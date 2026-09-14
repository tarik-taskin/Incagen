import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthContext } from "../lib/auth-context";
import { RequireAuth } from "./require-auth";

// Landing hedefini ve taşınan kimlik modalı durumunu test görünümünde gösterir.
function LandingState() {
  const location = useLocation();
  return <h1>{location.state?.authOpen && location.state?.from === "/app/new-analysis" ? "Landing modalı" : "Landing"}</h1>;
}

// Gerçek servis açmadan anonim/yükleniyor durumunda korumalı verinin render edilmediğini denetler.
function renderGate(loading: boolean, logoutPending = false) {
  render(<AuthContext.Provider value={{ user: null, loading, error: "" }}><MemoryRouter initialEntries={[{ pathname: "/app/new-analysis", state: logoutPending ? { logoutPending: true } : null }]}><Routes><Route path="/" element={<LandingState />} /><Route element={<RequireAuth />}><Route path="/app/new-analysis" element={<p>Özel rapor</p>} /></Route></Routes></MemoryRouter></AuthContext.Provider>);
}
describe("Oturum kapısı", () => {
  it("anonim kullanıcıyı landing üzerindeki giriş modalına yönlendirir", () => {
    renderGate(false);
    expect(screen.getByRole("heading", { name: "Landing modalı" })).toBeInTheDocument();
    expect(screen.queryByText("Özel rapor")).not.toBeInTheDocument();
  });
  it("oturum yüklenirken özel içeriği göstermez", () => {
    renderGate(true);
    expect(screen.getByRole("status")).toHaveTextContent("Oturum kontrol ediliyor");
    expect(screen.queryByText("Özel rapor")).not.toBeInTheDocument();
  });
  it("çıkış yönlendirmesinde landing modalını açmaz", () => {
    renderGate(false, true);
    expect(screen.getByRole("heading", { name: "Landing" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Landing modalı" })).not.toBeInTheDocument();
  });
});
