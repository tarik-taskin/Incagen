import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ShareLinkButton } from "./share-link-button";

describe("ShareLinkButton", () => {
  let writeTextMock: ReturnType<typeof vi.fn>;
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.useFakeTimers();
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  it("bağlantıyı panoya kopyalar ve erişilebilir başarı durumu gösterir", async () => {
    render(<ShareLinkButton activeSection="finansal-detay" />);

    const button = screen.getByRole("button", { name: "Bağlantıyı kopyala" });
    expect(button).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const copiedUrl = writeTextMock.mock.calls[0][0];
    expect(copiedUrl).toContain("#finansal-detay");

    // Başarı durumu ve role="status"
    expect(screen.getByRole("status")).toHaveTextContent("Bağlantı kopyalandı");

    // 2 saniye sonra eski haline dönmeli
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole("button", { name: "Bağlantıyı kopyala" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("genel bakış aktifken gereksiz hash eklemez", async () => {
    render(<ShareLinkButton activeSection="genel-bakis" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Bağlantıyı kopyala" }));
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const copiedUrl = writeTextMock.mock.calls[0][0];
    expect(copiedUrl).not.toContain("#genel-bakis");
  });

  it("clipboard desteklenmediğinde prompt fallback kullanır", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const promptMock = vi.spyOn(window, "prompt").mockImplementation(() => null);

    render(<ShareLinkButton />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Bağlantıyı kopyala" }));
    });

    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(promptMock.mock.calls[0][0]).toBe("Bağlantıyı kopyalayın:");
  });

  it("bekleyen kopyalamayı tekilleştirir ve unmount sonrası reddi fallback'e taşımaz", async () => {
    let reject!: (reason: Error) => void;
    const write = vi.fn(() => new Promise<void>((_, no) => { reject = no; }));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: write } });
    const prompt = vi.spyOn(window, "prompt").mockImplementation(() => null);
    const { unmount } = render(<ShareLinkButton />);
    const button = screen.getByRole("button", { name: "Bağlantıyı kopyala" });
    fireEvent.click(button); fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(write).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => reject(new Error("denied")));
    expect(prompt).not.toHaveBeenCalled();
  });

  it("adres değiştiğinde eski isteğin başarı veya fallback durumunu göstermez", async () => {
    let reject!: (reason: Error) => void;
    const before = window.location.href;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => new Promise<void>((_, no) => { reject = no; }) } });
    const prompt = vi.spyOn(window, "prompt").mockImplementation(() => null);
    render(<ShareLinkButton />);
    fireEvent.click(screen.getByRole("button"));
    window.history.replaceState(null, "", "?period=new");
    try {
      await act(async () => reject(new Error("denied")));
      expect(prompt).not.toHaveBeenCalled();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByRole("button")).toBeEnabled();
    } finally { window.history.replaceState(null, "", before); }
  });

  it("fallback hata verse bile geçici alanı kaldırır ve klavye odağını geri verir", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    const original = document.execCommand;
    document.execCommand = vi.fn(() => { throw new Error("denied"); });
    const prompt = vi.spyOn(window, "prompt").mockImplementation(() => null);
    const { container } = render(<ShareLinkButton />);
    const button = screen.getByRole("button"); button.focus();
    try {
      await act(async () => fireEvent.click(button));
      expect(document.querySelector("textarea")).toBeNull();
      expect(button).toHaveFocus();
      expect(prompt).toHaveBeenCalledOnce();
      expect(container.querySelector('[role="status"]')).toBeNull();
    } finally { document.execCommand = original; }
  });

  it("başarılı kopyalamanın zamanlayıcısını unmount sırasında temizler", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const { unmount } = render(<ShareLinkButton />);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

});
