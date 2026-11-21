import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FileDropzone } from "./file-dropzone";
import { SUPPORTED_FORMAT_GROUPS } from "../../features/files/file-rules";
import { SUPPORTED_FILE_EXTENSIONS } from "../../../functions/src/contracts";
import { useFileSelectionState } from "../../hooks/use-file-selection";
import { languages, setLocale, t } from "../../i18n/runtime";

// Gerçek dosya sürüklemesini metin/bağlantı sürüklemesinden ayıran sentetik DataTransfer girdisi.
const transfer = (files: File[] = [], types = ["Files"]) => ({ dataTransfer: { files, types } });

it("ignores text drags and clears nested file drag highlighting on leave, outside drop and cancellation", () => {
  const select = vi.fn();
  render(<FileDropzone onFilesSelected={select} />);
  const area = screen.getByRole("group");
  fireEvent.dragEnter(area, transfer([], ["text/plain"]));
  expect(screen.getByText("Belgelerinizi ekleyin")).toBeVisible();
  expect(fireEvent.drop(area, transfer([], ["text/plain"]))).toBe(true);
  expect(select).not.toHaveBeenCalled();
  fireEvent.dragEnter(area, transfer()); fireEvent.dragEnter(area, transfer());
  fireEvent.dragLeave(area, transfer());
  expect(screen.getByText("Belgelerinizi buraya bırakın")).toBeVisible();
  fireEvent.dragLeave(area, transfer());
  expect(screen.getByText("Belgelerinizi ekleyin")).toBeVisible();
  for (const event of ["drop", "dragend"]) {
    fireEvent.dragEnter(area, transfer());
    fireEvent(window, new Event(event));
    expect(screen.getByText("Belgelerinizi ekleyin")).toBeVisible();
  }
  expect(fireEvent.dragOver(window, transfer())).toBe(false);
  expect(fireEvent.drop(window, transfer([new File(["data"], "outside.csv")]))).toBe(false);
  expect(fireEvent.drop(window, transfer([], ["text/uri-list"]))).toBe(true);
  expect(select).not.toHaveBeenCalled();
});

it("keeps file selections intact, permits reselection and ignores disabled or cancelled selections", () => {
  const select = vi.fn();
  const file = new File(["data"], "source.csv", { type: "text/csv" });
  const { rerender } = render(<FileDropzone onFilesSelected={select} />);
  const input = screen.getByLabelText("Analiz edilecek dosyaları seç") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [] } });
  expect(select).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { files: [file] } });
  expect(input.value).toBe("");
  fireEvent.change(input, { target: { files: [file] } });
  expect(select.mock.calls).toEqual([[[file]], [[file]]]);
  const area = screen.getByRole("group");
  fireEvent.dragEnter(area, transfer());
  const button = screen.getByRole("button");
  button.focus();
  rerender(<FileDropzone unavailable={{ title: "Seçim kapalı", detail: "Bir dosya kaldırın." }} onFilesSelected={select} />);
  expect(screen.getByText("Seçim kapalı")).toBeVisible();
  expect(button).toHaveAttribute("aria-disabled", "true");
  expect(button).toHaveAccessibleDescription("Bir dosya kaldırın.");
  expect(button).toHaveFocus();
  const openPicker = vi.spyOn(input, "click");
  fireEvent.click(button);
  expect(openPicker).not.toHaveBeenCalled();
  fireEvent.drop(area, transfer([file]));
  fireEvent.change(input, { target: { files: [file] } });
  expect(select).toHaveBeenCalledTimes(2);
  rerender(<FileDropzone onFilesSelected={select} />);
  fireEvent.drop(area, transfer([file]));
  expect(select).toHaveBeenLastCalledWith([file]);
  expect(select).toHaveBeenCalledTimes(3);
});

// Gerçek doğrulayıcıyla son kabul edilen grubun taslak bildirimini sınar.
function ValidatingDropzone({ show }: { show: boolean }) {
  const { addFiles, lastAccepted } = useFileSelectionState();
  return show ? <FileDropzone onFilesSelected={addFiles} lastAccepted={lastAccepted} /> : null;
}

it("confirms only accepted files, announces equal-sized additions and does not replay after navigation", () => {
  const { rerender } = render(<ValidatingDropzone show />);
  const input = screen.getByLabelText("Analiz edilecek dosyaları seç");
  const first = new File(["region,sales"], "source.csv");
  const second = new File(["notes"], "notes.txt");
  const unsupported = new File(["data"], "bad.exe");

  fireEvent.change(input, { target: { files: [first, unsupported] } });
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("Seçime 1 dosya eklendi");
  const initialMessage = status.firstElementChild;

  fireEvent.drop(screen.getByRole("group"), transfer([first, second]));
  expect(status).toHaveTextContent("Seçime 1 dosya eklendi");
  expect(status.firstElementChild).not.toBe(initialMessage);

  fireEvent.drop(screen.getByRole("group"), transfer([first, second, unsupported]));
  expect(status).toBeEmptyDOMElement();
  expect(screen.queryByText("+1")).not.toBeInTheDocument();

  fireEvent.drop(screen.getByRole("group"), transfer([new File(["notes"], "third.txt")]));
  expect(status).toHaveTextContent("Seçime 1 dosya eklendi");
  rerender(<ValidatingDropzone show={false} />);
  rerender(<ValidatingDropzone show />);
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

it("expires only the current score and retains the selection guidance", () => {
  vi.useFakeTimers();
  try {
    render(<ValidatingDropzone show />);
    const area = screen.getByRole("group");
    fireEvent.drop(area, transfer([new File(["one"], "first.txt")]));
    expect(screen.getByText("+1")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1500));
    fireEvent.drop(area, transfer([new File(["two"], "second.txt"), new File(["three"], "third.txt")]));
    expect(screen.queryByText("+1")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByText("+2")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1400));
    expect(screen.queryByText("+2")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Seçime 2 dosya eklendi");
    expect(screen.getByText("Seçiminizi aşağıdaki listeden düzenleyebilirsiniz.")).toBeVisible();
  } finally {
    vi.useRealTimers();
  }
});

it("uses the locale's number formatting and singular or plural draft acknowledgement", () => {
  try {
    for (const { code, tag } of languages) {
      setLocale(code);
      for (const count of [1, 2, 5]) {
        const message = t("Seçime {0} dosya eklendi", count);
        expect(message).toContain(new Intl.NumberFormat(tag).format(count));
        if (code !== "tr") expect(message).not.toMatch(/Seçime|\{0\}/);
      }
    }
    setLocale("en");
    expect(t("Seçime {0} dosya eklendi", 1)).toBe("1 file added to the selection");
    expect(t("Seçime {0} dosya eklendi", 2)).toBe("2 files added to the selection");
  } finally {
    setLocale("tr");
  }
});

it("displays every accepted file extension including TSV grouped by localized category across all 6 locales", () => {
  try {
    for (const { code } of languages) {
      setLocale(code);
      const { unmount } = render(<FileDropzone onFilesSelected={() => {}} />);
      const guide = screen.getByLabelText(t("Desteklenen formatlar"));
      const text = guide.textContent?.toLowerCase() ?? "";

      for (const extension of SUPPORTED_FILE_EXTENSIONS) {
        expect(text).toContain(extension);
      }
      for (const group of SUPPORTED_FORMAT_GROUPS) {
        expect(guide).toHaveTextContent(t(group.category));
      }
      expect(text).not.toContain("exe");
      unmount();
    }
  } finally {
    setLocale("tr");
  }
});
