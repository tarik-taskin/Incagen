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
});
