import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./settings-page";

const signOutMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const sendPasswordResetEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("firebase/auth", () => ({ signOut: signOutMock, sendPasswordResetEmail: sendPasswordResetEmailMock }));
vi.mock("../lib/firebase", () => ({ getServices: () => ({ auth: { name: "test-auth" } }) }));
vi.mock("../lib/auth-context", () => ({
  useAuth: () => ({ user: { uid: "test-user", email: "test@example.test" }, loading: false, error: "" }),
}));

// Ayarlar ekranını gerçek router davranışıyla oluşturur.
function renderSettings() {
  return render(
    <MemoryRouter initialEntries={["/app/settings"]}>
      <Routes>
        <Route path="/" element={<h1>Ana sayfa</h1>} />
        <Route path="/app/settings" element={<SettingsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Ayarlar sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOutMock.mockResolvedValue(undefined);
    sendPasswordResetEmailMock.mockResolvedValue(undefined);
  });

  it("oturumdaki e-postaya şifre değiştirme bağlantısı ister", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: "E-postaya bağlantı gönder" }));

    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith({ name: "test-auth" }, "test@example.test");
    expect(await screen.findByRole("status")).toHaveTextContent("Şifre değiştirme isteği hazırlandı");
    expect(screen.getByRole("button", { name: "Tekrar gönder" })).toBeEnabled();
  });

  it("şifre bağlantısı hatasını kullanıcıya gösterir", async () => {
    const user = userEvent.setup();
    sendPasswordResetEmailMock.mockRejectedValueOnce(new Error("Bağlantı gönderilemedi"));
    renderSettings();

    await user.click(screen.getByRole("button", { name: "E-postaya bağlantı gönder" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Bağlantı gönderilemedi");
  });

  it("başarılı çıkıştan sonra ana sayfaya döner", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Çıkış yap" }));

    expect(signOutMock).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: "Ana sayfa" })).toBeInTheDocument();
  });
});
