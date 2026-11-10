import { useCallback, useSyncExternalStore } from "react";

const pendingOnServer = () => false;

// Saati React state'ine kopyalamadan, yalnız son tarihte veya görünürlük değişince güncellenen dış sinyal sunar.
export function useDeadlineReached(deadline: number | undefined) {
  const getSnapshot = useCallback(() => deadline === undefined || !Number.isFinite(deadline) || Date.now() >= deadline, [deadline]);
  const subscribe = useCallback((notify: () => void) => {
    if (deadline === undefined || !Number.isFinite(deadline)) return () => {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    // Ertelenmiş sekme veya sistem saati değişiminde kalan süreyi tekrar hesaplar; iş başlatmaz.
    function refresh() {
      if (!active) return;
      clearTimeout(timer);
      notify();
      if (!active) return;
      const remaining = deadline! - Date.now();
      timer = remaining > 0 ? setTimeout(refresh, Math.min(remaining + 1, 2_147_483_647)) : undefined;
    }
    function onVisibility() { if (document.visibilityState === "visible") refresh(); }
    refresh();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { active = false; clearTimeout(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [deadline]);
  return useSyncExternalStore(subscribe, getSnapshot, pendingOnServer);
}
