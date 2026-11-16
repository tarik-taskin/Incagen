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
  viewPath,
  className = "",
}: {
  activeSection?: string;
  viewPath?: string;
  className?: string;
}) {
  useLocale();
  // Görünen rota ile tıklama anındaki tarayıcı adresi kısa süre ayrışabilir; geri bildirim kendi adresine aittir.
  const visibleUrl = typeof window === "undefined" ? "" : new URL(viewPath ?? window.location.href, window.location.origin).href;
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const copied = copiedUrl === visibleUrl;
  const pending = pendingUrl === visibleUrl;
  const operation = useRef<{ id: symbol; url: string } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    operation.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  // Aynı adresin isteğini tekilleştirir; eski isteğin geç sonucu yeni adresin durumunu değiştiremez.
  async function copyCurrentLink() {
    const startedAt = window.location.href;
    if (operation.current?.url === startedAt) return;
    const request = Symbol();
    operation.current = { id: request, url: startedAt };
    setPendingUrl(startedAt);
    setCopiedUrl(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const current = () => operation.current?.id === request && window.location.href === startedAt;
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
      setCopiedUrl(startedAt);
      timeoutRef.current = setTimeout(() => setCopiedUrl(null), 2000);
    } finally {
      if (operation.current?.id === request) { operation.current = null; setPendingUrl(null); }
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
