import { useMemo, useState } from "react";

type Direction = "ascending" | "descending";
export interface SortState<K extends string> { key: K; direction: Direction }

// Küçük rapor tablolarını istemcide sıralar; sıralama yoksa kaynak sırası (ör. ay sırası) korunur.
export function useSortedRows<T, K extends string>(rows: T[], value: (row: T, key: K) => number | string) {
  const [sort, setSort] = useState<SortState<K> | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const factor = sort.direction === "ascending" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = value(a, sort.key), right = value(b, sort.key);
      return (typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right))) * factor;
    });
  }, [rows, sort, value]);
  // Aynı sütunda artan → azalan → kaynak sırası döngüsü; yeni sütun artan başlar.
  const toggle = (key: K) => setSort(current => current?.key !== key ? { key, direction: "ascending" } : current.direction === "ascending" ? { key, direction: "descending" } : null);
  return { sorted, sort, toggle };
}
