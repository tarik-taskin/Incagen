import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthModal } from "./auth-modal";

const signInWithPopupMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class { parameters = {}; setCustomParameters(parameters: object) { this.parameters = parameters; } },
  sendPasswordResetEmail: vi.fn(),
  signInWithPopup: signInWithPopupMock,
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
}));
vi.mock("../lib/firebase-auth", () => ({ getAuthServices: () => ({ auth: { name: "test-auth" } }), usesFirebaseEmulator: true }));
vi.mock("../lib/auth-context", () => ({ useAuth: () => ({ user: null, loading: false, error: "" }) }));

describe("AuthModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWithPopupMock.mockResolvedValue(undefined);
  });

  it("giriş başarılı olduğunda arka plandaki formu kaldırır ve dış tıklama veya Escape ile kapanmayı önler", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onAuthenticated = vi.fn();

    const { baseElement } = render(
      <AuthModal open={true} onClose={onClose} onAuthenticated={onAuthenticated} />,
    );

    const googleButton = screen.getByRole("button", { name: "Google ile giriş yap" });
    expect(googleButton).toBeInTheDocument();

    await user.click(googleButton);

    // Giriş başarılı oldu, durum mesajı görünür ve form kaldırılır
    expect(await screen.findByRole("status")).toHaveTextContent("Çalışma alanınıza geçiş yapılıyor");
    expect(screen.queryByRole("button", { name: "Google ile giriş yap" })).not.toBeInTheDocument();

    // Geçiş ekranı varken Escape basıldığında onClose çağrılmamalıdır
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    // Geçiş ekranı varken dış alana / boşluğa tıklandığında onClose çağrılmamalıdır
    fireEvent.pointerDown(baseElement);
    fireEvent.pointerUp(baseElement);
    fireEvent.click(baseElement);
    expect(onClose).not.toHaveBeenCalled();
  });
});
