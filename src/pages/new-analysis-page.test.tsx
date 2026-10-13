import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NewAnalysisPage } from "./new-analysis-page";
import { MemoryRouter } from "react-router-dom";
import { WorkspaceProvider } from "../components/workspace-provider";

// Sayfayı gerçek oturum içi taslak sağlayıcısıyla test eder.
function renderPage() {
  return render(<MemoryRouter><WorkspaceProvider><NewAnalysisPage /></WorkspaceProvider></MemoryRouter>);
}

// Test kullanıcısını dosya seçicinin accept filtresini uygulamadan gerçek etkileşim davranışıyla başlatır.
function setupUser() {
  return userEvent.setup({ applyAccept: false });
}

describe("NewAnalysisPage", () => {
  it("hedef boşsa hazırlığı başlatmaz; kullanıcı girdilerini koruyarak soruyu belirtmesini ister", async () => {
    const user = setupUser();
    renderPage();
    await user.upload(screen.getByLabelText("Analiz edilecek dosyaları seç"), new File(["test"], "faaliyet.txt", { type: "text/plain" }));
    await user.type(screen.getByLabelText("İşletme adı"), "Sentetik İşletme");
    await user.type(screen.getByLabelText("Analiz başlığı"), "Aylık çalışma");
    await user.click(screen.getByRole("button", { name: "Belgeleri ayrıştır" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Analiz hedefini belirtin");
    await waitFor(() => expect(screen.getByLabelText("Analiz hedefi")).toHaveFocus());
    expect(screen.getByLabelText("Analiz hedefi")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("faaliyet.txt")).toBeInTheDocument();
    expect(screen.getByLabelText("Analiz başlığı")).toHaveValue("Aylık çalışma");
    expect(screen.getByLabelText("Analiz hedefi")).toBeRequired();
    expect(screen.queryByText("Gerekli")).not.toBeInTheDocument();
  });
  it("farklı belge türlerini birlikte listeler ve dosya kaldırır", async () => {
    const user = setupUser();
    renderPage();
    const input = screen.getByLabelText("Analiz edilecek dosyaları seç");
    const sheet = new File(["sheet"], "faaliyet.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", lastModified: 1 });
    const report = new File(["report"], "rapor.pdf", { type: "application/pdf", lastModified: 2 });

    await user.upload(input, [sheet, report]);

    expect(screen.getByText("faaliyet.xlsx")).toBeInTheDocument();
    expect(screen.getByText("rapor.pdf")).toBeInTheDocument();
    expect(screen.getByText("2/5 dosya analize hazırlanıyor")).toBeInTheDocument();
    expect(screen.queryByText("Para birimi")).not.toBeInTheDocument();
    expect(screen.queryByText(/sütun eşleştirme/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Müşteri geri bildirimleri ya da finans verileri/)).toBeInTheDocument();
    expect(screen.queryByText(/Yerel geliştirme ortamı/)).not.toBeInTheDocument();
    expect(screen.queryByText(/dosya başına.*MB/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "faaliyet.xlsx dosyasını kaldır" }));
    expect(screen.queryByText("faaliyet.xlsx")).not.toBeInTheDocument();
  });

  it("yinelenen ve desteklenmeyen dosyaları açıklamalı olarak reddeder", async () => {
    const user = setupUser();
    renderPage();
    const input = screen.getByLabelText("Analiz edilecek dosyaları seç");
    const valid = new File(["data"], "veri.json", { type: "application/json", lastModified: 3 });
    const unsupported = new File(["bin"], "arac.exe", { lastModified: 4 });

    await user.upload(input, valid);
    await user.upload(input, [valid, unsupported]);

    const alert = screen.getAllByRole("alert")[0];
    expect(alert).toHaveTextContent("veri.json: Bu dosya zaten seçili.");
    expect(alert).toHaveTextContent("arac.exe: Bu dosya türü şu anda desteklenmiyor.");
    expect(screen.getAllByText("veri.json")).toHaveLength(1);
  });

  it("Free plan sınırının üzerindeki dosyayı eklemez", async () => {
    const user = setupUser();
    renderPage();
    const input = screen.getByLabelText("Analiz edilecek dosyaları seç");
    const files = Array.from({ length: 6 }, (_, index) => new File([String(index)], `belge-${index}.pdf`, { type: "application/pdf", lastModified: index }));

    await user.upload(input, files);

    expect(screen.getByText("5/5 dosya analize hazırlanıyor")).toBeInTheDocument();
    expect(screen.getByText(/belge-5.pdf:/)).toBeInTheDocument();
    expect(input).toBeDisabled();
  });

  it("doğrulama başarısız olduğunda dosya ve analiz başlığını yeniden deneme için korur", async () => {
    const user = setupUser();
    renderPage();
    await user.upload(screen.getByLabelText("Analiz edilecek dosyaları seç"), new File(["test"], "faaliyet.txt", { type: "text/plain" }));
    await user.type(screen.getByLabelText("Analiz başlığı"), "Korunacak taslak");
    await user.click(screen.getByRole("button", { name: "Satış değişimi" }));
    const objective = screen.getByLabelText("Analiz hedefi");
    await user.clear(objective);
    await user.type(objective, "Aylık değişimi görmek istiyorum.");

    await user.click(screen.getByRole("button", { name: "Belgeleri ayrıştır" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Çalışma alanınız için işletme adını belirtin");
    await waitFor(() => expect(screen.getByLabelText("İşletme adı")).toHaveFocus());
    expect(screen.getByText("faaliyet.txt")).toBeInTheDocument();
    expect(screen.getByLabelText("Analiz başlığı")).toHaveValue("Korunacak taslak");
    expect(objective).toHaveValue("Aylık değişimi görmek istiyorum.");
  });

  it("toplam ve kalan kapasiteyi ekleme, kaldırma ve temizlemede günceller", async () => {
    const user = setupUser();
    renderPage();
    const summary = within(screen.getByRole("region", { name: "Belge kapasitesi" }));
    expect(summary.getByText("0 B")).toBeInTheDocument();
    const first = new File([new Uint8Array(1.5 * 1024 ** 2)], "ilk.txt", { type: "text/plain" });
    const second = new File([new Uint8Array(2 * 1024 ** 2)], "ikinci.txt", { type: "text/plain" });
    await user.upload(screen.getByLabelText("Analiz edilecek dosyaları seç"), [first, second]);
    expect(summary.getByText("3,5 MB")).toBeInTheDocument();
    expect(summary.getByText("21,5 MB")).toBeInTheDocument();
    expect(summary.getByRole("progressbar")).toHaveAttribute("value", String(3.5 * 1024 ** 2));
    await user.click(screen.getByRole("button", { name: "ilk.txt dosyasını kaldır" }));
    expect(summary.getByText("2 MB")).toBeInTheDocument();
    expect(summary.getByText("23 MB")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tümünü temizle" }));
    expect(summary.getByText("0 B")).toBeInTheDocument();
    expect(summary.getByText("5 belge daha ekleyebilirsiniz")).toBeInTheDocument();
  });

  it("hazırlık kontrolünden eksik başlığa yönlendirir ve alanlar dolunca hazır durumuna geçer", async () => {
    const user = setupUser();
    renderPage();
    await user.upload(screen.getByLabelText("Analiz edilecek dosyaları seç"), new File(["test"], "kaynak.txt", { type: "text/plain" }));
    await user.click(screen.getByRole("button", { name: "Analiz başlığı alanını tamamla" }));
    await waitFor(() => expect(screen.getByLabelText("Analiz başlığı")).toHaveFocus());
    await user.type(screen.getByLabelText("Analiz başlığı"), "   ");
    await user.type(screen.getByLabelText("İşletme adı"), "Deneme");
    await user.type(screen.getByLabelText("Analiz hedefi"), "Ana konuları özetle.");
    await user.click(screen.getByRole("button", { name: "Belgeleri ayrıştır" }));
    expect(screen.getByRole("alert")).toHaveTextContent("bir analiz başlığı yazın");
    await waitFor(() => expect(screen.getByLabelText("Analiz başlığı")).toHaveFocus());
    await user.clear(screen.getByLabelText("Analiz başlığı"));
    await user.type(screen.getByLabelText("Analiz başlığı"), "Haftalık değerlendirme");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Belgeleriniz ve çalışma ayrıntılarınız hazırlamaya hazır.")).toBeInTheDocument();
    expect(screen.getByLabelText("Analiz başlığı")).toHaveAttribute("aria-invalid", "false");
    await user.click(screen.getByRole("button", { name: "kaynak.txt dosyasını kaldır" }));
    expect(screen.getByText("Çalışma ayrıntıları hazır. Başlamak için belgelerinizi ekleyin.")).toBeInTheDocument();
  });

  it("boyut sınırında tek belgeyi kabul eder ve aşan dosyanın özet toplamına girmesini engeller", async () => {
    const user = setupUser();
    renderPage();
    const input = screen.getByLabelText("Analiz edilecek dosyaları seç");
    await user.upload(input, new File([new Uint8Array(25 * 1024 ** 2)], "tam.txt", { type: "text/plain" }));
    const summary = within(screen.getByRole("region", { name: "Belge kapasitesi" }));
    expect(summary.getByText("25 MB", { exact: true })).toBeInTheDocument();
    expect(summary.getByText("0 B")).toBeInTheDocument();
    await user.upload(input, new File(["1"], "asan.txt", { type: "text/plain" }));
    expect(screen.getByRole("alert")).toHaveTextContent("toplamı 25 MB sınırını aşamaz");
    expect(screen.queryByText("asan.txt", { exact: true })).not.toBeInTheDocument();
    expect(summary.getByRole("progressbar")).toHaveAttribute("value", String(25 * 1024 ** 2));
  });
});
