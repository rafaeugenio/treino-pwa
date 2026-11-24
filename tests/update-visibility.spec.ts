import { test, expect, type Locator, type Page } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Simula a troca de primeiro plano: fixa visibilityState e dispara
// visibilitychange no document, como o iOS faz ao suspender e reabrir o app.
const mudarVisibilidade = (page: Page, estado: "visible" | "hidden") =>
  page.evaluate((valor) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => valor });
    document.dispatchEvent(new Event("visibilitychange"));
  }, estado);

type Cenario = { servirSegundo: () => void; swRequests: () => number; update: Locator };

// Abre o primeiro build com o SW no controle e o sw.js quieto, e entrega ao
// cenário o controle de quando o servidor passa a servir o segundo build.
async function comDoisBuilds(page: Page, cenario: (ctx: Cenario) => Promise<void>) {
  const temp = mkdtempSync(join(tmpdir(), "treino-sw-visibilidade-"));
  let server: ReturnType<typeof createServer> | undefined;
  let failed = false;
  let cleanupError: unknown;
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
    await page.goto(`http://127.0.0.1:${address.port}/`);
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
    await cenario({
      servirSegundo: () => { active = second; },
      swRequests: () => swRequests,
      update: page.getByRole("button", { name: "Atualizar", exact: true }),
    });
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      if (server?.listening) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    } catch (error) { cleanupError = error; }
    try { rmSync(temp, { recursive: true, force: true, maxRetries: 3 }); }
    catch (error) { cleanupError ??= error; }
  }
  if (!failed && cleanupError) throw cleanupError;
}

// Sem registration.update() nos testes: só o evento de retorno busca o SW novo.
test("volta ao primeiro plano mostra Atualizar com o segundo build", async ({ page }) => {
  test.setTimeout(120_000);
  await comDoisBuilds(page, async ({ servirSegundo, swRequests, update }) => {
    servirSegundo();
    const antes = swRequests();
    await page.waitForTimeout(3_000);
    await expect(update).toHaveCount(0);
    expect(swRequests()).toBe(antes);

    await mudarVisibilidade(page, "visible");
    await expect(update).toBeVisible({ timeout: 30_000 });
    expect(swRequests()).toBeGreaterThan(antes);
    expect(await update.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);

    // Intervalo mínimo: outra volta logo em seguida não busca o SW de novo.
    const depois = swRequests();
    await mudarVisibilidade(page, "visible");
    await page.waitForTimeout(2_000);
    expect(swRequests()).toBe(depois);

    await update.click();
    await expect(page).toHaveTitle("Treino versão nova", { timeout: 30_000 });
  });
});

test("página oculta não busca o SW novo", async ({ page }) => {
  test.setTimeout(120_000);
  await comDoisBuilds(page, async ({ servirSegundo, swRequests, update }) => {
    servirSegundo();
    const antes = swRequests();
    await mudarVisibilidade(page, "hidden");
    await page.waitForTimeout(3_000);
    expect(swRequests()).toBe(antes);
    await expect(update).toHaveCount(0);

    // O intervalo segue livre: a volta visível seguinte checa.
    await mudarVisibilidade(page, "visible");
    await expect(update).toBeVisible({ timeout: 30_000 });
    expect(swRequests()).toBeGreaterThan(antes);
  });
});

test("offline não busca nem gasta o intervalo; de volta online, checa", async ({ page, context }) => {
  test.setTimeout(120_000);
  await comDoisBuilds(page, async ({ servirSegundo, swRequests, update }) => {
    servirSegundo();
    const antes = swRequests();
    await context.setOffline(true);
    await mudarVisibilidade(page, "visible");
    await page.waitForTimeout(3_000);
    expect(swRequests()).toBe(antes);
    await expect(update).toHaveCount(0);

    await context.setOffline(false);
    await mudarVisibilidade(page, "visible");
    await expect(update).toBeVisible({ timeout: 30_000 });
    expect(swRequests()).toBeGreaterThan(antes);
  });
});
