import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const sandbox = "C:/dev/Geral/tmp-harness/rafa180-pub-sandbox";
mkdirSync(sandbox, { recursive: true });
const script = new URL("./publicar-pages.mjs", import.meta.url);
for (const scenario of ["branch", "divergent", "dirty", "check-fails", "happy", "push-rejected"]) {
  test(`publicação local: ${scenario}`, () => {
    const base = mkdtempSync(join(sandbox, "case-"));
    const origin = join(base, "origin.git");
    const repo = join(base, "repo");
    const git = (args, cwd = repo) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    git(["init", "--bare", origin], base);
    git(["init", "-b", "main", repo], base);
    git(["config", "user.name", "Sandbox"]);
    git(["config", "user.email", "sandbox@example.invalid"]);
    mkdirSync(join(repo, "scripts"));
    cpSync(script, join(repo, "scripts/publicar-pages.mjs"));
    writeFileSync(join(repo, "fake-npm.cjs"), `const fs=require('node:fs'); if(process.env.FAIL_CHECK && process.argv[3]==='check') process.exit(7); fs.mkdirSync('dist',{recursive:true}); fs.writeFileSync('dist/index.html','sandbox');`);
    writeFileSync(join(repo, ".gitignore"), "dist/\n");
    git(["add", "."]);
    git(["commit", "-m", "fixture"]);
    git(["remote", "add", "origin", origin]);
    git(["push", "-u", "origin", "main"]);
    const before = git(["rev-parse", "HEAD"]);
    if (scenario === "branch") git(["switch", "-c", "other"]);
    if (scenario === "divergent") git(["commit", "--allow-empty", "-m", "ahead"]);
    if (scenario === "dirty") writeFileSync(join(repo, "dirty.txt"), "dirty");
    if (scenario === "push-rejected") writeFileSync(join(origin, "hooks/pre-receive"), "#!/bin/sh\nexit 1\n");
    const result = spawnSync(process.execPath, ["scripts/publicar-pages.mjs"], { cwd: repo, encoding: "utf8", env: { ...process.env, TEMP: base, TMP: base, npm_execpath: join(repo, "fake-npm.cjs"), ...(scenario === "check-fails" ? { FAIL_CHECK: "1" } : {}) } });
    assert.equal(result.status === 0, scenario === "happy", result.stdout + result.stderr);
    assert.equal(git(["branch", "--list", "publicacao-pages-*"]), "");
    assert.equal(git(["worktree", "list", "--porcelain"]).split("worktree ").length - 1, 1);
    assert.equal(git(["rev-parse", "origin/main"]), before);
    if (scenario === "happy") {
      assert.equal(git(["show", "origin/gh-pages:index.html"]), "sandbox");
      assert.equal(git(["show", "origin/gh-pages:.nojekyll"]), "");
    } else assert.equal(git(["ls-remote", "--heads", "origin", "gh-pages"]), "");
    assert.ok(readFileSync(join(repo, "scripts/publicar-pages.mjs"), "utf8").includes('git(["fetch", "origin"])'));
  });
}
