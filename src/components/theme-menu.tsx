import { t, useLocale } from "../i18n/runtime";
import { Droplets, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "../hooks/use-theme";
import type { ThemeMode, ThemeStyle } from "../lib/theme-context";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";

const modes = [
  { value: "light", label: "Açık", icon: Sun },
  { value: "dark", label: "Koyu", icon: Moon },
  { value: "system", label: "Sistem", icon: Monitor },
] as const;

const styles = [
  { value: "classic", label: "Klasik", icon: Palette },
  { value: "glass", label: "Liquid Glass", icon: Droplets },
] as const;

// Renk modunu ve yüzey görünümünü tek menüde seçtirir; seçim klavye ve ekran okuyucuyla radio grubu olarak duyurulur.
export function ThemeMenu() {
  useLocale();
  const { theme, mode, style, setMode, setStyle } = useTheme();
  const ModeIcon = mode === "system" ? Monitor : theme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="relative rounded-full border-border/70 bg-card/70 shadow-sm backdrop-blur-xl" aria-label={t("Tema")} data-testid="theme-menu">
          <ModeIcon className="h-[18px] w-[18px]" aria-hidden="true" />
          {style === "glass" && <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-gradient-to-br from-secondary to-primary ring-2 ring-card" aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("Mod")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mode} onValueChange={value => setMode(value as ThemeMode)}>
          {modes.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} data-theme-option={`mode-${value}`}><Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{t(label)}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("Görünüm")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={style} onValueChange={value => setStyle(value as ThemeStyle)}>
          {styles.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} data-theme-option={`style-${value}`}><Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{t(label)}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
