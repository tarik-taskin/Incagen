import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { tr } from "../i18n/tr";
import { WorkspaceProvider } from "./workspace-provider";

// Oturum yüklenirken özel içeriği gizler; anonim kullanıcıyı landing üzerindeki kimlik modalına taşır.
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status" className="p-8">{tr.auth.loading}</p>;
  if (user) return <WorkspaceProvider key={user.uid}><Outlet /></WorkspaceProvider>;
  return <Navigate to="/" state={location.state?.logoutPending ? null : { authOpen: true, from: location.pathname }} replace />;
}
