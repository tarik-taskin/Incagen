import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Her koşuya kısa ve özel bir geçici alan verir; yalnız kendi oluşturduğu dizini çocuk kapandıktan sonra siler.
export async function runIsolated(command, args, { env = process.env, stdio = "inherit" } = {}) {
  const base = process.platform === "darwin" ? "/private/tmp" : process.platform === "win32" ? tmpdir() : "/tmp";
  const directory = mkdtempSync(join(base, "inctest-"));
  chmodSync(directory, 0o700);
  const signals = ["SIGINT", "SIGTERM"];
  const handlers = new Map();
  let timer;
  try {
    const child = spawn(command, args, { stdio, env: { ...env, TMPDIR: directory, TMP: directory, TEMP: directory }, detached: process.platform !== "win32" });
    let interrupted;
    // Firebase'e önce normal kapanma fırsatı verir; asılı kalırsa yalnız bu koşunun süreç grubunu sonlandırır.
    for (const signal of signals) {
      const handler = () => {
        if (interrupted) return;
        interrupted = signal;
        child.kill(signal);
        timer = setTimeout(() => {
          try {
            if (process.platform !== "win32" && child.pid) process.kill(-child.pid, "SIGKILL");
            else child.kill("SIGKILL");
          } catch (error) { if (error.code !== "ESRCH") throw error; }
        }, 30000);
        timer.unref();
      };
      handlers.set(signal, handler);
      process.on(signal, handler);
    }
    const result = await new Promise((resolveResult, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolveResult({ code, signal }));
    });
    return { ...result, signal: interrupted ?? result.signal };
  } finally {
    clearTimeout(timer);
    for (const [signal, handler] of handlers) process.off(signal, handler);
    rmSync(directory, { recursive: true, force: true });
  }
}

// Sadece sabit demo proje/test komutlarını çalıştırır; gerçek buluta veya kullanıcı girdili kabuk komutuna yönelmez.
async function main() {
  const commands = { browser: "npm run test:e2e -- --workers=1 --retries=0", integration: "node --test integration/*.test.mjs" };
  const command = commands[process.argv[2]];
  if (!command) throw new Error("Choose browser or integration.");
  const cli = fileURLToPath(new URL("../node_modules/firebase-tools/lib/bin/firebase.js", import.meta.url));
  const result = await runIsolated(process.execPath, [cli, "emulators:exec", "--project", "demo-incagen", "--only", "auth,firestore,storage,functions", command]);
  process.exitCode = result.signal === "SIGINT" ? 130 : result.signal === "SIGTERM" ? 143 : result.code ?? 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => { console.error("Isolated emulator test run failed."); process.exitCode = 1; });
}
