import type { Theme, ThemeMode, ThemeStyle } from "./theme-context";

const MODE_STORAGE_KEY = "incagen-theme";
const STYLE_STORAGE_KEY = "incagen-style";
const DARK_QUERY = "(prefers-color-scheme: dark)";

// Kayıtlı modu okur; eski "light/dark" kayıtları aynen geçerlidir, kayıt yoksa sistem izlenir.
export function readThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(MODE_STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    // Depolama kapalıysa sistem tercihiyle devam edilir.
  }
  return "system";
}

// Kayıtlı yüzey görünümünü okur; varsayılan Klasik'tir.
export function readThemeStyle(): ThemeStyle {
  try {
    return localStorage.getItem(STYLE_STORAGE_KEY) === "glass" ? "glass" : "classic";
  } catch {
    return "classic";
  }
}

// Seçimi tarayıcıda saklar; depolama erişilemezse görünüm yine de oturum boyunca uygulanır.
export function saveThemePreference(mode: ThemeMode, style: ThemeStyle) {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
    localStorage.setItem(STYLE_STORAGE_KEY, style);
  } catch {
    // Gizli pencere gibi ortamlarda tercih yalnız bellekte kalır.
  }
}

export function systemPrefersDark() {
  return window.matchMedia(DARK_QUERY).matches;
}

export function resolveTheme(mode: ThemeMode, systemDark = systemPrefersDark()): Theme {
  return mode === "system" ? (systemDark ? "dark" : "light") : mode;
}

// Sınıf, görünüm niteliği ve tarayıcı çubuğu rengini tek yerden uygular; ilk çizimden önce de çağrılır.
export function applyTheme(theme: Theme, style: ThemeStyle) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  if (style === "glass") root.dataset.style = "glass";
  else delete root.dataset.style;
  const background = getComputedStyle(root).getPropertyValue("--background").trim();
  if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", `hsl(${background})`);
}

export { DARK_QUERY };
