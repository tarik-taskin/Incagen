import { File, FileSpreadsheet, FileText, Image, Presentation, Trash2, X } from "lucide-react";
import { Button } from "../ui/button";
import { formatFileSize, type FileCategory, type PreparedFile } from "../../features/files/file-rules";

interface SelectedFileListProps {
  files: PreparedFile[];
  limit: number;
  onClear: () => void;
  onRemove: (id: string) => void;
}

const categoryIconMap = {
  Tablo: FileSpreadsheet,
  Belge: FileText,
  Sunum: Presentation,
  Veri: File,
  Görsel: Image,
} satisfies Record<FileCategory, typeof File>;

// Seçilen dosyaları kategori, boyut ve kaldırma kontrolleriyle kullanıcıya özetler.
export function SelectedFileList({ files, limit, onClear, onRemove }: SelectedFileListProps) {
  if (files.length === 0) return null;

  return (
    <section className="rounded-3xl border border-border/70 bg-card/75 shadow-sm" aria-labelledby="selected-files-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4 sm:px-6">
        <div>
          <h2 id="selected-files-title" className="font-semibold">Seçilen dosyalar</h2>
          <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">{files.length}/{limit} dosya analize hazırlanıyor</p>
        </div>
        <Button type="button" variant="ghost" className="h-9 gap-2 px-3 text-muted-foreground hover:text-foreground" onClick={onClear}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Tümünü temizle
        </Button>
      </div>

      <ul className="divide-y divide-border/70" aria-label="Seçilen dosyalar">
        {files.map(({ id, file, category }) => {
          const CategoryIcon = categoryIconMap[category];
          return (
            <li key={id} className="flex items-center gap-3 px-5 py-4 sm:px-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-secondary/10 dark:text-secondary">
                <CategoryIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={file.name}>{file.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{category} · {formatFileSize(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
                aria-label={`${file.name} dosyasını kaldır`}
                onClick={() => onRemove(id)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
