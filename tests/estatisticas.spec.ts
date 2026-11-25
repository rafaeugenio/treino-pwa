import { test, expect, type Page } from "@playwright/test";

// CA01 a CA05 da RAFA-185: estatísticas de horas e progresso do plano, com o
// "hoje" do aparelho controlado pelo relógio do Playwright.
const D = "2026-11-24";
const ATIVIDADES = "treino-pwa:atividades:v1";
const PLANO = "treino-pwa:plano:v1";

const tab = (page: Page, nome: string) => page.getByRole("tab", { name: nome, exact: true }).click();
const painel = (page: Page) => page.getByRole("tabpanel");
const treinos = (page: Page) => painel(page).locator("section", { hasText: "Treinos" });
const plano = (page: Page) => page.getByTestId("horas-plano").getByRole("listitem");
const livres = (page: Page) => page.getByTestId("horas-livres").getByRole("listitem");

let n = 0;
const reg = (nome: string, horas: number, data = D) => ({ id: `r${n++}`, data, nome, horas });

async function abrir(page: Page, salvo: Record<string, unknown> = {}, hash = "#estatisticas") {
  await page.clock.setFixedTime(new Date(`${D}T10:00:00`));
  await page.goto("./");
  await page.evaluate((itens) => {
    localStorage.clear();
    for (const [chave, valor] of Object.entries(itens))
      localStorage.setItem(chave, typeof valor === "string" ? valor : JSON.stringify(valor));
  }, salvo);
  await page.goto(`./${hash}`);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function semRolagemEAlvos(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  for (const alvo of await page.locator('[role="tab"], main button:visible, main input:visible').all()) {
    const box = (await alvo.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
}

// CA05: o que a tela mostra bate com a soma dos registros salvos no aparelho.
async function conferirComSalvo(page: Page) {
  const salvo = await page.evaluate((chave) => JSON.parse(localStorage.getItem(chave) ?? "[]"), ATIVIDADES);
  const nomesPlano = new Set(Array.from({ length: 28 }, (_, i) => `Treino ${i + 1}`));
  let somaPlano = 0;
  const somaLivres = new Map<string, number>();
  for (const { nome, horas } of salvo as { nome: string; horas: number }[]) {
    const c = Math.round(horas * 100);
    if (nomesPlano.has(nome)) somaPlano += c;
    else somaLivres.set(nome, (somaLivres.get(nome) ?? 0) + c);
  }
  const fmt = (c: number) => `${(c / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} h`;
  const linha = (nome: string, c: number) =>
    new RegExp(`^${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*${fmt(c)}$`);
  if (somaPlano) await expect(plano(page)).toHaveText([linha("Plano de calistenia", somaPlano)]);
  else await expect(page.getByTestId("horas-plano")).toHaveCount(0);
  const esperadas = [...somaLivres]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b, "pt-BR"))
    .map(([nome, c]) => linha(nome, c));
  if (esperadas.length) await expect(livres(page)).toHaveText(esperadas);
  else await expect(page.getByTestId("horas-livres")).toHaveCount(0);
}

test("CA01: horas por atividade, do maior para o menor, com vírgula", async ({ page }) => {
  await abrir(page, {
    [ATIVIDADES]: [reg("Futebol", 2, "2026-11-22"), reg("Vôlei", 1.5, "2026-11-23"), reg("Vôlei", 2, D)],
  });
  await expect(livres(page)).toHaveText([/^Vôlei\s*3,5 h$/, /^Futebol\s*2 h$/]);
  await expect(page.getByTestId("horas-plano")).toHaveCount(0);
  await semRolagemEAlvos(page);
});

test("CA02: treinos do plano numa linha Plano de calistenia, acima das livres", async ({ page }) => {
  await abrir(page, {
    [ATIVIDADES]: [
      reg("Treino 1", 1, "2026-10-01"), // plano anterior ao Recomeçar
      reg("Vôlei", 2, "2026-11-22"),
      reg("Treino 1", 1.5, "2026-11-23"),
      reg("Treino 3", 0.5, D), // digitado no Registro
      reg("Treino 29", 1, D), // nome fora da lista: atividade livre
    ],
  });
  await expect(plano(page)).toHaveText([/^Plano de calistenia\s*3 h$/]);
  await expect(livres(page)).toHaveText([/^Vôlei\s*2 h$/, /^Treino 29\s*1 h$/]);
  const topoPlano = (await page.getByTestId("horas-plano").boundingBox())!.y;
  const topoLivres = (await page.getByTestId("horas-livres").boundingBox())!.y;
  expect(topoPlano).toBeLessThan(topoLivres);
  await semRolagemEAlvos(page);
});

test("CA03: K de 28, sem contar dias deslizados", async ({ page }) => {
  // Treino 1 em 20/11 e Treino 2 em 23/11: 21 e 22 deslizaram.
  await abrir(page, {
    [PLANO]: { inicio: "2026-11-20", feitos: ["2026-11-20", "2026-11-23"] },
    [ATIVIDADES]: [reg("Treino 1", 1, "2026-11-20"), reg("Treino 2", 1, "2026-11-23")],
  });
  await expect(treinos(page)).toContainText(/2\s*de 28/);
  await expect(plano(page)).toHaveText([/^Plano de calistenia\s*2 h$/]);
});

test("CA03: plano ilegível mostra 0 de 28", async ({ page }) => {
  await abrir(page, { [PLANO]: "{corrompido" });
  await expect(treinos(page)).toContainText(/0\s*de 28/);
});

test("CA04: sem dados abre sem erro, sem linhas, com 0 de 28 e sem texto de ajuda", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  await abrir(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Estatísticas");
  await expect(treinos(page)).toContainText(/0\s*de 28/);
  await expect(painel(page).getByRole("listitem")).toHaveCount(0);
  await expect(painel(page).locator('section[aria-label="Horas"]')).toHaveCount(0);
  // Só o título e o StatCards: nenhum texto de ajuda nem estado vazio.
  await expect(painel(page)).toHaveText(/^Estatísticas\s*Treinos\s*0\s*de 28$/);
  await expect(painel(page).locator('[slot="description"]')).toHaveCount(0);
  expect(erros).toEqual([]);
  await semRolagemEAlvos(page);
});

test("CA05: registro novo e treino feito entram nos totais sem recarregar", async ({ page }) => {
  await abrir(page, { [ATIVIDADES]: [reg("Vôlei", 1.5, "2026-11-23")] }, "#plano");
  await page.getByRole("textbox", { name: "Início", exact: true }).fill(D);
  await page.getByRole("button", { name: "Iniciar", exact: true }).click();

  await tab(page, "Estatísticas");
  await expect(treinos(page)).toContainText(/0\s*de 28/);
  await expect(livres(page)).toHaveText([/^Vôlei\s*1,5 h$/]);
  await conferirComSalvo(page);

  // Registro novo, sem recarregar.
  await tab(page, "Registro");
  await page.getByRole("textbox", { name: "Atividade", exact: true }).fill("Futebol");
  await page.getByRole("textbox", { name: "Horas", exact: true }).fill("2");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByTestId("atividades").getByRole("listitem")).toHaveText([/Futebol\s*2 h/]);
  await tab(page, "Estatísticas");
  await expect(livres(page)).toHaveText([/^Futebol\s*2 h$/, /^Vôlei\s*1,5 h$/]);
  await conferirComSalvo(page);

  // Treino do dia marcado como feito, sem recarregar.
  await tab(page, "Início");
  await page.getByRole("textbox", { name: "Horas", exact: true }).fill("0,75");
  await page.getByRole("button", { name: "Feito", exact: true }).click();
  await expect(page.getByRole("button", { name: "Feito", exact: true })).toHaveCount(0);
  await tab(page, "Estatísticas");
  await expect(treinos(page)).toContainText(/1\s*de 28/);
  await expect(plano(page)).toHaveText([/^Plano de calistenia\s*0,75 h$/]);
  await expect(livres(page)).toHaveText([/^Futebol\s*2 h$/, /^Vôlei\s*1,5 h$/]);
  await conferirComSalvo(page);
  await semRolagemEAlvos(page);
});
