import { gzipSync } from "node:zlib";
import type { OutputChunk } from "rollup";
import type { Plugin } from "vite";

// Her üretim derlemesinde ilk ekranın gerçek statik JS grafiğini ölçer; veri/çalışma alanı kodunun geri sızmasını durdurur.
export function startupBudget(): Plugin {
  return {
    name: "incagen-startup-budget",
    apply: "build",
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find((item): item is OutputChunk => item.type === "chunk" && item.isEntry);
      if (!entry) this.error("Ana uygulama başlangıç paketi bulunamadı.");
      const chunks = new Map<string, OutputChunk>();
      // Yalnız statik importları izler; kullanıcının henüz istemediği dinamik ekranları başlangıç boyutuna katmaz.
      function visit(chunk: OutputChunk) {
        if (chunks.has(chunk.fileName)) return;
        chunks.set(chunk.fileName, chunk);
        for (const dependency of chunk.imports) {
          const next = bundle[dependency];
          if (next?.type === "chunk") visit(next);
        }
      }
      visit(entry);
      const modules = [...chunks.values()].flatMap(chunk => Object.keys(chunk.modules));
      const forbidden = modules.filter(id => /\/@firebase\/(firestore|storage|functions)\//.test(id) || /\/src\/(pages\/(new-analysis|history|settings|plan|analysis)-page|components\/(require-auth|workspace-provider|layout\/app-shell))\.tsx$/.test(id));
      if (forbidden.length) this.error(`İlk açılışa çalışma alanı/veri kodu eklendi: ${forbidden.join(", ")}`);
      const gzipBytes = [...chunks.values()].reduce((total, chunk) => total + gzipSync(chunk.code).length, 0);
      if (gzipBytes > 400 * 1024) this.error(`İlk açılış JavaScript bütçesi aşıldı: ${gzipBytes} > 409600 gzip bayt.`);
      this.info(`İlk açılış: ${chunks.size} JS paketi, ${gzipBytes} gzip bayt (bütçe: 409600).`);
    },
  };
}
