import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { HistoryPage } from "./history-page";

vi.mock("../lib/deployment-mode", () => ({ authOnlyPreview: true }));
vi.mock("../hooks/use-analyses", () => ({
  useAnalyses: () => ({ rows: [], loading: false, error: "Geçmiş okunamıyor." }),
}));

it("canlı Auth boş geçmiş kartı kullanıcıyı yeni analiz ekranına götürür", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/app/history"]}>
    <Routes>
      <Route path="/app/history" element={<HistoryPage />} />
      <Route path="/app/new-analysis" element={<h1>Yeni analiz alanı</h1>} />
    </Routes>
  </MemoryRouter>);

  expect(screen.getByRole("heading", { name: "Henüz analiz yok." })).toBeInTheDocument();
  expect(screen.queryByText(/önizleme|henüz etkin değil/i)).not.toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "Analize başla" }));
  expect(screen.getByRole("heading", { name: "Yeni analiz alanı" })).toBeInTheDocument();
});
