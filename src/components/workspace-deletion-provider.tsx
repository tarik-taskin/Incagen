import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { WorkspaceDeletionContext, type DeleteItem, type DeletionResult } from "../lib/workspace-deletion-context";
import { userError } from "../lib/errors";
import { getServices } from "../lib/firebase";

const emptyIds = new Set<string>();

// Sağlayıcı UID ile anahtarlanır. Gezinmede iş sürer, oturum kapanınca sırada bekleyen çağrılar durur.
export function WorkspaceDeletionProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const active = useRef(false);
  const navigate = useNavigate();
  const running = useRef(false);
  const erasingAccount = useRef(false);
  const [accountPending, setAccountPending] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [job, setJob] = useState<{ ids: ReadonlySet<string>; done: number; total: number } | null>(null);
  const [result, setResult] = useState<DeletionResult | null>(null);
  useLayoutEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  // Açıkça onaylanan kayıtları sırayla siler ve yalnız olumlu sunucu yanıtını tamamlanmış sayar.
  async function remove(items: DeleteItem[]) {
    if (!active.current || running.current || erasingAccount.current || items.length === 0) return null;
    running.current = true;
    const ids = new Set(items.map(item => item.id));
    setJob({ ids, done: 0, total: items.length });
    setResult(null);
    setAccountError("");
    const outcome: DeletionResult = { deleted: 0, failed: [] };
    try {
      for (const [index, item] of items.entries()) {
        if (!active.current) return null;
        try {
          const services = getServices();
          if (services.auth.currentUser?.uid !== uid) return null;
          const call = httpsCallable<{ id: string }, { deleted: boolean }>(services.functions, "deleteAnalysis", { timeout: 310_000 });
          const response = await call({ id: item.id });
          if (response.data.deleted !== true) throw new Error("Analiz silinemedi.");
          outcome.deleted++;
        } catch (error) {
          outcome.failed.push({ ...item, reason: userError(error) });
        }
        if (!active.current) return null;
        setJob({ ids, done: index + 1, total: items.length });
      }
      setResult(outcome);
      return outcome;
    } finally {
      running.current = false;
      if (active.current) setJob(null);
    }
  }

  // Yalnız yeniden doğrulanmış ayarlar akışından çağrılır ve gezinme boyunca ikinci isteği engeller.
  async function eraseAccount() {
    const services = getServices();
    if (!active.current || erasingAccount.current || running.current || services.auth.currentUser?.uid !== uid) return;
    erasingAccount.current = true;
    setAccountPending(true);
    setAccountError("");
    setResult(null);
    try {
      const removeAccount = httpsCallable<{ confirmation: string }, { deleted: boolean }>(services.functions, "deleteAccount", { timeout: 310_000 });
      const response = await removeAccount({ confirmation: "HESABIMI SİL" });
      if (response.data.deleted !== true) throw new Error("Hesap silinemedi.");
      if (services.auth.currentUser?.uid !== uid) return;
      await signOut(services.auth);
      if (!services.auth.currentUser || services.auth.currentUser.uid === uid) navigate("/", { replace: true, state: null, flushSync: true });
    } catch (error) {
      if (active.current) setAccountError(userError(error));
    } finally {
      erasingAccount.current = false;
      if (active.current) setAccountPending(false);
    }
  }

  // Sonuç bildirimi kapatıldığında etkilenen işlem türlerinin son durumlarını temizler.
  function dismiss() {
    setResult(null);
    setAccountError("");
  }

  return <WorkspaceDeletionContext.Provider value={{ pendingIds: job?.ids ?? emptyIds, progress: job, result, remove, accountPending, accountError, eraseAccount, dismiss }}>
    {children}
  </WorkspaceDeletionContext.Provider>;
}
