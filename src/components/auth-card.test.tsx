import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthCard } from "./auth-card";

vi.mock("../lib/auth-context", () => ({ useAuth: () => ({ user: null, loading: false, error: "" }) }));

// Kimlik kartını servis çağrısı gerektirmeyen test özellikleriyle oluşturur.
function renderAuthCard() {
  return render(<AuthCard titleId="test-auth-title" onAuthenticated={vi.fn()} onClose={vi.fn()} />);
}

describe("Kimlik kartı", () => {
  it("kayıt alanlarını canlı doğrular ve pasif sosyal seçenekleri gösterir", async () => {
    const user = userEvent.setup();
    renderAuthCard();

    expect(screen.getByRole("button", { name: "Google ile giriş yap — yakında" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Apple ile giriş yap — yakında" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Microsoft ile giriş yap — yakında" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Hesap oluştur" }));
    const registerButton = screen.getByRole("button", { name: "Hesap oluştur" });
    expect(registerButton).toBeDisabled();
    await user.type(screen.getByLabelText("E-posta", { exact: true }), "demo@example.test");
    expect(screen.getByText("E-posta formatı uygun")).toBeInTheDocument();

    const password = screen.getByLabelText("Parola", { exact: true });
    await user.type(password, "Secure123!");
    expect(screen.getByText("4/4 kriter")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Parolayı göster" }));
    expect(password).toHaveAttribute("type", "text");

    const confirmation = screen.getByLabelText("Parola tekrarı", { exact: true });
    await user.type(confirmation, "Other123!");
    expect(screen.getByText("Parolalar eşleşmiyor")).toBeInTheDocument();
    await user.clear(confirmation);
    await user.type(confirmation, "Secure123!");
    expect(screen.getByText("Parolalar eşleşiyor")).toBeInTheDocument();
    expect(registerButton).toBeEnabled();

    expect(screen.getByLabelText("Davet kodu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Google ile kayıt ol — yakında" })).toBeDisabled();
  });
});
