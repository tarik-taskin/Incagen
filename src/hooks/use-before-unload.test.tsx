import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBeforeUnload } from "./use-before-unload";

// Native diyaloğu açmadan ayrılma olayının engellenip engellenmediğini kontrol eder.
function leave() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("Taslağı kaybetmeden ayrılma", () => {
  it("yalnız risk varken bağlanır; temizleme ve unmount sonrasında ayrılmayı engellemez", () => {
    const { rerender, unmount } = renderHook(({ enabled }) => useBeforeUnload(enabled), { initialProps: { enabled: false } });
    expect(leave()).toBe(false);
    rerender({ enabled: true });
    expect(leave()).toBe(true);
    rerender({ enabled: false });
    expect(leave()).toBe(false);
    rerender({ enabled: true });
    unmount();
    expect(leave()).toBe(false);
  });
});
