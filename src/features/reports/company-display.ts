import type { createCompanyReport } from "../../../functions/src/examples/company-report";
import { getLocale, t, type Locale } from "../../i18n/runtime";
import { reportNumber } from "./report-format";

// Yalnız örnek raporun sunum metnini yerelleştirir; doğrulanmış sayılar, kimlikler, kanıtlar ve özgün alıntılar değişmez.
export function companyDisplay(report: ReturnType<typeof createCompanyReport>, locale: Locale = getLocale()) {
  if (locale === "tr") return report;
  const value = (id: string) => report.result.metrics.find(item => item.id === id)!.value!;
  const money = (n: number) => reportNumber(n);
  const percent = (n: number) => reportNumber(n, "%");
  const summary = [
    t(report.technology ? "{0} net satış ve {1} bütçe gerçekleşmesi. {2} en yüksek gelirli kanal; {3} en yüksek gelirli hizmet alanı." : "{0} net satış ve {1} bütçe gerçekleşmesi. {2} en yüksek gelirli kanal; {3} en yüksek gelirli kategori.", money(value("net-sales")), percent(value("target-rate")), t(report.channels[0].name), t(report.categories[0].name)),
    t(report.technology ? "{0} brüt marjı, {1} hizmet düzeyiyle birlikte izleyin." : "{0} brüt marjı, {1} zamanında teslimatla birlikte izleyin.", percent(value("margin")), percent(value("on-time"))),
  ];
  const texts: Record<string, string> = {
    growth: t("{0} net satışı {1}; bütçe gerçekleşmesi {2}. İlk ay {3}, son ay {4} net satış üretiyor.", t(report.periodLabel), money(value("net-sales")), percent(value("target-rate")), money(report.monthly[0].net), money(report.monthly[report.monthly.length - 1].net)),
    mix: t(report.technology ? "{0} {1} ile en yüksek hizmet alanı gelirini oluşturuyor. {2}, kanal satışlarında {3} paya sahip. Kanal marjları ve hizmet işi hacimleri birlikte okunmalı." : "{0} {1} ile en yüksek kategori satışını oluşturuyor. {2}, kanal satışlarında {3} paya sahip. Kanal marjları ve sipariş hacimleri birlikte okunmalı.", t(report.categories[0].name), money(report.categories[0].net), t(report.channels[0].name), percent(report.channels[0].share)),
    quality: t(report.technology ? "Brüt kâr {0}, brüt marj {1}. Satış/pazarlama ve hizmet operasyonu sonrasında katkı {2}; zamanında tamamlanma {3}. Katkı tutarı net kâr değildir." : "Brüt kâr {0}, brüt marj {1}. Pazarlama ve sipariş karşılama sonrasında katkı {2}; zamanında teslimat {3}. Katkı tutarı net kâr değildir.", money(value("gross-profit")), percent(value("margin")), money(value("contribution")), percent(value("on-time"))),
  };
  return { ...report, result: { ...report.result, metrics: report.result.metrics.map(metric => report.technology && /^(category|channel|region)-/.test(metric.id) ? { ...metric, method: t("{0} kırılımında brüt − indirim − hizmet kredisi; seçili dönem toplamı.", t(metric.label)) } : metric), summary: report.result.summary.map((statement, index) => ({ ...statement, text: summary[index] })), findings: report.result.findings.map(finding => ({ ...finding, statements: finding.statements.map(statement => ({ ...statement, text: texts[finding.id] ?? statement.text })) })) } };
}
