import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { requireGeminiDeveloper } from "./gemini-diagnostic";
import { assertSyntheticSource, matchesSyntheticRequest, requireSyntheticGrant, trialFixtures, type SyntheticGrant } from "./tabular-acceptance";

const now = 1_790_000_000_000;
const id = "11111111-2222-4333-8444-555555555555";
const grant: SyntheticGrant = { id, format: "csv", locale: "tr", sha256: "a".repeat(64), expiresAt: now + 420_000 };
const token = { email: `table-${id}@example.test`, auth_time: now / 1000, incagenSyntheticReport: grant };
const req = { syntheticReportId: id };

it("allows a fresh isolated trial claim only on the synthetic route", () => {
  const auth = { uid: "synthetic-uid", token };
  expect(requireGeminiDeveloper(auth, req, now)).toBe(auth.uid);
  expect(requireSyntheticGrant(token, id, now)).toEqual(grant);
  expect(() => requireGeminiDeveloper(auth, {}, now)).toThrow("Geliştirici yetkisi");
  expect(() => requireGeminiDeveloper(auth, { ...req, tableFormat: "xlsx" }, now)).toThrow();
  expect(() => requireGeminiDeveloper({ ...auth, token: { ...token, auth_time: now / 1000 - 301 } }, req, now)).toThrow("Yeniden giriş");
});

it("rejects ordinary developers, the wrong identity, amended grant and long or expired grants", () => {
  for (const changed of [
    { ...token, incagenSyntheticReport: undefined, incagenDeveloper: true },
    { ...token, email: "normal-user@example.test" },
    { ...token, incagenSyntheticReport: { ...grant, expiresAt: now } },
    { ...token, incagenSyntheticReport: { ...grant, expiresAt: now + 600_001 } },
    { ...token, incagenSyntheticReport: { ...grant, mode: "arbitrary" } },
  ]) expect(() => requireSyntheticGrant(changed, id, now)).toThrow("sentetik rapor provası yetkisi");
  expect(() => requireSyntheticGrant(token, "different-id", now)).toThrow();
});

it("requires the fixed source, objective, report locale and table selection before reservation", () => {
  const spec = trialFixtures.csv;
  const csv = "Service,NetRevenue\nCloud,12000.10\nCloud,-500.10\nConsulting,5000.20\nConsulting,2500.30\n";
  const source = { id: "file-0", name: spec.name, sha256: createHash("sha256").update(csv).digest("hex"), size: Buffer.byteLength(csv) };
  const exactGrant = { ...grant, sha256: source.sha256 };
  const record = { title: "Synthetic service analysis", objective: spec.objective, report: { sources: [source] } };
  expect(() => assertSyntheticSource(exactGrant, source, record)).not.toThrow();
  expect(() => assertSyntheticSource(exactGrant, { ...source, sha256: "b".repeat(64) }, record)).toThrow();
  expect(() => assertSyntheticSource(exactGrant, source, { ...record, report: { sources: [source, source] } })).toThrow();
  expect(() => assertSyntheticSource(exactGrant, source, { ...record, objective: "Other objective" })).toThrow();
  expect(() => assertSyntheticSource(exactGrant, { ...source, size: 32_769 }, record)).toThrow();
  const changed = { ...source, sha256: "c".repeat(64) };
  expect(() => assertSyntheticSource({ ...grant, sha256: changed.sha256 }, changed, record)).toThrow();
  const input = { id, sourceId: "file-0", locale: "tr", selection: spec.selection };
  expect(matchesSyntheticRequest(grant, input, now)).toBe(true);
  expect(matchesSyntheticRequest(grant, { ...input, locale: "zh" }, now)).toBe(false);
  expect(matchesSyntheticRequest(grant, { ...input, selection: { ...input.selection, unit: "EUR" } }, now)).toBe(false);
});
