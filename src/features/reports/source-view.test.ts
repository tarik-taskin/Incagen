import { describe, expect, it } from "vitest";
import { matchesEvidence, sourceTables } from "./source-view";
import type { ReportSource } from "./source-dialog";

const source: ReportSource = { sourceId: "book", fileName: "book.xlsx", sha256: "a".repeat(64), chunks: [
  { id: "part-1", locator: { sheet: "Revenue", rowStart: 2, rowEnd: 20 }, table: { columns: ["Name", "Revenue"], rows: [["A", 5]] } },
] };
const evidence = { sourceId: source.sourceId, sha256: source.sha256, chunkId: "part-1", locator: { sheet: "Revenue", rowStart: 3, rowEnd: 4 } };

describe("source-view evidence matching", () => {
  it("accepts a cited subrange but rejects a different hash, chunk, worksheet, dimensions and invalid ranges", () => {
    expect(matchesEvidence(source, evidence)).toBe(true);
    for (const changed of [
      { ...evidence, sha256: "b".repeat(64) }, { ...evidence, sourceId: "another" }, { ...evidence, chunkId: "another" },
      { ...evidence, locator: { ...evidence.locator, sheet: "Costs" } },
      { ...evidence, locator: { ...evidence.locator, page: 1 } },
      { ...evidence, locator: { ...evidence.locator, rowStart: 1 } },
      { ...evidence, locator: { ...evidence.locator, rowEnd: 21 } },
      { ...evidence, locator: { ...evidence.locator, rowStart: 5 } },
    ]) expect(matchesEvidence(source, changed)).toBe(false);
  });
  it("also checks page and section anchors for non-tabular documents", () => {
    const document = { ...source, chunks: [{ id: "page-1", locator: { page: 1, section: "Executive summary" }, text: "Evidence" }] };
    const citation = { ...evidence, chunkId: "page-1", locator: document.chunks[0].locator };
    expect(matchesEvidence(document, citation)).toBe(true);
    expect(matchesEvidence(document, { ...citation, locator: { page: 2, section: "Executive summary" } })).toBe(false);
    expect(matchesEvidence(document, { ...citation, locator: { page: 1 } })).toBe(false);
  });
  it("combines only chunks with the same worksheet and schema, retaining original identities and order", () => {
    const first = source.chunks[0];
    const book = { ...source, chunks: [first,
      { ...first, id: "part-2", locator: { ...first.locator, rowStart: 21, rowEnd: 21 } },
      { ...first, id: "costs", locator: { ...first.locator, sheet: "Costs" } },
      { ...first, id: "different-schema", table: { columns: ["Name", "Notes"], rows: [["A", "note"]] } },
    ] };
    const tables = sourceTables(book);
    expect(tables).toHaveLength(3);
    expect(tables[0].chunks.map(chunk => chunk.id)).toEqual(["part-1", "part-2"]);
    expect(tables[0].chunks[1].locator.rowStart).toBe(21);
    expect(tables[1].label).toBe("Costs");
    expect(tables[2].columns).toEqual(["Name", "Notes"]);
    expect(sourceTables({ ...book, chunks: [...book.chunks].reverse() }).map(table => table.key).sort()).toEqual(tables.map(table => table.key).sort());
    expect(source.chunks).toHaveLength(1);
  });
});
