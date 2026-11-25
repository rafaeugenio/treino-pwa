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

// Casos de borda da RAFA-183 (CA03-B1, B2 e B3), card RAFA-183, 24/11/2026 21:50.
const KEY_PLANO = "treino-pwa:plano:v1";
const KEY_ATIVIDADES = "treino-pwa:atividades:v1";
const lerChave = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const semAlerta = async (page: Page) => {
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Não foi possível salvar neste dispositivo.")).toHaveCount(0);
};

test("CA03-B1: plano iniciado não oferece reiniciar nem trocar a data D", async ({ page }) => {
  await abrirEm(page, D);
  await iniciar(page, D);
  for (const etapa of ["logo após iniciar", "após reabrir"]) {
    if (etapa === "após reabrir") await abrirEm(page, somar(D, 1), "#plano");
    const painel = page.getByRole("tabpanel");
    await expect(painel.getByTestId("plano"), etapa).toBeVisible();
    await expect(painel.getByRole("textbox"), etapa).toHaveCount(0);
    await expect(painel.getByRole("button"), etapa).toHaveCount(0);
  }
});

test("CA03-B2: Feito depois da meia-noite vale o dia novo, já deslizado, sem alerta", async ({ page }) => {
  await abrirEm(page, "2026-11-23");
  await iniciar(page, "2026-11-23");
  await tab(page, "Início");
  await horas(page).fill("1");
  await feito(page).click();
  // App aberto desde antes da meia-noite de 24/11, com o Treino 2 previsto.
  await page.clock.setFixedTime(new Date("2026-11-24T23:59:30"));
  await page.reload();
  await expect(hojeCard(page)).toContainText(/Treino 2\s*de 28/);
  await horas(page).fill("1,5");
  await page.clock.setFixedTime(new Date("2026-11-25T00:00:30"));
  await feito(page).click();
  await expect(hojeCard(page)).toContainText(/Treino 2\s*Feito/);
  await semAlerta(page);
  expect(JSON.parse((await lerChave(page, KEY_PLANO))!)).toEqual({
    inicio: "2026-11-23",
    feitos: ["2026-11-23", "2026-11-25"],
  });
  expect(JSON.parse((await lerChave(page, KEY_ATIVIDADES))!).map((a: { data: string; nome: string; horas: number }) => [a.data, a.nome, a.horas])).toEqual([
    ["2026-11-23", "Treino 1", 1],
    ["2026-11-25", "Treino 2", 1.5],
  ]);
  await tab(page, "Plano");
  await expect(linhas(page).nth(1)).toHaveText(/^Treino 2\s*Feito\s*25\/11$/);
  await expect(linhas(page).nth(1)).toHaveAttribute("aria-current", "date");
  await expect(linhas(page).nth(27)).toContainText("21/12");
});

test("CA03-B2: plano encerrado antes do toque depois da meia-noite, o Feito some sem alerta", async ({ page, context }) => {
  // 27 treinos feitos de 28/10 a 23/11; o Treino 28 está previsto para 24/11.
  const inicio = "2026-10-28";
  await abrirEm(page, D);
  await page.evaluate(
    ([k, v]) => localStorage.setItem(k, v),
    [KEY_PLANO, JSON.stringify({ inicio, feitos: Array.from({ length: 27 }, (_, i) => somar(inicio, i)) })],
  );
  await page.clock.setFixedTime(new Date("2026-11-24T23:59:00"));
  await page.reload();
  await expect(hojeCard(page)).toContainText(/Treino 28\s*de 28/);
  await horas(page).fill("1");
  // Outra aba do aparelho termina o plano antes da meia-noite.
  const outra = await context.newPage();
  await outra.goto("./");
  await outra.getByRole("textbox", { name: "Horas", exact: true }).fill("2");
  await outra.getByRole("button", { name: "Feito", exact: true }).click();
  await expect(hojeCard(outra)).toContainText(/Treino 28\s*Feito/);
  await outra.close();
  await page.clock.setFixedTime(new Date("2026-11-25T00:00:30"));
  await feito(page).click();
  await expect(feito(page)).toHaveCount(0);
  await expect(hojeCard(page)).toContainText(/—\s*de 28/);
  await semAlerta(page);
  expect(JSON.parse((await lerChave(page, KEY_ATIVIDADES))!)).toHaveLength(1);
});

test("CA03-B2: o toque relê o plano do aparelho e não repete o treino feito em outra aba", async ({ page, context }) => {
  await abrirEm(page, D);
  await iniciar(page, D);
  await tab(page, "Início");
  await horas(page).fill("2");
  const outra = await context.newPage();
  await outra.goto("./");
  await outra.getByRole("textbox", { name: "Horas", exact: true }).fill("1");
  await outra.getByRole("button", { name: "Feito", exact: true }).click();
  await expect(hojeCard(outra)).toContainText(/Treino 1\s*Feito/);
  await outra.close();
  await feito(page).click();
  await expect(hojeCard(page)).toContainText(/Treino 1\s*Feito/);
  await expect(feito(page)).toHaveCount(0);
  await semAlerta(page);
  expect(JSON.parse((await lerChave(page, KEY_ATIVIDADES))!)).toHaveLength(1);
});

async function abrirCorrompido(page: Page) {
  await abrirEm(page, D);
  await page.evaluate((k) => localStorage.setItem(k, "{"), KEY_PLANO);
  await page.reload();
}
const recomecar = (page: Page) => page.getByRole("button", { name: "Recomeçar plano", exact: true });

test("CA03-B3: plano corrompido mostra Recomeçar plano ao abrir o app, sem alerta e sem apagar", async ({ page }) => {
  await abrirCorrompido(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Início");
  await expect(recomecar(page)).toBeVisible();
  await semAlerta(page);
  await semRolagemEAlvos(page);
  expect(await lerChave(page, KEY_PLANO)).toBe("{");
});

test("CA03-B3: na tela Plano, Recomeçar plano fica no lugar de Iniciar", async ({ page }) => {
  await abrirCorrompido(page);
  await tab(page, "Plano");
  await expect(recomecar(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Iniciar", exact: true })).toHaveCount(0);
  await semAlerta(page);
  expect(await lerChave(page, KEY_PLANO)).toBe("{");
});

test("CA03-B3: Recomeçar plano pede confirmação e Cancelar não grava nada", async ({ page }) => {
  await abrirCorrompido(page);
  await recomecar(page).click();
  await expect(page.getByRole("button", { name: "Confirmar", exact: true })).toBeVisible();
  for (const alvo of await page.locator("main button").all()) {
    const box = (await alvo.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect(await lerChave(page, KEY_PLANO)).toBe("{");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(recomecar(page)).toBeVisible();
  expect(await lerChave(page, KEY_PLANO)).toBe("{");
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes(":backup:")))).toEqual([]);
});

test("CA03-B3: confirmar guarda o conteúdo inválido em backup e o plano novo começa hoje", async ({ page }) => {
  await abrirCorrompido(page);
  await page.evaluate((k) => localStorage.setItem(k, "[]"), KEY_ATIVIDADES);
  await tab(page, "Plano");
  await recomecar(page).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(linhas(page)).toHaveCount(28);
  await semAlerta(page);
  await conferirAgenda(page, 1, D);
  await expect(linhas(page).first()).toHaveAttribute("aria-current", "date");
  const backups = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith("treino-pwa:plano:v1:backup:"))
      .map((k) => localStorage.getItem(k)),
  );
  expect(backups).toEqual(["{"]);
  expect(JSON.parse((await lerChave(page, KEY_PLANO))!)).toEqual({ inicio: D, feitos: [] });
  expect(await lerChave(page, KEY_ATIVIDADES)).toBe("[]");
  await tab(page, "Início");
  await expect(hojeCard(page)).toContainText(/Treino 1\s*de 28/);
  await expect(recomecar(page)).toHaveCount(0);
});

// Ajustes Bari r1 (review 6050114781): o segundo gesto nunca confirma e o foco volta ao Recomeçar.
async function nadaGravado(page: Page) {
  await expect(page.getByTestId("plano")).toHaveCount(0);
  expect(await lerChave(page, KEY_PLANO)).toBe("{");
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes(":backup:")))).toEqual([]);
  await expect(
    page.getByRole("button", { name: /^(Recomeçar plano|Cancelar)$/ }).first(),
  ).toBeVisible();
  await semAlerta(page);
}
async function abrirCorrompidoNoPlano(page: Page) {
  await abrirCorrompido(page);
  await tab(page, "Plano");
  await expect(recomecar(page)).toBeVisible();
}

test("CA03-B3: dblclick no Recomeçar plano não confirma", async ({ page }) => {
  await abrirCorrompidoNoPlano(page);
  await recomecar(page).dblclick();
  await expect(page.getByRole("heading", { name: "Recomeçar plano?" })).toBeVisible();
  await nadaGravado(page);
});

test("CA03-B3: dois toques rápidos no Recomeçar plano não confirmam", async ({ page }) => {
  await abrirCorrompidoNoPlano(page);
  const box = (await recomecar(page).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(150);
  await page.touchscreen.tap(x, y);
  await expect(page.getByRole("heading", { name: "Recomeçar plano?" })).toBeVisible();
  await nadaGravado(page);
});

test("CA03-B3: Enter duas vezes no Recomeçar plano não confirma", async ({ page }) => {
  await abrirCorrompidoNoPlano(page);
  await recomecar(page).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await nadaGravado(page);
});

test("CA03-B3: Cancelar devolve o foco ao Recomeçar plano", async ({ page }) => {
  await abrirCorrompidoNoPlano(page);
  await recomecar(page).click();
  const cancelar = page.getByRole("button", { name: "Cancelar", exact: true });
  await expect(cancelar).toBeFocused();
  await cancelar.click();
  await expect(recomecar(page)).toBeFocused();
});

test("CA03-B3: a confirmação tem o título Recomeçar plano? para o leitor de tela", async ({ page }) => {
  await abrirCorrompidoNoPlano(page);
  await recomecar(page).click();
  await expect(page.getByRole("heading", { level: 2, name: "Recomeçar plano?" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Recomeçar plano?" })).toBeVisible();
  await expect(page.getByRole("tabpanel").locator("p")).toHaveCount(0);
  // Follow-up Bari: o Cancelar, que recebe o foco, é descrito pelo título.
  const cancelar = page.getByRole("button", { name: "Cancelar", exact: true });
  await expect(cancelar).toHaveAttribute("aria-describedby", "recomecar-titulo");
  await expect(cancelar).toHaveAccessibleDescription("Recomeçar plano?");
});
