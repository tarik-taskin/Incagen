import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, ChevronDown, Headphones, LoaderCircle, Mail, X } from "lucide-react";
import { useOutsideDismiss } from "../hooks/use-outside-dismiss";
import { t, useLocale } from "../i18n/runtime";
import { Button } from "./ui/button";
import { getSupportConfig, sendSupportMessage, supportMailto, type SupportTopic } from "../features/support/support";

const questions = [
  ["Hangi belgeleri ekleyebilirim?", "PDF, Word, Excel, CSV, metin, sunum ve desteklenen görsellerinizi aynı çalışmada bir araya getirebilirsiniz. Belgeleri tek bir konu etrafında seçin; örneğin aynı döneme ait satış tablolarını ilgili faaliyet raporuyla birlikte ekleyin. Dosya seçimi sırasında kalan kapasitenizi görebilir, hazırlığa başlamadan önce seçiminizi düzenleyebilirsiniz."],
  ["Analiz hedefini nasıl yazmalıyım?", "Belgelerinizden ne öğrenmek istediğinizi açık bir soruyla anlatın. Yalnızca ‘özetle’ yazmak yerine hangi dönemi, karşılaştırmayı veya karar konusunu merak ettiğinizi belirtin. Örneğin ‘İki dönem arasında satışlar nasıl değişti ve hangi kategoriler öne çıktı?’ diyebilirsiniz. Hedefiniz bu çalışmayla birlikte saklanır."],
  ["Örnek raporlar hangi verileri kullanıyor?", "Bu raporlar, analiz ve kaynak inceleme deneyimini göstermek için hazırlanan örnek dosyaları kullanır. Dosyaları indirip raporla birlikte inceleyebilir; bir bulgunun, grafiğin veya tablonun hangi kayıtlara dayandığını kaynak bağlantılarından görebilirsiniz. Müşteri deneyimi örneği de analiz sonrasında paylaşılan geri bildirimlerin nasıl değerlendirilebileceğini gösterir."],
];

// Yardımı kısa yanıtlarla açar; mesajı ayrı bir adımda toplar ve yalnız doğrulanan gönderimi başarılı gösterir.
export function SupportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useLocale();
  const reducedMotion = useReducedMotion();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const controller = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const [compose, setCompose] = useState(false);
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<SupportTopic>("question");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const config = getSupportConfig();
  useOutsideDismiss(dialog, onClose, open);
  useEffect(() => {
    if (open && !dialog.current?.open) { dialog.current?.showModal(); closeButton.current?.focus(); }
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  useEffect(() => () => controller.current?.abort(), []);

  // Çift tıklamayı kilitler; servis hatasında yazılan alanları korur ve yeniden denemeyi kullanıcıya bırakır.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !config.accessKey) return;
    lock.current = true; setState("sending");
    const abort = new AbortController(); controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 20_000);
    try { await sendSupportMessage({ email, topic, message }, config.accessKey, abort.signal); setState("sent"); setMessage(""); }
    catch { setState("error"); }
    finally { clearTimeout(timeout); controller.current = null; lock.current = false; }
  }

  return <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={onClose} onClose={onClose} className="w-[min(92vw,34rem)] max-w-none overflow-y-auto rounded-[1.75rem] border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm">
    <div className="p-5 sm:p-8">
      <div className="flex items-start justify-between gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/[0.07] text-primary dark:bg-secondary/10 dark:text-secondary"><Headphones className="h-5 w-5" aria-hidden="true" /></span><button ref={closeButton} type="button" aria-label={t("Kapat")} onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X className="h-4 w-4" aria-hidden="true" /></button></div>
      <h2 id={`${id}-title`} className="mt-5 text-2xl font-semibold tracking-tight">{t("Destek ve yardım")}</h2><p id={`${id}-description`} className="mt-2 text-sm leading-6 text-muted-foreground">{t("Takıldığınız yerden birlikte ilerleyelim.")}</p>
      {state === "sent" ? <motion.div role="status" initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.22 }} className="mt-7 rounded-2xl border border-emerald-500/15 bg-gradient-to-b from-emerald-500/[0.06] via-card to-card px-5 py-7 text-center dark:from-emerald-400/[0.08]">
        <span className="mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-emerald-500/10 bg-emerald-500/[0.06] p-2 dark:border-emerald-400/15"><span className="flex h-full w-full items-center justify-center rounded-full border border-emerald-500/15 bg-card text-emerald-700 shadow-[0_3px_12px_-6px_rgba(16,185,129,0.4)] dark:text-emerald-300"><motion.svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><motion.path d="m5 12 4 4L19 6" initial={{ pathLength: reducedMotion ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reducedMotion ? 0 : 0.3, delay: reducedMotion ? 0 : 0.08, ease: "easeOut" }} /></motion.svg></span></span>
        <h3 className="mt-5 text-lg font-semibold tracking-tight">{t("Mesajınız bize ulaştı")}</h3><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{t("Yanıtımızı belirttiğiniz e-posta adresine göndereceğiz.")}</p><Button className="mt-6 min-h-11 w-full rounded-xl" onClick={() => { setState("idle"); setCompose(false); }}>{t("Tamam")}</Button>
      </motion.div> : compose ? <form onSubmit={submit} className="mt-6 space-y-4" aria-busy={state === "sending"}>
        <button type="button" onClick={() => setCompose(false)} className="inline-flex min-h-9 items-center gap-2 rounded text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ArrowLeft className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden="true" />{t("Yardıma dön")}</button>
        <fieldset disabled={state === "sending"} className="space-y-4"><label className="block text-sm font-medium">{t("E-posta")}<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} className="form-control mt-1.5" /></label><label className="block text-sm font-medium">{t("Konu")}<select aria-label={t("Konu")} value={topic} onChange={event => setTopic(event.target.value as SupportTopic)} className="form-control mt-1.5"><option value="question">{t("Bir sorum var")}</option><option value="issue">{t("Bir sorun yaşıyorum")}</option><option value="feedback">{t("Bir önerim var")}</option></select></label><label className="block text-sm font-medium">{t("Mesajınız")}<textarea aria-label={t("Mesajınız")} required maxLength={2000} rows={4} value={message} onChange={event => setMessage(event.target.value)} className="form-control mt-1.5 min-h-28 resize-y" /></label></fieldset>
        {state === "error" && <p role="alert" className="text-sm leading-6 text-red-700 dark:text-red-300">{t("Gönderimi doğrulayamadık. Mesajınız korundu; yeniden deneyebilir veya bize e-posta yazabilirsiniz.")}</p>}
        {config.accessKey ? <Button type="submit" disabled={state === "sending" || !message.trim()} className="min-h-11 w-full gap-2">{state === "sending" && <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />}{state === "sending" ? t("Gönderiliyor…") : t("Mesajı gönder")}</Button> : config.email && <Button type="button" className="min-h-11 w-full" onClick={event => { if (event.currentTarget.closest("form")?.reportValidity()) window.location.href = supportMailto(config.email, { email, topic, message }); }}>{t("E-postada aç")}</Button>}
        <p className="text-xs leading-5 text-muted-foreground">{config.accessKey ? t("Mesajınız yalnız destek ekibine iletilir. Analiz belgelerinizi veya parolanızı paylaşmayın.") : t("Göndermeyi e-posta uygulamanızda tamamlayın.")}</p>
      </form> : <><div className="mt-6 divide-y divide-border/70">{questions.map(([question, answer]) => <details name={`${id}-faq`} key={question} className="group py-1"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">{t(question)}<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" /></summary><p className="px-2 pb-4 text-sm leading-7 text-muted-foreground">{t(answer)}</p></details>)}</div><div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5"><Link to="/" onClick={onClose} className="inline-flex min-h-10 items-center gap-2 rounded text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-secondary">{t("Nasıl çalışır?")}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>{(config.email || config.accessKey) && <Button onClick={() => setCompose(true)} className="gap-2"><Mail className="h-4 w-4" aria-hidden="true" />{t("Bize yazın")}</Button>}</div></>}
      {config.email && <a href={supportMailto(config.email)} className="mt-5 block w-fit max-w-full break-all rounded text-xs text-muted-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{config.email}</a>}
    </div>
  </dialog>;
}

// Genel sayfalarda da aynı yardım penceresini açan sade bir giriş sağlar.
export function SupportLauncher() {
  useLocale();
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Headphones className="h-4 w-4" aria-hidden="true" />{t("Destek ve yardım")}</button><SupportDialog open={open} onClose={() => setOpen(false)} /></>;
}
