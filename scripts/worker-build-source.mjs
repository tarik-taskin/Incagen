import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

const fixedFiles = ["python/Dockerfile", "python/.dockerignore", "python/requirements.runtime.lock", "python/worker_acceptance.py"];
const runtimeFile = /^python\/src\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.py$/;

// Yalnız sabit build girdileri ve Git’te normal dosya olan Python modülleri arşivlenir.
export function selectWorkerFiles(tree) {
  const selected = new Set();
  for (const entry of tree.split("\0").filter(Boolean)) {
    const [info, file] = entry.split("\t");
    if (!fixedFiles.includes(file) && !runtimeFile.test(file ?? "")) continue;
    if (!/^100(?:644|755) blob [a-f0-9]+$/.test(info)) throw new Error("Worker build girdisi normal Git dosyası değil.");
    selected.add(file);
  }
  if (!fixedFiles.every(file => selected.has(file)) || selected.size === fixedFiles.length) {
    throw new Error("Worker build girdileri eksik.");
  }
  return [...selected].sort();
}

// Arşiv yalnız verilen tam Git SHA’dan gelir. Build testi de aynı commit’ten okunur.
export function workerBuildSource(commit, root = process.cwd()) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("Worker build için tam Git SHA gerekli.");
  const git = (...args) => execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 16 * 1024 * 1024 });
  const tree = git("ls-tree", "-rz", commit, "--", "python").toString("utf8");
  const files = selectWorkerFiles(tree);
  const archive = gzipSync(git("archive", "--format=tar", commit, "--", ...files), { level: 9 });
  return {
    bytes: archive,
    sha256: createHash("sha256").update(archive).digest("hex"),
    acceptanceCode: git("show", `${commit}:python/worker_acceptance.py`).toString("utf8"),
  };
}
