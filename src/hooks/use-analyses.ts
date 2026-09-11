import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import type { Analysis } from "../../functions/src/contracts";
import { useAuth } from "../lib/auth-context";
import { getServices } from "../lib/firebase";
import { userError } from "../lib/errors";

// Kullanıcının geçmişini canlı ve yalnız kendi koleksiyonu üzerinden izler.
export function useAnalyses() {
  const { user } = useAuth();
  const [state, setState] = useState<{ uid: string; rows: Analysis[]; error: string }>({ uid: "", rows: [], error: "" });
  useEffect(() => {
    if (!user) return;
    const q = query(collection(getServices().db, "users", user.uid, "analyses"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setState({ uid: user.uid, rows: snap.docs.map(d => ({ ...d.data(), id: d.id }) as Analysis), error: "" }),
      e => setState({ uid: user.uid, rows: [], error: userError(e) }));
  }, [user]);
  return { ...state, loading: state.uid !== user?.uid };
}
// Sonuç değiştiğinde önceki raporu göstermeden yeni belgenin yüklenmesini bekler.
export function useAnalysis(id: string) {
  const { user } = useAuth();
  const [state, setState] = useState<{ key: string; analysis: Analysis | null; error: string }>({ key: "", analysis: null, error: "" });
  const key = user?.uid + "/" + id;
  useEffect(() => {
    if (!user || !id) return;
    return onSnapshot(doc(getServices().db, "users", user.uid, "analyses", id),
      snap => setState({ key, analysis: snap.exists() ? { ...snap.data(), id: snap.id } as Analysis : null, error: "" }),
      e => setState({ key, analysis: null, error: userError(e) }));
  }, [user, id, key]);
  return { ...state, loading: state.key !== key };
}
