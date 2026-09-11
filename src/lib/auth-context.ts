import { createContext, useContext } from "react";
import type { User } from "firebase/auth";
export interface AuthState { user: User | null; loading: boolean; error: string; }
export const AuthContext = createContext<AuthState>({ user: null, loading: true, error: "" });
// Oturum bilgisini paylaşır; rota yetkilendirmesi aynı doğrulanmış durumu kullanır.
export function useAuth() { return useContext(AuthContext); }
