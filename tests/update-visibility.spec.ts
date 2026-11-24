import { test, expect, type Page } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Simula a volta ao primeiro plano: fixa visibilityState em "visible" e
// dispara visibilitychange no document, como o iOS faz ao reabrir o app.
const voltarAoPrimeiroPlano = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });

test("volta ao primeiro plano mostra Atualizar com o segundo build", async ({ page }) => {
  test.setTimeout(120_000);
  const temp = mkdtempSync(join(tmpdir(), "treino-sw-visibilidade-"));
  let server: ReturnType<typeof createServer> | undefined;
  try {
    const first = join(temp, "first");
    const second = join(temp, "second");
    cpSync("dist", first, { recursive: true });
    // O build bloqueia o event loop; feito antes de abrir a página, nenhuma
    // checagem do navegador fica na fila e cai no segundo build por acaso.
    const config = join(temp, "update.config.mjs");
    writeFileSync(config, `import config from ${JSON.stringify(pathToFileURL(resolve("vite.config.ts")).href)};
export default { ...config, plugins: [...config.plugins, { name: "test-update-title", transformIndexHtml: (html) => html.replace(new RegExp("<title>.*?</title>"), "<title>Treino versão nova</title>") }] };`);
    execFileSync(process.execPath, ["node_modules/vite/bin/vite.js", "build", "--config", config, "--outDir", second], { stdio: "pipe" });
    let active = first;
    let swRequests = 0;
    server = createServer((req, res) => {
      const pathname = new URL(req.url!, "http://localhost").pathname;
      const relative = pathname.slice(1) || "index.html";
      if (relative.includes("..")) { res.writeHead(400).end(); return; }
      if (relative === "sw.js") swRequests++;
      try {
        const body = readFileSync(join(active, relative));
        const types: Record<string, string> = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };
        res.writeHead(200, { "Content-Type": types[extname(relative)] || "application/octet-stream", "Cache-Control": "no-store" }).end(body);
      } catch { res.writeHead(404).end(); }
    });
    await new Promise<void>((resolve, reject) => server!.once("error", reject).listen(0, "127.0.0.1", resolve));
    const address = server.address() as { port: number };
    const url = `http://127.0.0.1:${address.port}/`;
    await page.goto(url);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBeTruthy();
    // Depois da navegação o navegador faz uma checagem própria, atrasada em
    // 1 a 2 s. Espera sw.js ficar 3 s sem pedidos, ainda no primeiro build.
    await expect.poll(async () => {
      const visto = swRequests;
      await page.waitForTimeout(3_000);
      return swRequests === visto;
    }, { timeout: 30_000, intervals: [0] }).toBe(true);

    active = second;
    const update = page.getByRole("button", { name: "Atualizar", exact: true });
    const antes = swRequests;
    await page.waitForTimeout(3_000);
    await expect(update).toHaveCount(0);
    expect(swRequests).toBe(antes);

    // Sem registration.update() no teste: daqui em diante, só o evento de
    // retorno busca o SW novo.
    await voltarAoPrimeiroPlano(page);
    await expect(update).toBeVisible({ timeout: 30_000 });
    expect(swRequests).toBeGreaterThan(antes);
    expect(await update.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);

    // Intervalo mínimo: outra volta logo em seguida não busca o SW de novo.
    const depois = swRequests;
    await voltarAoPrimeiroPlano(page);
    await page.waitForTimeout(2_000);
    expect(swRequests).toBe(depois);

    await update.click();
    await expect(page).toHaveTitle("Treino versão nova", { timeout: 30_000 });
  } finally {
    if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
    rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
  }
});
