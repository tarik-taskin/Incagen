import { t, useLocale } from "./i18n/runtime";
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

const FeedbackReportPage = lazy(() => import("./pages/feedback-report-page").then(module => ({ default: module.FeedbackReportPage })));

const ExampleReportPage = lazy(() => import("./pages/example-report-page").then(module => ({ default: module.ExampleReportPage })));

// Genel landing rotasını ve uygulama çalışma alanının iç içe sayfalarını tanımlar.
function App() {
  useLocale();
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/ornek-rapor" element={<Suspense fallback={<p role="status" className="p-8">{t("Örnek rapor yükleniyor…")}</p>}><ExampleReportPage /></Suspense>} />
      <Route path="/ornek-rapor/musteri-deneyimi" element={<Suspense fallback={<p role="status" className="p-8">{t("Örnek rapor yükleniyor…")}</p>}><FeedbackReportPage /></Suspense>} />
      <Route element={<RequireAuth />}>
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Navigate to="new-analysis" replace />} />
        <Route path="new-analysis" element={<NewAnalysisPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="analyses/:id" element={<Suspense fallback={<p role="status">{t("Rapor yükleniyor…")}</p>}><AnalysisPage /></Suspense>} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="plan" element={<PlanPage />} />
      </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
