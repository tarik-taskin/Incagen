import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FileDropzone } from "./file-dropzone";

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
