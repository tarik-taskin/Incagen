import { afterEach, expect, it, vi } from "vitest";
import { downloadBlob } from "./download-blob";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each([false, true])("releases the object URL after a native download attempt (throws=%s)", fails => {
  vi.useFakeTimers();
  const file = new Blob(["content"]);
  const objectUrl = "blob:https://example.test/test";
  const createObjectURL = vi.fn(() => objectUrl);
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.href).toBe(objectUrl);
    expect(this.download).toBe("metrics.csv");
    if (fails) throw new Error("Download was unavailable.");
  });
  if (fails) expect(() => downloadBlob(file, "metrics.csv")).toThrow(/unavailable/);
  else downloadBlob(file, "metrics.csv");

  expect(createObjectURL).toHaveBeenCalledExactlyOnceWith(file);
  expect(click).toHaveBeenCalledOnce();
  expect(revokeObjectURL).not.toHaveBeenCalled();
  vi.runOnlyPendingTimers();
  expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(objectUrl);
});
