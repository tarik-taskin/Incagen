import { useEffect, useRef, type ReactNode } from "react";
import { animate, motion, useReducedMotion } from "motion/react";

import { reportNumber } from "./report-format";

// Sayı hareketini görsel katmanda tutar; ekran okuyucuya üst karttaki kesin değer iletilir.
export function AnimatedValue({ value, unit }: { value: number; unit: string }) {
  const element = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || !element.current) return;
    const animation = animate(0, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: latest => { if (element.current) element.current.textContent = reportNumber(latest, unit, true); } });
    return () => animation.stop();
  }, [value, unit, reduced]);
  return <span ref={element} aria-hidden="true">{reportNumber(value, unit, true)}</span>;
}

// Rapor bölümlerini kaydırma sırasında bir kez açar; hareket azaltıldığında içerik doğrudan görünürdür.
export function ReportReveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return <motion.div initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.06 }} transition={{ duration: reduced ? 0 : 0.55, delay: reduced ? 0 : delay, ease: [0.22, 1, 0.36, 1] }} className={`min-w-0 ${className}`}>{children}</motion.div>;
}
