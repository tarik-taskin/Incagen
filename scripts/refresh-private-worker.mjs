import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { writePrivateJson } from "./acceptance-resources.mjs";
import { callerIdentity, closedBackendPlan, cloudRequest, imageName, inspectWorker, project,
  projectNumber, revisionScope, workerResource, workerUrl } from "./closed-backend.mjs";
import { workerBuildSource } from "./worker-build-source.mjs";

const bucket = `incagen-analysis-build-${projectNumber}`;
const buildUrl = `https://cloudbuild.googleapis.com/v1/${revisionScope}/builds`;

// Selects only the image produced by this build and the exact uploaded source generation.
export function requireBuildImage(record, expected) {
  const input = record?.sourceProvenance?.resolvedStorageSource;
  const images = record?.results?.images;
  const image = Array.isArray(images) && images.length === 1 ? images[0] : null;
  if (record?.status !== "SUCCESS" || record.id !== expected.id || input?.bucket !== bucket || input.object !== expected.object
    || String(input.generation) !== expected.generation || image?.name !== expected.tag || !/^sha256:[a-f0-9]{64}$/.test(image.digest)) {
    throw new Error("Cloud Build çıktısı doğrulanmış arşiv veya image ile eşleşmiyor.");
  }
  return image.digest;
}

// Değişiklik yarışında durur. Trafik, IAM ve ölçekleme alanlarını taşımaz.
export function workerImagePatch(original, current, digest) {
  if (current?.name !== workerResource || !original?.etag || original.etag !== current.etag || !/^sha256:[a-f0-9]{64}$/.test(digest)) {
    throw new Error("Worker revizyonu hazırlık sırasında değişti veya image doğrulanamadı.");
  }
  return { name: workerResource, etag: original.etag, template: {
    containers: [{ ...current.template.containers[0], image: `${imageName}@${digest}` }],
  } };
}

// İlgili operasyonu sınırlı bir zaman penceresinde okur ve yalnız durumunu kaydeder.
async function waitFor(read, done, save) {
  const deadline = Date.now() + 12 * 60_000;
  while (Date.now() < deadline) {
    const state = await read();
    save(state);
    if (done(state)) return state;
    await delay(8000);
  }
  throw new Error("Bulut operasyonu bekleme süresini aştı. Koşu kaydını kontrol edin.");
}

// Mevcut özel worker’ı doğrulanmış image ile yeniler. IAM ve yerel env dosyalarına yazmaz.
async function refresh(args) {
  assert.ok(args.length === 0 && process.env.INCAGEN_CLOSED_WORKER_REFRESH === "1", "Kapalı worker yenilemesi açık onay gerektirir.");
  const plan = await closedBackendPlan(["--live"]);
  const request = cloudRequest();
  const initial = await inspectWorker(request);
  const before = initial.report;
  const source = workerBuildSource(plan.commit);
  const run = randomUUID().slice(0, 8);
  const object = `source-${source.sha256}-${run}.tgz`;
  const tag = `${imageName}:source-${source.sha256.slice(0, 20)}-${run}`;
  const local = resolve(".incagen-local");
  mkdirSync(local, { recursive: true, mode: 0o700 });
  assert.ok(lstatSync(local).isDirectory() && !lstatSync(local).isSymbolicLink(), "Yayın günlüğü dizini geçersiz.");
  const directory = mkdtempSync(join(local, "worker-refresh-"));
  const state = { commit: plan.commit, sourceSha256: source.sha256, before: { revision: before.revision, digest: before.digest }, tag };
  function persist(values) {
    Object.assign(state, values);
    writePrivateJson(join(directory, "worker-release.json"), state);
    console.log(JSON.stringify(values));
  }
  persist({ phase: "worker-refresh", directory });

  const upload = await request(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${object}&ifGenerationMatch=0`, {
    method: "POST", headers: { "Content-Type": "application/gzip" }, body: source.bytes,
  });
  const generation = String(upload.generation);
  assert.ok(/^[0-9]+$/.test(generation), "Build kaynak nesnesinin sürümü eksik.");
  const operation = await request(buildUrl, {
    method: "POST",
    body: JSON.stringify({
      source: { storageSource: { bucket, object, generation } },
      serviceAccount: `projects/${project}/serviceAccounts/${callerIdentity}`,
      steps: [
        { name: "gcr.io/cloud-builders/docker", dir: "python", args: ["build", "-t", tag, "."] },
        { name: "gcr.io/cloud-builders/docker", args: ["run", "--rm", "--network=none", "--memory=1g", "--cpus=1", "--entrypoint", "python", tag, "-c", source.acceptanceCode] },
      ],
      images: [tag], timeout: "600s", options: { logging: "CLOUD_LOGGING_ONLY" },
    }),
  });
  const id = operation.metadata?.build?.id;
  assert.ok(/^[a-f0-9-]{36}$/.test(id), "Cloud Build kimliği bulunamadı.");
  persist({ phase: "build-started", buildId: id, object, generation });

  const output = await waitFor(() => request(`${buildUrl}/${id}`),
    result => ["SUCCESS", "FAILURE", "TIMEOUT", "CANCELLED", "INTERNAL_ERROR", "EXPIRED"].includes(result.status), result => {
      if (state.buildStatus !== result.status) persist({ buildStatus: result.status });
    });
  const digest = requireBuildImage(output, { id, object, generation, tag });
  persist({ phase: "image-verified", candidateDigest: digest });
  const current = await inspectWorker(request);
  const patch = workerImagePatch(initial.service, current.service, digest);
  const update = await request(`${workerUrl}?updateMask=template.containers`, { method: "PATCH", body: JSON.stringify(patch) });
  assert.ok(typeof update.name === "string" && update.name.startsWith(`${revisionScope}/operations/`), "Cloud Run operasyon kimliği geçersiz.");
  persist({ phase: "worker-update-started", operation: update.name });
  const finished = update.done ? update : await waitFor(() => request(`https://run.googleapis.com/v2/${update.name}`), result => result.done, () => {});
  assert.ok(!finished.error, "Cloud Run worker yenilemesi başarısız.");
  const final = await inspectWorker(request);
  assert.equal(final.report.digest, digest);
  assert.equal(final.report.uri, before.uri);
  assert.notEqual(final.report.revision, before.revision);
  persist({ phase: "verified", after: { revision: final.report.revision, digest: final.report.digest } });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  refresh(process.argv.slice(2)).catch(error => {
    console.error(JSON.stringify({ status: "failed", reason: error.code && error.code !== "ERR_ASSERTION" ? "Yenileme tamamlanamadı." : error.message }));
    process.exitCode = 1;
  });
}
