// SDK bekleyişi iptal edemiyorsa dahi işlem son tarihten sonra ilerlemez.
export async function beforeAbort<T>(signal: AbortSignal, operation: () => Promise<T>) {
  signal.throwIfAborted();
  let rejectAbort!: () => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = () => reject(signal.reason);
    signal.addEventListener("abort", rejectAbort, { once: true });
  });
  try { return await Promise.race([aborted, Promise.resolve().then(() => { signal.throwIfAborted(); return operation(); })]); }
  finally { signal.removeEventListener("abort", rejectAbort); }
}
