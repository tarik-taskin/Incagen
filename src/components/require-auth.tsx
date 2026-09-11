import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { tr } from "../i18n/tr";
import { WorkspaceProvider } from "./workspace-provider";

// Oturum yüklenirken veri ekranını göstermeden giriş sayfasına güvenli dönüş adresi sağlar.
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status" className="p-8">{tr.auth.loading}</p>;
  return user ? <WorkspaceProvider key={user.uid}><Outlet /></WorkspaceProvider> : <Navigate to="/login" state={{ from: location.pathname }} replace />;
}
