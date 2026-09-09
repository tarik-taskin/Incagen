import { useContext } from "react";
import { ThemeContext } from "../lib/theme-context";

// Tema sağlayıcısına güvenli erişim sunar ve yanlış kullanımda erken hata verir.
export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) throw new Error("useTheme, ThemeProvider içinde kullanılmalıdır.");

  return context;
}
