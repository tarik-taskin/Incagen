import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/use-theme";
import { Button } from "./ui/button";

// Açık ve koyu tema arasında erişilebilir bir kontrol ile geçiş yapar.
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-full border-border/70 bg-card/70 shadow-sm backdrop-blur-xl"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Aydınlık moda geç" : "Karanlık moda geç"}
    >
      {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </Button>
  );
}
