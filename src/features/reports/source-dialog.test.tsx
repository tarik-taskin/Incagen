import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLocale, t } from "../../i18n/runtime";
import { SourceDialog, type ReportSource } from "./source-dialog";
import { sourceExtent } from "./source-catalog";

const source: ReportSource = { sourceId: "file-0", fileName: "synthetic.csv", sha256: "a".repeat(64), chunks: [{ id: "table-1", locator: { rowStart: 1, rowEnd: 30 },
  table: { columns: ["record_id", "net_sales_budget_try"], rows: Array.from({ length: 30 }, (_, n) => [`ID-${n + 1}`, n === 0 ? null : n === 1 ? false : n === 2 ? "not reported" : n === 3 ? 0 : "1234.50"]) } }] };
const selection = { title: "Source amounts", evidence: [{ sourceId: source.sourceId, sha256: source.sha256, chunkId: "table-1", locator: { rowStart: 1, rowEnd: 30 } }] };
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { setLocale("tr"); vi.restoreAllMocks(); });

it("keeps missing, boolean and textual amounts distinct from a genuine zero in the source table", () => {
  render(<SourceDialog selection={selection} sources={[source]} onClose={() => {}} />);
  const rows = screen.getAllByRole("row");
  expect(within(rows[1]).getAllByRole("cell")[1]).toHaveTextContent("—");
  expect(within(rows[2]).getAllByRole("cell")[1]).toHaveTextContent("false");
  expect(within(rows[3]).getAllByRole("cell")[1]).toHaveTextContent("not reported");
  expect(within(rows[4]).getAllByRole("cell")[1]).toHaveTextContent("0,00");
  expect(within(rows[5]).getAllByRole("cell")[1]).toHaveTextContent("1.234,50");
  expect(within(rows[5]).getAllByRole("cell")[1]).toHaveAttribute("title", "1234.50");
});

it("localizes Arabic pagination and preserves physical row numbers after filtering", async () => {
  setLocale("ar");
  render(<SourceDialog selection={selection} sources={[source]} onClose={() => {}} />);
  const number = new Intl.NumberFormat("ar-SA");
  expect(screen.getByRole("status")).toHaveTextContent(`${number.format(1)}–${number.format(25)}`);
  const buttons = screen.getAllByRole("button");
  await userEvent.click(buttons[buttons.length - 1]);
  expect(screen.getByRole("status")).toHaveTextContent(`${number.format(26)}–${number.format(30)}`);
  const search = screen.getByRole("textbox");
  fireEvent.change(search, { target: { value: "ID-29" } });
  expect(screen.getByRole("rowheader")).toHaveTextContent(number.format(29));
  expect(screen.getByRole("status")).toHaveTextContent(`${number.format(1)}–${number.format(1)}`);
});

it("does not invent a word for an empty source", () => {
  expect(sourceExtent({ ...source, chunks: [] })).toBe("0 sözcük · kaynak metni");
  expect(sourceExtent({ ...source, chunks: [{ id: "empty", locator: {}, text: "  \n  " }] })).toBe("0 sözcük · kaynak metni");
});

it("does not add thousands separators to physical row identifiers", () => {
  const row = { ...source, chunks: [{ ...source.chunks[0], locator: { rowStart: 3456, rowEnd: 3456 }, table: { columns: ["record_id"], rows: [["ID-3456"]] } }] };
  const anchor = { ...selection, evidence: [{ ...selection.evidence[0], locator: { rowStart: 3456, rowEnd: 3456 } }] };
  render(<SourceDialog selection={anchor} sources={[row]} onClose={() => {}} />);
  expect(screen.getByRole("rowheader")).toHaveTextContent("3456");
  expect(screen.getByRole("rowheader")).not.toHaveTextContent("3.456");
});

it("handles absent evidence and hash or locator mismatches without displaying unrelated data or downloads", () => {
  const { rerender } = render(<SourceDialog selection={selection} sources={[]} onClose={() => {}} />);
  const unavailable = /Bu dayanağa ait kaynak artık görüntülenemiyor/;
  expect(screen.getByRole("status")).toHaveTextContent(unavailable);
  rerender(<SourceDialog selection={selection} sources={[{ ...source, sha256: "b".repeat(64) }]} onClose={() => {}} />);
  expect(screen.getByRole("status")).toHaveTextContent(unavailable);
  rerender(<SourceDialog selection={{ ...selection, evidence: [{ ...selection.evidence[0], locator: { rowStart: 1, rowEnd: 99 } }] }} sources={[source]} onClose={() => {}} />);
  expect(screen.getByRole("status")).toHaveTextContent(unavailable);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Özgün belgeyi indir" })).not.toBeInTheDocument();
});

it("does not silently substitute another document when the selected source disappears", async () => {
  const other = { ...source, sourceId: "other", fileName: "other.csv" };
  const anchors = { ...selection, evidence: [...selection.evidence, { ...selection.evidence[0], sourceId: "other" }] };
  const { rerender } = render(<SourceDialog selection={anchors} sources={[source, other]} onClose={() => {}} />);
  rerender(<SourceDialog selection={anchors} sources={[other]} onClose={() => {}} />);
  expect(screen.getByRole("status")).toHaveTextContent(/Bu dayanağa ait kaynak/);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /other.csv/ }));
  expect(screen.getByRole("table")).toBeVisible();
});

it("resets query and page on a different evidence selection and aborts an old pending download", async () => {
  let signal: AbortSignal | undefined;
  const onDownload = vi.fn((_source: ReportSource, value?: AbortSignal) => { signal = value; return new Promise<void>(() => {}); });
  const { rerender } = render(<SourceDialog selection={selection} sources={[source]} onDownloadSource={onDownload} onClose={() => {}} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "ID-29" } });
  await userEvent.click(screen.getByRole("button", { name: "Özgün belgeyi indir" }));
  expect(signal?.aborted).toBe(false);
  rerender(<SourceDialog selection={{ ...selection, title: "New evidence" }} sources={[source]} onDownloadSource={onDownload} onClose={() => {}} />);
  expect(screen.getByRole("textbox")).toHaveValue("");
  expect(screen.getByRole("status")).toHaveTextContent("1–25");
  expect(signal?.aborted).toBe(true);
  expect(screen.getByRole("button", { name: "Özgün belgeyi indir" })).not.toBeDisabled();
});

const workbook: ReportSource = { ...source, fileName: "two-sheets.xlsx", chunks: [
  { id: "cost-1", locator: { sheet: "Costs", rowStart: 2, rowEnd: 2 }, table: { columns: ["Cost", "Amount"], rows: [["COST-ONLY", 40]] } },
  { id: "sales-1", locator: { sheet: "Sales", rowStart: 2, rowEnd: 2 }, table: { columns: ["Product", "Revenue"], rows: [["SALE-ONLY", 90]] } },
  { id: "sales-2", locator: { sheet: "Sales", rowStart: 3, rowEnd: 3 }, table: { columns: ["Product", "Revenue"], rows: [["SALE-LATER", 80]] } },
] };
const salesSelection = { title: "Sales evidence", evidence: [{ sourceId: workbook.sourceId, sha256: workbook.sha256, chunkId: "sales-1", locator: workbook.chunks[1].locator }] };

it("opens the cited worksheet, keeps columns/rows separate and preserves physical row identifiers", async () => {
  render(<SourceDialog selection={salesSelection} sources={[workbook]} translateContent={false} onClose={() => {}} />);
  expect(screen.getByRole("combobox")).toHaveDisplayValue("Sales · Tablo 2");
  await waitFor(() => expect(screen.getByRole("columnheader", { name: "Revenue" })).toBeVisible());
  expect(screen.getByText("SALE-ONLY")).toBeVisible();
  expect(screen.queryByText("COST-ONLY")).not.toBeInTheDocument();
  expect(screen.queryByText("SALE-LATER")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByText("SALE-LATER")).toBeVisible();
  expect(screen.getAllByRole("rowheader").map(row => row.textContent)).toEqual(["2, dayanak", "3"]);
  await userEvent.selectOptions(screen.getByRole("combobox"), screen.getByRole("option", { name: "Costs · Tablo 1" }));
  expect(screen.getByRole("columnheader", { name: "Amount" })).toBeVisible();
  expect(screen.queryByRole("columnheader", { name: "Revenue" })).not.toBeInTheDocument();
  expect(screen.getByText("COST-ONLY")).toBeVisible();
  expect(screen.queryByText("SALE-ONLY")).not.toBeInTheDocument();
  expect(screen.getByRole("rowheader")).not.toHaveTextContent("dayanak");
});

it("does not silently switch tables after a refresh removes the selected worksheet", async () => {
  const { rerender } = render(<SourceDialog selection={salesSelection} sources={[workbook]} onClose={() => {}} />);
  await userEvent.selectOptions(screen.getByRole("combobox"), screen.getByRole("option", { name: "Costs · Tablo 1" }));
  const refreshed = { ...workbook, chunks: workbook.chunks.slice(1) };
  rerender(<SourceDialog selection={salesSelection} sources={[refreshed]} onClose={() => {}} />);
  expect(screen.getByText("Seçilen tablo artık bu kaynakta bulunmuyor. Başka bir tablo seçin.")).toBeVisible();
  expect(screen.queryByText("SALE-ONLY")).not.toBeInTheDocument();
  // Even when only one table remains, the user can explicitly select it.
  await userEvent.selectOptions(screen.getByRole("combobox"), screen.getByRole("option", { name: "Sales · Tablo 1" }));
  expect(screen.getByText("SALE-ONLY")).toBeVisible();
});

it("preserves raw worksheet names while localizing table controls in all six languages", async () => {
  const { rerender } = render(<SourceDialog selection={salesSelection} sources={[workbook]} onClose={() => {}} />);
  for (const locale of ["en", "de", "es", "zh", "ar", "tr"] as const) {
    setLocale(locale);
    rerender(<SourceDialog selection={salesSelection} sources={[workbook]} onClose={() => {}} />);
    expect(screen.getByRole("combobox")).toHaveAccessibleName();
    expect(screen.getByRole("combobox")).toHaveAccessibleName(t("İncelenecek tablo"));
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent("Sales");
    await waitFor(() => expect(screen.getByText("SALE-ONLY")).toBeVisible());
  }
});

it("searches English uppercase cells and Arabic displayed row identifiers in their selected locales", () => {
  setLocale("en");
  const row = { ...source, chunks: [{ ...source.chunks[0], locator: { rowStart: 3456, rowEnd: 3456 }, table: { columns: ["Record"], rows: [["INVOICE"]] } }] };
  const anchor = { ...selection, evidence: [{ ...selection.evidence[0], locator: { rowStart: 3456, rowEnd: 3456 } }] };
  const { rerender } = render(<SourceDialog selection={anchor} sources={[row]} translateContent={false} onClose={() => {}} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "invoice" } });
  expect(screen.getByRole("rowheader")).toHaveTextContent("3456");
  setLocale("ar");
  rerender(<SourceDialog selection={anchor} sources={[row]} translateContent={false} onClose={() => {}} />);
  const digits = new Intl.NumberFormat("ar-SA", { useGrouping: false }).format(3456);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: digits } });
  expect(screen.getByRole("rowheader")).toHaveTextContent(digits);
});

it("highlights original text after Unicode normalization and never interprets source markup", () => {
  setLocale("en");
  const text = { ...source, chunks: [{ id: "page", locator: { page: 1 }, text: "İ X Cafe\u0301 <script>literal</script>" }] };
  const anchor = { title: "Text", evidence: [{ sourceId: text.sourceId, sha256: text.sha256, chunkId: "page", locator: { page: 1 } }] };
  const { container } = render(<SourceDialog selection={anchor} sources={[text]} translateContent={false} onClose={() => {}} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
  expect(container.querySelector("mark")).toHaveTextContent("X");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "café" } });
  expect(container.querySelector("mark")?.textContent).toBe("Cafe\u0301");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "<script>" } });
  expect(container.querySelector("mark")?.textContent).toBe("<script>");
  expect(container.querySelector("script")).toBeNull();
});

it("bounds text rendering while searching every evidence section and preserves original page numbers", async () => {
  const text: ReportSource = { ...source, fileName: "long.pdf", chunks: Array.from({ length: 12 }, (_, index) => ({ id: `page-${index}`, locator: { page: index + 1 }, text: `Content-${index + 1}. ${index === 10 ? "needle" : "other"}` })) };
  const anchor = { title: "Long text", evidence: text.chunks.map(chunk => ({ sourceId: text.sourceId, sha256: text.sha256, chunkId: chunk.id, locator: chunk.locator })) };
  const { container } = render(<SourceDialog selection={anchor} sources={[text]} translateContent={false} onClose={() => {}} />);
  await waitFor(() => expect(screen.getByText("Sayfa 1")).toBeVisible());
  expect(container.querySelectorAll("article")).toHaveLength(5);
  expect(screen.queryByText(/Content-11/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Sonraki kaynak sayfası" }));
  expect(screen.getByText("Sayfa 6")).toBeVisible();
  expect(screen.queryByText("Sayfa 1")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Sonraki kaynak sayfası" }));
  expect(container.querySelectorAll("article")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Sonraki kaynak sayfası" })).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "needle" } });
  expect(container.querySelectorAll("article")).toHaveLength(1);
  expect(screen.getByText("Sayfa 11")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Sonraki kaynak sayfası" })).toBeNull();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
  expect(screen.getByText("Sayfa 1")).toBeVisible();
  expect(container.querySelectorAll("article")).toHaveLength(5);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "not-found" } });
  expect(screen.getByText("Belgede aramanızla eşleşen bölüm yok.")).toBeVisible();
  expect(container.querySelectorAll("article")).toHaveLength(0);
});

it("restores focus to opener on Close, Escape and outside click, uses heading fallback when opener disappears, and never steals focus on route/report unmount", async () => {
  const user = userEvent.setup();

  function Harness({ showOpener = true, routeSwitched = false }: { showOpener?: boolean; routeSwitched?: boolean }) {
    return (
      <main>
        <h1 id="report-title" tabIndex={-1}>Rapor Başlığı</h1>
        <h2 id="findings-title" tabIndex={-1}>Bulgular</h2>
        {showOpener && <button id="open-source" type="button">Kaynağı aç</button>}
        {!routeSwitched && <SourceDialog selection={selection} sources={[source]} onClose={() => {}} />}
        {routeSwitched && <button id="next-route-focus" type="button">Sonraki rapor kontrolü</button>}
      </main>
    );
  }

  // 1. Kapat düğmesi / Escape / dışarı tıklama açıcıya odak döndürür (burada Escape & Kapat simüle edilir).
  const onClose = vi.fn();
  function InteractiveHarness() {
    return (
      <main>
        <h1 id="report-title" tabIndex={-1}>Rapor Başlığı</h1>
        <button id="open-source" type="button">Kaynağı aç</button>
      </main>
    );
  }
  const { unmount } = render(<InteractiveHarness />);
  const opener = document.getElementById("open-source") as HTMLButtonElement;
  opener.focus();
  expect(opener).toHaveFocus();

  const dialogRender = render(<SourceDialog selection={selection} sources={[source]} onClose={onClose} />);
  await user.click(screen.getByRole("button", { name: "Kaynak incelemesini kapat" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  dialogRender.unmount();
  expect(opener).toHaveFocus();

  // Escape (cancel olayı) sonrasında açıcıya döner.
  opener.focus();
  const escRender = render(<SourceDialog selection={selection} sources={[source]} onClose={onClose} />);
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  escRender.unmount();
  expect(opener).toHaveFocus();

  // Dışarı tıklama sonrasında açıcıya döner.
  opener.focus();
  const outRender = render(<SourceDialog selection={selection} sources={[source]} onClose={onClose} />);
  await user.click(document.body);
  outRender.unmount();
  expect(opener).toHaveFocus();

  unmount();

  // 2. Açıcı kaldırıldığında kullanıcı kapatması anlamlı rapor başlığına (#report-title) odak düşürür.
  const view2 = render(
    <main>
      <h1 id="report-title" tabIndex={-1}>Rapor Başlığı</h1>
      <button id="vanishing-opener" type="button">Kaybolan açıcı</button>
    </main>,
  );
  const vanishing = document.getElementById("vanishing-opener") as HTMLButtonElement;
  vanishing.focus();
  const dlg2 = render(<SourceDialog selection={selection} sources={[source]} onClose={onClose} />);
  vanishing.remove();
  await user.click(screen.getByRole("button", { name: "Kaynak incelemesini kapat" }));
  dlg2.unmount();
  expect(document.getElementById("report-title")).toHaveFocus();
  view2.unmount();

  // 3. Kullanıcı kapatmadan rota/rapor değişimiyle unmount olursa odağı yeni hedeften çalmaz.
  const view3 = render(<Harness showOpener routeSwitched={false} />);
  const nextTarget = document.createElement("button");
  nextTarget.textContent = "Yeni ekran odağı";
  document.body.appendChild(nextTarget);
  nextTarget.focus();
  view3.rerender(<Harness showOpener routeSwitched />);
  expect(nextTarget).toHaveFocus();
  nextTarget.remove();
  view3.unmount();
});
