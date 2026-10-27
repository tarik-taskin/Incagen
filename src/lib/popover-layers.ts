const POPPER_SELECTOR = "[data-radix-popper-content-wrapper]";

// Açık bir Radix seçim/menü katmanı varken dış tıklama ve Escape önce o katmanı kapatmalı; modal açık kalır.
export function hasOpenPopover() {
  return typeof document !== "undefined" && document.querySelector(POPPER_SELECTOR) !== null;
}

// Portal ile modalın dışına çizilen seçenek listesindeki tıklamayı modalın içi sayar.
export function isInsidePopover(target: EventTarget | null) {
  return target instanceof Element && target.closest(POPPER_SELECTOR) !== null;
}
