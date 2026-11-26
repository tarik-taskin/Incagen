import assert from "node:assert/strict";
import test from "node:test";
import { imageName, projectNumber, workerResource } from "./closed-backend.mjs";
import { requireBuildImage, workerImagePatch } from "./refresh-private-worker.mjs";

const digest = "sha256:" + "a".repeat(64);
const expected = { id: "test-build", object: "source-test.tgz", generation: "123", tag: `${imageName}:source-test` };

test("requires successful build provenance and a single immutable artifact from the recorded input", () => {
  const build = { status: "SUCCESS", id: expected.id, sourceProvenance: { resolvedStorageSource: {
    bucket: `incagen-analysis-build-${projectNumber}`, object: expected.object, generation: expected.generation,
  } }, results: { images: [{ name: expected.tag, digest }] } };
  assert.equal(requireBuildImage(build, expected), digest);
  assert.throws(() => requireBuildImage(build, { ...expected, generation: "456" }), /eşleşmiyor/);
  assert.throws(() => requireBuildImage({ ...build, status: "FAILURE" }, expected), /eşleşmiyor/);
  assert.throws(() => requireBuildImage({ ...build, results: { images: [] } }, expected), /eşleşmiyor/);
});

test("only patches the existing worker image and refuses a concurrent service change", () => {
  const service = { name: workerResource, etag: "before", invokerIamDisabled: false, template: {
    containers: [{ image: `${imageName}:previous`, ports: [{ containerPort: 8080 }] }], maxInstanceRequestConcurrency: 1,
  } };
  assert.deepEqual(workerImagePatch(service, service, digest), { name: service.name, etag: service.etag, template: {
    containers: [{ image: `${imageName}@${digest}`, ports: [{ containerPort: 8080 }] }],
  } });
  assert.throws(() => workerImagePatch(service, { ...service, etag: "current" }, digest), /değişti/);
  assert.throws(() => workerImagePatch(service, service, "tag"), /doğrulanamadı/);
});
