import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./settings-page";

const signOutMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("firebase/auth", () => ({ signOut: signOutMock }));
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
  it("başarılı çıkıştan sonra ana sayfaya döner", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Çıkış yap" }));

    expect(signOutMock).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: "Ana sayfa" })).toBeInTheDocument();
  });
});
