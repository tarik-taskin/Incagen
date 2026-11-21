import { localeTag, t, useLocale } from "../../i18n/runtime";
import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Check, FilePlus2, FileText } from "lucide-react";
import { Button } from "../ui/button";
import { SUPPORTED_FILE_ACCEPT, SUPPORTED_FORMAT_GROUPS, type PreparedFile } from "../../features/files/file-rules";
import { cn } from "../../lib/utils";
import styles from "./file-dropzone.module.css";

const SCORE_VISIBLE_MS = 2000;

interface FileDropzoneProps {
  unavailable?: { title: string; detail: string };
  lastAccepted?: readonly PreparedFile[];
  onFilesSelected: (files: File[]) => void;
}

// Sürüklenen bağlantı ve metinlerin doğal tarayıcı davranışına karışmaz.
function hasDraggedFiles(transfer: DataTransfer | null) {
  return transfer?.types.includes("Files") ?? false;
}

// Kabul edilen grubu ürüne özgü kısa bir pota animasyonuyla karşılar.
function DropIllustration({ count }: { count: number }) {
  const [showScore, setShowScore] = useState(count > 0);

  // Görsel sayaç her kabulde kısa süre gösterilir; yeni grup kendi süresini başlatır.
  useEffect(() => {
    if (!count) return;
    const timeout = window.setTimeout(() => setShowScore(false), SCORE_VISIBLE_MS);
    return () => window.clearTimeout(timeout);
  }, [count]);

  return (
    <div className={styles.illustration} data-caught={count > 0} dir="ltr" aria-hidden="true">
      <div className={styles.orbit} />
      <div className={styles.backboard} />
      <div className={styles.net} />
      <div className={styles.document}><FileText size={21} strokeWidth={1.7} /></div>
      <div className={styles.rim} />
      {showScore && <div className={styles.score}>{new Intl.NumberFormat(localeTag(), { signDisplay: "always" }).format(count)}</div>}
    </div>
  );
}

// Sürükle-bırak ve sistem dosya seçicisini aynı erişilebilir seçim davranışında birleştirir.
export function FileDropzone({ unavailable, lastAccepted, onFilesSelected }: FileDropzoneProps) {
  useLocale();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [initialAcceptance] = useState(() => lastAccepted);
  const dragDepth = useRef(0);
  const dragging = isDragging && !unavailable;
  // Taslak iç sayfalarda korunur. Geri dönüldüğünde önceki seçim animasyonu yeniden başlamaz.
  const accepted = lastAccepted !== initialAcceptance ? lastAccepted : undefined;
  const count = accepted?.length ?? 0;
  const batchKey = accepted?.[0]?.id;

  // Alan dışına bırakılan dosya tarayıcıda açılıp kullanıcının taslağını kesmesin.
  useEffect(() => {
    const reset = () => { dragDepth.current = 0; setIsDragging(false); };
    const preventOutsideFileDrop = (event: globalThis.DragEvent) => {
      if (event.defaultPrevented || !hasDraggedFiles(event.dataTransfer)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
    };
    const stopDrag = (event: globalThis.DragEvent) => { preventOutsideFileDrop(event); reset(); };
    window.addEventListener("dragover", preventOutsideFileDrop);
    window.addEventListener("drop", stopDrag);
    window.addEventListener("dragend", reset);
    return () => {
      window.removeEventListener("dragover", preventOutsideFileDrop);
      window.removeEventListener("drop", stopDrag);
      window.removeEventListener("dragend", reset);
    };
  }, []);

  // Seçilen dosyaları üst bileşene iletir ve aynı dosyanın yeniden seçilebilmesi için input değerini sıfırlar.
  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!unavailable && files.length) onFilesSelected(files);
    event.target.value = "";
  }

  // Dosya çalışma alanına girildiğinde sürükleme vurgusunu etkinleştirir.
  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    if (unavailable || !hasDraggedFiles(event.dataTransfer)) return;
    dragDepth.current += 1;
    setIsDragging(true);
  }

  // İç içe eleman geçişlerinde vurgunun erken kapanmasını engelleyerek sürükleme durumunu temizler.
  function handleDragLeave() {
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  }

  // Bırakılan dosyaları doğrulama katmanına gönderir ve sürükleme durumunu sıfırlar.
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    dragDepth.current = 0;
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (!files.length && !hasDraggedFiles(event.dataTransfer)) return;
    event.preventDefault();
    if (!unavailable && files.length) onFilesSelected(files);
  }

  // Fare veya dokunmayla alanın herhangi bir noktasından sistem dosya seçicisini açar.
  function openFilePicker() {
    if (!unavailable) inputRef.current?.click();
  }

  return (
    <div
      className={cn(
        styles.dropzone,
        "relative flex min-h-72 flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed px-5 py-6 text-center motion-safe:transition-colors sm:px-8 sm:py-7",
        dragging
          ? "border-primary bg-primary/[0.07] dark:border-secondary dark:bg-secondary/[0.08]"
          : "border-primary/30 bg-card/75 dark:border-secondary/25",
        unavailable ? "cursor-not-allowed" : "cursor-pointer hover:border-primary/60 dark:hover:border-secondary/55",
      )}
      role="group"
      data-available={!unavailable}
      data-dragging={dragging}
      aria-label={t("Dosya seçim alanı")}
      onDragEnter={handleDragEnter}
      onDragOver={(event) => {
        if (!hasDraggedFiles(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = unavailable ? "none" : "copy";
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(event) => {
        if (event.target !== inputRef.current) openFilePicker();
      }}
    >
      <DropIllustration key={batchKey ?? "idle"} count={count} />
      <h2 className="relative mt-1 text-xl font-semibold tracking-[-0.03em]">
        {unavailable?.title ?? t(dragging ? "Belgelerinizi buraya bırakın" : "Belgelerinizi ekleyin")}
      </h2>
      <p id={hintId} className="relative mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        {unavailable?.detail ?? t("Belgeleri sürükleyip bırakın veya cihazınızdan seçin.")}
      </p>
      <Button
        type="button"
        className="relative mt-4 gap-2 rounded-xl aria-disabled:cursor-not-allowed aria-disabled:bg-muted aria-disabled:text-muted-foreground aria-disabled:hover:bg-muted"
        aria-disabled={Boolean(unavailable)}
        aria-describedby={hintId}
        onClick={(event) => {
          event.stopPropagation();
          openFilePicker();
        }}
      >
        <FilePlus2 className="h-4 w-4" aria-hidden="true" />
        {t("Belgeleri seç")}
      </Button>
      <div
        className="relative mt-3 flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-xs leading-5 text-muted-foreground"
        aria-label={t("Desteklenen formatlar")}
      >
        {SUPPORTED_FORMAT_GROUPS.map((group) => (
          <span
            key={group.category}
            className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg bg-muted/60 px-2 py-0.5"
          >
            <span className="font-medium text-foreground/80">{t(group.category)}:</span>
            <span dir="ltr" className="uppercase">{group.extensions.join(" · ")}</span>
          </span>
        ))}
      </div>
      <div role="status" aria-atomic="true" className="sr-only">
        {count > 0 && <span key={batchKey}>{t("Seçime {0} dosya eklendi", count)}</span>}
      </div>
      <div className="relative mt-1 flex min-h-5 items-center justify-center gap-1.5 text-xs font-medium leading-5 text-primary dark:text-secondary">
        {count > 0 && !unavailable && (
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t("Seçiminizi aşağıdaki listeden düzenleyebilirsiniz.")}
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        hidden
        type="file"
        multiple
        accept={SUPPORTED_FILE_ACCEPT}
        aria-label={t("Analiz edilecek dosyaları seç")}
        onChange={handleInputChange}
        disabled={Boolean(unavailable)}
      />
    </div>
  );
}
