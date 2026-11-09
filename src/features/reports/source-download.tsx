import { useEffect, useId, useRef, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { t, useLocale } from "../../i18n/runtime";
import type { ReportSource } from "./source-dialog";

/**
 * Kaynak indirme butonunu yönetir; kaynak kimliğiyle mount edilir,
 * hızlı ardışık tıklamaları tekilleştirir ve güvenli yerelleştirilmiş hata gösterir.
 */
export function SourceDownload({
  source,
  onDownload,
}: {
  source: ReportSource;
  onDownload: (source: ReportSource) => Promise<void>;
}) {
  useLocale();
  const mounted = useRef(true);
  const busy = useRef(false);
  const errorId = useId();
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Aynı belgenin hızlı tekrar tıklamasını engeller, indirmeyi başlatır ve
   * bütünlük hatası ile genel bağlantı hatasını kullanıcıya anlaşılır biçimde aktarır.
   */
  async function download() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setErrorMessage(null);
    try {
      await onDownload(source);
    } catch (error: unknown) {
      if (mounted.current) {
        const isIntegrityError = error instanceof Error && error.message === "integrity_failed";
        setErrorMessage(
          isIntegrityError
            ? "İndirilen dosya bütünlük kontrolünü geçemedi."
            : "Belge indirilemedi. Bağlantınızı kontrol edip yeniden deneyin."
        );
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-2">
      <Button
        variant="outline"
        disabled={pending}
        aria-busy={pending}
        aria-describedby={errorMessage ? errorId : undefined}
        onClick={download}
        className="h-9 gap-2 text-xs"
      >
        {pending ? (
          <LoaderCircle
            className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {t(pending ? "İndiriliyor…" : "Özgün belgeyi indir")}
      </Button>
      {errorMessage && (
        <p
          id={errorId}
          role="alert"
          className="max-w-sm text-start text-xs leading-5 text-destructive"
        >
          {t(errorMessage)}
        </p>
      )}
    </div>
  );
}
