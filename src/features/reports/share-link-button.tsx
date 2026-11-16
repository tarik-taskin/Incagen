import { useEffect, useState, useRef } from "react";
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
  const [pending, setPending] = useState(false);
  const operation = useRef<symbol | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    operation.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  // Tek bir pano isteği yürütür; eski görünümün geç yanıtı başarı veya fallback başlatamaz.
  async function copyCurrentLink() {
    if (operation.current) return;
    const request = Symbol();
    operation.current = request;
    setPending(true);
    setCopied(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const startedAt = window.location.href;
    const current = () => operation.current === request && window.location.href === startedAt;
    const url = new URL(startedAt);
    if (!url.hash && activeSection && activeSection !== "genel-bakis") url.hash = `#${activeSection}`;
    const text = url.toString();
    try {
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(text);
      } catch {
        if (!current()) return;
        if (!fallbackCopy(text)) { if (current()) window.prompt(t("Bağlantıyı kopyalayın:"), text); return; }
      }
      if (!current()) return;
      setCopied(true);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } finally {
      if (operation.current === request) { operation.current = null; setPending(false); }
    }
  }

  // Geçici alan her hata yolunda kaldırılır; kopyalama sonrasında önceki klavye odağı geri gelir.
  function fallbackCopy(text: string) {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const textarea = document.createElement("textarea");
    try {
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.setAttribute("aria-hidden", "true");
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      return document.execCommand("copy");
    } catch { return false; }
    finally { textarea.remove(); previousFocus?.focus({ preventScroll: true }); }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={`h-9 rounded-xl border-border/80 px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary ${className}`}
      onClick={copyCurrentLink}
      disabled={pending}
      aria-busy={pending}
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
