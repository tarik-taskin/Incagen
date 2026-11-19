import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisDeleteDialog } from "./analysis-delete-dialog";
import { WorkspaceDeletionProvider } from "./workspace-deletion-provider";
import { WorkspaceDeletionStatus } from "./workspace-deletion-status";
import { setLocale } from "../i18n/runtime";

function wrap(children: ReactNode) {
  return (
    <MemoryRouter>
      <WorkspaceDeletionProvider uid="user-1">{children}</WorkspaceDeletionProvider>
    </MemoryRouter>
  );
}

const state = vi.hoisted(() => ({
  call: vi.fn(),
}));

vi.mock("../lib/firebase", () => ({
  getServices: () => ({ functions: {}, auth: { currentUser: { uid: "user-1" } } }),
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: () => state.call,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("AnalysisDeleteDialog", () => {
  beforeEach(() => {
    state.call.mockReset();
    setLocale("tr");
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  });

  afterEach(() => {
    setLocale("tr");
    vi.restoreAllMocks();
  });

  it("onay beklerken Vazgeç, Escape ve dış tıklama ile kapatır ve istek başlatmaz", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(wrap(
      <AnalysisDeleteDialog
        idPrefix="test-del"
        items={[{ id: "a1", title: "Birinci analiz" }]}
        description="Bu işlem geri alınamaz."
        onClose={onClose}
        onSuccess={vi.fn()}
      />,
    ));

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Vazgeç" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Vazgeç" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(state.call).not.toHaveBeenCalled();
  });

  it("Vazgeç, Escape ve dış tıklama sonrasında odağı açıcıya, açıcı yoksa yedek hedefe geri verir", async () => {
    const user = userEvent.setup();
    const fallbackHeading = document.createElement("h1");
    fallbackHeading.tabIndex = -1;
    fallbackHeading.textContent = "Sayfa Başlığı";
    document.body.appendChild(fallbackHeading);

    const opener = document.createElement("button");
    opener.type = "button";
    opener.textContent = "Silmeyi aç";
    document.body.appendChild(opener);

    try {
      const renderDialog = (props: { open: boolean; targetOpener: HTMLElement | null; onClose: () => void }) => (
        <WorkspaceDeletionProvider uid="user-1">
          <AnalysisDeleteDialog
            idPrefix="focus-restore"
            items={props.open ? [{ id: "a1", title: "Birinci" }] : null}
            description="Bu işlem geri alınamaz."
            openerElement={props.targetOpener}
            fallbackFocus={() => fallbackHeading}
            onClose={props.onClose}
            onSuccess={vi.fn()}
          />
        </WorkspaceDeletionProvider>
      );

      // 1. Vazgeç -> odağı açıcıya döndürür.
      opener.focus();
      let closed = false;
      const view = render(<MemoryRouter>{renderDialog({ open: true, targetOpener: opener, onClose: () => { closed = true; } })}</MemoryRouter>);
      await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Vazgeç" }));
      expect(closed).toBe(true);
      view.rerender(<MemoryRouter>{renderDialog({ open: false, targetOpener: opener, onClose: vi.fn() })}</MemoryRouter>);
      expect(opener).toHaveFocus();

      // 2. Escape -> odağı açıcıya döndürür.
      opener.focus();
      view.rerender(<MemoryRouter>{renderDialog({ open: true, targetOpener: opener, onClose: vi.fn() })}</MemoryRouter>);
      fireEvent(screen.getByRole("alertdialog"), new Event("cancel", { cancelable: true }));
      view.rerender(<MemoryRouter>{renderDialog({ open: false, targetOpener: opener, onClose: vi.fn() })}</MemoryRouter>);
      expect(opener).toHaveFocus();

      // 3. Dış tıklama -> açıcı bağlı değilse anlamlı yedek hedefe odaklanır.
      opener.focus();
      view.rerender(<MemoryRouter>{renderDialog({ open: true, targetOpener: opener, onClose: vi.fn() })}</MemoryRouter>);
      opener.remove();
      fireEvent.pointerDown(document.body, { isPrimary: true, button: 0 });
      fireEvent.pointerUp(document.body, { isPrimary: true, button: 0 });
      fireEvent.click(document.body);
      view.rerender(<MemoryRouter>{renderDialog({ open: false, targetOpener: opener, onClose: vi.fn() })}</MemoryRouter>);
      expect(fallbackHeading).toHaveFocus();
      view.unmount();
    } finally {
      opener.remove();
      fallbackHeading.remove();
    }
  });

  it("silme sürerken açık kalır, tekli ve çoklu ilerlemeyi düğmede gösterir ve çift tıklamayı engeller", async () => {
    const user = userEvent.setup();
    const p1 = deferred<{ data: { deleted: boolean } }>();
    const p2 = deferred<{ data: { deleted: boolean } }>();
    const p3 = deferred<{ data: { deleted: boolean } }>();
    state.call
      .mockReturnValueOnce(p1.promise)
      .mockReturnValueOnce(p2.promise)
      .mockReturnValueOnce(p3.promise);

    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(wrap(
      <>
        <WorkspaceDeletionStatus />
        <AnalysisDeleteDialog
          idPrefix="bulk-del"
          items={[
            { id: "a1", title: "Birinci" },
            { id: "a2", title: "İkinci" },
            { id: "a3", title: "Üçüncü" },
          ]}
          description="Bu işlem geri alınamaz."
          onClose={onClose}
          onSuccess={onSuccess}
        />
      </>,
    ));

    const dialog = screen.getByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "3 analizi sil" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(state.call).toHaveBeenCalledTimes(1);
    expect(state.call).toHaveBeenNthCalledWith(1, { id: "a1" });

    // Onay düğmesinde 1/3 ilerleme ve motion-reduce güvenli spinner görünür; düğmeler devre dışıdır.
    expect(dialog).toBeVisible();
    const progressButton = within(dialog).getByRole("button", { name: "Siliniyor… 1/3" });
    expect(progressButton).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Vazgeç" })).toBeDisabled();
    expect(progressButton.querySelector("svg")).toHaveClass("motion-reduce:animate-none");
    expect(within(dialog).getByRole("status")).toHaveTextContent("Siliniyor: 1/3");
    // Arka plan çalışma alanı durumunda gezinebilirsiniz banner'ı çıkmaz.
    expect(screen.queryByText(/çalışma alanında gezinebilirsiniz/)).not.toBeInTheDocument();

    // İşlem sürerken Escape ve dış tıklama pencereyi kapatmaz.
    const cancelEvent = new Event("cancel", { cancelable: true });
    fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    await user.pointer([{ keys: "[MouseLeft>]", target: document.body }, { keys: "[/MouseLeft]", target: document.body }]);
    await user.click(document.body);
    expect(onClose).not.toHaveBeenCalled();

    // 1. kayıt bitince 2/3, 2. kayıt bitince 3/3 gösterilir.
    await act(async () => { p1.resolve({ data: { deleted: true } }); });
    expect(within(dialog).getByRole("button", { name: "Siliniyor… 2/3" })).toBeVisible();
    expect(within(dialog).getByRole("status")).toHaveTextContent("Siliniyor: 2/3");

    await act(async () => { p2.resolve({ data: { deleted: true } }); });
    expect(within(dialog).getByRole("button", { name: "Siliniyor… 3/3" })).toBeVisible();
    expect(within(dialog).getByRole("status")).toHaveTextContent("Siliniyor: 3/3");

    await act(async () => { p3.resolve({ data: { deleted: true } }); });
    expect(onSuccess).toHaveBeenCalledWith({ deleted: 3, failed: [] });
    expect(screen.getByRole("status")).toHaveTextContent("3 analiz ve kaynak belgeleri silindi.");
  });

  it("kısmi hatada pencereyi açık tutar ve yeniden denemede yalnız başarısız kaydı gönderir", async () => {
    const user = userEvent.setup();
    state.call
      .mockResolvedValueOnce({ data: { deleted: true } })
      .mockRejectedValueOnce({ code: "functions/unavailable" })
      .mockResolvedValueOnce({ data: { deleted: true } });

    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    render(wrap(
      <AnalysisDeleteDialog
        idPrefix="partial-del"
        items={[
          { id: "a1", title: "Birinci" },
          { id: "a2", title: "Bozuk Kayıt" },
          { id: "a3", title: "Üçüncü" },
        ]}
        description="Bu işlem geri alınamaz."
        onClose={vi.fn()}
        onSuccess={onSuccess}
        onFailure={onFailure}
      />,
    ));

    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "3 analizi sil" }));

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith({
      deleted: 2,
      failed: [{ id: "a2", title: "Bozuk Kayıt", reason: "Servisle bağlantı kurulamadı. Lütfen yeniden deneyin." }],
    });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "1 analiz silinemedi." })).toBeVisible();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Bozuk Kayıt");
    const retryButton = within(dialog).getByRole("button", { name: "Yeniden dene" });
    expect(retryButton).toHaveFocus();

    state.call.mockClear();
    const retryReq = deferred<{ data: { deleted: boolean } }>();
    state.call.mockReturnValueOnce(retryReq.promise);
    await user.click(retryButton);

    expect(state.call).toHaveBeenCalledTimes(1);
    expect(state.call).toHaveBeenCalledWith({ id: "a2" });
    expect(within(dialog).getByRole("button", { name: "Siliniyor…" })).toBeDisabled();

    await act(async () => { retryReq.resolve({ data: { deleted: true } }); });
    expect(onSuccess).toHaveBeenCalledWith({ deleted: 1, failed: [] });
  });

  it("altı dil ve Arapça RTL yerleşimde silme ve hata etiketlerini doğru gösterir", () => {
    for (const [locale, expected] of [
      ["tr", "2 analizi sil"],
      ["en", "Delete 2 analyses"],
      ["de", "2 Analysen löschen"],
      ["es", "Eliminar 2 análisis"],
      ["zh", "删除 2 项分析"],
      ["ar", "حذف ٢ من التحليلات"],
    ] as const) {
      setLocale(locale);
      const { unmount } = render(wrap(
        <AnalysisDeleteDialog
          idPrefix={`loc-${locale}`}
          items={[
            { id: "a1", title: "Kayıt 1" },
            { id: "a2", title: "Kayıt 2" },
          ]}
          description="Bu işlem geri alınamaz. Seçilen analizler, yüklenen kaynak belgeler ve hazırlanmış içerikler birlikte silinir."
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
      ));
      expect(document.documentElement.dir).toBe(locale === "ar" ? "rtl" : "ltr");
      expect(screen.getByRole("button", { name: expected })).toBeEnabled();
      unmount();
    }
  });
});
