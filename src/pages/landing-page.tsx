import { useCallback, useEffect, useRef, useState } from "react";
import { animate, stagger } from "animejs";
import { ArrowRight, BarChart3, FileSearch, ShieldCheck, Sparkles } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatedLogo } from "../components/animated-logo";
import { AuthModal } from "../components/auth-modal";
import { ThemeToggle } from "../components/theme-toggle";
import { Button } from "../components/ui/button";
import { useAuth } from "../lib/auth-context";

const valueItems = [
  { icon: FileSearch, title: "Verilerinizi birleştirin", description: "Tablo, belge ve görsellerinizi tek analiz alanında hazırlayın." },
  { icon: BarChart3, title: "İçgörüleri görün", description: "Karmaşık verileri anlaşılır grafik, tablo ve önerilere dönüştürün." },
  { icon: ShieldCheck, title: "Kontrol sizde kalsın", description: "Dosyalar yalnız siz onay verdiğinizde işleme alınır." },
];

// Marka giriş sayfasını animasyonlu tanıtım, güven mesajları ve uygulama çağrısıyla sunar.
export function LandingPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const requested = location.state?.from;
  const authDestination = typeof requested === "string" && requested.startsWith("/app/") ? requested : "/app/new-analysis";
  const [authRequested, setAuthRequested] = useState(false);
  const authOpen = authRequested || location.state?.authOpen === true;
  const { user } = useAuth();
  const navigate = useNavigate();
  const closeAuth = useCallback(() => {
    setAuthRequested(false);
    navigate("/", { replace: true, state: null });
  }, [navigate]);

  // Oturum varsa çalışma alanına geçer; yoksa landing üzerinde kimlik modalını açar.
  function startAnalysis() {
    if (user) {
      navigate("/app/new-analysis");
      return;
    }

    setAuthRequested(true);
  }

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !pageRef.current) return;

    const intro = animate(pageRef.current.querySelectorAll("[data-reveal]"), {
      opacity: [0, 1],
      translateY: [18, 0],
      duration: 900,
      delay: stagger(100),
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
        <Link to="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Incagen ana sayfa">
          <AnimatedLogo className="h-9 w-9" compact />
          <span className="text-xl font-semibold tracking-[-0.04em]">Incagen</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-20 pt-10 sm:px-8 lg:px-10 lg:pt-16">
        <section className="mx-auto flex max-w-4xl flex-col items-center text-center">
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
            İşletme verilerinizi tek çalışma alanında hazırlayın; Incagen analizleri, içgörüleri ve uygulanabilir önerileri anlaşılır sonuçlara dönüştürsün.
          </p>
          <div data-reveal className="mt-8 flex flex-col gap-3 opacity-0 sm:flex-row">
            <Button type="button" size="default" className="h-12 rounded-xl px-6 text-base shadow-lg shadow-primary/20" onClick={startAnalysis}>
              Analize başla <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button asChild variant="outline" size="default" className="h-12 rounded-xl bg-card/60 px-6 text-base backdrop-blur-xl">
              <a href="#nasil-calisir">Nasıl çalışır?</a>
            </Button>
          </div>
        </section>

        <section id="nasil-calisir" data-reveal className="mx-auto mt-20 grid max-w-5xl gap-4 opacity-0 md:grid-cols-3" aria-labelledby="nasil-calisir-baslik">
          <h2 id="nasil-calisir-baslik" className="sr-only">Incagen nasıl çalışır?</h2>
          {valueItems.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-2xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur-xl">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-secondary/10 dark:text-secondary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-[-0.025em]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </article>
          ))}
        </section>
      </main>
      <AuthModal open={authOpen} onClose={closeAuth} onAuthenticated={() => navigate(authDestination)} />
    </div>
  );
}
