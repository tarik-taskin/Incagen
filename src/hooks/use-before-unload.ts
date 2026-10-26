import { useEffect } from "react";

// Yalnız kaybolabilecek yerel dosya/iş varken native ayrılma uyarısını bağlar; SPA gezinmesini engellemez.
export function useBeforeUnload(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    function preventLoss(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [enabled]);
}
