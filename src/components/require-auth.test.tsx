import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthContext } from "../lib/auth-context";
import { RequireAuth } from "./require-auth";

// Gerçek servis açmadan anonim/yükleniyor durumunda korumalı verinin render edilmediğini denetler.
function renderGate(loading: boolean) {
  render(<AuthContext.Provider value={{ user: null, loading, error: "" }}><MemoryRouter initialEntries={["/app/new-analysis"]}><Routes><Route path="/login" element={<h1>Giriş ekranı</h1>} /><Route element={<RequireAuth />}><Route path="/app/new-analysis" element={<p>Özel rapor</p>} /></Route></Routes></MemoryRouter></AuthContext.Provider>);
}
describe("Oturum kapısı", () => {
  it("anonim kullanıcıyı girişe yönlendirir", () => {
    renderGate(false);
    expect(screen.getByRole("heading", { name: "Giriş ekranı" })).toBeInTheDocument();
    expect(screen.queryByText("Özel rapor")).not.toBeInTheDocument();
  });
  it("oturum yüklenirken özel içeriği göstermez", () => {
    renderGate(true);
    expect(screen.getByRole("status")).toHaveTextContent("Oturum kontrol ediliyor");
    expect(screen.queryByText("Özel rapor")).not.toBeInTheDocument();
  });
});
