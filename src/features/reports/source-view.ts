import type { Evidence, ReportSource } from "./source-dialog";

// Görüntülenen dayanak aynı belge sürümüne ve özgün parça/konum aralığına ait olmalıdır.
export function matchesEvidence(source: ReportSource, evidence: Evidence[number]): boolean {
  if (source.sourceId !== evidence.sourceId || source.sha256 !== evidence.sha256) return false;
  const chunk = source.chunks.find(item => item.id === evidence.chunkId);
  if (!chunk) return false;
  const expected = chunk.locator, actual = evidence.locator;
  if (Object.keys(expected).sort().join() !== Object.keys(actual).sort().join()) return false;
  for (const dimension of ["page", "sheet", "slide", "section"] as const) {
    if (expected[dimension] !== actual[dimension]) return false;
  }
  return expected.rowStart === undefined || (actual.rowStart !== undefined && actual.rowEnd !== undefined
    && actual.rowStart >= expected.rowStart && actual.rowEnd >= actual.rowStart && actual.rowEnd <= expected.rowEnd!);
}

// Aynı çalışma sayfasındaki aynı şemaya ait parçaları birleştirir; başka tablo satırları başlıkları değiştiremez.
export function sourceTables(source: ReportSource) {
  const groups = new Map<string, { key: string; label?: string; columns: string[]; chunks: ReportSource["chunks"] }>();
  for (const chunk of source.chunks) {
    if (!chunk.table) continue;
    const { sheet, page, slide, section } = chunk.locator;
    const key = JSON.stringify([sheet ?? null, page ?? null, slide ?? null, section ?? null, chunk.table.columns]);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: sheet ?? section, columns: chunk.table.columns, chunks: [] };
      groups.set(key, group);
    }
    group.chunks.push(chunk);
  }
  return [...groups.values()];
}
