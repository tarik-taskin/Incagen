import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLocale } from "../../i18n/runtime";
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
