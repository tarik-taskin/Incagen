import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { setLocale } from "../../i18n/runtime";
import { useSortedRows } from "./use-sorted-rows";
const rows = [{ id: "z", label: "Zeta", amount: 10 }, { id: "o", label: "Özet", amount: 2 }, { id: "a", label: "Alfa", amount: 2 }];
const value = (row: typeof rows[number], key: "label" | "amount") => row[key];
afterEach(() => setLocale("tr"));
it("sorts numeric amounts and preserves ties and source order without mutating the input", () => {
  const { result } = renderHook(() => useSortedRows(rows, value));
  act(() => result.current.toggle("amount"));
  expect(result.current.sorted.map(row => row.id)).toEqual(["o", "a", "z"]);
  act(() => result.current.toggle("amount"));
  expect(result.current.sorted.map(row => row.id)).toEqual(["z", "o", "a"]);
  act(() => result.current.toggle("amount"));
  expect(result.current.sorted).toBe(rows);
  expect(rows.map(row => row.id)).toEqual(["z", "o", "a"]);
});
it("updates collation on language change and uses natural numeric ordering in labels", () => {
  const labels = ["I", "H", "ı", "İ", "Item 10", "Item 2"].map((label, id) => ({ label, id }));
  const read = (row: typeof labels[number], key: "label") => row[key];
  const { result } = renderHook(() => useSortedRows(labels, read));
  act(() => result.current.toggle("label"));
  expect(result.current.sorted.map(row => row.label)).toEqual(["H", "I", "ı", "Item 2", "Item 10", "İ"]);
  act(() => setLocale("en"));
  expect(result.current.sorted.map(row => row.label)).toEqual(["H", "I", "İ", "Item 2", "Item 10", "ı"]);
});
