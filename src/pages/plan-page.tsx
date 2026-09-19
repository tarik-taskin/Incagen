import { ArrowRight, Check, Crown, FileStack, Gauge, Link2, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { PLAN_RULES } from "../features/plans/plan-rules";

type Plan = typeof PLAN_RULES.free | typeof PLAN_RULES.premium;

// Ortak plan sözleşmesindeki bayt değerini kullanıcıya anlaşılır MB olarak sunar.
function megabytes(bytes: number) {
  return (bytes / 1024 ** 2).toLocaleString("tr-TR") + " MB";
}

// Aynı plan verisini kartlarda kullanır; Premium'un henüz etkin olmadığını görünür tutar.
function PlanCard({ plan, premium }: { plan: Plan; premium: boolean }) {
  return <article className={"relative flex h-full flex-col overflow-hidden rounded-[2rem] border bg-card p-6 shadow-sm sm:p-8 " + (premium ? "border-primary/35 shadow-primary/10 dark:border-secondary/35" : "border-border")}>
    {premium && <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-fuchsia-500 to-rose-400" aria-hidden="true" />}
    <div className="flex flex-wrap items-start justify-between gap-3">
      <span className={"flex h-12 w-12 items-center justify-center rounded-2xl " + (premium ? "bg-primary/10 text-primary dark:bg-secondary/10 dark:text-secondary" : "bg-muted text-foreground")}>
        {premium ? <Crown className="h-6 w-6" aria-hidden="true" /> : <ShieldCheck className="h-6 w-6" aria-hidden="true" />}
      </span>
      <span className={"rounded-full border px-3 py-1.5 text-xs font-semibold " + (premium ? "border-primary/20 bg-primary/5 text-primary dark:border-secondary/25 dark:bg-secondary/10 dark:text-secondary" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>
        {premium ? "Planlanan" : "Aktif planınız"}
      </span>
    </div>
    <h2 className="mt-6 text-2xl font-semibold tracking-tight">{plan.label}</h2>
    <p className="mt-2 min-h-12 max-w-md text-sm leading-6 text-muted-foreground">
      {premium ? "Daha fazla belgeyle çalışmak ve bağlantılı verilerden derin analiz almak için planlanan seçenek." : "Belgeleri güvenle hazırlamaya ve analiz geçmişinizi oluşturmaya başlamak için mevcut plan."}
    </p>
    <div className="mt-7 flex items-end gap-2 border-b border-border pb-6">
      <span className="text-5xl font-semibold tracking-[-0.07em]">{plan.dailyAnalysisLimit}</span>
      <span className="pb-1.5 text-sm text-muted-foreground">analiz / gün</span>
    </div>
    <div className="mt-6 grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-muted/55 p-4"><p className="text-xs text-muted-foreground">Analiz başına</p><p className="mt-1 text-lg font-semibold">{plan.filesPerAnalysis} dosya</p></div>
      <div className="rounded-2xl bg-muted/55 p-4"><p className="text-xs text-muted-foreground">Toplam boyut</p><p className="mt-1 text-lg font-semibold">{megabytes(plan.totalBytes)}</p></div>
    </div>
    <ul className="mt-6 space-y-3 text-sm">
      <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-secondary" aria-hidden="true" /><span>Her dosya için {megabytes(plan.fileBytes)} sınır</span></li>
      <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-secondary" aria-hidden="true" /><span>İki planda da aynı belge formatları</span></li>
      <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-secondary" aria-hidden="true" /><span>{plan.analysisDepth} analiz derinliği <span className="text-muted-foreground">(planlanan)</span></span></li>
    </ul>
    <div className="mt-auto pt-8">
      {premium
        ? <button type="button" disabled className="min-h-11 w-full cursor-not-allowed rounded-xl border border-primary/20 bg-primary/10 px-5 text-sm font-semibold text-primary/60 dark:border-secondary/20 dark:bg-secondary/10 dark:text-secondary/60">Premium'a geç</button>
        : <Link to="/app/new-analysis" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">Yeni analiz aç <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>}
    </div>
  </article>;
}

// Aktif Free sınırları ile planlanan Premium kapasitesini tek kaynaktan karşılaştırır.
export function PlanPage() {
  const free = PLAN_RULES.free;
  const premium = PLAN_RULES.premium;
  const rows = [
    { label: "Günlük analiz", icon: Gauge, free: free.dailyAnalysisLimit + " analiz", premium: premium.dailyAnalysisLimit + " analiz" },
    { label: "Analiz başına dosya", icon: FileStack, free: free.filesPerAnalysis + " dosya", premium: premium.filesPerAnalysis + " dosya" },
    { label: "Dosya başına boyut", icon: FileStack, free: megabytes(free.fileBytes), premium: megabytes(premium.fileBytes) },
    { label: "Analiz başına toplam", icon: FileStack, free: megabytes(free.totalBytes), premium: megabytes(premium.totalBytes) },
    { label: "Analiz derinliği", icon: Sparkles, free: free.analysisDepth + " · planlanan", premium: premium.analysisDepth + " · planlanan" },
    { label: "Harici veri bağlantıları", icon: Link2, free: free.externalSources, premium: premium.externalSources + " · planlanan" },
  ];

  return <section className="mx-auto w-full max-w-6xl" aria-labelledby="plan-title">
    <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-violet-800 to-slate-950 px-6 py-8 text-white shadow-xl sm:px-10 sm:py-10">
      <span className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
      <span className="pointer-events-none absolute bottom-0 right-1/3 h-36 w-36 rounded-full bg-fuchsia-400/15 blur-3xl" aria-hidden="true" />
      <div className="relative z-10 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Çalışma alanı / Plan</p>
        <h1 id="plan-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Planınızı ve sınırlarınızı görün</h1>
        <p className="mt-4 text-sm leading-7 text-white/80 sm:text-base">Free ile bugün kullanabildiğiniz kapasiteyi, Premium için planlanan farkları ve iki planda ortak kalan belge desteğini tek yerde karşılaştırın.</p>
        <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold"><Check className="h-4 w-4" aria-hidden="true" /> Şu anki planınız: Free</span>
      </div>
    </div>

    <div className="mt-8 grid gap-5 lg:grid-cols-2">
      <PlanCard plan={free} premium={false} />
      <PlanCard plan={premium} premium />
    </div>

    <section className="mt-8 rounded-[2rem] border border-border bg-card p-5 shadow-sm sm:p-8" aria-labelledby="plan-compare-title">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
        <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary dark:text-secondary">Yan yana karşılaştırma</p><h2 id="plan-compare-title" className="mt-1 text-xl font-semibold">Plan farkları</h2></div>
      </div>
      <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-border py-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:grid">
        <span>Özellik</span><span>Free</span><span>Premium</span>
      </div>
      <dl>
        {rows.map(({ label, icon: Icon, free: freeValue, premium: premiumValue }) => <div key={label} className="grid grid-cols-2 gap-3 border-b border-border/70 py-4 last:border-0 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <dt className="col-span-2 flex items-center gap-2 text-sm font-medium sm:col-span-1"><Icon className="h-4 w-4 shrink-0 text-primary dark:text-secondary" aria-hidden="true" />{label}</dt>
          <dd className="text-sm"><span className="mb-1 block text-xs text-muted-foreground sm:hidden">Free</span>{freeValue}</dd>
          <dd className="text-sm font-medium"><span className="mb-1 block text-xs text-muted-foreground sm:hidden">Premium</span>{premiumValue}</dd>
        </div>)}
      </dl>
    </section>

    <p className="mt-5 text-xs leading-5 text-muted-foreground">Premium ödeme, High AI analizi ve Google Analytics / Microsoft Clarity bağlantıları henüz kullanıma açılmadı. Bu ekran planlanan kapasiteyi gösterir; mevcut hesaplarda Free sınırları geçerlidir.</p>
  </section>;
}
