import type { ReactNode } from "react";
import { DirectionProvider } from "@radix-ui/react-direction";
import { useLocale } from "../i18n/runtime";

// Radix menü ve seçimlerinin hizasını seçili dilin yazım yönüyle eşler; Arapçada açılır içerik sağdan hizalanır.
export function LocaleDirection({ children }: { children: ReactNode }) {
  const locale = useLocale();
  return <DirectionProvider dir={locale === "ar" ? "rtl" : "ltr"}>{children}</DirectionProvider>;
}
