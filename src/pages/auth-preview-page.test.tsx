import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../components/theme-provider";
import { AuthPreviewPage } from "./auth-preview-page";

const signOutMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const sendPasswordResetEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("firebase/auth", () => ({ signOut: signOutMock, sendPasswordResetEmail: sendPasswordResetEmailMock }));
vi.mock("../lib/firebase", () => ({ getServices: () => ({ auth: { name: "preview-auth" } }) }));
vi.mock("../lib/auth-context", () => ({
  useAuth: () => ({ user: { uid: "test-user", email: "test@example.test" }, loading: false, error: "" }),
}));

// Auth önizlemesini gerçek rota ve tema sağlayıcılarıyla açar.
function renderPreview() {
  return render(
    <MemoryRouter initialEntries={["/app"]}>
      <ThemeProvider>
        <Routes>
          <Route path="/" element={<h1>Ana sayfa</h1>} />
          <Route path="/app" element={<AuthPreviewPage />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("Auth önizlemesi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOutMock.mockResolvedValue(undefined);
    sendPasswordResetEmailMock.mockResolvedValue(undefined);
  });

  it("yalnız çalışan hesap eylemlerini gösterir ve şifre bağlantısı yollar", async () => {
    const user = userEvent.setup();
    renderPreview();

    expect(screen.getByText("test@example.test")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hesabı sil" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Yeni analiz" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Şifre bağlantısı gönder" }));
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith({ name: "preview-auth" }, "test@example.test");
    expect(await screen.findByRole("status")).toHaveTextContent("Şifre yenileme bağlantısı");
  });

  it("çıkıştan sonra ana sayfaya döner", async () => {
    const user = userEvent.setup();
    renderPreview();

    await user.click(screen.getByRole("button", { name: "Çıkış yap" }));
    expect(signOutMock).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: "Ana sayfa" })).toBeInTheDocument();
  });
});
