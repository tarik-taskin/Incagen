import assert from "node:assert/strict";
import test from "node:test";
import { selectWorkerFiles, workerBuildSource } from "./worker-build-source.mjs";

const allowed = ["python/Dockerfile", "python/.dockerignore", "python/requirements.runtime.lock", "python/worker_acceptance.py", "python/src/incagen_extract/m.py"];
const hash = "a".repeat(40);
const entry = (name, mode = "100644") => `${mode} blob ${hash}\t${name}\0`;

test("keeps Python and pinned runtime inputs while ignoring local settings, caches and files outside scope", () => {
  const tree = [...allowed, "python/.env", "python/.venv/secret.py", "python/src/__pycache__/module.pyc",
    "python/src/incagen_extract/.env", "python/tests/fixture.py"].map(name => entry(name)).join("");
  assert.deepEqual(selectWorkerFiles(tree), [...allowed].sort());
});

test("rejects missing content, symlink runtime paths, and non-full commits", () => {
  assert.throws(() => selectWorkerFiles(allowed.slice(1).map(name => entry(name)).join("")), /girdileri eksik/);
  assert.throws(() => selectWorkerFiles(allowed.map(name => entry(name, name.endsWith("/m.py") ? "120000" : "100644")).join("")), /normal Git dosyası/);
  assert.throws(() => workerBuildSource("HEAD"), /tam Git SHA/);
});
