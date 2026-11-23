import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

const sandbox = resolve(process.env.RAFA_PAGES_TEST_SANDBOX || tmpdir());
mkdirSync(sandbox, { recursive: true });
const script = new URL("./publicar-pages.mjs", import.meta.url);
for (const scenario of ["branch", "divergent", "dirty", "check-fails", "check-dirties", "nodist", "noident", "commit-fails", "happy", "push-rejected"]) {
  test(`publicação local: ${scenario}`, (t) => {
    const base = mkdtempSync(join(sandbox, "rafa180-case-"));
    t.after(() => {
      assert.ok(resolve(base).startsWith(sandbox + sep));
      rmSync(base, { recursive: true });
    });
    const origin = join(base, "origin.git");
    const repo = join(base, "repo");
    const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(base, "no-global-config"), TEMP: base, TMP: base, TMPDIR: base, SCENARIO: scenario, npm_execpath: join(repo, "fake-npm.cjs") };
    const git = (args, cwd = repo) => execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    git(["init", "--bare", origin], base);
    git(["init", "-b", "main", repo], base);
    git(["config", "user.name", "Sandbox"]);
    git(["config", "user.email", "sandbox@example.invalid"]);
    mkdirSync(join(repo, "scripts"));
    cpSync(script, join(repo, "scripts/publicar-pages.mjs"));
    writeFileSync(join(repo, "fake-npm.cjs"), `const fs=require('node:fs'); const s=process.env.SCENARIO; if(s==='check-fails' && process.argv[3]==='check') process.exit(7); if(s==='check-dirties') fs.writeFileSync('dirty.txt','dirty'); if(s!=='nodist') {fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/index.html','sandbox');}`);
    writeFileSync(join(repo, ".gitignore"), "dist/\n");
    git(["add", "."]);
    git(["commit", "-m", "fixture"]);
    git(["remote", "add", "origin", origin]);
    git(["push", "-u", "origin", "main"]);
    const before = git(["rev-parse", "HEAD"]);
    if (scenario === "branch") git(["switch", "-c", "other"]);
    if (scenario === "divergent") git(["commit", "--allow-empty", "-m", "ahead"]);
    if (scenario === "dirty") writeFileSync(join(repo, "dirty.txt"), "dirty");
    if (scenario === "noident") {
      git(["config", "--unset", "user.name"]);
      git(["config", "--unset", "user.email"]);
      git(["config", "user.useConfigOnly", "true"]);
    }
    if (scenario === "commit-fails") writeFileSync(join(repo, ".git/hooks/pre-commit"), "#!/bin/sh\necho sandbox-commit-failure >&2\nexit 1\n");
    if (scenario === "push-rejected") writeFileSync(join(origin, "hooks/pre-receive"), "#!/bin/sh\nexit 1\n");
    const result = spawnSync(process.execPath, ["scripts/publicar-pages.mjs"], { cwd: repo, encoding: "utf8", env });
    assert.equal(result.status === 0, scenario === "happy", result.stdout + result.stderr);
    assert.equal(git(["branch", "--list", "publicacao-pages-*"]), "");
    assert.equal(git(["worktree", "list", "--porcelain"]).split("worktree ").length - 1, 1);
    assert.deepEqual(readdirSync(base).filter((name) => name.startsWith("treino-pages-")), []);
    assert.equal(git(["rev-parse", "origin/main"]), before);
    if (scenario === "nodist") assert.match(result.stderr, /ENOENT/);
    if (scenario === "commit-fails") assert.match(result.stderr, /sandbox-commit-failure/);
    if (["nodist", "commit-fails"].includes(scenario)) assert.doesNotMatch(result.stderr, /Falha de limpeza/);
    if (scenario === "happy") {
      assert.equal(git(["show", "origin/gh-pages:index.html"]), "sandbox");
      assert.equal(git(["show", "origin/gh-pages:.nojekyll"]), "");
    } else assert.equal(git(["ls-remote", "--heads", "origin", "gh-pages"]), "");
  });
}
