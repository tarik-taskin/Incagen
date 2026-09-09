import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FilePlus2, UploadCloud } from "lucide-react";
import { Button } from "../ui/button";
import { SUPPORTED_FILE_ACCEPT } from "../../features/files/file-rules";
import { cn } from "../../lib/utils";

interface FileDropzoneProps {
  disabled?: boolean;
  onFilesSelected: (files: File[]) => void;
}

// Sürükle-bırak ve sistem dosya seçicisini aynı erişilebilir seçim davranışında birleştirir.
export function FileDropzone({ disabled = false, onFilesSelected }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  // Seçilen dosyaları üst bileşene iletir ve aynı dosyanın yeniden seçilebilmesi için input değerini sıfırlar.
  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    onFilesSelected(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  // Dosya çalışma alanına girildiğinde sürükleme vurgusunu etkinleştirir.
  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) return;
    dragDepth.current += 1;
    setIsDragging(true);
  }

  // İç içe eleman geçişlerinde vurgunun erken kapanmasını engelleyerek sürükleme durumunu temizler.
  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  }

  // Bırakılan dosyaları doğrulama katmanına gönderir ve sürükleme durumunu sıfırlar.
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    if (!disabled) onFilesSelected(Array.from(event.dataTransfer.files));
  }

  return (
    <div
      className={cn(
        "group relative flex min-h-72 flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:p-10",
        isDragging
          ? "border-primary bg-primary/[0.08] dark:border-secondary dark:bg-secondary/[0.08]"
          : "border-primary/30 bg-card/75 hover:border-primary/60 hover:bg-card dark:border-secondary/25 dark:hover:border-secondary/55",
        disabled && "cursor-not-allowed opacity-60",
      )}
      role="group"
      aria-label="Dosya seçim alanı"
      onDragEnter={handleDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.08),transparent_58%)] opacity-0 transition-opacity group-hover:opacity-100 dark:bg-[radial-gradient(circle_at_center,hsl(var(--secondary)/0.08),transparent_58%)]" aria-hidden="true" />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-secondary/10 dark:text-secondary">
        {isDragging ? <FilePlus2 className="h-7 w-7" aria-hidden="true" /> : <UploadCloud className="h-7 w-7" aria-hidden="true" />}
      </div>
      <h2 className="relative mt-5 text-xl font-semibold tracking-[-0.03em]">
        {isDragging ? "Dosyalarınızı buraya bırakın" : "Analiz için dosyalarınızı seçin"}
      </h2>
      <p className="relative mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        İşletme verilerinizi içeren tabloları, belgeleri, sunumları, yapılandırılmış verileri veya görselleri birlikte ekleyebilirsiniz.
      </p>
      <Button
        type="button"
        className="relative mt-6 gap-2 rounded-xl"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          inputRef.current?.click();
        }}
      >
        <FilePlus2 className="h-4 w-4" aria-hidden="true" />
        Dosyaları seç
      </Button>
      <p className="relative mt-4 text-xs text-muted-foreground">CSV, Excel, PDF, Word, metin, sunum, JSON, XML ve görsel formatları</p>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        multiple
        accept={SUPPORTED_FILE_ACCEPT}
        aria-label="Analiz edilecek dosyaları seç"
        onChange={handleInputChange}
        disabled={disabled}
      />
    </div>
  );
}
