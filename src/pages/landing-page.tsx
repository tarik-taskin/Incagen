import { LanguageSelector } from "../components/language-selector";
import { SupportLauncher } from "../components/support-launcher";
import { t, useLocale } from "../i18n/runtime";
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
  useLocale();
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
    <div ref={pageRef} className="relative min-h-screen overflow-hidden bg-background text-foreground glass:bg-transparent">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="dot-grid absolute inset-0 opacity-50 dark:opacity-25" />
      </div>

      <a href="#landing-main" className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-4">{t("İçeriğe geç")}</a>
      <header className="brand-inverse relative z-20 border-b border-white/[0.08]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10">
          <Link to={user ? "/app/new-analysis" : "/"} className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={user ? t("Yeni analize git") : t("Incagen ana sayfa")}>
            <AnimatedLogo className="h-9 w-9" compact />
            <span className="text-xl font-semibold tracking-[-0.04em]">{t("Incagen")}</span>
          </Link>
          <div className="flex items-center gap-2"><LanguageSelector /><ThemeToggle /></div>
        </div>
      </header>

      <main id="landing-main" tabIndex={-1} className="relative z-10 outline-none">
        <section className="surface brand-hero relative isolate overflow-hidden border-x-0 border-t-0 px-5 pb-10 pt-14 sm:px-8 sm:pb-14 sm:pt-20 lg:px-10 lg:pt-24" aria-labelledby="landing-title">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(90deg,transparent_0px,transparent_7px,hsl(199_98%_56%_/_0.025)_8px,transparent_9px)] [mask-image:linear-gradient(to_bottom,transparent,black)]" />
          <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
            <div data-reveal className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.07] px-4 py-2 text-xs font-medium text-secondary opacity-0"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand shadow-[0_0_12px_hsl(var(--brand)/0.6)]" aria-hidden="true" /><Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{t("Yapay zekâ destekli iş zekâsı")}</div>
            <h1 id="landing-title" data-reveal className="mt-7 max-w-[60rem] text-balance text-[clamp(2.65rem,5.7vw,5.25rem)] font-medium leading-[1.04] tracking-[-0.055em] opacity-0">{t("Verilerinizdeki büyüme fırsatlarını keşfedin.")}</h1>
            <p data-reveal className="mt-6 max-w-2xl text-pretty text-sm leading-7 text-muted-foreground opacity-0 sm:text-base sm:leading-8">{t("Bir konunun belgelerini aynı çalışma alanında toplayın. Incagen, içeriği kaynaklarıyla düzenli bir başlangıca dönüştürür; içgörü ve öneri katmanı sonraki aşamada açılacak.")}</p>
            <div data-reveal className="mt-8 flex flex-wrap justify-center gap-3 opacity-0"><Button type="button" className="h-12 gap-3 rounded-xl px-6 text-sm font-semibold shadow-lg shadow-brand/15 sm:h-14 sm:px-7 sm:text-base" onClick={startAnalysis}>{t("Analize başla")}<ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" /></Button><Link to="/ornek-rapor" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl border border-border/90 bg-card/65 px-6 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-14">{t("Örnek raporu incele")}<ArrowRight className="h-4 w-4 text-primary rtl:-scale-x-100" aria-hidden="true" /></Link></div>
          </div>
          <div className="relative mx-auto mt-12 grid max-w-3xl gap-3 sm:mt-16 sm:grid-cols-2">
            <div className="surface flex items-start gap-4 rounded-2xl border border-border/70 bg-card/70 p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><FileCheck2 className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-sm font-semibold">{t("Kaynağı belli içerik")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("Her bölümün hangi belgeden geldiğini görün.")}</p></div></div>
            <div className="surface flex items-start gap-4 rounded-2xl border border-border/70 bg-card/70 p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand"><LockKeyhole className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-sm font-semibold">{t("Kontrol sizde")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("Hazırlamayı siz başlatın, kayıtları siz yönetin.")}</p></div></div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-7xl px-5 pb-14 sm:px-8 lg:px-10">
          <section id="nasil-calisir" className="scroll-mt-8 py-12 sm:py-16" aria-labelledby="nasil-calisir-baslik">
            <div className="mx-auto max-w-2xl text-center"><h2 id="nasil-calisir-baslik" className="text-balance text-3xl font-semibold leading-[1.12] tracking-[-0.045em] sm:text-4xl">{t("Dağınık dosyalardan")} <span className="text-primary dark:text-secondary">{t("düzenli bir başlangıca.")}</span></h2><p className="mt-4 text-sm leading-7 text-muted-foreground">{t("Belge hazırlığının her adımı anlaşılır: konuyu seçin, kaynakları koruyarak düzenleyin, çalışmanıza dilediğinizde geri dönün.")}</p></div>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {steps.map(({ number, icon: Icon, title, description }) => <article key={number} className="surface group relative overflow-hidden rounded-2xl p-6 transition-colors hover:border-primary/40 sm:p-7"><div className="mb-7 flex items-center justify-between gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.07] text-primary dark:text-secondary"><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="font-mono text-xs font-medium tracking-widest text-muted-foreground">{t("Adım {0}", number)}</span></div><h3 className="text-lg font-semibold tracking-tight">{t(title)}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{t(description)}</p><span className="absolute inset-x-7 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" aria-hidden="true" /></article>)}
            </div>
            <div className="mt-5 flex flex-col gap-5 rounded-2xl border border-border/70 bg-muted/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="flex items-start gap-3"><Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary dark:text-secondary" aria-hidden="true" /><div><p className="text-sm font-semibold">{t("Bir konu. Daha net bir bakış.")}</p><p className="mt-1.5 max-w-2xl text-xs leading-6 text-muted-foreground">{t("Tek bir soruya ait belgeleri birlikte hazırlayın; kaynakları korunmuş içerik, sonraki değerlendirme için sağlam bir temel oluştursun.")}</p></div></div><div className="flex shrink-0 flex-wrap gap-2 text-[11px] text-muted-foreground" aria-label={t("Örnek analiz konuları")}>{["Müşteri deneyimi", "Finansal görünüm", "Operasyon"].map(topic => <span key={topic} className="rounded-full border border-border bg-card px-3 py-1.5">{t(topic)}</span>)}</div></div>
          </section>

          <section className="surface surface-accent grid gap-6 rounded-2xl border border-border p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" aria-labelledby="control-title"><div><span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary dark:text-secondary"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{t("Kontrol sizde")}</span><h2 id="control-title" className="mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{t("Verinizin yolculuğu görünür, karar sizin.")}</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{t("Dosyalar yalnız hazırlama işlemini başlattığınızda işlenir. İçerik türü kontrol edilir, kaynak konumları korunur ve kayıtları çalışma alanınızdan yönetirsiniz.")}</p></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1"><span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs"><FileCheck2 className="h-4 w-4 text-primary dark:text-secondary" aria-hidden="true" />{t("Kaynakları takip edin")}</span><span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs"><LockKeyhole className="h-4 w-4 text-primary dark:text-secondary" aria-hidden="true" />{t("Kayıtları siz yönetin")}</span></div></section>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-7"><p className="text-sm text-muted-foreground">{t("Hazır olduğunuzda ilk çalışma alanınızı açın.")}</p><Button onClick={startAnalysis} className="h-11 gap-2 rounded-xl px-5">{t("Çalışma alanına geç")}<ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" /></Button></div>
        </div>
      </main>
      <footer className="mx-auto flex max-w-6xl justify-center px-5 pb-8"><SupportLauncher /></footer>
      <AuthModal open={authOpen} onClose={closeAuth} onAuthenticated={() => navigate(authDestination)} />
    </div>
  );
}
