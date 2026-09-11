import { useEffect, useState } from "react";
import type { ColumnMapping } from "../../../functions/src/contracts";
import { LIMITS } from "../../../functions/src/contracts";
import { readCsv } from "../../../functions/src/csv";
import type { PreparedFile } from "../../features/files/file-rules";
import { useWorkspace } from "../../lib/workspace-context";

const emptyMapping: ColumnMapping = { dateColumn: "", amountColumn: "", categoryColumn: "", delimiter: ";", dateFormat: "tr", numberFormat: "tr" };
// CSV başlığını önizler; biçim ve sütun seçimini açıkça kullanıcıya bırakır.
export function CsvMapping({ item }: { item: PreparedFile }) {
  const { draft, setDraft, busy } = useWorkspace();
  const mapping = draft.mappings[item.id] ?? emptyMapping;
  const [preview, setPreview] = useState<{ headers: string[]; error: string }>({ headers: [], error: "" });
  useEffect(() => {
    let disposed = false;
    if (item.file.size > LIMITS.fileBytes) {
      queueMicrotask(() => { if (!disposed) setPreview({ headers: [], error: "Dosya 5 MB sınırını aşıyor." }); });
      return () => { disposed = true; };
    }
    item.file.text().then(text => {
      try {
        const { headers } = readCsv(text, mapping.delimiter);
        if (!disposed) setPreview({ headers, error: "" });
      } catch (error) { if (!disposed) setPreview({ headers: [], error: error instanceof Error ? error.message : "CSV okunamadı." }); }
    }).catch(() => { if (!disposed) setPreview({ headers: [], error: "Dosya okunamadı." }); });
    return () => { disposed = true; };
  }, [item.file, mapping.delimiter]);
  // Dosyaya ait eşleştirmeyi diğer dosyaların seçimlerini değiştirmeden günceller.
  function update(patch: Partial<ColumnMapping>) {
    setDraft(current => ({ ...current, mappings: { ...current.mappings, [item.id]: { ...mapping, ...patch } } }));
  }
  return <fieldset disabled={busy} className="min-w-0 rounded-2xl border border-border bg-card p-5">
    <legend className="max-w-full truncate px-2 text-sm font-semibold">{item.file.name} — sütun eşleştirme</legend>
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="text-sm">Ayırıcı<select aria-label={item.file.name + " ayırıcı"} className="form-control mt-1" value={mapping.delimiter} onChange={e => update({ delimiter: e.target.value as "," | ";", dateColumn: "", amountColumn: "", categoryColumn: "" })}><option value=";">Noktalı virgül (;)</option><option value=",">Virgül (,)</option></select></label>
      <label className="text-sm">Tarih biçimi<select className="form-control mt-1" value={mapping.dateFormat} onChange={e => update({ dateFormat: e.target.value as "tr" | "iso" })}><option value="tr">DD.MM.YYYY</option><option value="iso">YYYY-MM-DD</option></select></label>
      <label className="text-sm">Sayı biçimi<select className="form-control mt-1" value={mapping.numberFormat} onChange={e => update({ numberFormat: e.target.value as "tr" | "dot" })}><option value="tr">Türkçe: 1.234,50</option><option value="dot">Noktalı: 1,234.50</option></select></label>
      {([["dateColumn", "Tarih sütunu"], ["amountColumn", "Satış tutarı sütunu"], ["categoryColumn", "Kategori sütunu (isteğe bağlı)"]] as const).map(([key, label]) =>
        <label key={key} className="text-sm">{label}<select aria-label={item.file.name + " " + label} className="form-control mt-1" value={mapping[key]} onChange={e => update({ [key]: e.target.value })}><option value="">Seçin</option>{preview.headers.map(header => <option key={header}>{header}</option>)}</select></label>)}
    </div>
    {preview.error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{preview.error}</p>}
  </fieldset>;
}
