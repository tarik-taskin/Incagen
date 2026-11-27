import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { resultLocaleSchema, type TableSelection, type WorkerResult } from "./tabular-contract";

const syntheticAccount = /^table-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}@example\.test$/;
const grantLifetimeMs = 10 * 60_000;
export const syntheticGrantSchema = z.object({
  id: z.string().uuid(), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  format: z.enum(["csv", "xlsx"]), locale: resultLocaleSchema, expiresAt: z.number().int().positive(),
}).strict();
export type SyntheticGrant = z.infer<typeof syntheticGrantSchema>;

const commonSelection = { valueColumn: 1, groupColumn: 0, numberFormat: "plain" } as const;
type Fixture = { name: string; objective: string; measure: string; group: string; selection: TableSelection; aggregate: number;
  rows: number[]; groups: { label: string; value: number; rows: number[] }[]; cells: (string | number)[][] };
export const trialFixtures = {
  csv: { name: "synthetic-service-revenue.csv", objective: "Compare recorded net revenue across service lines. Explain which profitability conclusions cannot be supported without cost data.",
    measure: "NetRevenue", group: "Service", selection: { ...commonSelection, sheet: null, aggregation: "sum", unit: "USD" },
    cells: [["Cloud", "12000.10"], ["Cloud", "-500.10"], ["Consulting", "5000.20"], ["Consulting", "2500.30"]],
    aggregate: 19000.5, rows: [2, 3, 4, 5], groups: [{ label: "Cloud", value: 11500, rows: [2, 3] }, { label: "Consulting", value: 7500.5, rows: [4, 5] }] },
  xlsx: { name: "synthetic-service-teams.xlsx", objective: "Compare the unweighted average amount per team on the Services worksheet. Explain which business conclusions need additional evidence.",
    measure: "Amount", group: "Team", selection: { ...commonSelection, sheet: "Services", aggregation: "mean", unit: "EUR" },
    cells: [["A", 10], ["A", 20], ["B", 90]],
    aggregate: 40, rows: [2, 3, 4], groups: [{ label: "B", value: 90, rows: [4] }, { label: "A", value: 15, rows: [2, 3] }] },
} satisfies Record<SyntheticGrant["format"], Fixture>;
const csvFixture = ["Service,NetRevenue", ...trialFixtures.csv.cells.map(row => row.join(","))].join("\n") + "\n";
const csvFixtureHash = createHash("sha256").update(csvFixture).digest("hex");

// Geliştirici iznine ek olarak yalnız kayıtlı sentetik hesap, tek çalışma ve kısa süreli claim kabul edilir.
export function requireSyntheticGrant(token: Record<string, unknown>, id: string, now = Date.now()): SyntheticGrant {
  const parsed = syntheticGrantSchema.safeParse(token.incagenSyntheticReport);
  if (typeof token.email !== "string" || !syntheticAccount.test(token.email)
    || !parsed.success || parsed.data.id !== id || parsed.data.expiresAt <= now || parsed.data.expiresAt > now + grantLifetimeMs) {
    throw new HttpsError("permission-denied", "Geçerli sentetik rapor provası yetkisi gerekli.");
  }
  return parsed.data;
}

// Hazır belgenin kimlik, dosya, hedef ve hash bağını herhangi bir hesap veya model çağrısı öncesi doğrular.
export function assertSyntheticSource(grant: SyntheticGrant, source: { id: string; name: string; sha256: string; size: number },
  record: { title?: string; objective?: string; report: { sources: unknown[] } }) {
  const fixture = trialFixtures[grant.format];
  if (record.report.sources.length !== 1 || record.title !== "Synthetic service analysis" || record.objective !== fixture.objective
    || source.id !== "file-0" || source.name !== fixture.name || source.sha256 !== grant.sha256
    || !Number.isSafeInteger(source.size) || source.size <= 0 || source.size > 32 * 1024
    || (grant.format === "csv" && (source.sha256 !== csvFixtureHash || source.size !== Buffer.byteLength(csvFixture)))) {
    throw new HttpsError("failed-precondition", "Hazırlanan kaynak sentetik kabul vakasıyla eşleşmiyor.");
  }
}

// Doğrulanmış toplam eşleşse bile farklı kaynak hücreleri veya tablo alanları modele ilerleyemez.
export function verifySyntheticCells(worker: WorkerResult, format: SyntheticGrant["format"]) {
  const fixture = trialFixtures[format];
  const expectedColumns = [fixture.group, fixture.measure];
  return worker.scope.measure === fixture.measure && worker.scope.group === fixture.group
    && worker.document.chunks.every(chunk => chunk.kind === "table" && isDeepStrictEqual(chunk.table?.columns, expectedColumns))
    && isDeepStrictEqual(worker.document.chunks.flatMap(chunk => chunk.table?.rows ?? []), fixture.cells);
}

// İç çağrı da grant’teki tek kayıt, dil, dosya ve sunucu seçiminden sapamaz.
export function matchesSyntheticRequest(grant: SyntheticGrant, input: { id: string; locale: string; sourceId: string; selection: TableSelection }, now = Date.now()) {
  return grant.id === input.id && grant.locale === input.locale && input.sourceId === "file-0" && grant.expiresAt > now
    && isDeepStrictEqual(input.selection, trialFixtures[grant.format].selection);
}
