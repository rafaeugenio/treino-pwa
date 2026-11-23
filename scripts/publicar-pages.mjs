import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  rmSync,
  cpSync,
  writeFileSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
const root = realpathSync(new URL("..", import.meta.url));
const git = (args, cwd = root) =>
  execFileSync("git", args, { cwd, stdio: "inherit" });
const output = (args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
if (output(["status", "--porcelain"]))
  throw Error("Checkout precisa estar limpo.");
// Executa o build sob o mesmo ambiente npm recebido pelo script.
execFileSync(
  process.execPath,
  [join(root, "node_modules/typescript/bin/tsc"), "-b"],
  { cwd: root, stdio: "inherit" },
);
execFileSync(
  process.execPath,
  [join(root, "node_modules/vite/bin/vite.js"), "build", "--base=/treino-pwa/"],
  { cwd: root, stdio: "inherit" },
);
git(["fetch", "origin"]);
const exists =
  execFileSync("git", ["ls-remote", "--heads", "origin", "gh-pages"], {
    cwd: root,
    encoding: "utf8",
  }).trim().length > 0;
const parent = mkdtempSync(join(tmpdir(), "treino-pages-"));
const target = join(parent, "worktree");
const branch = `publicacao-pages-${Date.now()}`;
git([
  "worktree",
  "add",
  "--detach",
  target,
  exists ? "origin/gh-pages" : "HEAD",
]);
if (exists) git(["switch", "-c", branch], target);
else git(["switch", "--orphan", branch], target);
const checked = realpathSync(target);
for (const name of readdirSync(checked)) {
  if (name === ".git") continue;
  const item = resolve(checked, name);
  if (!item.startsWith(checked + sep)) throw Error("Caminho fora da worktree");
  rmSync(item, { recursive: true });
}
cpSync(join(root, "dist"), checked, { recursive: true });
writeFileSync(join(checked, ".nojekyll"), "");
git(["add", "--all"], checked);
const staged = execFileSync("git", ["diff", "--cached", "--name-only"], {
  cwd: checked,
  encoding: "utf8",
}).trim();
if (staged) {
  git(
    [
      "commit",
      "-m",
      "build(pages): publicar app de treino (RAFA-180)",
      "-m",
      "Part of RAFA-180\nPart of RAFA-176",
    ],
    checked,
  );
  git(["push", "origin", "HEAD:gh-pages"], checked);
}
console.log(`Worktree preservada para inspeção e limpeza manual: ${checked}`);
