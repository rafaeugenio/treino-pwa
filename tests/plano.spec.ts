import { test, expect, type Page } from "@playwright/test";

// CA02 e CA03 (RAFA-176) na RAFA-183: plano de 28 dias e deslize, com o "hoje"
// do aparelho controlado pelo relógio do Playwright.
const em = (dia: string) => new Date(`${dia}T10:00:00`);
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
function somar(dia: string, n: number) {
  const [a, m, d] = dia.split("-").map(Number);
  const data = new Date(a, m - 1, d + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}
const D = "2026-11-24";

const hojeCard = (page: Page) => page.locator("section", { hasText: "Hoje" });
const linhas = (page: Page) => page.getByTestId("plano").getByRole("listitem");
const horas = (page: Page) => page.getByRole("textbox", { name: "Horas", exact: true });
const feito = (page: Page) => page.getByRole("button", { name: "Feito", exact: true });
const tab = (page: Page, nome: string) => page.getByRole("tab", { name: nome, exact: true }).click();

async function iniciar(page: Page, inicio: string) {
  await page.goto("./#plano");
  await page.getByRole("textbox", { name: "Início", exact: true }).fill(inicio);
  await page.getByRole("button", { name: "Iniciar", exact: true }).click();
  await expect(linhas(page)).toHaveCount(28);
}
async function abrirEm(page: Page, dia: string, hash = "") {
  await page.clock.setFixedTime(em(dia));
  await page.goto(`./${hash}`);
}
async function conferirAgenda(page: Page, primeiro: number, dia: string) {
  await tab(page, "Plano");
  const lista = linhas(page);
  await expect(lista).toHaveCount(28);
  for (let n = primeiro; n <= 28; n++)
    await expect(lista.nth(n - 1)).toHaveText(new RegExp(`^Treino ${n}\\s*${ddmm(somar(dia, n - primeiro))}$`));
}
async function semRolagemEAlvos(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  for (const alvo of await page.locator("main form input, main form button").all()) {
    const box = (await alvo.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
}

test("CA02: inicia em D, mostra 1 a 28 em dias seguidos e marca o treino de hoje com horas", async ({ page }) => {
  await abrirEm(page, D, "#plano");
  await expect(page.getByRole("textbox", { name: "Início", exact: true })).toHaveValue(D);
  await semRolagemEAlvos(page);
  await iniciar(page, D);
  await conferirAgenda(page, 1, D);
  await expect(linhas(page).first()).toHaveAttribute("aria-current", "date");
  await expect(page.locator("section", { hasText: "Feitos" })).toContainText(/0\s*de 28/);
  await semRolagemEAlvos(page);

  await tab(page, "Início");
  await expect(hojeCard(page)).toContainText(/Treino 1\s*de 28/);
  await semRolagemEAlvos(page);
  await horas(page).fill("1,5");
  await feito(page).click();
  await expect(hojeCard(page)).toContainText(/Treino 1\s*Feito/);
  await expect(feito(page)).toHaveCount(0);

  await tab(page, "Registro");
  await page.getByRole("textbox", { name: "Data", exact: true }).fill(D);
  await expect(page.getByTestId("atividades").getByRole("listitem")).toHaveText([/Treino 1\s*1,5 h/]);
  await tab(page, "Plano");
  await expect(page.locator("section", { hasText: "Feitos" })).toContainText(/1\s*de 28/);
  await expect(linhas(page).first()).toHaveText(new RegExp(`^Treino 1\\s*Feito\\s*${ddmm(D)}$`));

  // Dia seguinte: o progresso avançou para o Treino 2, sem deslize.
  await abrirEm(page, somar(D, 1));
  await expect(hojeCard(page)).toContainText(/Treino 2\s*de 28/);
  await conferirAgenda(page, 2, somar(D, 1));
  await expect(linhas(page).nth(27)).toContainText(ddmm(somar(D, 27)));
});

test("CA03: atividade substituta no dia previsto desliza o plano e fica no histórico", async ({ page }) => {
  await abrirEm(page, D);
  await iniciar(page, D);
  await tab(page, "Registro");
  await page.getByRole("textbox", { name: "Data", exact: true }).fill(D);
  await page.getByRole("textbox", { name: "Atividade", exact: true }).fill("Futebol");
  await horas(page).fill("2");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await tab(page, "Início");
  await expect(hojeCard(page)).toContainText(/Treino 1\s*de 28/);

  // O dia termina sem o Treino 1: ele vai para 25/11 e o 28 para 22/12.
  await abrirEm(page, somar(D, 1));
  await expect(hojeCard(page)).toContainText(/Treino 1\s*de 28/);
  await conferirAgenda(page, 1, somar(D, 1));
  await expect(linhas(page).nth(27)).toContainText(ddmm(somar(D, 28)));
  await tab(page, "Registro");
  await page.getByRole("textbox", { name: "Data", exact: true }).fill(D);
  await expect(page.getByTestId("atividades").getByRole("listitem")).toHaveText([/Futebol\s*2 h/]);
});

test("CA03: dias sem registro deslizam o treino pendente, um dia por dia", async ({ page }) => {
  await abrirEm(page, D);
  await iniciar(page, D);
  await tab(page, "Início");
  await horas(page).fill("1");
  await feito(page).click();
  await expect(hojeCard(page)).toContainText(/Treino 1\s*Feito/);

  // 25 e 26 passam sem nada registrado; o app abre em 27/11.
  await abrirEm(page, somar(D, 3));
  await expect(hojeCard(page)).toContainText(/Treino 2\s*de 28/);
  await conferirAgenda(page, 2, somar(D, 3));
  await expect(linhas(page).first()).toHaveText(new RegExp(`^Treino 1\\s*Feito\\s*${ddmm(D)}$`));
  await expect(linhas(page).nth(27)).toContainText(ddmm(somar(D, 29)));
  await semRolagemEAlvos(page);
});

test("o dia muda ao voltar o app ao primeiro plano", async ({ page }) => {
  await abrirEm(page, D);
  await iniciar(page, D);
  await tab(page, "Início");
  await horas(page).fill("1");
  await feito(page).click();
  await expect(hojeCard(page)).toContainText(/Treino 1\s*Feito/);
  await page.clock.setFixedTime(em(somar(D, 1)));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(hojeCard(page)).toContainText(/Treino 2\s*de 28/);
  await expect(feito(page)).toBeVisible();
});

test("plano com início futuro não tem treino hoje", async ({ page }) => {
  await abrirEm(page, D);
  await iniciar(page, somar(D, 2));
  await conferirAgenda(page, 1, somar(D, 2));
  await tab(page, "Início");
  await expect(hojeCard(page)).toContainText(/—\s*de 28/);
  await expect(feito(page)).toHaveCount(0);
});

async function erroNoCampo(page: Page, campo: string, erro: string) {
  const input = page.getByRole("textbox", { name: campo, exact: true });
  await expect(input).toHaveAttribute("aria-invalid", "true");
  const mensagem = page.getByText(erro, { exact: true });
  await expect(mensagem).toBeVisible();
  const id = await mensagem.getAttribute("id");
  expect(id).toBeTruthy();
  expect((await input.getAttribute("aria-describedby"))?.split(" ")).toContain(id);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Não foi possível salvar neste dispositivo.")).toHaveCount(0);
}

test("recusa horas que arredondam para zero ao marcar o treino, com erro no campo", async ({ page }) => {
  await abrirEm(page, D);
  await iniciar(page, D);
  await tab(page, "Início");
  await horas(page).fill("0,001");
  await feito(page).click();
  await erroNoCampo(page, "Horas", "Horas inválidas");
  await expect(hojeCard(page)).toContainText(/Treino 1\s*de 28/);
  expect(await page.evaluate(() => localStorage.getItem("treino-pwa:atividades:v1"))).toBeNull();
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem("treino-pwa:plano:v1")))!)).toEqual({
    inicio: D,
    feitos: [],
  });
});

test("recusa iniciar sem data, com erro no campo", async ({ page }) => {
  await abrirEm(page, D, "#plano");
  await page.getByRole("textbox", { name: "Início", exact: true }).fill("");
  await page.getByRole("button", { name: "Iniciar", exact: true }).click();
  await erroNoCampo(page, "Início", "Informe a data");
  await expect(page.getByTestId("plano")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("treino-pwa:plano:v1"))).toBeNull();
});
