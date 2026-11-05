const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const auth = require("firebase-tools/lib/auth");

const root = path.resolve(__dirname, ".."), project = "incagen-eeef4", number = "483199933468", region = "europe-west1";
const workerName = "incagen-extract", runtimeEmail = `incagen-extract-runtime@${project}.iam.gserviceaccount.com`;
const callerEmail = `${number}-compute@developer.gserviceaccount.com`;
const repository = `projects/${project}/locations/${region}/repositories/incagen-analysis`;
const bucketName = `incagen-analysis-build-${number}`;
const serviceName = `projects/${project}/locations/${region}/services/${workerName}`;
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
let accessToken, expires = 0;

// Firebase CLI oturumunu bellekte kullanır; hiçbir token veya secret değeri çıktıya/dosyaya alınmaz.
async function request(url, options = {}, missingOkay = false) {
  if (Date.now() > expires) {
    const account = auth.getProjectDefaultAccount(root);
    if (!account) throw new Error("Firebase CLI login required.");
    const token = await auth.getAccessToken(account.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform"]);
    accessToken = token.access_token; expires = Date.now() + 30 * 60_000;
  }
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...options.headers }, signal: AbortSignal.timeout(60_000) });
  if (response.status === 404 && missingOkay) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Cloud request failed: ${response.status} ${result.error?.status || "unknown"}`);
  return result;
}

// Yalnız hedef kaynak üzerinde role ekler; mevcut etag korunur, public principal varsa durur.
async function grant(url, role, member) {
  const policy = await request(`${url}:getIamPolicy`);
  if ((policy.bindings || []).some(binding => binding.members?.some(value => value === "allUsers" || value === "allAuthenticatedUsers"))) throw new Error("Public IAM policy requires manual review.");
  policy.bindings ||= [];
  let binding = policy.bindings.find(value => value.role === role && !value.condition);
  if (!binding) { binding = { role, members: [] }; policy.bindings.push(binding); }
  if (!binding.members.includes(member)) { binding.members.push(member); await request(`${url}:setIamPolicy`, { method: "POST", body: JSON.stringify({ policy }) }); }
}

// Uzun işlemleri sınırlı süre izler; ayrıntılı sağlayıcı günlükleri yerine yalnız durum bildirir.
async function operation(api, value) {
  const deadline = Date.now() + 12 * 60_000;
  while (!value.done) {
    if (Date.now() > deadline) throw new Error("Cloud operation timed out; inspect the saved operation name.");
    await sleep(5000); value = await request(`${api}/${value.name}`);
  }
  if (value.error) throw new Error(`Cloud operation failed: ${value.error.code}`);
  return value.response;
}

// Build bağlamına yalnız Python kaynakları ve hash kilidi girer; ortamlar, Git, testler ve venv dışarıda kalır.
function contextArchive() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "incagen-worker-build-"));
  const files = ["Dockerfile", ".dockerignore", "requirements.runtime.lock"];
  const visit = directory => { for (const entry of fs.readdirSync(path.join(root, "python", directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory() && entry.name !== "__pycache__") visit(relative);
    else if (entry.isFile() && entry.name.endsWith(".py")) files.push(relative);
  } };
  visit("src");
  const archive = path.join(temporary, "source.tgz");
  execFileSync("tar", ["-czf", archive, "-C", path.join(root, "python"), ...files]);
  return { temporary, archive, hash: createHash("sha256").update(fs.readFileSync(archive)).digest("hex") };
}

// Ayrı, veri/secret yetkisi olmayan runtime kimliğiyle özel Cloud Run işçisini dağıtır.
async function main() {
  const projectPolicy = await request(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}:getIamPolicy`, { method: "POST", body: "{}" });
  if ((projectPolicy.bindings || []).some(binding => binding.members?.includes(`serviceAccount:${runtimeEmail}`))) throw new Error("Extraction runtime has project-level roles; review before deployment.");
  const iam = `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${runtimeEmail}`;
  if (!await request(iam, {}, true)) await request(`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`, { method: "POST", body: JSON.stringify({ accountId: "incagen-extract-runtime", serviceAccount: { displayName: "Incagen private extraction worker" } }) });
  const repoUrl = `https://artifactregistry.googleapis.com/v1/${repository}`;
  if (!await request(repoUrl, {}, true)) await operation("https://artifactregistry.googleapis.com/v1", await request(`https://artifactregistry.googleapis.com/v1/projects/${project}/locations/${region}/repositories?repositoryId=incagen-analysis`, { method: "POST", body: JSON.stringify({ format: "DOCKER", description: "Incagen Python extraction images", dockerConfig: { immutableTags: true } }) }));
  const bucketUrl = `https://storage.googleapis.com/storage/v1/b/${bucketName}`;
  const existingBucket = await request(bucketUrl, {}, true);
  if (existingBucket && (!existingBucket.iamConfiguration?.uniformBucketLevelAccess?.enabled || existingBucket.iamConfiguration?.publicAccessPrevention !== "enforced")) throw new Error("Existing build bucket does not meet private access requirements.");
  if (!existingBucket) await request(`https://storage.googleapis.com/storage/v1/b?project=${project}`, { method: "POST", body: JSON.stringify({ name: bucketName, location: "EU", iamConfiguration: { uniformBucketLevelAccess: { enabled: true }, publicAccessPrevention: "enforced" }, lifecycle: { rule: [{ action: { type: "Delete" }, condition: { age: 1 } }] } }) });
  await grant(repoUrl, "roles/artifactregistry.writer", `serviceAccount:${callerEmail}`);
  // GCS IAM uses a different REST shape; only the source-build reader is granted here.
  const bucketPolicy = await request(`${bucketUrl}/iam`);
  bucketPolicy.bindings ||= [];
  if (bucketPolicy.bindings.some(binding => binding.members?.some(value => ["allUsers", "allAuthenticatedUsers"].includes(value)))) throw new Error("Public build bucket policy requires manual review.");
  let viewer = bucketPolicy.bindings.find(binding => binding.role === "roles/storage.objectViewer");
  if (!viewer) { viewer = { role: "roles/storage.objectViewer", members: [] }; bucketPolicy.bindings.push(viewer); }
  if (!viewer.members.includes(`serviceAccount:${callerEmail}`)) { viewer.members.push(`serviceAccount:${callerEmail}`); await request(`${bucketUrl}/iam`, { method: "PUT", body: JSON.stringify(bucketPolicy) }); }
  const context = contextArchive(), tag = `source-${context.hash.slice(0, 20)}`, image = `${region}-docker.pkg.dev/${project}/incagen-analysis/extract:${tag}`;
  let digest;
  try {
    const object = `${tag}.tgz`;
    await request(`https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${object}`, { method: "POST", headers: { "Content-Type": "application/gzip" }, body: fs.readFileSync(context.archive) });
    const started = await request(`https://cloudbuild.googleapis.com/v1/projects/${project}/locations/${region}/builds`, { method: "POST", body: JSON.stringify({
      source: { storageSource: { bucket: bucketName, object } }, serviceAccount: `projects/${project}/serviceAccounts/${callerEmail}`,
      steps: [{ name: "gcr.io/cloud-builders/docker", args: ["build", "-t", image, "."] }], images: [image], timeout: "600s", options: { logging: "CLOUD_LOGGING_ONLY" },
    }) });
    const buildId = started.metadata?.build?.id;
    if (!buildId) throw new Error("Missing build ID.");
    fs.writeFileSync("/tmp/incagen-python-build.json", JSON.stringify({ buildId, image, project, region }));
    let last;
    const deadline = Date.now() + 12 * 60_000;
    while (true) {
      const build = await request(`https://cloudbuild.googleapis.com/v1/projects/${project}/locations/${region}/builds/${buildId}`);
      if (build.status !== last) { console.log(JSON.stringify({ phase: "build", id: buildId, status: build.status })); last = build.status; }
      if (build.status === "SUCCESS") { digest = build.results?.images?.[0]?.digest; break; }
      if (["FAILURE", "TIMEOUT", "CANCELLED", "INTERNAL_ERROR", "EXPIRED"].includes(build.status) || Date.now() > deadline) throw new Error(`Build failed: ${build.status}`);
      await sleep(10_000);
    }
  } finally { fs.rmSync(context.temporary, { recursive: true, force: true }); }
  if (!/^sha256:[a-f0-9]{64}$/.test(digest || "")) throw new Error("Missing immutable image digest.");
  const runUrl = `https://run.googleapis.com/v2/${serviceName}`;
  const current = await request(runUrl, {}, true);
  if (current && current.template?.serviceAccount !== runtimeEmail) throw new Error("Existing service has an unexpected runtime identity.");
  const service = { name: serviceName, ingress: "INGRESS_TRAFFIC_ALL", invokerIamDisabled: false, template: {
    serviceAccount: runtimeEmail, timeout: "90s", maxInstanceRequestConcurrency: 1, scaling: { minInstanceCount: 0, maxInstanceCount: 1 },
    containers: [{ image: `${region}-docker.pkg.dev/${project}/incagen-analysis/extract@${digest}`, ports: [{ containerPort: 8080 }], resources: { limits: { cpu: "1", memory: "1Gi" }, cpuIdle: true }, startupProbe: { httpGet: { path: "/healthz", port: 8080 }, periodSeconds: 3, failureThreshold: 20 } }],
  } };
  await operation("https://run.googleapis.com/v2", await request(current ? `${runUrl}?updateMask=template,ingress,invokerIamDisabled` : `https://run.googleapis.com/v2/projects/${project}/locations/${region}/services?serviceId=${workerName}`, { method: current ? "PATCH" : "POST", body: JSON.stringify(service) }));
  await grant(`https://run.googleapis.com/v2/${serviceName}`, "roles/run.invoker", `serviceAccount:${callerEmail}`);
  const deployed = await request(runUrl);
  const configFile = path.join(root, "functions", `.env.${project}`);
  let config = fs.existsSync(configFile) ? fs.readFileSync(configFile, "utf8") : "";
  config = config.replace(/^INCAGEN_PYTHON_WORKER_URL=.*(?:\r?\n|$)/gm, "").trimEnd();
  fs.writeFileSync(configFile, `${config}${config ? "\n" : ""}INCAGEN_PYTHON_WORKER_URL=${deployed.uri}\n`, { mode: 0o600 });
  fs.chmodSync(configFile, 0o600);
  fs.writeFileSync("/tmp/incagen-python-worker-deploy.json", JSON.stringify({ serviceName, uri: deployed.uri, runtimeEmail, digest }));
  console.log(JSON.stringify({ phase: "ready", service: serviceName, uri: deployed.uri, privateIam: true, maxInstances: 1, concurrency: 1, runtimeSecrets: false }));
}

// --plan yalnız sabit hedefleri gösterir; oturum okumaz, ağ isteği veya bulut değişikliği yapmaz.
if (process.argv.includes("--plan")) console.log(JSON.stringify({ project, region, worker: workerName, runtimeEmail, buildBucket: bucketName, imageRepository: repository, cpu: 1, memory: "1GiB", maxInstances: 1, concurrency: 1, timeoutSeconds: 90, privateIam: true, callerEmail, permissions: ["artifactregistry.writer (image repository only)", "storage.objectViewer (build source bucket only)", "run.invoker (worker only)"] }, null, 2));
else main().catch(error => { console.error(error.message); process.exitCode = 1; });
