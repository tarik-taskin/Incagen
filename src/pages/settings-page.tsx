import { useEffect, useRef, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { BarChart3, CheckCircle2, Eye, EyeOff, KeyRound, Link2, LogOut, Mail, MousePointer2, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useAuth } from "../lib/auth-context";
import { getServices } from "../lib/firebase";
import { userError } from "../lib/errors";
import { tr } from "../i18n/tr";
import { authOnlyPreview } from "../lib/deployment-mode";

type ResetStatus = "idle" | "sending" | "sent";

// Hesap bilgilerini, parola yenilemeyi ve güvenli çıkışı geniş bir ayarlar görünümünde sunar.
export function SettingsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [resetStatus, setResetStatus] = useState<ResetStatus>("idle");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deleteOpen && !dialog.open) dialog.showModal();
    else if (!deleteOpen && dialog.open) dialog.close();
  }, [deleteOpen]);

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

  // Yeniden kimlik doğrulayıp onaylı silme işlevini çağırır; başarılıysa oturumu kapatır.
  async function deleteAccount() {
    if (authOnlyPreview) return;
    if (!user?.email || deleteConfirmation !== "HESABIMI SİL" || !deletePassword || deletePending) return;
    setDeleteError("");
    setDeletePending(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, deletePassword));
      await user.getIdToken(true);
      const remove = httpsCallable<{ confirmation: string }, { deleted: boolean }>(getServices().functions, "deleteAccount", { timeout: 310_000 });
      await remove({ confirmation: deleteConfirmation });
      await signOut(getServices().auth);
      navigate("/", { replace: true, state: null, flushSync: true });
    } catch (actionError) {
      setDeleteError(userError(actionError));
    } finally {
      setDeletePending(false);
    }
  }

  // İptalde şifreyi ve onay metnini bellekte tutmaz.
  function closeDeleteDialog() {
    if (deletePending) return;
    setDeleteOpen(false);
    setDeletePassword("");
    setDeleteConfirmation("");
    setShowDeletePassword(false);
    setDeleteError("");
  }

  return (
    <section className="mx-auto w-full max-w-6xl" aria-labelledby="settings-title">
      <div className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-card via-card to-primary/[0.07] p-6 shadow-sm dark:to-secondary/[0.05] sm:p-8">
        <span className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full border border-primary/10 bg-primary/[0.035] dark:border-secondary/10 dark:bg-secondary/[0.025]" aria-hidden="true" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:text-secondary">Hesap merkezi</p>
            <h1 id="settings-title" className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Çalışma alanı ayarları</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Hesabınız, veri kaynaklarınız ve oturum kontrolünüz tek bir düzenli alanda.</p>
          </div>
          <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" /> Oturum açık
          </span>
        </div>
      </div>

      {error && <p role="alert" className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}

      <div className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-7" aria-labelledby="account-summary-title">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:text-secondary">01 / Kimlik</p>
          <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-secondary/10 dark:text-secondary">
            <UserRound className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 id="account-summary-title" className="mt-5 text-xl font-semibold tracking-[-0.025em]">Hesap özeti</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Çalışmalarınız bu hesapla ilişkilendirilir.</p>

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

        </article>

        <article className="flex h-full flex-col rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-7" aria-labelledby="password-settings-title">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:text-secondary">02 / Güvenlik</p>
            <div className="flex flex-col gap-5">
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-secondary/10 dark:text-secondary">
                  <KeyRound className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="password-settings-title" className="text-lg font-semibold">Şifre değiştir</h2>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Bağlı e-posta adresinize güvenli bir şifre değiştirme bağlantısı gönderin. Mevcut şifrenizi bu ekranda paylaşmanız gerekmez.</p>
                </div>
              </div>
              <Button type="button" variant="outline" className="h-11 w-fit rounded-xl px-5" disabled={!user?.email || resetStatus === "sending"} onClick={requestPasswordReset}>
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
            <div className="mt-auto border-t border-border pt-5">
              <div className="flex items-start gap-3 rounded-2xl bg-muted/40 p-4">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-secondary" aria-hidden="true" />
                <p className="text-xs leading-5 text-muted-foreground">Şifre bağlantısı yalnızca bağlı e-posta adresinize gönderilir. Parolanız bu ekranda görüntülenmez.</p>
              </div>
            </div>
        </article>
      </div>

      <section className="mt-6 overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm" aria-labelledby="connections-title">
        <div className="border-b border-border bg-gradient-to-r from-primary/[0.07] via-card to-secondary/[0.12] p-6 dark:from-primary/20 dark:to-secondary/[0.05] sm:p-8">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:text-secondary"><Link2 className="h-4 w-4" aria-hidden="true" /> 03 / Veri kaynakları</span>
          <h2 id="connections-title" className="mt-2 text-2xl font-semibold tracking-tight">Kaynakları bir araya getirin</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Bağlantılar eklendiğinde trafik ve davranış verilerini çalışmalarınızla aynı yerde yönetebileceksiniz.</p>
        </div>
        <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-2">
          {[
            { name: "Google Analytics", subtitle: "Ziyaretçi ve trafik verileri", icon: BarChart3, tone: "from-amber-400/20 to-orange-500/10 text-amber-700 dark:text-amber-300" },
            { name: "Microsoft Clarity", subtitle: "Oturum ve davranış içgörüleri", icon: MousePointer2, tone: "from-sky-400/20 to-blue-500/10 text-sky-700 dark:text-sky-300" },
          ].map(({ name, subtitle, icon: Icon, tone }) => <article key={name} className="flex min-w-0 flex-col rounded-3xl border border-border bg-background/70 p-5 transition-colors hover:border-primary/25 dark:hover:border-secondary/25">
            <div className="flex items-start justify-between gap-3"><span className={"flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br " + tone}><Icon className="h-6 w-6" aria-hidden="true" /></span><span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Harici kaynak</span></div>
            <h3 className="mt-5 text-lg font-semibold">{name}</h3><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            <button type="button" disabled className="mt-6 min-h-11 w-full cursor-not-allowed rounded-xl border border-border bg-muted/60 px-4 text-sm font-semibold text-muted-foreground">Hesabı bağla</button>
          </article>)}
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-border bg-card p-6 shadow-sm sm:p-8" aria-labelledby="session-settings-title">
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:text-secondary">04 / Oturum</p>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><LogOut className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <h2 id="session-settings-title" className="text-lg font-semibold">Aktif oturum</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Çıkışta devam eden yükleme durdurulur ve seçili yerel dosyalar temizlenir. Tamamlanan raporlar hesabınızda kalır.</p>
            </div>
          </div>
          <Button type="button" className="h-11 shrink-0 rounded-xl px-5" onClick={logout}>{tr.auth.logout}</Button>
        </div>
      </section>

      <section className="mt-6 flex flex-col gap-5 rounded-[2rem] border border-red-500/20 bg-red-500/[0.035] p-6 dark:bg-red-500/[0.06] sm:flex-row sm:items-center sm:justify-between sm:p-8" aria-labelledby="delete-account-title">
        <div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-700 dark:text-red-300"><Trash2 className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-red-700 dark:text-red-300">Tehlikeli alan</p><h2 id="delete-account-title" className="mt-1 text-lg font-semibold">Hesabı sil</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Hesabınız, analiz geçmişiniz ve yüklediğiniz belgeler kalıcı olarak silinir. Bu işlem geri alınamaz.</p></div></div>
        <Button type="button" variant="outline" className="h-11 shrink-0 rounded-xl border-red-500/30 px-5 text-red-700 hover:bg-red-500/10 dark:text-red-300" onClick={() => authOnlyPreview ? setError("Bu önizlemede hesap silme henüz etkin değil.") : setDeleteOpen(true)}>Hesabı sil</Button>
      </section>

      <dialog ref={deleteDialogRef} role="alertdialog" aria-labelledby="delete-account-dialog-title" aria-describedby="delete-account-dialog-description" onCancel={event => { if (deletePending) event.preventDefault(); else closeDeleteDialog(); }} onClose={closeDeleteDialog}
        className="w-[min(92vw,32rem)] max-w-none rounded-[2rem] border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm">
        <div className="p-6 sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-700 dark:text-red-300"><Trash2 className="h-5 w-5" aria-hidden="true" /></span>
          <h2 id="delete-account-dialog-title" className="mt-5 text-2xl font-semibold tracking-tight">Hesabınızı kalıcı olarak silin</h2>
          <p id="delete-account-dialog-description" className="mt-2 text-sm leading-6 text-muted-foreground">Bu işlem hesabınızı, tüm analizlerinizi ve belgelerinizi siler. Devam etmek için parolanızı ve aşağıdaki onay metnini girin.</p>
          <form className="mt-6 space-y-4" onSubmit={event => { event.preventDefault(); void deleteAccount(); }}>
            <div><label htmlFor="delete-account-password" className="text-sm font-medium">Mevcut parola</label><div className="relative mt-2"><input id="delete-account-password" type={showDeletePassword ? "text" : "password"} autoComplete="current-password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} disabled={deletePending} className="h-12 w-full rounded-xl border border-input bg-background px-4 pr-12 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" /><button type="button" aria-label={showDeletePassword ? "Parolayı gizle" : "Parolayı göster"} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => setShowDeletePassword(value => !value)}>{showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
            <div><label htmlFor="delete-account-confirmation" className="text-sm font-medium">Onaylamak için <strong>HESABIMI SİL</strong> yazın</label><input id="delete-account-confirmation" type="text" autoComplete="off" value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} disabled={deletePending} className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" /></div>
            {deleteError && <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{deleteError}</p>}
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="rounded-xl" disabled={deletePending} onClick={closeDeleteDialog}>Vazgeç</Button><Button type="submit" className="rounded-xl bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700" disabled={deletePending || !deletePassword || deleteConfirmation !== "HESABIMI SİL"}>{deletePending ? "Hesap siliniyor…" : "Hesabı kalıcı olarak sil"}</Button></div>
          </form>
        </div>
      </dialog>
    </section>
  );
}
