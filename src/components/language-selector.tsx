import { t, useLocale, languages, setLocale, type Locale } from "../i18n/runtime";
import { Languages } from "lucide-react";
// Seçili dilde dil adlarını gösteren yerel select, mobilde ve klavyede ek panel gerektirmeden kullanılabilir.
export function LanguageSelector() {
  const locale = useLocale();
  return <label className="relative inline-flex h-10 min-w-0 items-center rounded-full border border-border bg-card shadow-sm"><Languages aria-hidden="true" className="pointer-events-none absolute start-3 h-4 w-4 text-muted-foreground" /><span className="sr-only">{t("Dil")}</span><select aria-label={t("Dil")} value={locale} onChange={event => setLocale(event.target.value as Locale)} className="h-full w-10 cursor-pointer sm:w-[8.5rem] appearance-none rounded-full bg-transparent ps-9 pe-1 text-xs font-medium text-transparent sm:pe-3 sm:text-foreground [&>option]:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary">{languages.map(item => <option key={item.code} value={item.code} lang={locale}>{t(item.name)}</option>)}</select></label>;
}
