import { LanguageSelector } from "./language-selector";
import { t, useLocale } from "../i18n/runtime";
import { useState, type FormEvent, type ReactNode } from "react";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { Apple, BadgeCheck, Check, Circle, Eye, EyeOff, KeyRound, Mail, ShieldCheck, Ticket, X } from "lucide-react";
import { tr } from "../i18n/tr";
import { useAuth } from "../lib/auth-context";
import { userError } from "../lib/errors";
import { getServices, usesFirebaseEmulator } from "../lib/firebase";
import { AnimatedLogo } from "./animated-logo";
import { AuthSuccessTransition } from "./auth-success-transition";
import { Button } from "./ui/button";

interface AuthCardProps {
  onAuthenticated: () => void;
  onClose: () => void;
  titleId: string;
}

interface PasswordFieldProps {
  autoComplete: "current-password" | "new-password";
  id: string;
  label: string;
  onChange: (value: string) => void;
  show: boolean;
  toggleLabel: string;
  value: string;
  onToggle: () => void;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Parola alanına klavyeyle erişilebilir gösterme ve gizleme kontrolü ekler.
function PasswordField({ autoComplete, id, label, onChange, onToggle, show, toggleLabel, value }: PasswordFieldProps) {
  useLocale();
  return (
    <div>
      <label htmlFor={id} className="text-[13.5px] font-medium text-foreground sm:text-sm">{t(label)}</label>
      <div className="relative mt-2">
        <KeyRound className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          id={id}
          name={id}
          type={show ? "text" : "password"}
          required
          minLength={8}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="form-control h-12 ps-10 pe-12"
        />
        <button
          type="button"
          className="absolute end-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-secondary"
          aria-label={t(toggleLabel)}
          aria-pressed={show}
          onClick={onToggle}
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

// Microsoft sağlayıcısını tanınabilir dört renkli işaretiyle gösterir.
function MicrosoftMark() {
  return (
    <span className="grid h-4 w-4 grid-cols-2 gap-px" aria-hidden="true">
      <span className="bg-[#f35325]" /><span className="bg-[#81bc06]" />
      <span className="bg-[#05a6f0]" /><span className="bg-[#ffba08]" />
    </span>
  );
}

// Henüz bağlı olmayan sosyal sağlayıcıyı arayüz yerini koruyarak pasif sunar.
function SocialOption({ action, icon, name }: { action: string; icon: ReactNode; name: string }) {
  useLocale();
  return (
    <button
      type="button"
      disabled
      title={t("{0} ile {1}", name, t(action))}
      className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-1 text-[11px] font-semibold text-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-100 sm:gap-2 sm:px-3 sm:text-sm"
      aria-label={t("{0} ile {1}", name, t(action))}
    >
      {icon}
      <span>{t(name)}</span>
    </button>
  );
}

// Firebase kimlik işlemlerini doğrulamalı ve iki modlu modal formunda yürütür.
export function AuthCard({ onAuthenticated, onClose, titleId }: AuthCardProps) {
  useLocale();
  const { error: configError } = useAuth();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const emailValid = emailPattern.test(email.trim());
  const passwordCriteria = [
    { label: "En az 8 karakter", met: password.length >= 8 },
    { label: "Bir büyük harf", met: /[A-ZÇĞİÖŞÜ]/.test(password) },
    { label: "Bir rakam", met: /\d/.test(password) },
    { label: "Bir özel karakter", met: /[^A-Za-z0-9ÇĞİÖŞÜçğıöşü]/.test(password) },
  ];
  const metCriteriaCount = passwordCriteria.filter(({ met }) => met).length;
  const passwordValid = metCriteriaCount === passwordCriteria.length;
  const passwordsMatch = passwordConfirmation.length > 0 && password === passwordConfirmation;
  const formValid = emailValid && password.length >= 8 && (!register || (passwordValid && passwordsMatch));

  // Mod değişiminde e-postayı korur, hassas alanları ve önceki hataları temizler.
  function changeMode(nextRegister: boolean) {
    setRegister(nextRegister);
    setPassword("");
    setPasswordConfirmation("");
    setShowPassword(false);
    setShowPasswordConfirmation(false);
    setError("");
    setResetSent(false);
  }

  // Girişte şifresini unutan kullanıcıya yalnız geçerli e-posta için Firebase bağlantısı gönderir.
  async function requestPasswordReset() {
    setEmailTouched(true);
    if (!emailValid || resetSending) return;
    setError("");
    setResetSent(false);
    setResetSending(true);
    try {
      await sendPasswordResetEmail(getServices().auth, email.trim());
      setResetSent(true);
    } catch (resetError) {
      setError(userError(resetError));
    } finally {
      setResetSending(false);
    }
  }

  // Seçili moda göre bağlı Firebase Auth projesinde hesap açar veya giriş yapar.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailTouched(true);
    if (!formValid) return;

    setBusy(true);
    setError("");

    try {
      const operation = register ? createUserWithEmailAndPassword : signInWithEmailAndPassword;
      await operation(getServices().auth, email.trim(), password);
      setAuthenticated(true);
    } catch (submissionError) {
      setError(userError(submissionError));
    } finally {
      setBusy(false);
    }
  }

  const action = register ? "kayıt ol" : "giriş yap";

  return (
    <>
    <section className="relative w-full overflow-hidden rounded-[2rem] border border-border/80 bg-card text-card-foreground shadow-[0_30px_100px_-32px_rgba(50,14,59,0.65)]" aria-labelledby={titleId}>
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-secondary via-primary to-[#ff5978]" aria-hidden="true" />
      <div className="relative p-5 sm:p-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/[0.06] shadow-sm dark:border-secondary/15 dark:bg-secondary/[0.08]">
              <AnimatedLogo compact className="h-8 w-8" />
            </span>
            <div>
              <p className="text-[15.5px] font-semibold tracking-[-0.02em] sm:text-base">{t("Incagen")}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {usesFirebaseEmulator ? t("Yerel analiz alanı") : t("Güvenli analiz alanı")}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1"><LanguageSelector /><Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-xl" aria-label={t("Giriş penceresini kapat")} onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button></div>
        </header>

        <div className="mt-5">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-primary dark:text-secondary sm:text-xs">{t("Veriden karara, tek çalışma alanı")}</p>
          <h1 id={titleId} className="mt-1.5 text-[29px] font-semibold tracking-[-0.04em] sm:text-4xl">{register ? t(tr.auth.register) : t(tr.auth.login)}</h1>
          <p className="mt-2 text-[13.5px] leading-6 text-muted-foreground sm:text-sm">
            {register ? t("Kişisel analiz alanınızı oluşturun ve raporlarınızı bir arada yönetin.") : t("Analizlerinize ve kayıtlı raporlarınıza kaldığınız yerden devam edin.")}
          </p>
          {usesFirebaseEmulator && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary/[0.05] px-2.5 py-1 text-xs font-medium text-primary dark:border-secondary/15 dark:bg-secondary/[0.07] dark:text-secondary">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />  {t("Yerel demo · Yalnız sentetik veri")} </span>
          )}
        </div>

        <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
          <div>
            <label htmlFor="email" className="text-[13.5px] font-medium text-foreground sm:text-sm">{t(tr.auth.email)}</label>
            <div className="relative mt-2">
              <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                id="email"
                dir="ltr"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onBlur={() => setEmailTouched(true)}
                onChange={(event) => { setEmail(event.target.value); setResetSent(false); }}
                aria-invalid={emailTouched && !emailValid}
                aria-describedby="email-feedback"
                className="form-control h-12 ps-10 pe-11"
                placeholder="ornek@isletmeniz.com"
              />
              {emailValid && <BadgeCheck className="pointer-events-none absolute end-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
            </div>
            <p id="email-feedback" className={`mt-1.5 min-h-4 text-xs ${emailValid ? "text-emerald-700 dark:text-emerald-300" : emailTouched && email ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}`} aria-live="polite">
              {emailValid ? t("E-posta formatı uygun") : emailTouched && email ? t("Geçerli bir e-posta adresi girin") : t("Hesabınız ve raporlarınız bu adresle eşleşir")}
            </p>
          </div>

          <PasswordField
            id="password"
            label={t(tr.auth.password)}
            autoComplete={register ? "new-password" : "current-password"}
            value={password}
            onChange={setPassword}
            show={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
            toggleLabel={showPassword ? "Parolayı gizle" : "Parolayı göster"}
          />

          {!register && <div className="-mt-2 text-end"><button type="button" disabled={resetSending} className="rounded-md text-[13.5px] font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-secondary sm:text-sm" onClick={requestPasswordReset}>{resetSending ? t("Bağlantı gönderiliyor…") : t("Şifremi unuttum")}</button></div>}

          {resetSent && <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-3 text-sm text-emerald-800 dark:text-emerald-200">{t("Şifre yenileme bağlantısı e-posta adresinize gönderildi.")}</p>}

          {register && (
            <div className="rounded-2xl border border-border/80 bg-muted/55 p-3.5" aria-live="polite">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold">{t("Güçlü parola oluşturun")}</p>
                <span className="text-xs font-medium text-muted-foreground">{t("{0}/4 kriter", metCriteriaCount)}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {passwordCriteria.map(({ label, met }) => (
                  <span key={label} className={`flex items-center gap-1.5 text-xs ${met ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>
                    {met ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                    {t(label)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {register && (
            <div>
              <PasswordField
                id="password-confirmation"
                label="Parola tekrarı"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={setPasswordConfirmation}
                show={showPasswordConfirmation}
                onToggle={() => setShowPasswordConfirmation((current) => !current)}
                toggleLabel={showPasswordConfirmation ? "Parola tekrarını gizle" : "Parola tekrarını göster"}
              />
              {passwordConfirmation && (
                <p className={`mt-1.5 text-xs ${passwordsMatch ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`} aria-live="polite">
                  {passwordsMatch ? t("Parolalar eşleşiyor") : t("Parolalar eşleşmiyor")}
                </p>
              )}
            </div>
          )}

          {register && (
            <div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="invite-code" className="text-[13.5px] font-medium text-foreground sm:text-sm">{t("Davet kodu")}</label>
                <span className="text-xs text-muted-foreground">{t("İsteğe bağlı")}</span>
              </div>
              <div className="relative mt-2">
                <Ticket className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input id="invite-code" name="invite-code" type="text" autoComplete="off" className="form-control h-12 ps-10 uppercase tracking-[0.12em]" placeholder={t("INCAGEN-XXXX")} />
              </div>
            </div>
          )}

          {(error || configError) && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-3 text-sm text-red-700 dark:text-red-300">{t(error || configError)}</p>}

          <Button disabled={busy || !!configError || !formValid} className="h-12 w-full rounded-xl text-sm font-semibold shadow-lg shadow-primary/20">
            {busy ? t("Bekleyin…") : register ? t(tr.auth.register) : t(tr.auth.login)}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium text-muted-foreground">{t("veya")}</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <SocialOption action={action} name="Google" icon={<span className="bg-[conic-gradient(from_-45deg,#4285f4_0_25%,#34a853_0_50%,#fbbc05_0_75%,#ea4335_0)] bg-clip-text text-base font-bold text-transparent" aria-hidden="true">{"G"}</span>} />
          <SocialOption action={action} name="Apple" icon={<Apple className="h-4 w-4" aria-hidden="true" />} />
          <SocialOption action={action} name="Microsoft" icon={<MicrosoftMark />} />
        </div>

        <p className="mt-6 text-center text-[13.5px] text-muted-foreground sm:text-sm">
          {register ? t("Zaten hesabınız var mı?") : t("Henüz hesabınız yok mu?")}{" "}
          <button type="button" className="rounded-md font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-secondary" onClick={() => changeMode(!register)}>
            {register ? t(tr.auth.login) : t(tr.auth.register)}
          </button>
        </p>
      </div>
    </section>
    {authenticated && <AuthSuccessTransition onComplete={onAuthenticated} />}
    </>
  );
}
