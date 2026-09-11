import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/app-shell";
import { HistoryPage } from "./pages/history-page";
import { LandingPage } from "./pages/landing-page";
import { NewAnalysisPage } from "./pages/new-analysis-page";
import { SettingsPage } from "./pages/settings-page";
import { AuthPage } from "./pages/auth-page";
import { RequireAuth } from "./components/require-auth";

// Genel landing rotasını ve uygulama çalışma alanının iç içe sayfalarını tanımlar.
function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route element={<RequireAuth />}>
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Navigate to="new-analysis" replace />} />
        <Route path="new-analysis" element={<NewAnalysisPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
