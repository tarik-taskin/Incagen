import { useEffect, useId, useRef, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { t, useLocale } from "../../i18n/runtime";
import type { ReportSource } from "./source-dialog";

// Kaynak kimliğiyle yeniden mount edilir; kapanan/değişen belgeye ait yanıt yeni indirme durumuna yazamaz.
export function SourceDownload({ source, onDownload }: { source: ReportSource; onDownload: (source: ReportSource) => Promise<void> }) {
  useLocale();
  const mounted = useRef(true), busy = useRef(false), errorId = useId();
  const [pending, setPending] = useState(false), [failed, setFailed] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // Aynı belgenin hızlı tekrar tıklamasını tekilleştirir; yalnız güvenli, yerelleştirilmiş hata gösterir.
  async function download() {
    if (busy.current) return;
    busy.current = true; setPending(true); setFailed(false);
    try { await onDownload(source); }
    catch { if (mounted.current) setFailed(true); }
    finally { busy.current = false; if (mounted.current) setPending(false); }
  }

  return <div className="flex min-w-0 flex-col items-end gap-2">
    <Button variant="outline" disabled={pending} aria-busy={pending} aria-describedby={failed ? errorId : undefined} onClick={download} className="h-9 gap-2 text-xs">
      {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
      {t(pending ? "İndiriliyor…" : "Özgün belgeyi indir")}
    </Button>
    {failed && <p id={errorId} role="alert" className="max-w-sm text-start text-xs leading-5 text-destructive">{t("Belge indirilemedi. Bağlantınızı kontrol edip yeniden deneyin.")}</p>}
  </div>;
}
