import { t, useLocale, languages, setLocale, type Locale } from "../i18n/runtime";
import { Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

// Dil adlarını seçili dilde gösteren tema uyumlu seçim; mobilde yalnız ikon, geniş ekranda seçili dil görünür.
export function LanguageSelectMenu({ container }: { container?: HTMLElement | null }) {
  const locale = useLocale();
  return (
    <Select value={locale} onValueChange={value => setLocale(value as Locale)}>
      <SelectTrigger
        aria-label={t("Dil")}
        data-testid="language-select"
        className="h-10 w-10 shrink-0 justify-center rounded-full border-border/70 bg-card/70 px-0 shadow-sm backdrop-blur-xl sm:w-[8.75rem] sm:justify-between sm:px-3 [&>svg:last-child]:hidden sm:[&>svg:last-child]:block"
      >
        <Languages className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="hidden min-w-0 flex-1 truncate text-start text-xs font-medium sm:block"><SelectValue /></span>
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[11rem]" container={container}>
        {languages.map(item => (
          <SelectItem key={item.code} value={item.code} data-locale={item.code}>{t(item.name)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
