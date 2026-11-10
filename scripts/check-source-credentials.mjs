#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Yalnız ayırt edilebilir credential biçimleri aranır; eşleşen değer hiçbir sonuç/günlüğe girmez.
const patterns = [
  ["google-api-key", /AIza[A-Za-z0-9_-]{35}/g],
  ["github-token", /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})/g],
  ["aws-access-key", /(?:AKIA|ASIA)[A-Z0-9]{16}/g],
  ["google-oauth-token", /ya29\.[A-Za-z0-9_-]{20,}/g],
  ["private-key-material", /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----(?:\s|\\r|\\n)+[A-Za-z0-9+/=]{32,}/g],
];

// Testte kullanılan çıplak PEM başlığını anahtar sanmaz; gerçek gövde, gerçek/escaped satır sonunda da yakalanır.
export function scanCredentialPatterns(bytes, path, location) {
  const content = bytes.toString("utf8"), findings = [];
  const safePath = patterns.reduce((value, [kind, pattern]) => value.replace(pattern, `[${kind}-redacted]`), path);
  for (const [kind, pattern] of patterns) for (const match of content.matchAll(pattern)) {
    findings.push({ path: safePath, location, line: content.slice(0, match.index).split("\n").length, kind });
  }
  return findings;
}

// Index blob'larını tek Git çağrısıyla okur; isimler shell'e girmez, symlink hedefi takip edilmez.
function readIndex(cwd) {
  const entries = execFileSync("git", ["ls-files", "--stage", "-z"], { cwd, encoding: "utf8" }).split("\0").filter(Boolean).map(entry => {
    const tab = entry.indexOf("\t"), metadata = entry.slice(0, tab).split(" ");
    assert.ok(tab > 0 && metadata.length === 3 && metadata[2] === "0", "Çakışan Git index'i taranamaz.");
    assert.match(metadata[1], /^[a-f0-9]{40,64}$/);
    assert.ok(["100644", "100755", "120000"].includes(metadata[0]), "Alt modül içeriği ayrıca taranmalı.");
    return { path: entry.slice(tab + 1), object: metadata[1] };
  });
  if (!entries.length) return [];
  const output = execFileSync("git", ["cat-file", "--batch"], { cwd, input: entries.map(entry => entry.object).join("\n") + "\n", maxBuffer: 128 * 1024 * 1024 });
  let offset = 0;
  return entries.map(entry => {
    const end = output.indexOf(10, offset), header = output.subarray(offset, end).toString("ascii");
    assert.ok(end >= offset);
    const [object, type, length] = header.split(" "), size = Number(length);
    assert.ok(object === entry.object && type === "blob" && Number.isSafeInteger(size) && size >= 0);
    const start = end + 1; offset = start + size + 1;
    assert.ok(offset <= output.length && output[offset - 1] === 10);
    return { ...entry, bytes: output.subarray(start, start + size) };
  });
}

// Hem stage edilmiş içeriği hem takip edilen çalışma dosyasını sınar; .env gibi Git dışı dosyalar okunmaz.
function scanTrackedSources({ cwd = process.cwd() } = {}) {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }).trim();
  const entries = readIndex(root), findings = [];
  for (const entry of entries) {
    findings.push(...scanCredentialPatterns(Buffer.from(entry.path), entry.path, "path"));
    findings.push(...scanCredentialPatterns(entry.bytes, entry.path, "index"));
    const file = join(root, entry.path);
    let stat;
    try { stat = lstatSync(file); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    if (!stat.isFile()) continue;
    const bytes = readFileSync(file);
    if (!bytes.equals(entry.bytes)) findings.push(...scanCredentialPatterns(bytes, entry.path, "worktree"));
  }
  return { checkedFiles: entries.length, findings };
}

// Dosya sistemi/Git hataları dosya adındaki credential'ı üst çağrıların günlüklerine taşıyamaz.
export function checkSourceCredentials(options = {}) {
  try { return scanTrackedSources(options); }
  catch { throw new Error("Kaynak credential taraması tamamlanamadı; Git index'ini ve dosya erişimini kontrol edin."); }
}

// Başarısızlıkta yalnız dosya/satır/tür döner; credential değeri veya içerik alıntısı gösterilmez.
export function runSourceCredentialCheck(args = process.argv.slice(2), options = {}) {
  assert.equal(args.length, 0, "Kaynak credential kontrolünde atlama/allowlist seçeneği yoktur.");
  const result = checkSourceCredentials(options);
  console.log(JSON.stringify(result));
  if (result.findings.length) process.exitCode = 1;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { runSourceCredentialCheck(); }
  catch { console.error("Kaynak credential taraması tamamlanamadı; Git index'ini ve kapsam sınırlarını kontrol edin."); process.exitCode = 1; }
}
