import { useLocale } from "../i18n/runtime";
import { PageLoading } from "./page-loading";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { tr } from "../i18n/tr";
import { WorkspaceProvider } from "./workspace-provider";

// Oturum yüklenirken özel içeriği gizler; anonim kullanıcıyı landing üzerindeki kimlik modalına taşır.
export function RequireAuth() {
  useLocale();
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoading fullPage kind="workspace" label={tr.auth.loading} />;
  if (user) return <WorkspaceProvider key={user.uid}><Outlet /></WorkspaceProvider>;
  return <Navigate to="/" state={location.state?.logoutPending ? null : { authOpen: true, from: location.pathname }} replace />;
}
