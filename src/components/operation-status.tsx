import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

// Beklemeyi sayfa akışında duyurur ve hareket azaltıldığında simgeyi sabit tutar.
export function OperationStatus({ children }: { children: ReactNode }) {
  return <p role="status" aria-atomic="true" className="flex items-start gap-2 rounded-xl border border-primary/15 bg-card px-4 py-3 text-sm leading-6 text-foreground dark:border-secondary/20">
    <LoaderCircle className="mt-1 h-4 w-4 shrink-0 text-primary motion-safe:animate-spin dark:text-secondary" aria-hidden="true" />
    <span>{children}</span>
  </p>;
}
