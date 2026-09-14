import { Navigate, useLocation } from "react-router-dom";
import { AuthCard } from "../components/auth-card";
import { useAuth } from "../lib/auth-context";

// Doğrudan korumalı rotaya gelen kullanıcıya güvenli dönüş adresiyle tam sayfa kimlik formu sunar.
export function AuthPage() {
  const { user } = useAuth();
  const location = useLocation();
  const requested = location.state?.from;
  const destination = typeof requested === "string" && requested.startsWith("/app/") ? requested : "/app/new-analysis";

  if (user) return <Navigate to={destination} replace />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5 text-foreground">
      <div className="w-full max-w-md">
        <AuthCard />
      </div>
    </main>
  );
}
