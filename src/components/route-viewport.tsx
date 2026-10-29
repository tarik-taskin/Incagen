import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// Yeni ekranı baştan açar; raporun bölüm adreslerini kendi kaynak/bölüm kaydırma mantığına bırakır.
export function RouteViewport() {
  const { pathname, hash, key } = useLocation();
  const previousPath = useRef<string | null>(null);
  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = previous; };
  }, []);
  useLayoutEffect(() => {
    const changed = previousPath.current !== pathname;
    previousPath.current = pathname;
    if (!hash && (changed || pathname === "/app/new-analysis")) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname, hash, key]);
  return null;
}
