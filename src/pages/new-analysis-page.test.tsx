import { render, screen } from "@testing-library/react";
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
  it("farklı belge türlerini birlikte listeler ve dosya kaldırır", async () => {
    const user = setupUser();
    renderPage();
    const input = screen.getByLabelText("Analiz edilecek dosyaları seç");
    const sheet = new File(["sheet"], "faaliyet.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", lastModified: 1 });
    const report = new File(["report"], "rapor.pdf", { type: "application/pdf", lastModified: 2 });

    await user.upload(input, [sheet, report]);

    expect(screen.getByText("faaliyet.xlsx")).toBeInTheDocument();
    expect(screen.getByText("rapor.pdf")).toBeInTheDocument();
    expect(screen.getByText("2/10 dosya analize hazırlanıyor")).toBeInTheDocument();
    expect(screen.queryByText("Para birimi")).not.toBeInTheDocument();
    expect(screen.queryByText(/sütun eşleştirme/i)).not.toBeInTheDocument();
    expect(screen.getByText("5 MB/dosya · 30 MB/analiz")).toBeInTheDocument();
    expect(screen.getByText("5 MB/dosya · 50 MB/analiz")).toBeInTheDocument();

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
    const files = Array.from({ length: 11 }, (_, index) => new File([String(index)], `belge-${index}.pdf`, { type: "application/pdf", lastModified: index }));

    await user.upload(input, files);

    expect(screen.getByText("10/10 dosya analize hazırlanıyor")).toBeInTheDocument();
    expect(screen.getByText(/belge-10.pdf:/)).toBeInTheDocument();
    expect(input).toBeDisabled();
  });
});
