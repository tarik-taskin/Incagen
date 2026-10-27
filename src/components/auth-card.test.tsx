import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthCard } from "./auth-card";

const sendPasswordResetEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const signInWithPopupMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class { parameters = {}; setCustomParameters(parameters: object) { this.parameters = parameters; } },
  sendPasswordResetEmail: sendPasswordResetEmailMock,
  signInWithPopup: signInWithPopupMock,
}));
vi.mock("../lib/firebase-auth", () => ({ getAuthServices: () => ({ auth: { name: "test-auth" } }), usesFirebaseEmulator: true }));
vi.mock("../lib/auth-context", () => ({ useAuth: () => ({ user: null, loading: false, error: "" }) }));

// Kimlik kartını servis çağrısı gerektirmeyen test özellikleriyle oluşturur.
function renderAuthCard() {
  return render(<AuthCard titleId="test-auth-title" onAuthenticated={vi.fn()} onClose={vi.fn()} />);
}

// Firebase SDK'nın kodlu hata nesnesini taklit eder.
function authError(code: string) {
  return Object.assign(new Error(code), { code });
}

describe("Kimlik kartı", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWithPopupMock.mockResolvedValue(undefined);
  });

  it("giriş ekranında şifresini unutan kullanıcıya bağlantı yollar", async () => {
    const user = userEvent.setup();
    renderAuthCard();

    await user.click(screen.getByRole("button", { name: "Şifremi unuttum" }));
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("E-posta", { exact: true }), "demo@example.test");
    await user.click(screen.getByRole("button", { name: "Şifremi unuttum" }));

    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith({ name: "test-auth" }, "demo@example.test");
    expect(await screen.findByRole("status")).toHaveTextContent("Şifre yenileme bağlantısı");
  });

  it("kayıt alanlarını canlı doğrular; Google'ı etkin, diğer sosyal seçenekleri pasif gösterir", async () => {
    const user = userEvent.setup();
    renderAuthCard();

    expect(screen.getByRole("button", { name: "Google ile giriş yap" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Apple ile giriş yap" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Microsoft ile giriş yap" })).toBeDisabled();
    expect(screen.queryByText(/sosyal seçenekler yakında/i)).not.toBeInTheDocument();

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
    expect(screen.getByRole("button", { name: "Google ile kayıt ol" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Apple ile kayıt ol" })).toBeDisabled();
  });

  it("Google penceresini hesap seçiciyle açar ve başarıda çalışma alanına geçer", async () => {
    const user = userEvent.setup();
    renderAuthCard();

    await user.click(screen.getByRole("button", { name: "Google ile giriş yap" }));

    expect(signInWithPopupMock).toHaveBeenCalledOnce();
    const [auth, provider] = signInWithPopupMock.mock.calls[0];
    expect(auth).toEqual({ name: "test-auth" });
    expect(provider).toMatchObject({ parameters: { prompt: "select_account" } });
    expect(await screen.findByRole("status")).toHaveTextContent("Çalışma alanınıza geçiş yapılıyor");
  });

  it("kapatılan Google penceresini hata saymaz, başka yöntemle kayıtlı e-postayı açıklar", async () => {
    const user = userEvent.setup();
    renderAuthCard();
    const google = screen.getByRole("button", { name: "Google ile giriş yap" });

    signInWithPopupMock.mockRejectedValueOnce(authError("auth/popup-closed-by-user"));
    await user.click(google);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(google).toBeEnabled();

    signInWithPopupMock.mockRejectedValueOnce(authError("auth/account-exists-with-different-credential"));
    await user.click(google);
    expect(await screen.findByRole("alert")).toHaveTextContent("Bu e-posta başka bir giriş yöntemiyle kayıtlı.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
