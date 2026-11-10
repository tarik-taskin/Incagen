import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, chmodSync, lstatSync, writeFileSync, renameSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const PROJECT = "incagen-eeef4";
const UID = /^[a-zA-Z0-9_-]{20,128}$/;
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

// Her koşu ayrı özel dosyaya yazılır; yalnız sentetik kaynak kimlikleri tutulur, oturum bilgisi tutulmaz.
export function createAcceptanceJournal(purpose, directory = resolve(".incagen-local")) {
  assert.ok(["connectivity", "preparation", "tabular"].includes(purpose), "Unexpected journal purpose.");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  assert.ok(lstatSync(directory).isDirectory() && !lstatSync(directory).isSymbolicLink(), "Journal directory must be local.");
  chmodSync(directory, 0o700);
  const state = { version: 1, project: PROJECT, purpose, runId: randomUUID(), status: "pending", accounts: [] };
  const path = join(directory, `${purpose}-${state.runId}.json`);
  assert.ok(!existsSync(path), "Journal already exists.");

  // Aynı dizindeki atomik rename, yarım JSON'un önceki kaynak kaydını bozmasını önler.
  function persist() {
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify(state), { mode: 0o600, flag: "wx" });
      renameSync(temporary, path);
    } finally { rmSync(temporary, { force: true }); }
  }
  persist();
  return {
    path,
    // UID bilinir bilinmez kaydedilir; önceki koşuların dosyalarına dokunulmaz.
    account(uid) {
      assert.equal(state.status, "pending"); assert.ok(UID.test(uid), "Invalid synthetic UID.");
      if (!state.accounts.some(account => account.uid === uid)) {
        assert.ok(state.accounts.length < 10); state.accounts.push({ uid, ids: [] }); persist();
      }
    },
    // Analiz oluşturma yanıtı gelir gelmez kaynak kapsamını genişletir.
    analysis(uid, id) {
      assert.equal(state.status, "pending"); assert.ok(ID.test(id), "Invalid analysis ID.");
      const account = state.accounts.find(account => account.uid === uid); assert.ok(account, "Account must be recorded first.");
      if (!account.ids.includes(id)) { assert.ok(account.ids.length < 100); account.ids.push(id); persist(); }
    },
    // Temiz işareti yalnız Auth, Firestore ve Storage metadata kontrollerinin tümü geçince yazılır.
    async verifyClean(config, request) {
      assert.equal(state.status, "pending");
      await verifyAcceptanceCleanup(state.accounts, config, request);
      state.status = "verified-clean"; persist();
    },
  };
}

// CLI yetkisi yalnız bellekte kalır; özel anahtar veya sağlayıcı sırrı okunmaz.
async function metadataClient() {
  const cli = createRequire(import.meta.url)("firebase-tools/lib/auth");
  const account = cli.getProjectDefaultAccount(process.cwd()); assert.ok(account, "Firebase CLI login required.");
  const token = await cli.getAccessToken(account.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform"]);
  return (url, options = {}) => fetch(url, { ...options, headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(30_000) });
}

// Yalnız kaydedilmiş sentetik UID kapsamını okur; veri silme veya geniş proje taraması yapmaz.
export async function verifyAcceptanceCleanup(accounts, config, request) {
  assert.equal(config.projectId, PROJECT);
  assert.ok([`${PROJECT}.firebasestorage.app`, `${PROJECT}.appspot.com`].includes(config.storageBucket));
  assert.ok(accounts.length > 0 && accounts.length <= 10, "No synthetic accounts recorded.");
  for (const account of accounts) {
    assert.ok(UID.test(account.uid)); assert.ok(account.ids.length <= 100 && account.ids.every(id => ID.test(id)));
  }
  const read = request ?? await metadataClient();
  for (const { uid, ids } of accounts) {
    for (const id of ids) {
      const response = await read(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}/analyses/${id}`);
      assert.equal(response.status, 404, "Synthetic Firestore record remains or cannot be verified.");
    }
    for (const prefix of [`users/${uid}/`, `derived/${uid}/`]) {
      const response = await read(`https://storage.googleapis.com/storage/v1/b/${config.storageBucket}/o?prefix=${encodeURIComponent(prefix)}&maxResults=1`);
      assert.equal(response.status, 200); const body = await response.json();
      assert.ok(body && typeof body === "object" && !Array.isArray(body) && !body.error && (body.items === undefined || Array.isArray(body.items)), "Invalid storage metadata.");
      assert.equal(body.items?.length ?? 0, 0, "Synthetic storage remains.");
      assert.ok(!body.nextPageToken, "Synthetic storage listing is incomplete.");
    }
    const response = await read(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`, { method: "POST", body: JSON.stringify({ localId: [uid] }) });
    assert.equal(response.status, 200); const body = await response.json();
    assert.ok(body && typeof body === "object" && !Array.isArray(body) && !body.error && (body.users === undefined || Array.isArray(body.users)), "Invalid auth metadata.");
    assert.equal(body.users?.length ?? 0, 0, "Synthetic account remains.");
  }
}
