import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectionStatus } from "./connection-status";
import { setLocale, t, type Locale } from "../i18n/runtime";

afterEach(() => { vi.restoreAllMocks(); act(() => setLocale("tr")); });

describe("Bağlantı durumu", () => {
  it.each<Locale>(["tr", "en", "de", "es", "zh", "ar"])("%s: yalnız çevrimdışında görünür; dil ve yeniden bağlantı olayları doğru görünümü günceller", locale => {
    let online = true;
    vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
    render(<ConnectionStatus />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => { online = false; window.dispatchEvent(new Event("offline")); setLocale(locale); });
    expect(screen.getByRole("status")).toHaveTextContent(t("Çevrimdışı görünüyorsunuz"));
    expect(screen.getByRole("status")).toHaveTextContent(t("Bağlantınızı kontrol edin. Bu sekmedeki taslağınız korunur; yerel dosyalarınızı kaybetmemek için sayfayı yenilemeyin."));
    act(() => { online = true; window.dispatchEvent(new Event("online")); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
