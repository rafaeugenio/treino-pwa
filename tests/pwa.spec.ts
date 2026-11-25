import { test as base, expect, type Page } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Perfil persistente, como o app instalado no iPhone. O contexto efêmero do
// WebKit esvazia o Cache Storage quando o origin fica sem páginas, e a
// reabertura offline falharia por limitação do navegador de teste, sem
// relação com o app.
// CA07 com o registro do CA01: a atividade salva continua no dia escolhido.
const DIA = "2026-11-24";
async function verDia(page: Page) {
  await page.getByRole("tab", { name: "Registro" }).click();
  await page.getByRole("textbox", { name: "Data", exact: true }).fill(DIA);
  await expect(page.getByTestId("atividades")).toHaveText(/Vôlei\s*1,5 h/);
}
const test = base.extend({
  context: async ({ playwright, browserName }, fornecer, info) => {
    const { viewport, userAgent, screen, deviceScaleFactor, isMobile, hasTouch } = info.project.use;
    const profile = mkdtempSync(join(tmpdir(), "treino-pwa-perfil-"));
    const context = await playwright[browserName].launchPersistentContext(profile, {
      baseURL: info.project.use.baseURL,
      viewport,
      userAgent,
      screen,
      deviceScaleFactor,
      isMobile,
      hasTouch,
    });
    try {
      await fornecer(context);
    } finally {
      await context.close();
      rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
    }
  },
  page: async ({ context }, fornecer) => {
    await fornecer(context.pages()[0] ?? (await context.newPage()));
  },
});
test("manifest, metas, layout e persistência", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(60_000);
  const foreign: string[] = [];
  context.on("request", (r) => {
    if (new URL(r.url()).origin !== new URL(baseURL!).origin)
      foreign.push(r.url());
  });
  await page.goto("./");
  const manifest = await (
    await context.request.get("manifest.webmanifest")
  ).json();
  expect(manifest).toMatchObject({
    name: "Treino pessoal",
    short_name: "Treino",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: "#18181b",
    background_color: "#fafafa",
  });
  for (const icon of manifest.icons) {
    expect(["192x192", "512x512"]).toContain(icon.sizes);
    expect((await context.request.get(icon.src)).ok()).toBeTruthy();
  }
  expect(
    manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable"),
  ).toBeTruthy();
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/apple-touch-icon.png",
  );
  for (const name of [
    "apple-mobile-web-app-capable",
    "apple-mobile-web-app-status-bar-style",
    "apple-mobile-web-app-title",
    "theme-color",
  ])
    await expect(page.locator(`meta[name="${name}"]`)).toHaveAttribute(
      "content",
      /.+/,
    );
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /viewport-fit=cover/,
  );
  await page.getByRole("tab", { name: "Registro" }).click();
  await page.getByRole("textbox", { name: "Data", exact: true }).fill(DIA);
  await page.getByRole("textbox", { name: "Atividade", exact: true }).fill("Vôlei");
  await page.getByRole("textbox", { name: "Horas", exact: true }).fill("1,5");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByTestId("atividades")).toHaveText(/Vôlei\s*1,5 h/);
  await page.reload();
  await verDia(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(
    await page
      .getByRole("button", { name: "Salvar", exact: true })
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44);
  expect(foreign).toEqual([]);
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) throw Error("SW inativo");
    if (new URL(registration.scope).pathname !== "/")
      throw Error("escopo incorreto");
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBeTruthy();
  await context.setOffline(true);
  await page.reload();
  await verDia(page);
  await page.close();
  expect(context.pages()).toHaveLength(0);
  // Sem nenhuma página por 20 s: tempo suficiente para o navegador encerrar o SW.
  await new Promise((resolve) => setTimeout(resolve, 20_000));
  const reopened = await context.newPage();
  await reopened.goto(baseURL!);
  await verDia(reopened);
  expect(foreign).toEqual([]);
});
