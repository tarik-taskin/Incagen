import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeContext, type ThemeMode, type ThemeStyle } from "../lib/theme-context";
import { applyTheme, DARK_QUERY, readThemeMode, readThemeStyle, resolveTheme, saveThemePreference, systemPrefersDark } from "../lib/theme-storage";

// Mod ve yüzey görünümünü uygulama genelinde paylaşır; sistem modunda işletim sistemi değişimini canlı izler.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readThemeMode);
  const [style, setStyle] = useState<ThemeStyle>(readThemeStyle);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const theme = resolveTheme(mode, systemDark);

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const update = () => setSystemDark(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    applyTheme(theme, style);
    saveThemePreference(mode, style);
  }, [mode, style, theme]);

  const value = useMemo(() => ({
    theme,
    mode,
    style,
    setMode,
    setStyle,
    toggleTheme: () => setMode(theme === "dark" ? "light" : "dark"),
  }), [mode, style, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
