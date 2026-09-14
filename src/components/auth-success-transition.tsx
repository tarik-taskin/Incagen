import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import { AUTH_TRANSITION_DURATION_MS, getAuthTransitionMessages } from "../features/auth/auth-transition-content";
import { AnimatedLogo } from "./animated-logo";

// Mesajların her başarılı kimlik işleminde farklı bir sırada görünmesini sağlar.
function shuffleMessages(messages: readonly string[]) {
  const shuffled = [...messages];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

// Başarılı Firebase yanıtından sonra mesajları ve üç saniyelik ilerlemeyi gösterip hedef rotaya geçirir.
export function AuthSuccessTransition({ onComplete, register }: { onComplete: () => void; register: boolean }) {
  const [messages] = useState(() => shuffleMessages(getAuthTransitionMessages(register)));
  const [messageIndex, setMessageIndex] = useState(0);
  const [progressing, setProgressing] = useState(false);
  const completeRef = useRef(onComplete);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Hazırlık tamamlanırken modalın Escape ile kapanıp geçişi yarıda kesmesini engeller.
    function keepTransitionOpen(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
    }

    window.addEventListener("keydown", keepTransitionOpen, true);
    const frame = window.requestAnimationFrame(() => setProgressing(true));
    const messageInterval = window.setInterval(() => {
      setMessageIndex((current) => Math.min(current + 1, messages.length - 1));
    }, AUTH_TRANSITION_DURATION_MS / messages.length);
    const completionTimer = window.setTimeout(() => completeRef.current(), AUTH_TRANSITION_DURATION_MS);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(messageInterval);
      window.clearTimeout(completionTimer);
      window.removeEventListener("keydown", keepTransitionOpen, true);
    };
  }, [messages.length]);

  return (
    <div className="fixed inset-0 z-[140] flex min-h-screen items-center justify-center overflow-hidden bg-background/95 px-6 text-foreground backdrop-blur-2xl" role="status" aria-live="polite" aria-atomic="true">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="dot-grid absolute inset-0 opacity-45 dark:opacity-25" />
      </div>
      <div className="relative w-full max-w-2xl text-center">
        <AnimatedLogo className="mx-auto h-20 w-20 sm:h-24 sm:w-24" />
        <p className="mt-7 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card/75 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary shadow-sm dark:border-secondary/20 dark:text-secondary">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Güvenli Incagen oturumu
        </p>
        <div className="mt-6 flex min-h-24 items-center justify-center">
          <h2 className="text-balance text-3xl font-semibold tracking-[-0.045em] text-primary dark:text-secondary sm:text-5xl">
            {messages[messageIndex]}
          </h2>
        </div>
        <div className="mx-auto mt-5 h-2 w-full max-w-xl overflow-hidden rounded-full bg-primary/10 shadow-inner dark:bg-secondary/10" aria-hidden="true">
          <div className={`h-full origin-left rounded-full bg-gradient-to-r from-secondary via-primary to-[#ff5978] transition-transform duration-[3000ms] ease-linear ${progressing ? "scale-x-100" : "scale-x-0"}`} />
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary dark:text-secondary" aria-hidden="true" /> Çalışma alanınıza geçiş yapılıyor
        </p>
      </div>
    </div>
  );
}
