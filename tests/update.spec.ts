import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdtempSync, cpSync } from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

test("atualização por toque aplica o segundo build", async ({ page }) => {
  test.setTimeout(120_000);
  const temp = mkdtempSync(join(tmpdir(), "treino-sw-update-"));
  const first = join(temp, "first");
  const second = join(temp, "second");
  cpSync("dist", first, { recursive: true });
  let active = first;
  const server = createServer((req, res) => {
    const pathname = new URL(req.url!, "http://localhost").pathname;
    if (!pathname.startsWith("/treino-pwa/")) { res.writeHead(404).end(); return; }
    const relative = pathname.slice("/treino-pwa/".length) || "index.html";
    if (relative.includes("..")) { res.writeHead(400).end(); return; }
    try {
      const body = readFileSync(join(active, relative));
      const types: Record<string, string> = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };
      res.writeHead(200, { "Content-Type": types[extname(relative)] || "application/octet-stream", "Cache-Control": "no-store" }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}/treino-pwa/`;
  try {
    await page.goto(url);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBeTruthy();
    const original = readFileSync("index.html", "utf8");
    try {
      writeFileSync("index.html", original.replace(/<title>.*?<\/title>/, "<title>Treino versão nova</title>"));
      execFileSync(process.execPath, ["node_modules/vite/bin/vite.js", "build", "--outDir", second], { stdio: "pipe" });
    } finally { writeFileSync("index.html", original); }
    active = second;
    await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
    const update = page.getByRole("button", { name: "Atualizar", exact: true });
    await expect(update).toBeVisible({ timeout: 30_000 });
    expect(await update.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await expect(page).not.toHaveTitle("Treino versão nova");
    await update.click();
    await expect(page).toHaveTitle("Treino versão nova", { timeout: 30_000 });
    await expect(update).toHaveCount(0);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});
