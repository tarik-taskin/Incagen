import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTH_TRANSITION_DURATION_MS, getAuthTransitionMessages } from "../features/auth/auth-transition-content";
import { AuthSuccessTransition } from "./auth-success-transition";

afterEach(() => vi.useRealTimers());

describe("Kimlik sonrası hazırlık geçişi", () => {
  it("giriş ve kayıt için on farklı mesaj üretir", () => {
    expect(new Set(getAuthTransitionMessages(false)).size).toBe(10);
    expect(new Set(getAuthTransitionMessages(true)).size).toBe(10);
    expect(getAuthTransitionMessages(false)).toContain("Giriş yapılıyor…");
    expect(getAuthTransitionMessages(true)).toContain("Hesabınız oluşturuluyor…");
  });

  it("ilerleme süresi bitince çalışma alanına geçer", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<AuthSuccessTransition register={false} onComplete={onComplete} />);

    expect(screen.getByRole("status")).toHaveTextContent("Çalışma alanınıza geçiş yapılıyor");
    act(() => vi.advanceTimersByTime(AUTH_TRANSITION_DURATION_MS - 1));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
