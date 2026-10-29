import { useLocale } from "./i18n/runtime";
import { PageLoading } from "./components/page-loading";
import { Navigate, Route, Routes } from "react-router-dom";
import { LandingPage } from "./pages/landing-page";
import { lazy, Suspense, type ReactNode } from "react";
import { RouteViewport } from "./components/route-viewport";

const RequireAuth = lazy(() => import("./components/require-auth").then(module => ({ default: module.RequireAuth })));
const AppShell = lazy(() => import("./components/layout/app-shell").then(module => ({ default: module.AppShell })));
const NewAnalysisPage = lazy(() => import("./pages/new-analysis-page").then(module => ({ default: module.NewAnalysisPage })));
const HistoryPage = lazy(() => import("./pages/history-page").then(module => ({ default: module.HistoryPage })));
const SettingsPage = lazy(() => import("./pages/settings-page").then(module => ({ default: module.SettingsPage })));
const PlanPage = lazy(() => import("./pages/plan-page").then(module => ({ default: module.PlanPage })));
const AnalysisPage = lazy(() => import("./pages/analysis-page").then(module => ({ default: module.AnalysisPage })));

const FeedbackReportPage = lazy(() => import("./pages/feedback-report-page").then(module => ({ default: module.FeedbackReportPage })));

const ExampleReportPage = lazy(() => import("./pages/example-report-page").then(module => ({ default: module.ExampleReportPage })));

// Sayfa kodu beklenirken yalnız içerik alanını değiştirir; çalışma alanı taslağı ve yükleme sağlayıcısı yaşamaya devam eder.
function WorkspaceScreen({ children, history = false }: { children: ReactNode; history?: boolean }) {
  return <Suspense fallback={<PageLoading kind={history ? "history" : "workspace"} label={history ? "Analiz geçmişi yükleniyor…" : "Analiz araçları yükleniyor…"} />}>{children}</Suspense>;
}

// Genel landing rotasını ve uygulama çalışma alanının iç içe sayfalarını tanımlar.
function App() {
  useLocale();
  return (
    <><RouteViewport /><Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/ornek-rapor" element={<Suspense fallback={<PageLoading fullPage label="Örnek rapor yükleniyor…" />}><ExampleReportPage /></Suspense>} />
      <Route path="/ornek-rapor/musteri-deneyimi" element={<Suspense fallback={<PageLoading fullPage label="Örnek rapor yükleniyor…" />}><FeedbackReportPage /></Suspense>} />
      <Route element={<Suspense fallback={<PageLoading fullPage kind="workspace" label="İşletme alanı hazırlanıyor…" />}><RequireAuth /></Suspense>}>
      <Route path="/app" element={<Suspense fallback={<PageLoading fullPage kind="workspace" label="İşletme alanı hazırlanıyor…" />}><AppShell /></Suspense>}>
        <Route index element={<Navigate to="new-analysis" replace />} />
        <Route path="new-analysis" element={<WorkspaceScreen><NewAnalysisPage /></WorkspaceScreen>} />
        <Route path="history" element={<WorkspaceScreen history><HistoryPage /></WorkspaceScreen>} />
        <Route path="analyses/:id" element={<Suspense fallback={<PageLoading label="Rapor yükleniyor…" />}><AnalysisPage /></Suspense>} />
        <Route path="settings" element={<WorkspaceScreen><SettingsPage /></WorkspaceScreen>} />
        <Route path="plan" element={<WorkspaceScreen><PlanPage /></WorkspaceScreen>} />
      </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></>
  );
}

export default App;
