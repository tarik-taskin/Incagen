import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NewAnalysisPage } from "./new-analysis-page";

// Test kullanıcısını dosya seçicinin accept filtresini uygulamadan gerçek etkileşim davranışıyla başlatır.
function setupUser() {
  return userEvent.setup({ applyAccept: false });
}

describe("NewAnalysisPage", () => {
  it("çoklu dosyaları listeler, analiz hazırlığını açar ve dosya kaldırır", async () => {
    const user = setupUser();
    render(<NewAnalysisPage />);
    const input = screen.getByLabelText("Analiz edilecek dosyaları seç");
    const sales = new File(["month,total"], "satis.csv", { type: "text/csv", lastModified: 1 });
    const report = new File(["report"], "rapor.pdf", { type: "application/pdf", lastModified: 2 });

    await user.upload(input, [sales, report]);

    expect(screen.getByText("satis.csv")).toBeInTheDocument();
    expect(screen.getByText("rapor.pdf")).toBeInTheDocument();
    expect(screen.getByText("2/10 dosya analize hazırlanıyor")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Analize hazırla" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 dosya istemci ön kontrolünü geçti");

    await user.click(screen.getByRole("button", { name: "satis.csv dosyasını kaldır" }));
    expect(screen.queryByText("satis.csv")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("yinelenen ve desteklenmeyen dosyaları açıklamalı olarak reddeder", async () => {
    const user = setupUser();
    render(<NewAnalysisPage />);
    const input = screen.getByLabelText("Analiz edilecek dosyaları seç");
    const valid = new File(["data"], "veri.json", { type: "application/json", lastModified: 3 });
    const unsupported = new File(["bin"], "arac.exe", { lastModified: 4 });

    await user.upload(input, valid);
    await user.upload(input, [valid, unsupported]);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("veri.json: Bu dosya zaten seçili.");
    expect(alert).toHaveTextContent("arac.exe: Bu dosya türü şu anda desteklenmiyor.");
    expect(screen.getAllByText("veri.json")).toHaveLength(1);
  });

  it("Free plan sınırının üzerindeki dosyayı eklemez", async () => {
    const user = setupUser();
    render(<NewAnalysisPage />);
    const input = screen.getByLabelText("Analiz edilecek dosyaları seç");
    const files = Array.from({ length: 11 }, (_, index) => new File([String(index)], `dosya-${index}.csv`, { lastModified: index }));

    await user.upload(input, files);

    expect(screen.getByText("10/10 dosya analize hazırlanıyor")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("dosya-10.csv");
    expect(input).toBeDisabled();
  });
});
