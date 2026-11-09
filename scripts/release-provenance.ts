import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

// Build'in gerçek kaynak revizyonunu, etkin public ayarlarını ve bütün çıktı dosyalarını birlikte kaydeder.
export function releaseProvenance(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "incagen-release-provenance", apply: "build", enforce: "post",
    configResolved(value) { config = value; },
    writeBundle() {
      const directory = resolve(config.root, config.build.outDir), manifestName = "release-manifest.json";
      const git = (...args: string[]) => execFileSync("git", args, { cwd: config.root, encoding: "utf8" }).trim();
      const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
      const files: Record<string, string> = {};
      // Manifest kendini hash'lemez; yayın doğrulayıcısı manifest dosyasını ayrıca karşılaştırır.
      function visit(relative = "") {
        for (const name of readdirSync(join(directory, relative)).sort()) {
          const file = relative ? `${relative}/${name}` : name;
          if (file === manifestName) continue;
          const stat = lstatSync(join(directory, file));
          if (stat.isSymbolicLink()) throw new Error("Yayın paketinde sembolik bağlantı olamaz.");
          if (stat.isDirectory()) visit(file);
          else files[file] = hash(readFileSync(join(directory, file)));
        }
      }
      visit();
      const env = config.env;
      writeFileSync(join(directory, manifestName), JSON.stringify({
        version: 1,
        revision: { commit: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"), dirty: git("status", "--porcelain").length > 0 },
        mode: config.mode,
        firebase: {
          mode: env.VITE_FIREBASE_MODE ?? "", projectId: env.VITE_FIREBASE_PROJECT_ID ?? "",
          authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? "", storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
          messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "", appId: env.VITE_FIREBASE_APP_ID ?? "",
          apiKeySha256: env.VITE_FIREBASE_API_KEY ? hash(env.VITE_FIREBASE_API_KEY) : "",
        },
        flags: { authOnlyPreview: env.VITE_AUTH_ONLY_PREVIEW === "true", tabularAnalysisEnabled: env.VITE_TABULAR_ANALYSIS_ENABLED === "true" },
        files,
      }, null, 2) + "\n");
    },
  };
}
