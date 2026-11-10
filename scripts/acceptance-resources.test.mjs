import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAcceptanceJournal, verifyAcceptanceCleanup } from "./acceptance-resources.mjs";
const uid = "synthetic-user-00000000001", id = "11111111-2222-4333-8444-555555555555";
const config = { projectId: "incagen-eeef4", storageBucket: "incagen-eeef4.firebasestorage.app" };
// Gerçek servis yerine yalnız belirli metadata yanıtlarını döndürür; hiçbir hesap oluşturmaz.
function empty(url) { return Promise.resolve(new Response(JSON.stringify({}), { status: url.includes("firestore.googleapis.com") ? 404 : 200 })); }
// Her test kendi özel dizinini kullanır ve çıkışta temizler.
function directory(t) { const dir = mkdtempSync(join(tmpdir(), "incagen-journal-")); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; }

test("separate runs preserve unfinished scopes with private atomic files", t => {
  const dir = directory(t), first = createAcceptanceJournal("preparation", dir);
  first.account(uid); first.analysis(uid, id);
  const before = readFileSync(first.path, "utf8");
  const next = createAcceptanceJournal("preparation", dir); next.account("synthetic-user-00000000002");
  assert.notEqual(first.path, next.path); assert.equal(readFileSync(first.path, "utf8"), before);
  assert.equal(statSync(dir).mode & 0o777, 0o700); assert.equal(statSync(first.path).mode & 0o777, 0o600);
  assert.equal(readdirSync(dir).length, 2); assert.ok(!readdirSync(dir).some(name => name.endsWith(".tmp")));
  const saved = JSON.parse(before);
  assert.deepEqual(Object.keys(saved).sort(), ["accounts", "project", "purpose", "runId", "status", "version"]);
  assert.deepEqual(saved.accounts, [{ uid, ids: [id] }]); assert.equal(saved.status, "pending");
});
test("invalid identifiers and out-of-scope writes fail without persisting caller data", t => {
  const journal = createAcceptanceJournal("tabular", directory(t));
  assert.throws(() => journal.account("person@example.test"));
  assert.throws(() => journal.analysis(uid, id)); journal.account(uid);
  assert.throws(() => journal.analysis(uid, "invalid")); journal.analysis(uid, id); journal.analysis(uid, id);
  assert.deepEqual(JSON.parse(readFileSync(journal.path)).accounts, [{ uid, ids: [id] }]);
});
test("cleanup checks exact scopes and marks clean only after all three services agree", async t => {
  const journal = createAcceptanceJournal("tabular", directory(t)); journal.account(uid); journal.analysis(uid, id);
  const calls = [];
  await journal.verifyClean(config, async (url, options) => { calls.push([url, options]); return empty(url); });
  assert.equal(calls.length, 4);
  assert.ok(calls[0][0].endsWith(`/users/${uid}/analyses/${id}`));
  assert.ok(calls.slice(1, 3).every(([url]) => new URL(url).searchParams.get("prefix").endsWith(`${uid}/`)));
  assert.deepEqual(JSON.parse(calls[3][1].body), { localId: [uid] });
  assert.equal(JSON.parse(readFileSync(journal.path)).status, "verified-clean");
  assert.throws(() => journal.account(uid));
});
test("remaining resources, unauthorized metadata and malformed lists keep cleanup pending", async t => {
  const dir = directory(t);
  for (const body of [null, [], { items: [{}] }, { nextPageToken: "more" }, { users: [{}] }, { users: {} }, { error: {} }]) {
    const journal = createAcceptanceJournal("connectivity", dir); journal.account(uid);
    await assert.rejects(journal.verifyClean(config, async () => new Response(JSON.stringify(body), { status: 200 })));
    assert.equal(JSON.parse(readFileSync(journal.path)).status, "pending");
  }
  const journal = createAcceptanceJournal("tabular", dir); journal.account(uid); journal.analysis(uid, id);
  await assert.rejects(journal.verifyClean(config, async () => new Response("{}", { status: 403 })));
  assert.equal(JSON.parse(readFileSync(journal.path)).status, "pending");
});
test("wrong project, empty scope and symlink journals are rejected", async t => {
  const dir = directory(t), journal = createAcceptanceJournal("tabular", dir);
  await assert.rejects(journal.verifyClean(config, empty)); journal.account(uid);
  await assert.rejects(journal.verifyClean({ ...config, projectId: "other" }, empty));
  const linked = join(dir, "linked"); symlinkSync(dir, linked);
  assert.throws(() => createAcceptanceJournal("tabular", linked));
});
