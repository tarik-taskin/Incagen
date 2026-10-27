import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "../../components/ui/table";
import { cn } from "../../lib/utils";
import type { SortState } from "./use-sorted-rows";

interface SortableHeadProps<K extends string> {
  column: K;
  sort: SortState<K> | null;
  onSort: (column: K) => void;
  align?: "start" | "end";
  className?: string;
  children: ReactNode;
}

// Sıralama durumunu aria-sort ile duyuran, klavyeyle kullanılabilen tablo başlığı.
export function SortableHead<K extends string>({ column, sort, onSort, align = "end", className, children }: SortableHeadProps<K>) {
  const active = sort?.key === column ? sort.direction : undefined;
  const Icon = active === "ascending" ? ArrowUp : active === "descending" ? ArrowDown : ArrowUpDown;
  return (
    <TableHead scope="col" aria-sort={active ?? "none"} className={cn("px-0 text-[10px]", align === "end" && "text-end", className)}>
      <button type="button" onClick={() => onSort(column)} className={cn("inline-flex min-h-10 w-full items-center gap-1.5 rounded-lg px-5 font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary dark:focus-visible:ring-secondary", align === "end" && "justify-end", active && "text-foreground")}>
        {children}
        <Icon className={cn("h-3 w-3 shrink-0", !active && "opacity-40")} aria-hidden="true" />
      </button>
    </TableHead>
  );
}
