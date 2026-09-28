import { useState } from "react";
import { sendPasswordResetEmail, signOut } from "firebase/auth";
import { ArrowLeft, CheckCircle2, KeyRound, LogOut, Mail, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatedLogo } from "../components/animated-logo";
import { ThemeToggle } from "../components/theme-toggle";
import { Button } from "../components/ui/button";
import { tr } from "../i18n/tr";
import { useAuth } from "../lib/auth-context";
import { userError } from "../lib/errors";
import { getServices } from "../lib/firebase";

type ResetStatus = "idle" | "sending" | "sent";

// Canlı Auth önizlemesinde yalnız çalışan hesap eylemlerini gösterir; backend gerektiren analiz yollarını açmaz.
export function AuthPreviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(typeof location.state?.logoutError === "string" ? location.state.logoutError : "");
  const [resetStatus, setResetStatus] = useState<ResetStatus>("idle");
  const [signingOut, setSigningOut] = useState(false);

  // Doğrulanmış hesabın e-postasına Firebase üzerinden şifre yenileme bağlantısı yollar.
  async function requestPasswordReset() {
    if (!user?.email || resetStatus === "sending") return;
    setError("");
    setResetStatus("sending");
    try {
      await sendPasswordResetEmail(getServices().auth, user.email);
      setResetStatus("sent");
    } catch (resetError) {
      setResetStatus("idle");
      setError(userError(resetError));
    }
  }

  // Korumalı rotadan önce ayrılıp Firebase oturumunu kapatır; Auth değişimi modalı yeniden açmaz.
  async function logout() {
    if (signingOut) return;
    setError("");
    setSigningOut(true);
    navigate("/", { replace: true, state: null });
    try {
      await signOut(getServices().auth);
    } catch (logoutError) {
      navigate("/app", { replace: true, state: { logoutError: userError(logoutError) } });
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="dot-grid absolute inset-0 opacity-50 dark:opacity-25" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-5 py-6 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Incagen ana sayfa">
          <AnimatedLogo compact className="h-10 w-10" />
          <span className="text-lg font-semibold tracking-tight">Incagen</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
        <Link to="/" className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Ana sayfaya dön
        </Link>
        <div className="mt-8 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary dark:text-secondary">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Hesap önizlemesi
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Hesabın hazır.</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">Firebase hesabınla giriş yaptın. Bu önizlemede oturumunu ve şifreni yönetebilirsin; analiz alanı henüz açılmadı.</p>
        </div>

        {error && <p role="alert" className="mt-8 rounded-2xl border border-red-500/25 bg-red-500/10 px-5 py-4 text-sm text-red-700 dark:text-red-300">{error}</p>}

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <section className="rounded-[2rem] border border-border/80 bg-card/90 p-6 shadow-xl shadow-primary/[0.04] backdrop-blur-xl sm:p-8" aria-labelledby="account-preview-title">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-secondary/10 dark:text-secondary"><Mail className="h-6 w-6" aria-hidden="true" /></span>
            <h2 id="account-preview-title" className="mt-6 text-xl font-semibold">Hesap bilgileri</h2>
            <p className="mt-2 text-sm text-muted-foreground">Giriş yaptığın e-posta adresi</p>
            <p className="mt-4 break-all rounded-2xl border border-border bg-muted/45 px-4 py-3 text-sm font-semibold">{user?.email}</p>
            <p className="mt-5 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Oturum açık</p>
          </section>

          <section className="rounded-[2rem] border border-border/80 bg-card/90 p-6 shadow-xl shadow-primary/[0.04] backdrop-blur-xl sm:p-8" aria-labelledby="account-security-title">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-secondary/10 dark:text-secondary"><KeyRound className="h-6 w-6" aria-hidden="true" /></span>
            <h2 id="account-security-title" className="mt-6 text-xl font-semibold">Şifre ve güvenlik</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Şifreni değiştirmek için e-posta adresine güvenli bir bağlantı gönder.</p>
            <Button type="button" variant="outline" className="mt-6 min-h-11 rounded-xl" disabled={!user?.email || resetStatus === "sending"} onClick={requestPasswordReset}>
              <Mail className="mr-2 h-4 w-4" aria-hidden="true" />{resetStatus === "sending" ? "Gönderiliyor…" : resetStatus === "sent" ? "Tekrar gönder" : "Şifre bağlantısı gönder"}
            </Button>
            {resetStatus === "sent" && <p role="status" className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-300">Şifre yenileme bağlantısı {user?.email} adresine gönderildi.</p>}
          </section>
        </div>

        <section className="mt-5 flex flex-col gap-4 rounded-[2rem] border border-border/80 bg-card/90 p-6 shadow-xl shadow-primary/[0.04] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-8" aria-labelledby="account-session-title">
          <div>
            <h2 id="account-session-title" className="text-lg font-semibold">Aktif oturum</h2>
            <p className="mt-1 text-sm text-muted-foreground">Çıkış yaptığında ana sayfaya dönersin.</p>
          </div>
          <Button type="button" className="min-h-11 shrink-0 rounded-xl" disabled={signingOut} onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />{signingOut ? "Çıkış yapılıyor…" : tr.auth.logout}
          </Button>
        </section>
      </main>
    </div>
  );
}
