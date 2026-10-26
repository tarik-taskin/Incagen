import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { Report } from "../../functions/src/contracts";
import { PreparedDocuments } from "./prepared-documents";
import { localeTag, setLocale, t, type Locale } from "../i18n/runtime";

const report: Report = {
  version: 3, fileCount: 1, totalBytes: 1400, totalChunks: 2, totalCharacters: 724,
  sources: [{ id: "source-1", name: "kaynak.pdf", size: 1400, declaredContentType: "application/pdf", detectedMime: "application/pdf", sha256: "a".repeat(64), category: "Belge", chunkCount: 2, characterCount: 724, metadata: { pages: 1 }, warnings: ["Örnek okuma notu: bir sayfada metin bulunamadı."] }],
};
afterEach(() => setLocale("tr"));

describe("Hazırlanmış belge kapsamı", () => {
  it.each<Locale>(["tr", "en", "de", "es", "zh", "ar"])("%s: uyarılar görünür; teknik değerler açılana kadar gizli, açılınca eksiksizdir", async locale => {
    setLocale(locale);
    const user = userEvent.setup();
    render(<PreparedDocuments report={report} />);
    expect(within(screen.getByRole("list", { name: t("Hazırlanan belgeler") })).getByText("kaynak.pdf")).toBeVisible();
    expect(screen.getByText(report.sources[0].warnings[0])).toBeVisible();
    expect(screen.getByText("application/pdf")).not.toBeVisible();
    for (const item of screen.getAllByText((724).toLocaleString(localeTag()))) expect(item).not.toBeVisible();
    expect(screen.getByText(t("{0} sayfa", 1))).toBeVisible();
    await user.click(screen.getByText(t("Teknik ayrıntılar")));
    const details = screen.getByText(t("Teknik ayrıntılar")).closest("details")!;
    expect(details).toHaveAttribute("open");
    expect(within(details).getByText("application/pdf")).toBeVisible();
    expect(within(details).getAllByText((724).toLocaleString(localeTag()))).toHaveLength(2);
    expect(within(details).getAllByText((2).toLocaleString(localeTag()))).toHaveLength(2);
    await user.click(screen.getByText(t("Teknik ayrıntılar")));
    expect(screen.getByText(report.sources[0].warnings[0])).toBeVisible();
    expect(screen.getByText("application/pdf")).not.toBeVisible();
  });
});
