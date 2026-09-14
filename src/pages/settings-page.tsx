import { useState } from "react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useAuth } from "../lib/auth-context";
import { getServices } from "../lib/firebase";
import { userError } from "../lib/errors";
import { tr } from "../i18n/tr";

// Oturum bilgisini ve çıkışı sunar; çıkış provider'ı kaldırarak bellekteki taslağı temizler.
export function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  // Firebase oturumunu kapattıktan sonra kullanıcıyı modal açmadan landing sayfasına taşır.
  async function logout() {
    try {
      await signOut(getServices().auth);
      navigate("/", { replace: true });
    } catch (e) {
      setError(userError(e));
    }
  }
  return <section aria-labelledby="settings-title"><h1 id="settings-title" className="text-3xl font-semibold">Çalışma alanı ayarları</h1><div className="mt-8 rounded-3xl border border-border bg-card p-6"><h2 className="font-semibold">Hesap</h2><p className="mt-2 break-words text-sm">{user?.email}</p><p className="mt-4 text-sm text-muted-foreground">{tr.auth.local} Çıkışta yükleme durdurulur ve seçili dosyalar temizlenir; tamamlanan raporlar hesabınızda kalır.</p><Button className="mt-5" onClick={logout}>{tr.auth.logout}</Button>{error && <p role="alert" className="mt-3">{error}</p>}</div></section>;
}
