import { useId, useState, type FormEvent } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { X } from "lucide-react";
import { Link } from "react-router-dom";
import { tr } from "../i18n/tr";
import { useAuth } from "../lib/auth-context";
import { userError } from "../lib/errors";
import { getServices } from "../lib/firebase";
import { Button } from "./ui/button";

interface AuthCardProps {
  onAuthenticated?: () => void;
  onClose?: () => void;
  titleId?: string;
}

// Giriş ve kayıt işlemlerini sayfa ile modal arasında paylaşılan tek formda yürütür.
export function AuthCard({ onAuthenticated, onClose, titleId: suppliedTitleId }: AuthCardProps) {
  const generatedTitleId = useId();
  const titleId = suppliedTitleId ?? generatedTitleId;
  const { error: configError } = useAuth();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Seçili moda göre yerel Firebase hesabını açar veya mevcut hesaba giriş yapar.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");

    try {
      const operation = register ? createUserWithEmailAndPassword : signInWithEmailAndPassword;
      await operation(getServices().auth, String(form.get("email")).trim(), String(form.get("password")));
      onAuthenticated?.();
    } catch (submissionError) {
      setError(userError(submissionError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-full rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8" aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-4">
        {onClose ? (
          <p className="text-sm font-semibold text-primary dark:text-secondary">Incagen hesabı</p>
        ) : (
          <Link to="/" className="rounded-md text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-secondary">← Incagen</Link>
        )}
        {onClose && (
          <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-xl" aria-label="Giriş penceresini kapat" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      <h1 id={titleId} className="mt-5 text-3xl font-semibold">{register ? tr.auth.register : tr.auth.login}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{tr.auth.local}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          {tr.auth.email}
          <input name="email" type="email" required autoComplete="email" autoFocus className="form-control mt-2" />
        </label>
        <label className="block text-sm font-medium">
          {tr.auth.password}
          <input name="password" type="password" required minLength={8} autoComplete={register ? "new-password" : "current-password"} className="form-control mt-2" />
        </label>
        {(error || configError) && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error || configError}</p>}
        <Button disabled={busy || !!configError} className="w-full">{busy ? "Bekleyin…" : register ? tr.auth.register : tr.auth.login}</Button>
      </form>
      <Button type="button" variant="ghost" className="mt-4 w-full" onClick={() => { setRegister(!register); setError(""); }}>
        {register ? "Hesabım var, giriş yap" : "Hesabım yok, hesap oluştur"}
      </Button>
    </section>
  );
}
