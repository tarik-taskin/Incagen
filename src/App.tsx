import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/app-shell";
import { HistoryPage } from "./pages/history-page";
import { LandingPage } from "./pages/landing-page";
import { NewAnalysisPage } from "./pages/new-analysis-page";
import { PlanPage } from "./pages/plan-page";
import { SettingsPage } from "./pages/settings-page";
import { RequireAuth } from "./components/require-auth";
import { lazy, Suspense } from "react";
const AnalysisPage = lazy(() => import("./pages/analysis-page").then(module => ({ default: module.AnalysisPage })));

// Genel landing rotasını ve uygulama çalışma alanının iç içe sayfalarını tanımlar.
function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<RequireAuth />}>
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Navigate to="new-analysis" replace />} />
        <Route path="new-analysis" element={<NewAnalysisPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="analyses/:id" element={<Suspense fallback={<p role="status">Rapor yükleniyor…</p>}><AnalysisPage /></Suspense>} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="plan" element={<PlanPage />} />
      </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
