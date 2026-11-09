import { useEffect, useId, useRef, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { t, useLocale } from "../../i18n/runtime";
import type { ReportSource } from "./source-dialog";
import { DownloadError } from "./source-integrity";

/**
 * Kaynak indirme butonunu yönetir; kaynak kimliğiyle mount edilir,
 * unmount ve kaynak değişiminde devam eden indirmeyi iptal eder,
 * hızlı ardışık tıklamaları tekilleştirir ve güvenli yerelleştirilmiş hata gösterir.
 */
export function SourceDownload({
  source,
  onDownload,
}: {
  source: ReportSource;
  onDownload: (source: ReportSource, signal?: AbortSignal) => Promise<void>;
}) {
  useLocale();
  const mounted = useRef(true);
  const busy = useRef(false);
  const activeController = useRef<AbortController | null>(null);
  const errorId = useId();
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // SDK/crypto devam edebilse de eski sonuç artık dosya indirmeyi veya UI güncellemesini tetikleyemez.
      activeController.current?.abort();
    };
  }, []);

  /**
   * Aynı belgenin hızlı tekrar tıklamasını engeller, iptal edilebilir sinyal ile
   * indirmeyi başlatır ve bütünlük/bağlantı hatalarını kontrollü olarak sunar.
   */
  async function download() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setErrorMessage(null);

    const controller = new AbortController();
    activeController.current = controller;

    try {
      await onDownload(source, controller.signal);
    } catch (error: unknown) {
      // İptal edilmiş işlem veya kapanmış panelde hata state'i yazma
      if (controller.signal.aborted || !mounted.current) {
        return;
      }
      const isIntegrityError =
        (error instanceof DownloadError && error.reason === "integrity_failed") ||
        (error instanceof Error && error.message === "integrity_failed");
      const isCancelled =
        (error instanceof DownloadError && error.reason === "cancelled") ||
        (error instanceof Error && error.name === "AbortError");

      if (isCancelled) {
        return;
      }

      setErrorMessage(
        isIntegrityError
          ? "İndirilen dosya bütünlük kontrolünü geçemedi."
          : "Belge indirilemedi. Bağlantınızı kontrol edip yeniden deneyin."
      );
    } finally {
      busy.current = false;
      if (activeController.current === controller) {
        activeController.current = null;
      }
      if (mounted.current && !controller.signal.aborted) {
        setPending(false);
      }
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
