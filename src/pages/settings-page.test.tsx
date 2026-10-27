import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./settings-page";

const signOutMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const sendPasswordResetEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const reauthenticateWithPopupMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const deleteAccountMock = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { deleted: true } }));
const authState = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }));

vi.mock("firebase/auth", () => ({
  EmailAuthProvider: { credential: vi.fn() },
  GoogleAuthProvider: class { setCustomParameters() { return this; } },
  reauthenticateWithCredential: vi.fn(),
  reauthenticateWithPopup: reauthenticateWithPopupMock,
  sendPasswordResetEmail: sendPasswordResetEmailMock,
  signOut: signOutMock,
}));
vi.mock("firebase/functions", () => ({ httpsCallable: () => deleteAccountMock }));
vi.mock("../lib/firebase", () => ({ getServices: () => ({ auth: { name: "test-auth" }, functions: { name: "test-functions" } }) }));
vi.mock("../lib/auth-context", () => ({ useAuth: () => ({ user: authState.user, loading: false, error: "" }) }));

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
  // jsdom modal diyaloğu desteklemediğinden yalnız açık/kapalı durumunu taklit eder.
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    signOutMock.mockResolvedValue(undefined);
    sendPasswordResetEmailMock.mockResolvedValue(undefined);
    reauthenticateWithPopupMock.mockResolvedValue(undefined);
    deleteAccountMock.mockResolvedValue({ data: { deleted: true } });
    authState.user = { uid: "test-user", email: "test@example.test" };
  });

  it("oturumdaki e-postaya şifre değiştirme bağlantısı ister", async () => {
    const user = userEvent.setup();
    renderSettings();

    expect(screen.getByText("E-posta ve parola")).toBeInTheDocument();
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

  it("yalnız Google kullanan hesapta parola bağlantısını gizler ve silmede Google ile doğrular", async () => {
    const getIdToken = vi.fn().mockResolvedValue("fresh-token");
    authState.user = { uid: "google-user", email: "google@example.test", providerData: [{ providerId: "google.com" }], getIdToken };
    const user = userEvent.setup();
    renderSettings();

    expect(screen.getByText("Google", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText(/Bu hesap Google ile giriş yapıyor/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "E-postaya bağlantı gönder" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hesabı sil" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Hesabınızı kalıcı olarak silin" });
    expect(within(dialog).queryByLabelText("Mevcut parola")).not.toBeInTheDocument();
    const submit = within(dialog).getByRole("button", { name: "Hesabı kalıcı olarak sil" });
    expect(submit).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/Onaylamak için/), "HESABIMI SİL");
    await user.click(submit);

    expect(reauthenticateWithPopupMock).toHaveBeenCalledWith(authState.user, expect.anything());
    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(deleteAccountMock).toHaveBeenCalledWith({ confirmation: "HESABIMI SİL" });
    expect(await screen.findByRole("heading", { name: "Ana sayfa" })).toBeInTheDocument();
  });

  it("Google doğrulama penceresi kapatılırsa hesabı silmez ve hata göstermez", async () => {
    authState.user = { uid: "google-user", email: "google@example.test", providerData: [{ providerId: "google.com" }], getIdToken: vi.fn() };
    reauthenticateWithPopupMock.mockRejectedValueOnce(Object.assign(new Error("closed"), { code: "auth/popup-closed-by-user" }));
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Hesabı sil" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Hesabınızı kalıcı olarak silin" });
    await user.type(within(dialog).getByLabelText(/Onaylamak için/), "HESABIMI SİL");
    await user.click(within(dialog).getByRole("button", { name: "Hesabı kalıcı olarak sil" }));

    expect(deleteAccountMock).not.toHaveBeenCalled();
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Hesabı kalıcı olarak sil" })).toBeEnabled();
  });
});
