import { useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { AuthContext, type AuthState } from "../lib/auth-context";
import { getServices } from "../lib/firebase";

// Auth SDK oturumunu izler; yapılandırma veya bağlantı hatasında korumalı içeriği açmaz.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: "" });
  useEffect(() => {
    try {
      return onAuthStateChanged(getServices().auth,
        user => setState({ user, loading: false, error: "" }),
        () => setState({ user: null, loading: false, error: "Oturum doğrulanamadı." }));
    } catch (error) {
      // Effect başlangıcındaki dış servis sonucu React dışından teslim edilir.
      queueMicrotask(() => setState({ user: null, loading: false, error: error instanceof Error ? error.message : "Yapılandırma hatası." }));
    }
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
