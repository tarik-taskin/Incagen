import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { ThemeProvider } from "./components/theme-provider";
const authState = vi.hoisted(() => ({
  current: { user: { uid: "test-user", email: "test@example.test" } as { uid: string; email: string } | null, loading: false, error: "" },
}));
vi.mock("./lib/auth-context", () => ({ useAuth: () => authState.current }));
vi.mock("./hooks/use-analyses", () => ({ useAnalyses: () => ({ rows: [], loading: false, error: "" }) }));

// Uygulamayı istenen başlangıç adresinde gerçek tema ve router sağlayıcılarıyla oluşturur.
function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("App routes", () => {
  beforeEach(() => {
    authState.current = { user: { uid: "test-user", email: "test@example.test" }, loading: false, error: "" };
  });

  it("oturumsuz analiz çağrısında landing üzerinde giriş modalını açar ve kapatır", async () => {
    const user = userEvent.setup();
    authState.current = { user: null, loading: false, error: "" };
    renderApp("/");

    await user.click(screen.getByRole("button", { name: /Analize başla/ }));
    expect(screen.getByRole("dialog", { name: "Giriş yap" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Giriş penceresini kapat" }));
    expect(screen.queryByRole("dialog", { name: "Giriş yap" })).not.toBeInTheDocument();
  });

  it("eski login adresini ayrı ekran açmadan landing sayfasına döndürür", async () => {
    authState.current = { user: null, loading: false, error: "" };
    renderApp("/login");

    expect(await screen.findByRole("heading", { name: "Verilerinizdeki büyüme fırsatlarını keşfedin." })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("oturumsuz korumalı adresi landing üzerindeki giriş modalına taşır", async () => {
    authState.current = { user: null, loading: false, error: "" };
    renderApp("/app/new-analysis");

    expect(await screen.findByRole("heading", { name: "Verilerinizdeki büyüme fırsatlarını keşfedin." })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Giriş yap" })).toBeInTheDocument();
  });

  it("iç sayfalar arasında dosya seçimini korur", async () => {
    const user = userEvent.setup();
    renderApp("/app/new-analysis");
    await user.upload(screen.getByLabelText("Analiz edilecek dosyaları seç"), new File(["test"], "rapor.pdf", { type: "application/pdf" }));
    const nav = within(screen.getByRole("navigation", { name: "Ana navigasyon" }));
    await user.click(nav.getByRole("link", { name: "Geçmiş" }));
    await user.click(nav.getByRole("link", { name: "Yeni analiz" }));
    expect(screen.getByText("rapor.pdf")).toBeInTheDocument();
  });
  it("uygulama kökünü yeni analiz ekranına yönlendirir", async () => {
    renderApp("/app");

    expect(await screen.findByRole("heading", { name: "Belgelerinizi analize hazırlayın" })).toBeInTheDocument();
  });

  it("uygulama kabuğu içinde geçmişten ayarlara ve plan karşılaştırmasına geçer", async () => {
    const user = userEvent.setup();
    renderApp("/app/history");

    expect(screen.getByRole("heading", { name: "Geçmiş analizleriniz" })).toBeInTheDocument();
    const desktopNavigation = screen.getByRole("navigation", { name: "Ana navigasyon" });
    await user.click(within(desktopNavigation).getByRole("link", { name: "Ayarlar" }));
    expect(screen.getByRole("heading", { name: "Çalışma alanı ayarları" })).toBeInTheDocument();
    await user.click(within(desktopNavigation).getByRole("link", { name: "Plan" }));
    expect(screen.getByRole("heading", { name: "Planınızı ve sınırlarınızı görün" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Free" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Premium" })).toBeInTheDocument();
    expect(screen.queryByText("AI analiz katmanı")).not.toBeInTheDocument();
    expect(screen.queryByText("Harici veri bağlantıları")).not.toBeInTheDocument();
  });

  it("Premium geçiş çağrısında kısa üyelik bilgisini gösterir", async () => {
    const user = userEvent.setup();
    renderApp("/app/new-analysis");

    await user.click(screen.getByRole("button", { name: "Premium’a geç" }));
    const premiumNotice = screen.getByRole("region", { name: "Premium ile daha geniş alan" });
    expect(premiumNotice).not.toHaveTextContent("PayTR");
    expect(premiumNotice).toHaveTextContent("toplam 50 MB");
    expect(within(premiumNotice).getByRole("link", { name: "Planları karşılaştır" })).toBeInTheDocument();

    await user.click(screen.getByRole("heading", { name: "Belgelerinizi analize hazırlayın" }));
    expect(screen.queryByRole("region", { name: "Premium ile daha geniş alan" })).not.toBeInTheDocument();
  });
  it("bilinmeyen adresleri güvenli biçimde landing sayfasına döndürür", async () => {
    renderApp("/bilinmeyen-rota");

    expect(await screen.findByRole("heading", { name: "Verilerinizdeki büyüme fırsatlarını keşfedin." })).toBeInTheDocument();
  });
});
