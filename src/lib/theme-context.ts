import { createContext } from "react";

// Ekranda uygulanan renk modu; grafikler ve tema bağımlı bileşenler bunu okur.
export type Theme = "light" | "dark";
// Kullanıcının seçtiği mod; "system" işletim sistemi tercihini izler.
export type ThemeMode = Theme | "system";
// Yüzey görünümü; Liquid Glass yalnız yüzey ve arka plan katmanını değiştirir.
export type ThemeStyle = "classic" | "glass";

export type ThemeContextValue = {
  theme: Theme;
  mode: ThemeMode;
  style: ThemeStyle;
  setMode: (mode: ThemeMode) => void;
  setStyle: (style: ThemeStyle) => void;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);
