import { test, expect } from "@playwright/test";

// CA08 (RAFA-176), casco da RAFA-181: seis telas navegáveis em 390×844.
const TELAS = ["Início", "Registro", "Plano", "Dor", "Estatísticas", "Lembretes"];

test("casco percorre as seis telas com Board UI, toque de 44 px e sem rolagem horizontal", async ({ page }) => {
  await page.goto("./");
  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
  const tabs = page.getByRole("tablist", { name: "Telas" }).getByRole("tab");
  await expect(tabs).toHaveCount(TELAS.length);
  for (const [i, nome] of TELAS.entries()) {
    const tab = page.getByRole("tab", { name: nome, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    const panel = page.getByRole("tabpanel");
    await expect(panel).toHaveCount(1);
    // Tabs/TabPanel do Board UI (react-aria-components).
    await expect(panel).toHaveAttribute("data-rac", "");
    await expect(panel.getByRole("heading", { level: 1 })).toHaveText(nome);
    // Peças Board UI na tela: StatCards ou Input do Board UI.
    await expect(
      panel.locator("section.bg-background-secondary-default, [data-input-size]").first(),
    ).toBeVisible();
    // Sem subtítulo nem texto de ajuda.
    await expect(panel.locator('[slot="description"]')).toHaveCount(0);
    await expect(panel.locator("h1 + p")).toHaveCount(0);
    // Alvos de toque.
    const alvos = page.locator('[role="tab"], main button:visible, main input:visible');
    for (const box of await alvos.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height, id: el.getAttribute("aria-label") ?? el.textContent };
      }),
    )) {
      expect(box.w, `${nome}: largura de ${box.id}`).toBeGreaterThanOrEqual(44);
      expect(box.h, `${nome}: altura de ${box.id}`).toBeGreaterThanOrEqual(44);
    }
    // Sem rolagem horizontal.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    // Conteúdo termina acima da barra fixa e dentro da tela.
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const { navTop, navBottom, contentBottom } = await page.evaluate(() => {
      const nav = document.querySelector(".app-nav")!.getBoundingClientRect();
      const panel = document.querySelector('[role="tabpanel"]')!.getBoundingClientRect();
      return { navTop: nav.top, navBottom: nav.bottom, contentBottom: panel.bottom };
    });
    expect(contentBottom, `${nome}: conteúdo sob a barra`).toBeLessThanOrEqual(navTop);
    expect(navBottom).toBeLessThanOrEqual(844);
    // Hash leva direto à tela.
    await expect(page).toHaveURL(i === 0 ? /\/$/ : new RegExp(`#[a-z]+$`));
  }
  await page.reload();
  await expect(page.getByRole("tab", { name: "Lembretes" })).toHaveAttribute("aria-selected", "true");
});

test("safe areas aplicadas no casco", async ({ page }) => {
  await page.goto("./");
  const css = await page.evaluate(() =>
    [...document.styleSheets]
      .flatMap((s) => [...s.cssRules])
      .map((r) => r.cssText)
      .join("\n"),
  );
  for (const lado of ["top", "right", "bottom", "left"])
    expect(css).toContain(`env(safe-area-inset-${lado})`);
  const nav = await page.locator(".app-nav").evaluate((el) => {
    const s = getComputedStyle(el);
    return { position: s.position, bottom: s.bottom };
  });
  expect(nav).toEqual({ position: "fixed", bottom: "0px" });
});
