import { useLayoutEffect, useState, type ReactNode } from "react";
import { ThemeContext, type Theme } from "../lib/theme-context";

const THEME_STORAGE_KEY = "incagen-theme";

// Kaydedilmiş tercihi veya sistem temasını kullanarak ilk görünüm temasını belirler.
function getInitialTheme(): Theme {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Tema durumunu uygulama genelinde paylaşır ve seçimi tarayıcıda kalıcılaştırır.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme: () => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark")),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
