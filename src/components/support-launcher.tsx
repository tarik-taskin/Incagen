import { lazy, Suspense, useState } from "react";
import { Headphones } from "lucide-react";
import { t, useLocale } from "../i18n/runtime";

const SupportDialog = lazy(() => import("./support-dialog").then(module => ({ default: module.SupportDialog })));

// Yardım kodunu ilk istekte yükler; sonraki kapatmalarda formu kaldırmayarak yazılan mesajı korur.
export function SupportLauncher() {
  useLocale();
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  return <><button type="button" onClick={() => { setRequested(true); setOpen(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Headphones className="h-4 w-4" aria-hidden="true" />{t("Destek ve yardım")}</button>{requested && <Suspense fallback={<span role="status" className="text-xs text-muted-foreground">{t("Yardım yükleniyor…")}</span>}><SupportDialog open={open} onClose={() => setOpen(false)} /></Suspense>}</>;
}
