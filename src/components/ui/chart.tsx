import type * as React from "react";
import { cn } from "@/lib/utils";

// Recharts metin, ızgara ve imleç renklerini tasarım tokenlarına bağlayan kap.
export function ChartContainer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "w-full text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-label]:fill-muted-foreground [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/60 [&_.recharts-surface]:overflow-visible [&_.recharts-tooltip-cursor]:stroke-border [&_.recharts-wrapper]:outline-none [&_svg]:outline-none",
        className,
      )}
      {...props}
    />
  );
}

interface TooltipRow { name: string; value: string; color?: string }

// shadcn tooltip görünümü: başlık, renk işareti ve tam değer; yüzey glass görünümüne uyar.
export function ChartTooltipCard({ title, rows }: { title?: string; rows: TooltipRow[] }) {
  return (
    <div className="popover-surface min-w-[9rem] rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-xl">
      {title && <p className="mb-1.5 font-semibold">{title}</p>}
      <div className="space-y-1">
        {rows.map(row => (
          <div key={row.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">{row.color && <span className="h-2 w-2 rounded-sm" style={{ background: row.color }} />}{row.name}</span>
            <span className="font-medium tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
