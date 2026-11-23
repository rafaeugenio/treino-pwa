import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, cpSync, writeFileSync, realpathSync, existsSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const root = realpathSync(new URL("..", import.meta.url));
const git = (args, cwd = root) => execFileSync("git", args, { cwd, stdio: "inherit" });
const output = (args, cwd = root) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
// Use o HOME falso; o npm CLI é o mesmo que iniciou este processo.
const npm = (args) => {
  if (!process.env.npm_execpath) throw Error("Execute via npm run publicar:pages com HOME falso.");
  execFileSync(process.execPath, [process.env.npm_execpath, ...args], { cwd: root, stdio: "inherit" });
};
git(["fetch", "origin"]);
if (output(["branch", "--show-current"]) !== "main") throw Error("Publicação exige main.");
if (output(["status", "--porcelain"])) throw Error("Checkout precisa estar limpo.");
if (output(["rev-parse", "main"]) !== output(["rev-parse", "origin/main"]))
  throw Error("main precisa ser igual a origin/main após fetch.");
npm(["run", "check"]);
npm(["run", "build", "--", "--base=/treino-pwa/"]);
const exists = output(["ls-remote", "--heads", "origin", "gh-pages"]).length > 0;
const parent = mkdtempSync(join(tmpdir(), "treino-pages-"));
const target = join(parent, "worktree");
const branch = `publicacao-pages-${process.pid}-${Date.now()}`;
let worktreeCreated = false;
let branchCreated = false;
try {
  git(["worktree", "add", "--detach", target, exists ? "origin/gh-pages" : "HEAD"]);
  worktreeCreated = true;
  git(exists ? ["switch", "-c", branch] : ["switch", "--orphan", branch], target);
  branchCreated = true;
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
  if (output(["diff", "--cached", "--name-only"], checked)) {
    git(["commit", "-m", "build(pages): publicar app de treino (RAFA-180)", "-m", "Part of RAFA-180\nPart of RAFA-176"], checked);
  }
  git(["push", "origin", "HEAD:gh-pages"], checked);
} finally {
  // Desfaz somente alterações na worktree criada por este processo, sem --force.
  if (worktreeCreated) {
    try {
      // Um commit pode ter falhado: preserve arquivos para inspeção nesse caso.
      git(["worktree", "remove", target]);
      worktreeCreated = false;
    } catch {
      console.error(`Não foi possível remover a worktree: ${target}`);
      process.exitCode = 1;
    } finally {
      if (branchCreated && !worktreeCreated) git(["branch", "-D", branch]);
    }
  }
  if (!worktreeCreated && existsSync(parent)) rmdirSync(parent);
}
