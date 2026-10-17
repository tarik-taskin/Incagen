import { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useOutsideDismiss } from "./use-outside-dismiss";

// Native backdrop hedefini ve fare/dokunma hareketini tarayıcı koordinatlarıyla temsil eder.
function pointer(target: Element | Document, type: string, x: number, overrides = {}) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { clientX: x, clientY: x, pointerId: 1, button: 0, isPrimary: true, ...overrides });
  fireEvent(target, event);
  if (type === "pointerup") fireEvent.click(target);
}
function Window({ close, enabled = true }: { close: () => void; enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideDismiss(ref, close, enabled);
  return <div ref={ref} data-testid="window"><button>İçerik</button></div>;
}
function setup(enabled = true) {
  const close = vi.fn(); const view = render(<Window close={close} enabled={enabled} />);
  const panel = screen.getByTestId("window");
  vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({ left: 20, top: 20, right: 200, bottom: 200 } as DOMRect);
  return { close, panel, ...view };
}
describe("açılır pencere dış etkileşimi", () => {
  it("native dialog backdrop'unda fare ve dokunmayı kapatır; içerik tıklaması kapatmaz", () => {
    const { close, panel } = setup();
    pointer(screen.getByRole("button"), "pointerdown", 50); pointer(screen.getByRole("button"), "pointerup", 50); expect(close).not.toHaveBeenCalled();
    for (const pointerType of ["mouse", "touch"]) { pointer(panel, "pointerdown", 2, { pointerType }); pointer(panel, "pointerup", 2, { pointerType }); }
    expect(close).toHaveBeenCalledTimes(2);
  });
  it("özel modalın dışındaki arka planı kapatır", () => {
    const { close } = setup(); pointer(document.body, "pointerdown", 50); pointer(document.body, "pointerup", 50); expect(close).toHaveBeenCalledOnce();
  });
  it("içeriden dışarı veya dışarıdan içeri sürükleme ile iptal edilmiş hareketi kapatma saymaz", () => {
    const { close, panel } = setup();
    pointer(panel, "pointerdown", 50); pointer(panel, "pointerup", 2);
    pointer(panel, "pointerdown", 2); pointer(panel, "pointerup", 50);
    pointer(panel, "pointerdown", 2); pointer(panel, "pointercancel", 2); pointer(panel, "pointerup", 2);
    pointer(panel, "pointerdown", 2, { isPrimary: false }); pointer(panel, "pointerup", 2);
    expect(close).not.toHaveBeenCalled();
  });
  it("aktif işlemde ve unmount sonrası dış kapatmayı engeller", () => {
    const { close, panel, unmount } = setup(false); pointer(panel, "pointerdown", 2); pointer(panel, "pointerup", 2); expect(close).not.toHaveBeenCalled();
    unmount(); pointer(document.body, "pointerdown", 2); pointer(document.body, "pointerup", 2); expect(close).not.toHaveBeenCalled();
  });
});
