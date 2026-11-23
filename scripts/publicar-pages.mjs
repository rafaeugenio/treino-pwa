import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, cpSync, writeFileSync, realpathSync, existsSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const root = realpathSync(new URL("..", import.meta.url));
const git = (args, cwd = root) => execFileSync("git", args, { cwd, stdio: "inherit" });
const output = (args, cwd = root) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const npm = (args) => {
  if (!process.env.npm_execpath) throw Error("Execute via npm run publicar:pages com HOME falso.");
  execFileSync(process.execPath, [process.env.npm_execpath, ...args], { cwd: root, stdio: "inherit" });
};
const requireClean = () => {
  if (output(["status", "--porcelain"])) throw Error("Checkout precisa estar limpo.");
};
git(["fetch", "origin"]);
if (output(["branch", "--show-current"]) !== "main") throw Error("Publicação exige main.");
requireClean();
const source = output(["rev-parse", "main"]);
if (source !== output(["rev-parse", "origin/main"]))
  throw Error("main precisa ser igual a origin/main após fetch.");
// Não configure identidade automaticamente; valide a identidade efetiva no HOME recebido.
output(["var", "GIT_AUTHOR_IDENT"]);
output(["var", "GIT_COMMITTER_IDENT"]);
npm(["run", "check"]);
requireClean();
npm(["run", "build", "--", "--base=/treino-pwa/"]);
const exists = output(["ls-remote", "--heads", "origin", "gh-pages"]).length > 0;
const parent = mkdtempSync(join(tmpdir(), "treino-pages-"));
const target = join(parent, "worktree");
const branch = `publicacao-pages-${process.pid}-${Date.now()}`;
let worktreeCreated = false;
let branchCreated = false;
let publicationError;
const cleanupErrors = [];
const cleanStep = (label, action) => {
  try { action(); } catch (error) {
    cleanupErrors.push(error);
    console.error(`Falha de limpeza (${label}); inspecione ${target}: ${error.message}`);
  }
};
const emptyOwnWorktree = () => {
  const checked = realpathSync(target);
  if (checked !== resolve(parent, "worktree")) throw Error("Worktree fora do diretório exclusivo");
  for (const name of readdirSync(checked)) {
    if (name === ".git") continue;
    const item = resolve(checked, name);
    if (!item.startsWith(checked + sep)) throw Error("Caminho fora da worktree");
    rmSync(item, { recursive: true });
  }
};
try {
  git(["worktree", "add", "--detach", target, exists ? "origin/gh-pages" : "HEAD"]);
  worktreeCreated = true;
  git(exists ? ["switch", "-c", branch] : ["switch", "--orphan", branch], target);
  branchCreated = true;
  emptyOwnWorktree();
  cpSync(join(root, "dist"), target, { recursive: true });
  writeFileSync(join(target, ".nojekyll"), "");
  git(["add", "--all"], target);
  if (output(["diff", "--cached", "--name-only"], target))
    git(["commit", "-m", "build(pages): publicar app de treino (RAFA-180)", "-m", "Part of RAFA-180\nPart of RAFA-176"], target);
  git(["push", "origin", "HEAD:gh-pages"], target);
} catch (error) {
  publicationError = error;
} finally {
  if (worktreeCreated) {
    // Apenas esta worktree temporária exclusiva: retire conteúdo copiado e restaure
    // um commit conhecido no índice e disco, inclusive se a branch ainda for órfã.
    cleanStep("conteúdo temporário", emptyOwnWorktree);
    cleanStep("índice e arquivos temporários", () => git(["read-tree", "--reset", "-u", source], target));
    cleanStep("desanexar branch temporária", () => git(["switch", "--detach", source], target));
    cleanStep("worktree remove", () => git(["worktree", "remove", target]));
  }
  if (branchCreated && spawnSync("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { cwd: root }).status === 0)
    cleanStep("branch temporária", () => git(["branch", "-D", branch]));
  cleanStep("diretório temporário", () => { if (existsSync(parent)) rmdirSync(parent); });
}
if (publicationError) throw publicationError;
if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "Publicação terminou com falha de limpeza");
