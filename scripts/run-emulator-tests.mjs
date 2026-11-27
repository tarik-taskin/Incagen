import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { emulatorPorts } from "../src/lib/emulator-ports.ts";

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
    // Firebase'in başlattığı Playwright/Vite çocukları da aynı koşunun süreç grubundadır.
    function interruptChild(signal) {
      try {
        if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) { if (error.code !== "ESRCH") throw error; }
    }
    let interrupted;
    // Firebase'e önce normal kapanma fırsatı verir; asılı kalırsa yalnız bu koşunun süreç grubunu sonlandırır.
    for (const signal of signals) {
      const handler = () => {
        if (interrupted) return;
        interrupted = signal;
        interruptChild(signal);
        timer = setTimeout(() => interruptChild("SIGKILL"), 30000);
        timer.unref();
      };
      handlers.set(signal, handler);
      process.on(signal, handler);
    }
    const result = await new Promise((resolveResult, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolveResult({ code, signal }));
    });
    if (interrupted && process.platform !== "win32") interruptChild("SIGKILL");
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
  const [mode, option, ...unexpected] = process.argv.slice(2);
  const baseCommand = Object.hasOwn(commands, mode) ? commands[mode] : undefined;
  const tabularOnly = mode === "browser" && option === "--tabular";
  if (!baseCommand || unexpected.length || (option !== undefined && !tabularOnly)) {
    throw new Error("Choose integration, browser or browser --tabular.");
  }
  const command = tabularOnly ? `${baseCommand} e2e/tabular-analysis.spec.ts` : baseCommand;
  const cli = fileURLToPath(new URL("../node_modules/firebase-tools/lib/bin/firebase.js", import.meta.url));
  const base = process.env.INCAGEN_TEST_PORT_BASE;
  const ports = emulatorPorts(base);
  const env = { ...process.env, VITE_INCAGEN_TEST_PORT_BASE: base ?? "" };
  const config = base ? `.incagen-emulator-${randomUUID()}.json` : undefined;
  let configWritten = false;
  try {
    if (config) {
      const firebase = JSON.parse(readFileSync("firebase.json", "utf8"));
      for (const name of ["auth", "firestore", "storage", "functions", "hub", "logging", "eventarc", "tasks"]) {
        firebase.emulators[name] = { host: "127.0.0.1", port: ports[name] };
      }
      firebase.emulators.firestore.websocketPort = ports.firestoreWebsocket;
      writeFileSync(config, JSON.stringify(firebase), { flag: "wx", mode: 0o600 });
      configWritten = true;
    }
    const result = await runIsolated(process.execPath, [cli, "emulators:exec", "--project", "demo-incagen", "--only", "auth,firestore,storage,functions",
      ...(config ? ["--config", config] : []), command], { env });
    process.exitCode = result.signal === "SIGINT" ? 130 : result.signal === "SIGTERM" ? 143 : result.code ?? 1;
  } finally {
    if (configWritten) rmSync(config, { force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => { console.error("Isolated emulator test run failed."); process.exitCode = 1; });
}
