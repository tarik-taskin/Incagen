import { useCallback, useEffect, useRef, useState } from "react";
import { animate, stagger } from "animejs";
import { ArrowRight, FileCheck2, FileSearch, Files, FolderOpen, Lightbulb, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatedLogo } from "../components/animated-logo";
import { AuthModal } from "../components/auth-modal";
import { ThemeToggle } from "../components/theme-toggle";
import { Button } from "../components/ui/button";
import { useAuth } from "../lib/auth-context";

const steps = [
  { number: "01", icon: Files, title: "Bir konunun belgelerini toplayın", description: "Müşteri geri bildirimleri veya finans verileri gibi ilişkili tabloları, sunumları ve metinleri tek çalışmada bir araya getirin." },
  { number: "02", icon: FileSearch, title: "Kaynağı kaybetmeden hazırlayın", description: "Dosyaların gerçek türü doğrulanır, içerik okunabilir bölümlere ayrılır ve her bölümün kaynak konumu korunur." },
  { number: "03", icon: FolderOpen, title: "Çalışmanıza yeniden dönün", description: "Hazırlık özetini geçmişten açın. İhtiyacınız kalmayan kayıtları ve kaynak dosyaları kendi çalışma alanınızdan yönetin." },
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

  // Eski bölüm bağlantılarını temiz ana sayfa adresine taşıyarak açılışı en üstten başlatır.
  useEffect(() => {
    if (location.hash !== "#nasil-calisir") return;
    navigate("/", { replace: true, state: location.state });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.hash, location.state, navigate]);

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

      <main className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-20 pt-5 sm:px-8 lg:px-10 lg:pt-10">
        <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-6">
          <section className="relative flex min-w-0 flex-col overflow-hidden rounded-[2rem] border border-primary/10 bg-gradient-to-br from-card via-card to-primary/[0.08] p-7 shadow-[0_24px_80px_-55px_rgba(70,35,110,0.35)] dark:border-secondary/10 dark:to-secondary/[0.07] sm:p-10 lg:min-h-[44rem] lg:p-12" aria-labelledby="landing-title">
            <div className="pointer-events-none absolute -right-28 -top-24 h-80 w-80 rounded-full border border-primary/10 bg-primary/[0.04] dark:border-secondary/10" aria-hidden="true" />
            <div data-reveal className="relative opacity-0"><AnimatedLogo className="h-20 w-20 sm:h-24 sm:w-24" /></div>
            <div data-reveal className="relative mt-7 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-3.5 py-1.5 text-xs font-semibold text-primary opacity-0 dark:border-secondary/20 dark:text-secondary"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Yapay zekâ destekli iş zekâsı</div>
            <h1 id="landing-title" data-reveal className="relative mt-6 max-w-2xl text-balance text-[clamp(2.6rem,4vw,4.6rem)] font-semibold leading-[1.05] tracking-[-0.065em] opacity-0">Verilerinizdeki büyüme fırsatlarını keşfedin.</h1>
            <p data-reveal className="relative mt-6 max-w-xl text-pretty text-base leading-7 text-muted-foreground opacity-0">Bir konunun belgelerini aynı çalışma alanında toplayın. Incagen, içeriği kaynaklarıyla düzenli bir başlangıca dönüştürür; içgörü ve öneri katmanı sonraki aşamada açılacak.</p>
            <div data-reveal className="relative mt-8 opacity-0"><Button type="button" className="h-12 rounded-xl px-6 text-base shadow-lg shadow-primary/20" onClick={startAnalysis}>Analize başla <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Button></div>
            <div className="relative mt-auto grid gap-3 pt-12 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4 backdrop-blur-sm"><FileCheck2 className="h-5 w-5 text-primary dark:text-secondary" aria-hidden="true" /><p className="mt-3 text-sm font-semibold">Kaynağı belli içerik</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Her bölümün hangi belgeden geldiğini görün.</p></div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4 backdrop-blur-sm"><LockKeyhole className="h-5 w-5 text-primary dark:text-secondary" aria-hidden="true" /><p className="mt-3 text-sm font-semibold">Kontrol sizde</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Hazırlamayı siz başlatın, kayıtları siz yönetin.</p></div>
            </div>
          </section>

          <section id="nasil-calisir" className="min-w-0 scroll-mt-8 rounded-[2rem] border border-border/80 bg-card/90 p-7 shadow-[0_24px_80px_-55px_rgba(70,35,110,0.3)] sm:p-10 lg:p-12" aria-labelledby="nasil-calisir-baslik">
            <h2 id="nasil-calisir-baslik" className="max-w-xl text-balance text-3xl font-semibold leading-[1.1] tracking-[-0.05em] sm:text-4xl">Dağınık dosyalardan <span className="text-primary dark:text-secondary">düzenli bir başlangıca.</span></h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">Belge hazırlığının her adımı anlaşılır: konuyu seçin, kaynakları koruyarak düzenleyin, çalışmanıza dilediğinizde geri dönün.</p>
            <div className="relative mt-7 space-y-3 before:absolute before:bottom-8 before:left-5 before:top-8 before:w-px before:bg-primary/15 dark:before:bg-secondary/20">
              {steps.map(({ number, icon: Icon, title, description }) => (
                <article key={number} className="relative flex gap-4 rounded-2xl border border-border/70 bg-background/65 p-4 transition-colors hover:border-primary/25 hover:bg-background dark:hover:border-secondary/25 sm:p-5">
                  <span className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-card text-primary dark:border-secondary/20 dark:text-secondary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary dark:text-secondary">Adım {number}</span><h3 className="mt-1 text-base font-semibold tracking-tight">{title}</h3><p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">{description}</p></div>
                </article>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-card p-5 dark:border-secondary/20 dark:from-secondary/[0.09]">
              <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm dark:text-secondary"><Lightbulb className="h-4 w-4" aria-hidden="true" /></span><div><p className="text-sm font-semibold">Bir konu. Daha net bir bakış.</p><p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">Tek bir soruya ait belgeleri birlikte hazırlayın; kaynakları korunmuş içerik, sonraki değerlendirme için sağlam bir temel oluştursun.</p></div></div>
              <div className="mt-4 flex flex-wrap gap-2" aria-label="Örnek analiz konuları"><span className="rounded-full border border-primary/10 bg-card/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground dark:border-secondary/15">Müşteri deneyimi</span><span className="rounded-full border border-primary/10 bg-card/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground dark:border-secondary/15">Finansal görünüm</span><span className="rounded-full border border-primary/10 bg-card/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground dark:border-secondary/15">Operasyon</span></div>
            </div>
          </section>
        </div>

        <section className="mt-6 grid gap-5 rounded-[2rem] border border-primary/10 bg-gradient-to-br from-primary/[0.06] via-card to-card p-7 shadow-sm dark:border-secondary/15 dark:from-secondary/[0.07] sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10" aria-labelledby="control-title">
          <div><span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary dark:text-secondary"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Kontrol sizde</span><h2 id="control-title" className="mt-3 max-w-2xl text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Verinizin yolculuğu görünür, karar sizin.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Dosyalar yalnız hazırlama işlemini başlattığınızda işlenir. İçerik türü kontrol edilir, kaynak konumları korunur ve kayıtları çalışma alanınızdan yönetirsiniz.</p></div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1"><span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm"><FileCheck2 className="h-4 w-4 text-primary dark:text-secondary" aria-hidden="true" /> Kaynakları takip edin</span><span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm"><LockKeyhole className="h-4 w-4 text-primary dark:text-secondary" aria-hidden="true" /> Kayıtları siz yönetin</span></div>
        </section>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-7"><p className="text-sm text-muted-foreground">Hazır olduğunuzda ilk çalışma alanınızı açın.</p><Button onClick={startAnalysis} className="h-11 gap-2 rounded-xl px-5">Çalışma alanına geç <ArrowRight className="h-4 w-4" aria-hidden="true" /></Button></div>
      </main>
      <AuthModal open={authOpen} onClose={closeAuth} onAuthenticated={() => navigate(authDestination)} />
    </div>
  );
}
