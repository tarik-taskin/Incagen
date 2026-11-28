import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { verifyGitStatus } from "./verify-release.mjs";

export const project = "incagen-eeef4";
export const region = "europe-west1";
export const projectNumber = "483199933468";
export const workerName = "incagen-extract";
export const workerIdentity = `${workerName}-runtime@${project}.iam.gserviceaccount.com`;
export const callerIdentity = `${projectNumber}-compute@developer.gserviceaccount.com`;
export const revisionScope = `projects/${project}/locations/${region}`;
export const workerResource = `${revisionScope}/services/${workerName}`;
export const workerUrl = `https://run.googleapis.com/v2/${workerResource}`;
export const imageName = `${region}-docker.pkg.dev/${project}/incagen-analysis/extract`;
export const selectedFunctions = ["prepareAnalysis", "startAnalysis", "getAnalysisTables", "getAnalysisResult"];
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const publicMembers = new Set(["allUsers", "allAuthenticatedUsers"]);

// Üretim planı yalnız net kapalı bayrak ve güvenilir HTTPS Cloud Run adresiyle hazırlanır.
export function inspectClosedEnvironment(text, { inviteBeta = false } = {}) {
  const keys = ["INCAGEN_TABULAR_ANALYSIS_ENABLED", "INCAGEN_PYTHON_WORKER_URL"];
  const env = parseEnv(text);
  if (keys.some(key => [...text.matchAll(new RegExp(`^ *${key} *=`, "gm"))].length !== 1)
    || env[keys[0]] !== String(inviteBeta) || Object.hasOwn(env, "GEMINI_API_KEY")) {
    throw new Error("Kapalı backend ortamı eksik, yinelenmiş veya uygunsuz.");
  }
  let url;
  try { url = new URL(env[keys[1]]); } catch { throw new Error("Cloud Run worker adresi geçersiz."); }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".run.app")
    || url.pathname !== "/" || url.username || url.password || url.search || url.hash || url.port) {
    throw new Error("Cloud Run worker adresi geçersiz.");
  }
  return { workerOrigin: url.origin };
}

// Firebase CLI oturumunu bellekte kullanır. Hata gövdeleri ve kimlik bilgileri çıktıya yazılmaz.
export function cloudRequest(root = process.cwd()) {
  const auth = createRequire(import.meta.url)("firebase-tools/lib/auth");
  let token;
  let refreshAt = 0;
  return async function request(url, options = {}) {
    if (!token || Date.now() >= refreshAt) {
      const account = auth.getProjectDefaultAccount(root);
      if (!account) throw new Error("Firebase CLI oturumu bulunamadı.");
      refreshAt = Date.now() + 25 * 60_000;
      token = auth.getAccessToken(account.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform"]).catch(() => {
        token = undefined;
        throw new Error("Firebase CLI yetkisi tazelenemedi.");
      });
    }
    const credentials = await token;
    let response;
    try {
      response = await fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(60000),
        headers: { Authorization: `Bearer ${credentials.access_token}`, "Content-Type": "application/json", ...options.headers } });
    } catch { throw new Error("Google Cloud isteği tamamlanamadı."); }
    if (!response.ok) throw new Error(`Google Cloud isteği reddedildi (HTTP ${response.status}).`);
    return response.json();
  };
}

// Beklenen özel worker’ın son hazır revizyonu, çalışma sınırları ve doğrudan IAM kanıtını okur.
export function verifyWorker(service, servicePolicy, projectPolicy) {
  const template = service?.template;
  const container = template?.containers?.[0];
  const digest = container?.image?.slice(imageName.length + 1);
  const revision = service?.latestReadyRevision?.split("/").at(-1);
  const traffic = service?.trafficStatuses;
  if (service?.name !== workerResource || service.reconciling === true
    || service.invokerIamDisabled === true || !revision || service.latestCreatedRevision !== service.latestReadyRevision
    || traffic?.length !== 1 || traffic[0].percent !== 100 || traffic[0].revision?.split("/").at(-1) !== revision
    || !container?.image?.startsWith(`${imageName}@`) || !digestPattern.test(digest)
    || template.serviceAccount !== workerIdentity || template.containers.length !== 1
    || template.maxInstanceRequestConcurrency !== 1 || template.scaling?.maxInstanceCount !== 1
    || (template.scaling?.minInstanceCount ?? 0) !== 0 || (service.scaling?.minInstanceCount ?? 0) !== 0
    || template.timeout !== "90s" || container.resources?.limits?.cpu !== "1"
    || !["1Gi", "1024Mi"].includes(container.resources?.limits?.memory) || container.env?.length) {
    throw new Error("Cloud Run worker revizyonu veya kaynak sınırları beklenen kapsamda değil.");
  }
  const bindings = servicePolicy?.bindings;
  if (!Array.isArray(bindings) || bindings.some(binding => binding.members?.some(member => publicMembers.has(member)))
    || !bindings.some(binding => binding.role === "roles/run.invoker" && !binding.condition
      && binding.members?.includes(`serviceAccount:${callerIdentity}`))) {
    throw new Error("Cloud Run özel erişimi veya çağıran servis rolü doğrulanamadı.");
  }
  if (!Array.isArray(projectPolicy?.bindings) || projectPolicy.bindings.some(binding => binding.members?.includes(`serviceAccount:${workerIdentity}`))) {
    throw new Error("Cloud Run çalışma kimliğinin proje IAM kapsamı doğrulanamadı.");
  }
  return { revision, digest, uri: service.uri };
}

// Servis ve proje IAM verilerini birbirinden bağımsız okur. Worker mutasyonu yapmaz.
export async function inspectWorker(request) {
  const [service, servicePolicy, projectPolicy] = await Promise.all([
    request(workerUrl),
    request(`${workerUrl}:getIamPolicy`),
    request(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}:getIamPolicy`, { method: "POST", body: "{}" }),
  ]);
  return { service, report: verifyWorker(service, servicePolicy, projectPolicy) };
}

// Fonksiyon başına yalnız sürüm ve kapalı politika kanıtı döndürür. Ortam değerlerini dışarı vermez.
export function verifyClosedFunctions(records, workerOrigin, { inviteBeta = false, expectedCommit } = {}) {
  return selectedFunctions.map(name => {
    const record = records.find(value => value.name === `${revisionScope}/functions/${name}`);
    const config = record?.serviceConfig;
    const env = config?.environmentVariables;
    if (record?.state !== "ACTIVE" || typeof record.updateTime !== "string"
      || env?.INCAGEN_TABULAR_ANALYSIS_ENABLED !== String(inviteBeta) || env.INCAGEN_PYTHON_WORKER_URL?.replace(/\/$/, "") !== workerOrigin
      || Object.hasOwn(env, "GEMINI_API_KEY") || config.secretEnvironmentVariables?.some(secret => secret.key === "GEMINI_API_KEY")
      || config.serviceAccountEmail !== callerIdentity) {
      throw new Error(`${name} için beklenen Functions ortamı doğrulanamadı.`);
    }
    const releaseCommit = typeof env.INCAGEN_BACKEND_RELEASE_SHA === "string" && /^[a-f0-9]{40}$/.test(env.INCAGEN_BACKEND_RELEASE_SHA)
      ? env.INCAGEN_BACKEND_RELEASE_SHA : null;
    if (expectedCommit && releaseCommit !== expectedCommit) throw new Error(`${name} için yayın SHA’sı doğrulanamadı.`);
    return { name, updatedAt: record.updateTime, revision: config.revision ?? null, releaseCommit };
  });
}

// Yalnız açık geri kapatma geçişinde dört bilinen ucun kimliğini ve worker bağını doğrulayıp açık/kapalı karışık bayrağı okur.
export function verifyRollbackFunctions(records, workerOrigin) {
  return selectedFunctions.map(name => {
    const record = records.find(value => value.name === `${revisionScope}/functions/${name}`);
    const config = record?.serviceConfig;
    const env = config?.environmentVariables;
    const flag = env?.INCAGEN_TABULAR_ANALYSIS_ENABLED;
    if (record?.state !== "ACTIVE" || typeof record.updateTime !== "string"
      || (flag !== "true" && flag !== "false") || env.INCAGEN_PYTHON_WORKER_URL?.replace(/\/$/, "") !== workerOrigin
      || Object.hasOwn(env, "GEMINI_API_KEY") || config.secretEnvironmentVariables?.some(secret => secret.key === "GEMINI_API_KEY")
      || config.serviceAccountEmail !== callerIdentity) {
      throw new Error(`${name} için geri kapatma ön koşulu doğrulanamadı.`);
    }
    const releaseCommit = typeof env.INCAGEN_BACKEND_RELEASE_SHA === "string" && commitPattern.test(env.INCAGEN_BACKEND_RELEASE_SHA)
      ? env.INCAGEN_BACKEND_RELEASE_SHA : null;
    return { name, updatedAt: record.updateTime, revision: config.revision ?? null, releaseCommit, analysisEnabled: flag === "true" };
  });
}

// Geri kapatma sonrası dört analiz ucunun hangilerinin kapalı ve beklenen SHA'da olduğunu sır sızdırmadan özetler.
export function summarizeRollbackStatus(records, workerOrigin, expectedCommit, unreadableNames = new Set()) {
  const closedEndpoints = [];
  const pendingEndpoints = [];
  for (const name of selectedFunctions) {
    if (unreadableNames.has(name)) {
      pendingEndpoints.push({ name, revision: null, releaseCommit: null, analysisEnabled: null, reason: "endpoint-read-failed" });
      continue;
    }
    const record = records.find(value => value?.name === `${revisionScope}/functions/${name}`);
    const config = record?.serviceConfig;
    const env = config?.environmentVariables;
    const releaseCommit = typeof env?.INCAGEN_BACKEND_RELEASE_SHA === "string" && commitPattern.test(env.INCAGEN_BACKEND_RELEASE_SHA)
      ? env.INCAGEN_BACKEND_RELEASE_SHA : null;
    const flag = env?.INCAGEN_TABULAR_ANALYSIS_ENABLED;
    const analysisEnabled = flag === "true" ? true : flag === "false" ? false : null;
    const validIdentity = record?.state === "ACTIVE" && typeof record.updateTime === "string"
      && env?.INCAGEN_PYTHON_WORKER_URL?.replace(/\/$/, "") === workerOrigin
      && !Object.hasOwn(env, "GEMINI_API_KEY") && !config?.secretEnvironmentVariables?.some(secret => secret.key === "GEMINI_API_KEY")
      && config?.serviceAccountEmail === callerIdentity;
    const entry = { name, revision: config?.revision ?? null, releaseCommit, analysisEnabled };
    if (validIdentity && analysisEnabled === false && releaseCommit === expectedCommit) {
      closedEndpoints.push(entry);
    } else {
      const reason = !record ? "missing-endpoint" : !validIdentity ? "invalid-configuration"
        : analysisEnabled !== false ? "analysis-still-open" : "commit-mismatch";
      pendingEndpoints.push({ ...entry, reason });
    }
  }
  return { allClosed: pendingEndpoints.length === 0 && closedEndpoints.length === selectedFunctions.length, closedEndpoints, pendingEndpoints };
}

const commitPattern = /^[a-f0-9]{40}$/;
const usageMessage = "Kullanım: npm run backend:check -- [--live [--invite-beta] [--expected-commit <40-karakter-SHA>]]";

// Kapalı ve davetli backend kontrolünün CLI bayraklarını kesin ve yinelenmesiz biçimde ayrıştırır.
export function parseClosedBackendArgs(args) {
  let live = false;
  let inviteBeta = false;
  let expectedCommit;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--live") {
      if (live) throw new Error(usageMessage);
      live = true;
    } else if (arg === "--invite-beta") {
      if (inviteBeta) throw new Error(usageMessage);
      inviteBeta = true;
    } else if (arg === "--expected-commit") {
      const value = args[index + 1];
      if (expectedCommit !== undefined || !value || !commitPattern.test(value)) throw new Error(usageMessage);
      expectedCommit = value;
      index += 1;
    } else if (arg.startsWith("--expected-commit=")) {
      const value = arg.slice("--expected-commit=".length);
      if (expectedCommit !== undefined || !commitPattern.test(value)) throw new Error(usageMessage);
      expectedCommit = value;
    } else {
      throw new Error(usageMessage);
    }
  }
  if ((inviteBeta || expectedCommit !== undefined) && !live) throw new Error(usageMessage);
  return { live, inviteBeta, expectedCommit };
}

// Temiz revizyon, kapalı ortam ve seçili hedefler doğrulanır. Canlı mod yalnız metadata okur.
export async function closedBackendPlan(args, root = process.cwd(), deps = {}) {
  const { live, inviteBeta, expectedCommit: requestedCommit } = parseClosedBackendArgs(args);
  const { commit } = (deps.verifyGit ?? verifyGitStatus)({ cwd: root });
  if (inviteBeta && requestedCommit && requestedCommit !== commit) {
    throw new Error("Davetli beta doğrulamasında --expected-commit güncel HEAD ile eşleşmelidir.");
  }
  const functionsDir = join(root, "functions");
  const readEnv = deps.readEnvFile ?? (path => readFileSync(path, "utf8"));
  const productionEnv = inspectClosedEnvironment(readEnv(join(functionsDir, `.env.${project}`)), { inviteBeta });
  const sharedPath = join(functionsDir, ".env");
  if ((deps.hasSharedEnv ?? existsSync)(sharedPath)) {
    const shared = parseEnv(readEnv(sharedPath));
    if (["GEMINI_API_KEY", "INCAGEN_TABULAR_ANALYSIS_ENABLED", "INCAGEN_PYTHON_WORKER_URL"].some(key => Object.hasOwn(shared, key))) {
      throw new Error("Ortak Functions ortamı üretim kontrolünü gölgeliyor.");
    }
  }
  const plan = { commit, project, region, analysisEnabled: inviteBeta, targets: selectedFunctions, liveVerified: false };
  if (!live) return plan;
  const request = deps.request ?? cloudRequest(root);
  const [worker, records] = await Promise.all([
    inspectWorker(request),
    Promise.all(selectedFunctions.map(name => request(`https://cloudfunctions.googleapis.com/v2/${revisionScope}/functions/${name}`))),
  ]);
  if (worker.report.uri?.replace(/\/$/, "") !== productionEnv.workerOrigin) {
    throw new Error("Canlı worker adresi kapalı ortamla eşleşmiyor.");
  }
  const { revision, digest } = worker.report;
  const enforcedCommit = requestedCommit ?? (inviteBeta ? commit : undefined);
  const functions = verifyClosedFunctions(records, productionEnv.workerOrigin, { inviteBeta, expectedCommit: enforcedCommit });
  const targetCommit = enforcedCommit ?? commit;
  return {
    ...plan,
    liveVerified: true,
    expectedCommit: enforcedCommit ?? null,
    commitMatched: functions.every(item => item.releaseCommit === targetCommit),
    worker: { revision, digest },
    functions,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  closedBackendPlan(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(JSON.stringify({ status: "failed", reason: error.code ? "Yayın ortamı okunamadı." : error.message }));
    process.exitCode = 1;
  });
}
