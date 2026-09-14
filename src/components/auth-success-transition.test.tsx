import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTH_TRANSITION_DURATION_MS, AUTH_TRANSITION_VISIBLE_MESSAGE_COUNT, getAuthTransitionMessages, selectAuthTransitionMessages } from "../features/auth/auth-transition-content";
import { AuthSuccessTransition } from "./auth-success-transition";

afterEach(() => vi.useRealTimers());

describe("Kimlik sonrası hazırlık geçişi", () => {
  it("sıralamadan bağımsız yirmi farklı hazırlık mesajı üretir", () => {
    const messages = getAuthTransitionMessages();

    expect(new Set(messages).size).toBe(20);
    expect(messages.join(" ")).not.toMatch(/giriş yapılıyor|hesabınız oluşturuluyor|kayıt olunuyor/i);
  });

  it("yirmi mesajlık havuzdan tekrar etmeyen beş mesaj seçer", () => {
    const pool = getAuthTransitionMessages();
    const selected = selectAuthTransitionMessages();

    expect(selected).toHaveLength(AUTH_TRANSITION_VISIBLE_MESSAGE_COUNT);
    expect(new Set(selected).size).toBe(AUTH_TRANSITION_VISIBLE_MESSAGE_COUNT);
    expect(selected.every((message) => pool.includes(message))).toBe(true);
  });

  it("ilerleme süresi bitince çalışma alanına geçer", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<AuthSuccessTransition onComplete={onComplete} />);

    expect(screen.getByRole("status")).toHaveTextContent("Çalışma alanınıza geçiş yapılıyor");
    act(() => vi.advanceTimersByTime(AUTH_TRANSITION_DURATION_MS - 1));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
