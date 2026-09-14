import { useState } from "react";
import { sendPasswordResetEmail, signOut } from "firebase/auth";
import { CheckCircle2, KeyRound, LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useAuth } from "../lib/auth-context";
import { getServices } from "../lib/firebase";
import { userError } from "../lib/errors";
import { tr } from "../i18n/tr";

type ResetStatus = "idle" | "sending" | "sent";

// Hesap bilgilerini, parola yenilemeyi ve güvenli çıkışı geniş bir ayarlar görünümünde sunar.
export function SettingsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [resetStatus, setResetStatus] = useState<ResetStatus>("idle");

  // Oturumdaki e-posta için Firebase parola sıfırlama isteği oluşturur.
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

  // Firebase oturumunu kapattıktan sonra kullanıcıyı modal açmadan landing sayfasına taşır.
  async function logout() {
    setError("");
    navigate(location.pathname, { replace: true, state: { logoutPending: true }, flushSync: true });
    try {
      await signOut(getServices().auth);
      navigate("/", { replace: true, state: null, flushSync: true });
    } catch (logoutError) {
      navigate(location.pathname, { replace: true, state: null, flushSync: true });
      setError(userError(logoutError));
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl" aria-labelledby="settings-title">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-primary dark:text-secondary">Hesap merkezi</p>
          <h1 id="settings-title" className="mt-1 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Çalışma alanı ayarları</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Hesap erişiminizi, parolanızı ve aktif oturumunuzu tek yerden yönetin.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" /> Oturum açık
        </span>
      </div>

      {error && <p role="alert" className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}

      <div className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.35fr]">
        <article className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-7" aria-labelledby="account-summary-title">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-secondary/10 dark:text-secondary">
            <UserRound className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 id="account-summary-title" className="mt-5 text-xl font-semibold tracking-[-0.025em]">Hesap özeti</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Analizleriniz bu hesaba bağlı olarak saklanır.</p>

          <dl className="mt-6 space-y-4">
            <div className="rounded-2xl border border-border/80 bg-muted/45 p-4">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"><Mail className="h-4 w-4" aria-hidden="true" /> Bağlı e-posta</dt>
              <dd className="mt-2 break-all text-sm font-semibold">{user?.email}</dd>
            </div>
            <div className="rounded-2xl border border-border/80 bg-muted/45 p-4">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Giriş yöntemi</dt>
              <dd className="mt-2 text-sm font-semibold">E-posta ve parola</dd>
            </div>
          </dl>

          <div className="mt-6 rounded-2xl border border-primary/10 bg-primary/[0.05] p-4 text-sm leading-6 text-muted-foreground dark:border-secondary/10 dark:bg-secondary/[0.05]">
            <p className="font-semibold text-foreground">Yerel demo ortamı</p>
            <p className="mt-1">Yalnız sentetik veriler kullanın. Tamamlanan raporlar siz silene kadar bu hesaba bağlı kalır.</p>
          </div>
        </article>

        <div className="space-y-5">
          <article className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-7" aria-labelledby="password-settings-title">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-secondary/10 dark:text-secondary">
                  <KeyRound className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="password-settings-title" className="text-lg font-semibold">Şifre değiştir</h2>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Bağlı e-posta adresinize güvenli bir şifre değiştirme bağlantısı gönderin. Mevcut şifrenizi bu ekranda paylaşmanız gerekmez.</p>
                </div>
              </div>
              <Button type="button" variant="outline" className="h-11 shrink-0 rounded-xl px-5" disabled={!user?.email || resetStatus === "sending"} onClick={requestPasswordReset}>
                <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                {resetStatus === "sending" ? "Gönderiliyor…" : resetStatus === "sent" ? "Tekrar gönder" : "E-postaya bağlantı gönder"}
              </Button>
            </div>

            {resetStatus === "sent" && (
              <div role="status" className="mt-5 flex gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Şifre değiştirme isteği hazırlandı</p>
                  <p className="mt-1 leading-6">Canlı ortamda bağlantı <strong>{user?.email}</strong> adresine gönderilir. Yerel Firebase emülatörü gerçek e-posta teslim etmez.</p>
                </div>
              </div>
            )}
          </article>

          <article className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-7" aria-labelledby="session-settings-title">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="session-settings-title" className="text-lg font-semibold">Aktif oturum</h2>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Çıkışta devam eden yükleme durdurulur ve seçili yerel dosyalar temizlenir. Tamamlanan raporlar hesabınızda kalır.</p>
                </div>
              </div>
              <Button type="button" className="h-11 shrink-0 rounded-xl px-5" onClick={logout}>{tr.auth.logout}</Button>
            </div>
          </article>

          <div className="flex items-start gap-3 rounded-2xl border border-border/70 px-4 py-3 text-xs leading-5 text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            Şifre bağlantısı yalnız oturumdaki e-posta için istenir; uygulama parolanızı görüntülemez veya saklamaz.
          </div>
        </div>
      </div>
    </section>
  );
}
