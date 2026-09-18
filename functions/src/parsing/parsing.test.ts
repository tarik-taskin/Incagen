import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { DocumentParseError, parseDocument } from "./index";

// Parser testlerinde ortak ve yalnız bellekte yaşayan sentetik kaynak girdisi üretir.
function input(fileName: string, contentType: string, data: Buffer) {
  return { sourceId: "file-0", fileName, contentType, data };
}

// Mammoth'un okuyabileceği en küçük sentetik DOCX paketini oluşturur.
async function docxFixture() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Sentetik faaliyet raporu</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

// Slayt metni içeren küçük ve dış kaynaksız bir PPTX paketi oluşturur.
async function pptxFixture() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("ppt/presentation.xml", "<p:presentation xmlns:p=\"p\"/>");
  zip.file("ppt/slides/slide1.xml", `<p:sld xmlns:p="p" xmlns:a="a"><p:cSld><a:t>Büyüme fırsatı</a:t><a:t>Yeni kanal</a:t></p:cSld></p:sld>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("ortak belge ayrıştırıcıları", () => {
  it("UTF-8 metin ve JSON'u kaynaklı parçalara dönüştürür", async () => {
    const text = await parseDocument(input("notlar.md", "text/markdown", Buffer.from("Başlık\n\nÖnemli not")));
    const json = await parseDocument(input("veri.json", "application/json", Buffer.from('{"ciro":1250,"aktif":true}')));
    expect(text.detectedMime).toBe("text/markdown");
    expect(text.chunks[0]?.text).toContain("Önemli not");
    expect(json.chunks[0]?.text).toContain('"ciro": 1250');
    expect(json.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("CSV ve TSV satırlarını konumlu tablo parçalarına ayırır", async () => {
    const csv = await parseDocument(input("satis.csv", "text/csv", Buffer.from("Tarih;Tutar\n2026-09-01;1250\n2026-09-02;900")));
    const tsv = await parseDocument(input("stok.tsv", "text/tab-separated-values", Buffer.from("Urun\tAdet\nKalem\t12")));
    expect(csv.chunks[0]?.table).toEqual({ columns: ["Tarih", "Tutar"], rows: [["2026-09-01", "1250"], ["2026-09-02", "900"]] });
    expect(csv.chunks[0]?.locator).toMatchObject({ rowStart: 1, rowEnd: 2 });
    expect(tsv.chunks[0]?.table?.rows[0]).toEqual(["Kalem", "12"]);
  });

  it("XLSX sayfalarını ve önceden hesaplanmış formül sonuçlarını okur", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Satış");
    sheet.addRow(["Ay", "Tutar"]);
    sheet.addRow(["Eylül", { formula: "600+650", result: 1250 }]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const parsed = await parseDocument(input("satis.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer));
    expect(parsed.metadata.sheets).toBe(1);
    expect(parsed.chunks[0]?.locator.sheet).toBe("Satış");
    expect(parsed.chunks[0]?.table?.rows[0]).toEqual(["Eylül", 1250]);
  });

  it("PDF metnini sayfa kaynağıyla çıkarır", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.addPage().drawText("Synthetic business report", { x: 40, y: 700, font });
    const parsed = await parseDocument(input("rapor.pdf", "application/pdf", Buffer.from(await pdf.save())));
    expect(parsed.metadata.pages).toBe(1);
    expect(parsed.chunks[0]?.locator.page).toBe(1);
    expect(parsed.chunks[0]?.text).toContain("Synthetic business report");
  });

  it("PNG imzasını ve boyutlarını doğrular", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4xkAAAAASUVORK5CYII=", "base64");
    const parsed = await parseDocument(input("grafik.png", "image/png", png));
    expect(parsed.metadata).toMatchObject({ width: 1, height: 1 });
    expect(parsed.chunks[0]?.kind).toBe("image");
    expect(parsed.warnings[0]).toContain("AI/OCR");
  });

  it("DOCX ve PPTX metinlerini belge konumlarıyla çıkarır", async () => {
    const docx = await parseDocument(input("faaliyet.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", await docxFixture()));
    const pptx = await parseDocument(input("sunum.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", await pptxFixture()));
    expect(docx.chunks[0]?.text).toContain("Sentetik faaliyet raporu");
    expect(pptx.metadata.slides).toBe(1);
    expect(pptx.chunks[0]?.locator.slide).toBe(1);
    expect(pptx.chunks[0]?.text).toContain("Yeni kanal");
  });

  it("uzantı, MIME ve gerçek içerik uyuşmazlıklarını reddeder", async () => {
    await expect(parseDocument(input("dosya.xls", "application/vnd.ms-excel", Buffer.from("legacy")))).rejects.toBeInstanceOf(DocumentParseError);
    await expect(parseDocument(input("dosya.pdf", "application/pdf", Buffer.from("PDF değil")))).rejects.toThrow("PDF imzası");
    await expect(parseDocument(input("dosya.png", "image/jpeg", Buffer.alloc(64)))).rejects.toThrow("içerik türü");
  });
});
