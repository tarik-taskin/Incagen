import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "./App";
import { ThemeProvider } from "./components/theme-provider";

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
  it("uygulama kökünü yeni analiz ekranına yönlendirir", async () => {
    renderApp("/app");

    expect(await screen.findByRole("heading", { name: "Verilerinizi analize hazırlayın" })).toBeInTheDocument();
  });

  it("uygulama kabuğu içinde geçmişten ayarlara geçer", async () => {
    const user = userEvent.setup();
    renderApp("/app/history");

    expect(screen.getByRole("heading", { name: "Geçmiş analizleriniz" })).toBeInTheDocument();
    const desktopNavigation = screen.getByRole("navigation", { name: "Ana navigasyon" });
    await user.click(within(desktopNavigation).getByRole("link", { name: "Ayarlar" }));
    expect(screen.getByRole("heading", { name: "Çalışma alanı ayarları" })).toBeInTheDocument();
  });

  it("Premium geçiş çağrısında kısa üyelik bilgisini gösterir", async () => {
    const user = userEvent.setup();
    renderApp("/app/new-analysis");

    await user.click(screen.getByRole("button", { name: "Premium’a geç" }));
    const premiumNotice = screen.getByRole("region", { name: "Premium üyelik yakında" });
    expect(premiumNotice).toHaveTextContent("PayTR");

    await user.click(screen.getByRole("heading", { name: "Verilerinizi analize hazırlayın" }));
    expect(screen.queryByRole("region", { name: "Premium üyelik yakında" })).not.toBeInTheDocument();
  });
  it("bilinmeyen adresleri güvenli biçimde landing sayfasına döndürür", async () => {
    renderApp("/bilinmeyen-rota");

    expect(await screen.findByRole("heading", { name: "Verilerinizdeki büyüme fırsatlarını keşfedin." })).toBeInTheDocument();
  });
});
