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
export function inspectClosedEnvironment(text) {
  const keys = ["INCAGEN_TABULAR_ANALYSIS_ENABLED", "INCAGEN_PYTHON_WORKER_URL"];
  const env = parseEnv(text);
  if (keys.some(key => [...text.matchAll(new RegExp(`^ *${key} *=`, "gm"))].length !== 1)
    || env[keys[0]] !== "false" || Object.hasOwn(env, "GEMINI_API_KEY")) {
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
export function verifyClosedFunctions(records, workerOrigin) {
  return selectedFunctions.map(name => {
    const record = records.find(value => value.name === `${revisionScope}/functions/${name}`);
    const config = record?.serviceConfig;
    const env = config?.environmentVariables;
    if (record?.state !== "ACTIVE" || typeof record.updateTime !== "string"
      || env?.INCAGEN_TABULAR_ANALYSIS_ENABLED !== "false" || env.INCAGEN_PYTHON_WORKER_URL?.replace(/\/$/, "") !== workerOrigin
      || Object.hasOwn(env, "GEMINI_API_KEY") || config.secretEnvironmentVariables?.some(secret => secret.key === "GEMINI_API_KEY")
      || config.serviceAccountEmail !== callerIdentity) {
      throw new Error(`${name} için kapalı Functions ortamı doğrulanamadı.`);
    }
    return { name, updatedAt: record.updateTime, revision: config.revision ?? null };
  });
}

// Temiz revizyon, kapalı ortam ve seçili hedefler doğrulanır. Canlı mod yalnız metadata okur.
export async function closedBackendPlan(args, root = process.cwd()) {
  if (!(args.length === 0 || args.length === 1 && args[0] === "--live")) throw new Error("Kullanım: npm run backend:check -- [--live]");
  const { commit } = verifyGitStatus({ cwd: root });
  const functionsDir = join(root, "functions");
  const productionEnv = inspectClosedEnvironment(readFileSync(join(functionsDir, `.env.${project}`), "utf8"));
  const sharedPath = join(functionsDir, ".env");
  if (existsSync(sharedPath)) {
    const shared = parseEnv(readFileSync(sharedPath, "utf8"));
    if (["GEMINI_API_KEY", "INCAGEN_TABULAR_ANALYSIS_ENABLED", "INCAGEN_PYTHON_WORKER_URL"].some(key => Object.hasOwn(shared, key))) {
      throw new Error("Ortak Functions ortamı üretim kontrolünü gölgeliyor.");
    }
  }
  const plan = { commit, project, region, analysisEnabled: false, targets: selectedFunctions, liveVerified: false };
  if (args.length === 0) return plan;
  const request = cloudRequest(root);
  const [worker, records] = await Promise.all([
    inspectWorker(request),
    Promise.all(selectedFunctions.map(name => request(`https://cloudfunctions.googleapis.com/v2/${revisionScope}/functions/${name}`))),
  ]);
  if (worker.report.uri?.replace(/\/$/, "") !== productionEnv.workerOrigin) {
    throw new Error("Canlı worker adresi kapalı ortamla eşleşmiyor.");
  }
  const { revision, digest } = worker.report;
  return { ...plan, liveVerified: true, worker: { revision, digest }, functions: verifyClosedFunctions(records, productionEnv.workerOrigin) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  closedBackendPlan(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(JSON.stringify({ status: "failed", reason: error.code ? "Yayın ortamı okunamadı." : error.message }));
    process.exitCode = 1;
  });
}
