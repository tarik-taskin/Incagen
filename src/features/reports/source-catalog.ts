import { t, localeTag } from "../../i18n/runtime";
import feedbackUrl from "../../../fixtures/analysis-reference/examples/customer-feedback.v2.csv?url";
import salesUrl from "./originals/atlas-satis-2025.csv?url";
import budgetUrl from "./originals/atlas-butce-2025.xlsx?url";
import operationsUrl from "./originals/atlas-operasyon-2025.csv?url";
import reviewUrl from "./originals/atlas-performans-2025.pdf?url";
import commercialUrl from "./originals/atlas-ticari-degerlendirme-2025.docx?url";
import executiveUrl from "./originals/atlas-yonetim-2025.pptx?url";
import contextUrl from "./originals/atlas-rapor-baglami-2025.json?url";
import methodUrl from "./originals/atlas-hesap-yontemi-2025.md?url";
import handoffUrl from "./originals/atlas-yonetim-devir-notu-2025.txt?url";
import type { ReportSource } from "./source-dialog";

export const sourceCatalog: Record<string, { name: string; format: string; url: string; department: string; description: string; number: string }> = {
  "reference-feedback": { name: "Müşteri yorumları", format: "CSV", url: feedbackUrl, department: "Müşteri deneyimi", description: "Özgün yorumlar, kayıt kimlikleri ve alındıkları tarihler.", number: "01" },
  "atlas-review": { name: "Yıllık performans raporu", format: "PDF", url: reviewUrl, department: "Yönetim raporlaması", description: "Yönetici özeti, aylık performans, portföy, kanal ekonomisi ve hesap mutabakatı.", number: "01" },
  "atlas-commercial": { name: "Ticari değerlendirme", format: "DOCX", url: commercialUrl, department: "Ticari strateji", description: "Kanal kararları, portföy öncelikleri, kontrol noktaları ve takip çerçevesi.", number: "02" },
  "atlas-sales": { name: "Satış kayıtları", format: "CSV", url: salesUrl, department: "Ticari finans", description: "Ay, bölge, kanal, hizmet alanı ve müşteri segmenti bazında ayrıntılı mali döküm.", number: "03" },
  "atlas-budget": { name: "Satış bütçesi", format: "XLSX", url: budgetUrl, department: "Planlama", description: "On iki ay için net satış hedefleri; dönem karşılaştırmasının bütçe dayanağı.", number: "04" },
  "atlas-operations": { name: "Hizmet operasyonu", format: "CSV", url: operationsUrl, department: "Operasyon", description: "Dört bölge ve üç kanalda tamamlanan hizmet işleri, zamanında tamamlanma ve gecikme kayıtları.", number: "05" },
  "atlas-executive": { name: "Yönetim sunumu", format: "PPTX", url: executiveUrl, department: "Yönetim", description: "Yıllık göstergeler, hizmet portföyü ve karar öncelikleri; üç düzenlenebilir slayt.", number: "06" },
  "atlas-context": { name: "Rapor bağlamı", format: "JSON", url: contextUrl, department: "Veri yönetimi", description: "Şirket modeli, dönem, para birimi, alan tanımları ve kapsam sınırları.", number: "07" },
  "atlas-methodology": { name: "Hesap yöntemleri", format: "MD", url: methodUrl, department: "Ticari finans", description: "Mali formüller, oranların paydaları ve kaynaklar arasında çift sayımı önleyen kurallar.", number: "08" },
  "atlas-handoff": { name: "Yönetim devir notu", format: "TXT", url: handoffUrl, department: "Yönetim", description: "Finans, ticari ekip ve hizmet operasyonu için takip başlıkları ve gerekli ek kayıtlar.", number: "09" },
};

// PDF sayfasını ve tablo satırını gerçek parser çıktısından sayar; Word'de fiziksel sayfa konumu iddia etmez.
export function sourceExtent(source: ReportSource) {
  const rows = source.chunks.reduce((n, chunk) => n + (chunk.table?.rows.length ?? 0), 0);
  if (rows) return t("{0} satır · {1} alan", new Intl.NumberFormat(localeTag()).format(rows), source.chunks.find(chunk => chunk.table)?.table?.columns.length);
  const pages = new Set(source.chunks.map(chunk => chunk.locator.page).filter(Boolean));
  if (pages.size) return t("{0} sayfa · metin ve tablolar", pages.size);
  const slides = new Set(source.chunks.map(chunk => chunk.locator.slide).filter(Boolean));
  if (slides.size) return t("{0} slayt · yönetim özeti", slides.size);
  const words = source.chunks.map(chunk => chunk.text ?? "").join(" ").trim().split(/\s+/).length;
  return t("{0} sözcük · kaynak metni", new Intl.NumberFormat(localeTag()).format(words));
}
