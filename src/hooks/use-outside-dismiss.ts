import { useEffect, type RefObject } from "react";
import { hasOpenPopover, isInsidePopover } from "../lib/popover-layers";

// Yalnız dışarıda başlayıp dışarıda biten birincil dokunmayı kapatma sayar; içerik sürükleme ve aktif işlemler korunur.
// Açık seçim/menü katmanı varken ilk dış dokunma yalnız o katmanı kapatır.
export function useOutsideDismiss<T extends HTMLElement>(ref: RefObject<T | null>, onDismiss: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let outsidePointer: number | null = null;
    let completedOutside = false;
    const outside = (event: PointerEvent) => {
      const element = ref.current;
      if (!element || isInsidePopover(event.target)) return false;
      const bounds = element.getBoundingClientRect();
      return !element.contains(event.target as Node) || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
    };
    const down = (event: PointerEvent) => { completedOutside = false; outsidePointer = event.isPrimary && event.button === 0 && !hasOpenPopover() && outside(event) ? event.pointerId : null; };
    const up = (event: PointerEvent) => {
      completedOutside = outsidePointer === event.pointerId && outside(event);
      outsidePointer = null;

    };
    // Touch sonrasındaki uyumluluk fare olayları odak dönüşünü ezmesin: kapanış click aşamasında tamamlanır.
    const click = () => { const dismiss = completedOutside; completedOutside = false; if (dismiss) onDismiss(); };
    const cancel = () => { outsidePointer = null; completedOutside = false; };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", cancel, true);
    document.addEventListener("click", click, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", cancel, true);
      document.removeEventListener("click", click, true);
    };
  }, [ref, onDismiss, enabled]);
}
