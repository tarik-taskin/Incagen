import { ChevronDown, ScanLine, Table2, FileCheck2 } from "lucide-react";
import { t, useLocale } from "../../i18n/runtime";

// İlk ziyaretçiye tek satırlık giriş sunar; rehber açılmadıkça rapora ek bilgi yüklemez.
export function ExampleReportGuide() {
  useLocale();
  const steps = [
    { icon: ScanLine, title: "Büyük resmi görün", text: "Önce metrikleri ve özeti inceleyin. Bulgular, değişimin ne anlama gelebileceğini ve değerlendirme sınırlarını gösterir." },
    { icon: Table2, title: "Grafiği tabloyla karşılaştırın", text: "Grafiklerin altındaki veri tablosunu açın. Görsel karşılaştırmanın arkasındaki değerleri birlikte inceleyin." },
    { icon: FileCheck2, title: "Kaynağa kadar izleyin", text: "Bir metriği veya kaynak bağlantısını seçin. İlgili satırları, hesap yöntemini ve özgün belgeyi aynı pencerede inceleyin." },
  ];
  return <details className="surface group mb-5 rounded-2xl border border-border/70 bg-card/60">
    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-4 py-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden"><span className="flex items-center gap-2"><ScanLine className="h-4 w-4 text-primary dark:text-secondary" aria-hidden="true" />{t("Bu raporu nasıl inceleyebilirim?")}</span><ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></summary>
    <ol className="grid gap-5 border-t border-border/60 p-5 md:grid-cols-3">{steps.map(({ icon: Icon, title, text }) => <li key={title} className="min-w-0"><p className="flex items-start gap-2 text-xs font-semibold"><Icon className="h-4 w-4 shrink-0 text-primary dark:text-secondary" aria-hidden="true" />{t(title)}</p><p className="mt-2 text-xs leading-6 text-muted-foreground">{t(text)}</p></li>)}</ol>
  </details>;
}
