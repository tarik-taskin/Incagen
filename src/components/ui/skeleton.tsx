import type * as React from "react";
import { cn } from "@/lib/utils";

// Yüklenen içeriğin yerini tutar; azaltılmış hareket tercihinde nabız animasyonu global kuralla durur.
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-xl bg-muted", className)} {...props} />;
}

export { Skeleton };
