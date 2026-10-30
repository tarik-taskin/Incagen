import { useState, useRef } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "../../components/ui/button";
import { t, useLocale } from "../../i18n/runtime";

/**
 * Örnek raporun o anki görünümünü (rapor türü, dönem ve aktif bölüm) kopyalar.
 * İkinci bir durum sistemi kurmaz; mevcut URL/filtre/bölüm adresini paylaşır.
 * Tarayıcı geçmişi kaydı oluşturmaz, erişilebilir başarı geri bildirimi sunar.
 */
export function ShareLinkButton({
  activeSection,
  className = "",
}: {
  activeSection?: string;
  className?: string;
}) {
  useLocale();
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mevcut rapor görünümünün adreslenebilir tam bağlantısını panoya yazar.
  function copyCurrentLink() {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    if (!url.hash && activeSection && activeSection !== "genel-bakis") {
      url.hash = `#${activeSection}`;
    }
    const shareableUrl = url.toString();

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(shareableUrl).then(() => {
        handleSuccess();
      }).catch(() => {
        fallbackCopy(shareableUrl);
      });
    } else {
      fallbackCopy(shareableUrl);
    }
  }

  // Clipboard API desteklenmediğinde veya izin verilmediğinde bağlantıya erişim sağlar.
  function fallbackCopy(text: string) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (successful) {
        handleSuccess();
        return;
      }
    } catch {
      // Fallback başarısız olursa istemciye gösterilir.
    }
    window.prompt(t("Bağlantıyı kopyalayın:"), text);
  }

  // Kısa süreli erişilebilir başarı durumunu tetikler.
  function handleSuccess() {
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={`h-9 rounded-xl border-border/80 px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary ${className}`}
      onClick={copyCurrentLink}
      aria-label={copied ? t("Bağlantı kopyalandı") : t("Bağlantıyı kopyala")}
    >
      {copied ? (
        <>
          <Check className="me-1.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span className="text-emerald-700 dark:text-emerald-300" role="status" aria-live="polite">
            {t("Bağlantı kopyalandı")}
          </span>
        </>
      ) : (
        <>
          <Copy className="me-1.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span>{t("Bağlantıyı kopyala")}</span>
        </>
      )}
    </Button>
  );
}
