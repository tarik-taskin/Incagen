import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { SourceDownload } from "./source-download";
import type { ReportSource } from "./source-dialog";
import { setLocale } from "../../i18n/runtime";

const source: ReportSource = {
  sourceId: "file-0",
  fileName: "synthetic.csv",
  sha256: "a".repeat(64),
  chunks: [],
};

afterEach(() => setLocale("tr"));

it("keeps one pending authenticated download and allows retry after a sanitized failure", async () => {
  let reject!: (error: Error) => void;
  const pending = new Promise<void>((_, fail) => {
    reject = fail;
  });
  const download = vi.fn().mockReturnValueOnce(pending).mockResolvedValue(undefined),
    user = userEvent.setup();
  render(<SourceDownload source={source} onDownload={download} />);
  await user.dblClick(screen.getByRole("button", { name: "Özgün belgeyi indir" }));
  expect(download).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "İndiriliyor…" })).toBeDisabled();
  await act(async () => {
    reject(new Error("private-key source-content"));
  });
  expect(screen.getByRole("alert")).toHaveTextContent("Belge indirilemedi.");
  expect(document.body.textContent).not.toContain("private-key");
  await user.click(screen.getByRole("button", { name: "Özgün belgeyi indir" }));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(download).toHaveBeenCalledTimes(2);
});

it("does not carry an old source's pending state or late failure into a newly selected source", async () => {
  let reject!: (error: Error) => void;
  const download = vi.fn().mockReturnValue(
      new Promise<void>((_, fail) => {
        reject = fail;
      })
    ),
    user = userEvent.setup();
  const view = render(<SourceDownload key="first" source={source} onDownload={download} />);
  await user.click(screen.getByRole("button"));
  view.rerender(
    <SourceDownload key="second" source={{ ...source, sourceId: "file-1" }} onDownload={download} />
  );
  expect(screen.getByRole("button", { name: "Özgün belgeyi indir" })).toBeEnabled();
  await act(async () => {
    reject(new Error("late source failure"));
  });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("shows specialized integrity failure alert when hash mismatch occurs", async () => {
  const download = vi.fn().mockRejectedValue(new Error("integrity_failed"));
  const user = userEvent.setup();
  render(<SourceDownload source={source} onDownload={download} />);

  await user.click(screen.getByRole("button", { name: "Özgün belgeyi indir" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "İndirilen dosya bütünlük kontrolünü geçemedi."
  );
});

it("uses native localized action and failure text in English", async () => {
  setLocale("en");
  render(
    <SourceDownload
      source={source}
      onDownload={async () => {
        throw new Error("integrity_failed");
      }}
    />
  );
  await userEvent.click(screen.getByRole("button", { name: "Download original document" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "The downloaded file failed integrity verification."
  );
});
