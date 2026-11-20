import { localeTag, t, useLocale } from "../../i18n/runtime";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Check, FilePlus2, FileText } from "lucide-react";
import { Button } from "../ui/button";
import { SUPPORTED_FILE_ACCEPT, type PreparedFile } from "../../features/files/file-rules";
import { cn } from "../../lib/utils";
import styles from "./file-dropzone.module.css";

interface FileDropzoneProps {
  disabled?: boolean;
  lastAccepted?: readonly PreparedFile[];
  onFilesSelected: (files: File[]) => void;
}

// Kabul edilen grubu ürüne özgü kısa bir pota animasyonuyla karşılar.
function DropIllustration({ count }: { count: number }) {
  return (
    <div className={styles.illustration} data-caught={count > 0} dir="ltr" aria-hidden="true">
      <div className={styles.orbit} />
      <div className={styles.backboard} />
      <div className={styles.net} />
      <div className={styles.document}><FileText size={21} strokeWidth={1.7} /></div>
      <div className={styles.rim} />
      {count > 0 && <div className={styles.score}>{new Intl.NumberFormat(localeTag(), { signDisplay: "always" }).format(count)}</div>}
    </div>
  );
}

// Sürükle-bırak ve sistem dosya seçicisini aynı erişilebilir seçim davranışında birleştirir.
export function FileDropzone({ disabled = false, lastAccepted, onFilesSelected }: FileDropzoneProps) {
  useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [initialAcceptance] = useState(() => lastAccepted);
  const dragDepth = useRef(0);
  const dragging = isDragging && !disabled;
  // Taslak iç sayfalarda korunur. Geri dönüldüğünde önceki seçim animasyonu yeniden başlamaz.
  const accepted = lastAccepted !== initialAcceptance ? lastAccepted : undefined;
  const count = accepted?.length ?? 0;
  const batchKey = accepted?.[0]?.id;

  // Alan dışında bırakılan veya iptal edilen sürüklemeler de yerel vurguyu kapatır.
  useEffect(() => {
    const reset = () => { dragDepth.current = 0; setIsDragging(false); };
    window.addEventListener("drop", reset);
    window.addEventListener("dragend", reset);
    return () => { window.removeEventListener("drop", reset); window.removeEventListener("dragend", reset); };
  }, []);

  // Seçilen dosyaları üst bileşene iletir ve aynı dosyanın yeniden seçilebilmesi için input değerini sıfırlar.
  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!disabled && files.length) onFilesSelected(files);
    event.target.value = "";
  }

  // Dosya çalışma alanına girildiğinde sürükleme vurgusunu etkinleştirir.
  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled || !Array.from(event.dataTransfer.types).includes("Files")) return;
    dragDepth.current += 1;
    setIsDragging(true);
  }

  // İç içe eleman geçişlerinde vurgunun erken kapanmasını engelleyerek sürükleme durumunu temizler.
  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
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
    const files = Array.from(event.dataTransfer.files);
    if (!disabled && files.length) onFilesSelected(files);
  }

  // Fare veya dokunmayla alanın herhangi bir noktasından sistem dosya seçicisini açar.
  function openFilePicker() {
    if (!disabled) inputRef.current?.click();
  }

  return (
    <div
      className={cn(
        styles.dropzone,
        "group relative flex min-h-72 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed px-5 py-6 text-center motion-safe:transition-colors sm:px-8 sm:py-7",
        dragging
          ? "border-primary bg-primary/[0.07] dark:border-secondary dark:bg-secondary/[0.08]"
          : "border-primary/30 bg-card/75 dark:border-secondary/25",
        !disabled && "hover:border-primary/60 dark:hover:border-secondary/55",
        // Açıklamalar pasif alanda da okunur kalır; yalnız gerçek kontroller disabled görünür.
        disabled && "cursor-not-allowed",
      )}
      role="group"
      data-dragging={dragging}
      aria-label={t("Dosya seçim alanı")}
      onDragEnter={handleDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(event) => {
        if (event.target !== inputRef.current) openFilePicker();
      }}
    >
      <DropIllustration key={batchKey ?? "idle"} count={count} />
      <h2 className="relative mt-1 text-xl font-semibold tracking-[-0.03em]">
        {dragging ? t("Belgelerinizi buraya bırakın") : t("Belgelerinizi ekleyin")}
      </h2>
      <p className="relative mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        {t("Belgeleri sürükleyip bırakın veya cihazınızdan seçin.")}
      </p>
      <Button
        type="button"
        className="relative mt-4 gap-2 rounded-xl"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          openFilePicker();
        }}
      >
        <FilePlus2 className="h-4 w-4" aria-hidden="true" />
        {t("Belgeleri seç")}
      </Button>
      <p className="relative mt-3 text-xs leading-5 text-muted-foreground">{t("PDF · DOCX · PPTX · XLSX/CSV · TXT/MD/JSON · PNG/JPEG/WebP")}</p>
      <div role="status" aria-atomic="true" className="relative mt-1 flex min-h-5 items-center justify-center gap-1.5 text-xs font-medium leading-5 text-primary dark:text-secondary">
        {count > 0 && (
          <span key={batchKey} className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t("Taslağa {0} belge eklendi", count)}
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        multiple
        accept={SUPPORTED_FILE_ACCEPT}
        aria-label={t("Analiz edilecek dosyaları seç")}
        onChange={handleInputChange}
        disabled={disabled}
      />
    </div>
  );
}
