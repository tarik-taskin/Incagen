import { useState, type FormEvent } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useAuth } from "../lib/auth-context";
import { getServices } from "../lib/firebase";
import { userError } from "../lib/errors";
import { tr } from "../i18n/tr";

// Yerel e-posta/parola kaydı ve girişini tek formda sunar; dış dönüş adreslerini kabul etmez.
export function AuthPage() {
  const { user, error: configError } = useAuth();
  const location = useLocation();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requested = location.state?.from;
  const destination = typeof requested === "string" && requested.startsWith("/app/") ? requested : "/app/new-analysis";
  if (user) return <Navigate to={destination} replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const operation = register ? createUserWithEmailAndPassword : signInWithEmailAndPassword;
      await operation(getServices().auth, String(form.get("email")).trim(), String(form.get("password")));
    } catch (e) { setError(userError(e)); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-background p-5 text-foreground">
    <section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-xl" aria-labelledby="auth-title">
      <Link to="/" className="text-sm font-semibold text-primary dark:text-secondary">← Incagen</Link>
      <h1 id="auth-title" className="mt-6 text-3xl font-semibold">{register ? tr.auth.register : tr.auth.login}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{tr.auth.local}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">{tr.auth.email}<input name="email" type="email" required autoComplete="email" className="form-control mt-2" /></label>
        <label className="block text-sm font-medium">{tr.auth.password}<input name="password" type="password" required minLength={8} autoComplete={register ? "new-password" : "current-password"} className="form-control mt-2" /></label>
        {(error || configError) && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error || configError}</p>}
        <Button disabled={busy || !!configError} className="w-full">{busy ? "Bekleyin…" : register ? tr.auth.register : tr.auth.login}</Button>
      </form>
      <Button type="button" variant="ghost" className="mt-4 w-full" onClick={() => { setRegister(!register); setError(""); }}>{register ? "Hesabım var, giriş yap" : "Hesabım yok, hesap oluştur"}</Button>
    </section>
  </main>;
}
