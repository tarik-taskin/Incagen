import { AnimatedLogo } from "./animated-logo";
import { t, useLocale } from "../i18n/runtime";
import { cn } from "../lib/utils";

// Gerçek içeriğin yerleşimini koruyan sessiz bir iskelet sunar; ilerleme yüzdesi veya yapay bekleme üretmez.
export function PageLoading({ label, fullPage = false, kind = "report" }: { label: string; fullPage?: boolean; kind?: "report" | "history" | "workspace" }) {
  useLocale();
  return <div role="status" aria-label={t(label)} aria-busy="true" className={cn("min-w-0", fullPage && "min-h-screen bg-background px-5 py-12 text-foreground sm:px-8 sm:py-16")}>
    <span className="sr-only">{t(label)}</span>
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8 flex items-center gap-3 sm:mb-10"><span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-card shadow-sm dark:border-secondary/15"><AnimatedLogo compact className="h-8 w-8" /></span><div><p className="text-sm font-semibold tracking-tight">Incagen</p><p aria-hidden="true" className="mt-1 text-xs text-muted-foreground">{t(label)}</p></div></div>
      <div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse">
        <div className="rounded-3xl border border-border/70 bg-card p-6 sm:p-8"><div className="h-2 w-20 rounded-full bg-primary/10 dark:bg-secondary/15" /><div className="mt-5 h-6 w-3/4 max-w-lg rounded-lg bg-muted" /><div className="mt-3 h-3 w-5/6 max-w-xl rounded-full bg-muted/70" /></div>
        {kind === "history" ? <div className="rounded-3xl border border-border/70 bg-card px-6 sm:px-8">{[1, 2, 3].map(item => <div key={item} className="flex items-center gap-4 border-b border-border/60 py-6 last:border-0"><div className="h-10 w-10 shrink-0 rounded-xl bg-muted" /><div className="flex-1 space-y-3"><div className="h-3 w-2/3 max-w-sm rounded-full bg-muted" /><div className="h-2 w-1/3 rounded-full bg-muted/60" /></div></div>)}</div> : <>
          {kind === "report" && <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{[1, 2, 3, 4].map(item => <div key={item} className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6"><div className="h-2 w-1/2 rounded-full bg-muted" /><div className="mt-5 h-7 w-3/4 rounded-lg bg-muted" /></div>)}</div>}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]"><div className="min-h-64 rounded-3xl border border-border/70 bg-card p-6 sm:min-h-80 sm:p-8"><div className="h-3 w-1/3 rounded-full bg-muted" /><div className="mt-8 flex h-36 items-end justify-between gap-4 border-b border-border/60 px-3 sm:h-44">{["h-1/3", "h-2/3", "h-1/2", "h-4/5", "h-3/5", "h-full"].map((height, index) => <div key={index} className={cn("flex-1 rounded-t-lg bg-primary/[0.07] dark:bg-secondary/10", height)} />)}</div></div><div className="rounded-3xl border border-border/70 bg-card p-6 sm:p-8"><div className="h-3 w-2/3 rounded-full bg-muted" /><div className="mt-7 space-y-4">{["w-full", "w-5/6", "w-full", "w-2/3"].map((width, index) => <div key={index} className={cn("h-2 rounded-full bg-muted/70", width)} />)}</div></div></div>
        </>}
      </div>
    </div>
  </div>;
}
