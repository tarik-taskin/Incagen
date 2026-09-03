import { useEffect, useRef, useState } from "react";
import { animate, stagger } from "animejs";
import { ArrowUpRight, FileImage, FileText, Moon, Sparkles, Sun, Upload } from "lucide-react";
import { AnimatedLogo } from "./components/animated-logo";
import { Button } from "./components/ui/button";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  const savedTheme = localStorage.getItem("incagen-theme") as Theme | null;

  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("incagen-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !pageRef.current) return;

    const intro = animate(pageRef.current.querySelectorAll("[data-reveal]"), {
      opacity: [0, 1],
      translateY: [18, 0],
      duration: 900,
      delay: stagger(110),
      ease: "outExpo",
    });

    return () => {
      intro.cancel();
    };
  }, []);

  return (
    <div ref={pageRef} className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="dot-grid absolute inset-0 opacity-50 dark:opacity-25" />
      </div>

      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <a href="#" className="flex items-center gap-2.5" aria-label="Incagen ana sayfa">
          <AnimatedLogo className="h-9 w-9" compact />
          <span className="text-xl font-semibold tracking-[-0.04em]">incagen</span>
        </a>

        <Button
          variant="outline"
          size="icon"
          className="rounded-full border-border/70 bg-card/60 shadow-sm backdrop-blur-xl"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={theme === "dark" ? "Aydınlık moda geç" : "Karanlık moda geç"}
        >
          {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </Button>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-84px)] w-full max-w-7xl flex-col items-center justify-center px-5 pb-16 pt-8 sm:px-8 lg:px-10">
        <section className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          <div data-reveal className="mb-5 opacity-0">
            <AnimatedLogo className="h-24 w-24 sm:h-28 sm:w-28" />
          </div>

          <div data-reveal className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-3.5 py-1.5 text-sm font-medium text-primary opacity-0 dark:border-secondary/20 dark:bg-secondary/[0.08] dark:text-secondary">
            <Sparkles className="h-3.5 w-3.5" />
            Yapay zekâ destekli iş zekâsı
          </div>

          <h1 data-reveal className="max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.055em] opacity-0 sm:text-6xl lg:text-7xl">
            Verilerinizdeki büyüme fırsatlarını keşfedin.
          </h1>

          <p data-reveal className="mt-6 max-w-2xl text-pretty text-base leading-7 text-muted-foreground opacity-0 sm:text-lg">
            Belgelerinizi yükleyin; Incagen işletmenize özel analizleri, içgörüleri ve uygulanabilir önerileri sizin için hazırlasın.
          </p>

          <div data-reveal className="mt-10 w-full opacity-0 sm:mt-12">
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="sr-only" aria-label="Analiz edilecek belgeyi seç" />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="upload-card group relative w-full overflow-hidden rounded-[2rem] border border-primary/15 bg-card/70 p-2 text-left shadow-[0_28px_90px_-46px_rgba(76,42,133,0.55)] backdrop-blur-2xl transition duration-500 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_34px_100px_-42px_rgba(76,42,133,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background dark:border-secondary/15 dark:hover:border-secondary/30"
            >
              <span className="pointer-events-none absolute inset-x-20 top-0 h-px bg-gradient-to-r from-transparent via-secondary to-transparent opacity-80" />
              <span className="relative flex min-h-64 flex-col items-center justify-center rounded-[1.55rem] border border-dashed border-primary/20 bg-gradient-to-b from-primary/[0.055] to-transparent px-6 py-12 text-center transition-colors duration-500 group-hover:border-primary/40 dark:border-secondary/20 dark:from-secondary/[0.055] dark:group-hover:border-secondary/40 sm:min-h-72">
                <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_14px_35px_-14px_rgba(76,42,133,0.9)] transition duration-500 group-hover:scale-105 group-hover:-rotate-2 dark:bg-secondary dark:text-[#320E3B]">
                  <Upload className="h-7 w-7" strokeWidth={1.8} />
                </span>

                <span className="text-xl font-semibold tracking-[-0.025em] sm:text-2xl">Analiz için belgenizi seçin</span>
                <span className="mt-2 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
                  Dosyalarınızdan bir görsel veya PDF seçmek için bu alana tıklayın.
                </span>

                <span className="mt-7 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5">
                    <FileImage className="h-3.5 w-3.5 text-primary dark:text-secondary" /> PNG, JPG, WEBP
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary dark:text-secondary" /> PDF
                  </span>
                </span>

                <ArrowUpRight className="absolute right-6 top-6 h-5 w-5 text-muted-foreground/50 transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary dark:group-hover:text-secondary" />
              </span>
            </button>
          </div>

          <p data-reveal className="mt-5 text-xs text-muted-foreground/80 opacity-0">Belgeleriniz siz onay vermeden analiz edilmez.</p>
        </section>
      </main>
    </div>
  );
}

export default App;
