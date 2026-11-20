import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FileDropzone } from "./file-dropzone";
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
  fireEvent.drop(area, transfer([], ["text/plain"]));
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
  rerender(<FileDropzone disabled onFilesSelected={select} />);
  expect(screen.getByText("Belgelerinizi ekleyin")).toBeVisible();
  expect(screen.getByRole("button")).toBeDisabled();
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
  expect(status).toHaveTextContent("Taslağa 1 belge eklendi");
  const initialMessage = status.firstElementChild;

  fireEvent.drop(screen.getByRole("group"), transfer([first, second]));
  expect(status).toHaveTextContent("Taslağa 1 belge eklendi");
  expect(status.firstElementChild).not.toBe(initialMessage);

  fireEvent.drop(screen.getByRole("group"), transfer([first, second, unsupported]));
  expect(status).toBeEmptyDOMElement();
  expect(screen.queryByText("+1")).not.toBeInTheDocument();

  fireEvent.drop(screen.getByRole("group"), transfer([new File(["notes"], "third.txt")]));
  expect(status).toHaveTextContent("Taslağa 1 belge eklendi");
  rerender(<ValidatingDropzone show={false} />);
  rerender(<ValidatingDropzone show />);
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

it("uses the locale's number formatting and singular or plural draft acknowledgement", () => {
  try {
    for (const { code, tag } of languages) {
      setLocale(code);
      for (const count of [1, 2, 5]) {
        const message = t("Taslağa {0} belge eklendi", count);
        expect(message).toContain(new Intl.NumberFormat(tag).format(count));
        if (code !== "tr") expect(message).not.toMatch(/Taslağa|\{0\}/);
      }
    }
    setLocale("en");
    expect(t("Taslağa {0} belge eklendi", 1)).toBe("1 document added to your draft");
    expect(t("Taslağa {0} belge eklendi", 2)).toBe("2 documents added to your draft");
  } finally {
    setLocale("tr");
  }
});
