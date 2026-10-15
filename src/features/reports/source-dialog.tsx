import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { FileCheck2, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import type { AiResult } from "../../../functions/src/analysis/result-contract";

export type Evidence = AiResult["metrics"][number]["evidence"];
export interface ReportSource {
  sourceId: string; fileName: string; sha256: string;
  chunks: { id: string; locator: { rowStart?: number; rowEnd?: number; page?: number; sheet?: string; section?: string; slide?: number }; text?: string; table?: { columns: string[]; rows: (string | number | boolean | null)[][] } }[];
}
export interface SourceSelection { title: string; evidence: Evidence; method?: string }

// Yerel dialog odak kilidini/Escape davranışını kullanır; yalnız seçili kanıtı ve değişmemiş kaynak satırlarını gösterir.
export function SourceDialog({ selection, sources, onClose }: { selection: SourceSelection; sources: ReportSource[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [allRows, setAllRows] = useState(false);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal();
    return () => { element.close(); previousFocus?.focus(); };
  }, []);
  const groups = sources.flatMap(source => source.chunks.flatMap(chunk => {
    const anchors = selection.evidence.filter(item => item.sourceId === source.sourceId && item.chunkId === chunk.id);
    if (!anchors.length) return [];
    const isEvidence = (row: number) => anchors.some(item => item.locator.rowStart === undefined || (row >= item.locator.rowStart && row <= item.locator.rowEnd!));
    const rows = chunk.table?.rows.map((cells, index) => ({ cells, row: (chunk.locator.rowStart ?? 1) + index })).filter(item => allRows || isEvidence(item.row));
    return [{ source, chunk, rows, isEvidence }];
  }));
  return (
    <motion.dialog ref={dialog} onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="source-title" aria-describedby="source-description" initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl overflow-auto rounded-3xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-foreground/35 backdrop:backdrop-blur-sm">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-card p-5 sm:p-7">
        <div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary dark:text-secondary"><FileCheck2 className="h-4 w-4" aria-hidden="true" /> Kaynak incelemesi</p><h2 id="source-title" className="mt-2 text-xl font-semibold tracking-tight">{selection.title}</h2><p id="source-description" className="mt-2 text-sm leading-6 text-muted-foreground">Vurgulu satırlar bu sonucun dayanağıdır. Satır numaraları başlık hariç veri satırlarını gösterir.</p></div>
        <Button variant="ghost" size="icon" aria-label="Kaynak incelemesini kapat" onClick={onClose} className="shrink-0"><X className="h-5 w-5" aria-hidden="true" /></Button>
      </div>
      <div className="space-y-6 p-5 sm:p-7">
        {selection.method && <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4"><h3 className="text-sm font-semibold">Hesap yöntemi</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{selection.method}</p></div>}
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={allRows} onChange={event => setAllRows(event.target.checked)} className="h-4 w-4 accent-primary" /> Bağlam için tüm satırları göster</label>
        {groups.map(({ source, chunk, rows, isEvidence }) => <section key={`${source.sourceId}:${chunk.id}`}>
          <h3 className="text-sm font-semibold">{source.fileName}{chunk.locator.sheet ? ` · ${chunk.locator.sheet}` : ""}{chunk.locator.page ? ` · Sayfa ${chunk.locator.page}` : ""}</h3>
          {chunk.table && <div role="region" aria-label={`${source.fileName} kaynak satırları`} tabIndex={0} className="mt-3 overflow-x-auto rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><table className="w-full whitespace-nowrap text-left text-xs"><caption className="sr-only">{selection.title} için kaynak satırları; işaretli satırlar dayanak kapsamındadır.</caption><thead className="bg-muted"><tr><th scope="col" className="p-3">Satır</th>{chunk.table.columns.map((column, index) => <th scope="col" key={`${index}:${column}`} className="p-3 font-medium">{column}</th>)}</tr></thead><tbody>{rows?.map(({ cells, row }) => <tr key={row} className={isEvidence(row) ? "border-t border-border bg-primary/[0.07] dark:bg-secondary/[0.07]" : "border-t border-border"}><th scope="row" className="p-3 font-semibold">{row}{isEvidence(row) && <span className="sr-only">, dayanak</span>}</th>{cells.map((cell, index) => <td key={index} className="p-3">{cell === null ? "—" : String(cell)}</td>)}</tr>)}</tbody></table></div>}
          {chunk.text && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted p-4 text-sm leading-7">{chunk.text}</p>}
          <details className="mt-3 text-xs text-muted-foreground"><summary className="w-fit cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Kaynak kimliği ve bütünlük</summary><p className="mt-2 break-all leading-6">SHA-256: {source.sha256}<br />Parça: {chunk.id}</p></details>
        </section>)}
      </div>
    </motion.dialog>
  );
}
