import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from "./components/theme-provider";
import { AuthProvider } from "./components/auth-provider";
import { LocaleDirection } from "./components/locale-direction";
import { applyTheme, readThemeMode, readThemeStyle, resolveTheme } from "./lib/theme-storage";
// Fontlar projeden sunulur; unicode-range sayesinde yalnız sayfadaki alfabe için dosya iner.
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/noto-sans-arabic";
import "./index.css";

// Kayıtlı temayı React çizmeden önce uygular; açılışta yanlış renk modunun yanıp sönmesini önler.
applyTheme(resolveTheme(readThemeMode()), readThemeStyle());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <LocaleDirection>
          <AuthProvider><App /></AuthProvider>
        </LocaleDirection>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
