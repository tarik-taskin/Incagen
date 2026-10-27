import { useOutsideDismiss } from "../hooks/use-outside-dismiss";
import { hasOpenPopover } from "../lib/popover-layers";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AuthCard } from "./auth-card";

interface AuthModalProps {
  open: boolean;
  onAuthenticated: () => void;
  onClose: () => void;
}

// Landing içeriğini yerinde tutarak giriş ve kayıt kartını en üst katmanda sunar.
export function AuthModal({ open, onAuthenticated, onClose }: AuthModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useOutsideDismiss(dialogRef, onClose, open);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";

    // Escape ile kapatır; Tab odağını modalın etkileşimli öğeleri içinde tutar. Açık dil listesi varsa Escape yalnız onu kapatır.
    function handleDialogKeyboard(event: KeyboardEvent) {
      if (hasOpenPopover()) return;
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDialogKeyboard);
      previouslyFocused?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-foreground/45 p-3 backdrop-blur-lg sm:p-6"
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="landing-auth-title" className="my-auto w-full max-w-lg py-3">
        <AuthCard titleId="landing-auth-title" onAuthenticated={onAuthenticated} onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}
