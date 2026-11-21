import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SupportDialog } from "./support-dialog";
import { languages, setLocale, t } from "../i18n/runtime";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

afterEach(() => {
  setLocale("tr");
});

describe("SupportDialog", () => {
  it("altı dilde belge türü yardım yanıtında TSV biçimini de desteklenen tablo kapsamıyla açıklar", async () => {
    const user = userEvent.setup();
    for (const { code } of languages) {
      setLocale(code);
      const { unmount } = render(
        <MemoryRouter>
          <SupportDialog open onClose={() => {}} />
        </MemoryRouter>,
      );
      const question = screen.getByText(t("Hangi belge türlerini birlikte kullanabilirim?"));
      await user.click(question);
      const details = question.closest("details");
      expect(details).toHaveAttribute("open");
      expect(details?.textContent).toMatch(/TSV/);
      expect(details?.textContent).toMatch(/CSV/);
      unmount();
    }
  });
});
