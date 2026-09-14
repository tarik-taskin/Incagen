import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AuthCard } from "./auth-card";

interface AuthModalProps {
  open: boolean;
  onAuthenticated: () => void;
  onClose: () => void;
}

// Landing içeriğini yerinde tutarak giriş ve kayıt kartını en üst katmanda sunar.
export function AuthModal({ open, onAuthenticated, onClose }: AuthModalProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Escape ile modalı kapatır ve sayfa kaydırmasını eski durumuna getirir.
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-foreground/35 p-4 backdrop-blur-md sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="landing-auth-title" className="my-auto w-full max-w-md">
        <AuthCard titleId="landing-auth-title" onAuthenticated={onAuthenticated} onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}
