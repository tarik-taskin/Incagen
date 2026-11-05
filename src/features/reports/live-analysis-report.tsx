import { getBytes, ref } from "firebase/storage";
import { Check, FileCheck2 } from "lucide-react";
import type { AiArtifact } from "../../../functions/src/analysis/tabular-storage";
import type { AiJob } from "../../../functions/src/analysis/tabular-contract";
import type { ReportSource } from "./source-dialog";
import { getServices } from "../../lib/firebase";
import { useAuth } from "../../lib/auth-context";
import { t, useLocale, languages, localeTag } from "../../i18n/runtime";
import { AdaptiveReport, ReportDetails } from "./result-sections";

// Gerçek raporun hesap kapsamını kısa tutar; yöntem ve performans ayrıntıları açılır bölümde kalır.
export default function LiveAnalysisReport({ artifact, job, analysisId }: { artifact: AiArtifact; job: AiJob; analysisId: string }) {
  useLocale();
  const { user } = useAuth();
  const scope = artifact.scope;
  const language = languages.find(item => item.code === artifact.locale)?.name ?? artifact.locale;

  // Kaynak özgün baytları oturumlu Storage SDK ile indirilir; kalıcı paylaşım/token URL'si oluşturulmaz.
  async function downloadSource(source: ReportSource) {
    if (!user || source.sourceId !== job.sourceId) return;
      const bytes = await getBytes(ref(getServices().storage, `users/${user.uid}/analyses/${analysisId}/${source.sourceId}`), 25 * 1024 * 1024);
      const url = URL.createObjectURL(new Blob([bytes]));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = source.fileName; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section aria-label={t("Analiz raporu")}><div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-xs"><p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-800 dark:text-emerald-300"><Check className="h-3.5 w-3.5" aria-hidden="true" />{t("Hesaplar ve kaynak bağlantıları doğrulandı")}</p><span className="text-muted-foreground">{t("Rapor dili: {0}", t(language))}</span></div>
    <p className="mb-5 flex items-start gap-2 text-xs leading-6 text-muted-foreground"><FileCheck2 className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span>{artifact.sources[0].fileName}{scope.sheet ? ` · ${scope.sheet}` : ""}<span className="mx-2" aria-hidden="true">·</span>{t("{0} kayıt", scope.rows)}{scope.measure ? ` · ${scope.measure}` : ""}{scope.group ? ` · ${scope.group}` : ""}</span></p>
    <AdaptiveReport result={artifact.result} sources={artifact.sources} featuredMetricIds={["aggregate", "rows"]} translateContent={false} compactMetrics={false} onDownloadSource={downloadSource}>
      <ReportDetails title="İşlem ayrıntıları" description="Seçilen kapsamı ve gerçek işlem ölçümlerini inceleyin."><dl className="grid gap-5 text-xs sm:grid-cols-2 lg:grid-cols-3">{[
        [t("Kaynak"), `${artifact.sources[0].fileName}${scope.sheet ? ` · ${scope.sheet}` : ""}`],
        [t("Hesaplama"), t(scope.selection.aggregation === "sum" ? "Toplam" : scope.selection.aggregation === "mean" ? "Ortalama" : "Kayıt sayısı")],
        [t("Sayı biçimi"), scope.selection.numberFormat === "tr" ? "1.234,56" : scope.selection.numberFormat === "en" ? "1,234.56" : "1234.56"],
        [t("Boş satır"), new Intl.NumberFormat(localeTag()).format(scope.emptyRows)],
        [t("İşlem süresi"), t("{0} saniye", Number(((job.durationMs ?? 0) / 1000).toFixed(1)))],
        ...(job.usage ? [[t("Model kullanımı"), t("{0} token", job.usage.totalTokens)]] : []),
      ].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-2 break-words font-medium">{value}</dd></div>)}</dl><p className="mt-5 border-t border-border pt-4 text-xs leading-6 text-muted-foreground">{t("Hesaplar kaynak veriden üretilir. Yapay zekâ yorumları ve önerileri karar desteğidir; değerlendirme sorumluluğu sizdedir.")}</p></ReportDetails>
    </AdaptiveReport>
  </section>;
}
