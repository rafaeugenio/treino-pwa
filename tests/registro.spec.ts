import { test, expect, type Page } from "@playwright/test";

// CA01 (RAFA-176) na RAFA-182: atividade com data, nome e horas no dia certo,
// inclusive atividade substituta, e persistência ao fechar e reabrir.
async function registrar(page: Page, data: string, nome: string, horas: string) {
  await page.getByRole("textbox", { name: "Data", exact: true }).fill(data);
  await page.getByRole("textbox", { name: "Atividade", exact: true }).fill(nome);
  await page.getByRole("textbox", { name: "Horas", exact: true }).fill(horas);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
}
const lista = (page: Page) => page.getByTestId("atividades").getByRole("listitem");

test("registra atividades por dia e mantém depois de fechar e reabrir", async ({ page, context }) => {
  await page.goto("./#registro");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Registro");
  await registrar(page, "2026-11-24", "Vôlei", "1,5");
  await expect(page.getByRole("textbox", { name: "Atividade", exact: true })).toHaveValue("");
  await expect(lista(page)).toHaveText([/Vôlei\s*1,5 h/]);
  await registrar(page, "2026-11-24", "Flexões", "0.5");
  await registrar(page, "2026-11-23", "Futebol", "2");
  await expect(lista(page)).toHaveText([/Futebol\s*2 h/]);
  await page.getByRole("textbox", { name: "Data", exact: true }).fill("2026-11-24");
  await expect(lista(page)).toHaveText([/Vôlei\s*1,5 h/, /Flexões\s*0,5 h/]);
  await page.getByRole("textbox", { name: "Data", exact: true }).fill("2026-11-22");
  await expect(page.getByTestId("atividades")).toHaveCount(0);
  await expect(page.getByText("Nenhuma atividade")).toBeVisible();

  // Fecha o app e reabre numa página nova do mesmo aparelho.
  await page.close();
  const reaberta = await context.newPage();
  await reaberta.goto("./");
  await expect(reaberta.getByText("Atividades")).toBeVisible();
  await expect(reaberta.locator("section").getByText("3", { exact: true })).toBeVisible();
  await reaberta.getByRole("tab", { name: "Registro" }).click();
  await reaberta.getByRole("textbox", { name: "Data", exact: true }).fill("2026-11-24");
  await expect(lista(reaberta)).toHaveText([/Vôlei\s*1,5 h/, /Flexões\s*0,5 h/]);
  await reaberta.getByRole("textbox", { name: "Data", exact: true }).fill("2026-11-23");
  await expect(lista(reaberta)).toHaveText([/Futebol\s*2 h/]);
  expect(await reaberta.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test("abre no dia de hoje e recusa horas inválidas", async ({ page }) => {
  await page.goto("./#registro");
  const hoje = await page.evaluate(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
  await expect(page.getByRole("textbox", { name: "Data", exact: true })).toHaveValue(hoje);
  await page.getByRole("textbox", { name: "Atividade", exact: true }).fill("Vôlei");
  await page.getByRole("textbox", { name: "Horas", exact: true }).fill("abc");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Horas inválidas")).toBeVisible();
  await expect(page.getByTestId("atividades")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("treino-pwa:atividades:v1"))).toBeNull();
  for (const alvo of await page.locator("form input, form button").all()) {
    const box = (await alvo.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
});
