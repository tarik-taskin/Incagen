import { useCallback, useEffect, useRef, useState } from "react";
import { animate, stagger } from "animejs";
import { ArrowRight, Check, FileCheck2, FileSearch, Files, FolderOpen, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatedLogo } from "../components/animated-logo";
import { AuthModal } from "../components/auth-modal";
import { ThemeToggle } from "../components/theme-toggle";
import { Button } from "../components/ui/button";
import { useAuth } from "../lib/auth-context";

const steps = [
  { number: "01", icon: Files, title: "Belgeleri bir araya getirin", description: "Tabloları, sunumları, metinleri ve görselleri aynı çalışma alanında seçin. Hangi dosyaların hazırlanacağını siz belirlersiniz." },
  { number: "02", icon: FileSearch, title: "İçeriği kaynaklarıyla hazırlayın", description: "Belgeler doğrulanır ve okunabilir bölümlere ayrılır. Hazırlık özetinde kaynak dosyaları ve konumları korunur." },
  { number: "03", icon: FolderOpen, title: "Çalışmanıza geri dönün", description: "Hazırlanan kayıtları geçmişten yeniden açın; artık ihtiyacınız olmayanları kaynaklarıyla birlikte yönetin." },
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

  // İç sayfalardan gelen bağlantıyı bölüm yüklendikten sonra doğru konuma taşır.
  useEffect(() => {
    if (location.hash !== "#nasil-calisir") return;
    const frame = requestAnimationFrame(() => document.getElementById("nasil-calisir")?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [location.hash]);

  return (
    <div ref={pageRef} className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="dot-grid absolute inset-0 opacity-50 dark:opacity-25" />
      </div>

      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link to={user ? "/app/new-analysis" : "/"} className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={user ? "Yeni analize git" : "Incagen ana sayfa"}>
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

        <section id="nasil-calisir" className="relative mx-auto mt-28 max-w-6xl scroll-mt-8 sm:mt-36" aria-labelledby="nasil-calisir-baslik">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary shadow-sm dark:border-secondary/20 dark:text-secondary"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Nasıl çalışır?</span>
              <h2 id="nasil-calisir-baslik" className="mt-5 max-w-xl text-balance text-3xl font-semibold leading-[1.12] tracking-[-0.045em] sm:text-5xl">Dağınık dosyalardan <span className="text-primary dark:text-secondary">düzenli bir başlangıca.</span></h2>
            </div>
            <p className="max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">İlk adımda belgelerinizi güvenle hazırlarsınız. Hangi dosyanın nereden geldiğini kaybetmeden aynı çalışma alanında ilerlersiniz. Yapay zekâ yorumları ve öneriler sonraki aşamada eklenecek.</p>
          </div>

          <div className="mt-9 grid gap-4 lg:grid-cols-3">
            {steps.map(({ number, icon: Icon, title, description }) => (
              <article key={number} className="group relative overflow-hidden rounded-[1.75rem] border border-border/80 bg-card/90 p-6 shadow-[0_16px_50px_-38px_rgba(55,20,95,0.6)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_22px_55px_-34px_rgba(55,20,95,0.42)] dark:hover:border-secondary/35 sm:p-7">
                <div className="pointer-events-none absolute -right-9 -top-12 h-36 w-36 rounded-full bg-primary/[0.06] blur-2xl dark:bg-secondary/[0.08]" aria-hidden="true" />
                <div className="relative flex items-start justify-between gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-secondary/10 dark:text-secondary"><Icon className="h-6 w-6" aria-hidden="true" /></span><span className="text-4xl font-semibold tracking-[-0.06em] text-primary/15 dark:text-secondary/20" aria-hidden="true">{number}</span></div>
                <h3 className="relative mt-9 text-xl font-semibold tracking-[-0.035em]">{title}</h3>
                <p className="relative mt-3 min-h-20 text-sm leading-6 text-muted-foreground">{description}</p>
                <div className="relative mt-8 flex items-center gap-2 border-t border-border/70 pt-4 text-xs font-semibold text-primary dark:text-secondary"><Check className="h-3.5 w-3.5" aria-hidden="true" /> Adım {number}</div>
              </article>
            ))}
          </div>

          <div className="relative mt-5 overflow-hidden rounded-[1.75rem] bg-[#2c1645] p-6 text-white shadow-xl shadow-primary/10 sm:p-8 lg:p-10">
            <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl"><span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-200"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Kontrol sizde</span><h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Verinizin yolculuğu görünür, karar sizin.</h3><p className="mt-3 text-sm leading-6 text-violet-100/80">Dosyalar yalnız siz hazırlama işlemini başlattığınızda işlenir. Kaynaklarınızı ve kayıtlarınızı çalışma alanından yönetirsiniz.</p></div>
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col"><span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm"><FileCheck2 className="h-4 w-4 text-violet-200" aria-hidden="true" /> Kaynakları takip edin</span><span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm"><LockKeyhole className="h-4 w-4 text-violet-200" aria-hidden="true" /> Kayıtları siz yönetin</span></div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-7"><p className="text-sm text-muted-foreground">Hazır olduğunuzda ilk çalışma alanınızı açın.</p><Button onClick={startAnalysis} className="h-11 gap-2 rounded-xl px-5">Çalışma alanına geç <ArrowRight className="h-4 w-4" aria-hidden="true" /></Button></div>
        </section>
      </main>
      <AuthModal open={authOpen} onClose={closeAuth} onAuthenticated={() => navigate(authDestination)} />
    </div>
  );
}
