import { test, expect, type Locator, type Page } from "@playwright/test";

// CA04 (RAFA-176), CA04-1 a CA04-4 da RAFA-184: dor ou desconforto do dia na
// tela Dor e o histórico dos dias com dor, com o "hoje" do relógio do Playwright.
const KEY_DOR = "treino-pwa:dor:v1";
const KEY_ATIVIDADES = "treino-pwa:atividades:v1";
const HOJE = "2026-11-24";

const data = (page: Page) => page.getByRole("textbox", { name: "Data", exact: true });
const texto = (page: Page) => page.getByRole("textbox", { name: "Texto", exact: true });
const icone = (page: Page, nome: string) =>
  page.getByRole("group", { name: "Ícones" }).getByRole("button", { name: nome, exact: true });
const salvar = (page: Page) => page.getByRole("button", { name: "Salvar", exact: true });
const dias = (page: Page) => page.getByTestId("historico").locator(":scope > li");
const lerDor = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY_DOR);
const anotacoes = async (page: Page) => JSON.parse((await lerDor(page)) ?? "[]") as unknown[];

async function abrir(page: Page) {
  await page.clock.setFixedTime(new Date(`${HOJE}T10:00:00`));
  await page.goto("./#dor");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dor");
}
async function anotar(page: Page, dia: string, marcados: string[], escrito = "") {
  await data(page).fill(dia);
  for (const nome of marcados) await icone(page, nome).click();
  await texto(page).fill(escrito);
  await salvar(page).click();
}
async function nadaGravado(page: Page) {
  expect(await lerDor(page)).toBeNull();
  await expect(page.getByTestId("historico")).toHaveCount(0);
  await expect(page.getByText("Nenhuma dor", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Não foi possível salvar neste dispositivo.")).toHaveCount(0);
}
async function semRolagemEAlvos(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  for (const alvo of await page.locator("main form input, main form button").all()) {
    const box = (await alvo.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
}

test("CA04-1 e CA04-3: anota a dor de hoje sem atividade, duas no mesmo dia, e mantém ao reabrir", async ({
  page,
  context,
}) => {
  await abrir(page);
  await expect(data(page)).toHaveValue(HOJE);
  await expect(page.getByText("Nenhuma dor", { exact: true })).toBeVisible();
  await icone(page, "Dor muscular").click();
  await icone(page, "Dor nas costas").click();
  await expect(icone(page, "Dor muscular")).toHaveAttribute("aria-pressed", "true");
  await icone(page, "Dor muscular").click();
  await expect(icone(page, "Dor muscular")).toHaveAttribute("aria-pressed", "false");
  await icone(page, "Dor muscular").click();
  await salvar(page).click();
  // Formulário limpo para a próxima anotação; a data fica.
  await expect(icone(page, "Dor muscular")).toHaveAttribute("aria-pressed", "false");
  await expect(icone(page, "Dor nas costas")).toHaveAttribute("aria-pressed", "false");
  await expect(data(page)).toHaveValue(HOJE);
  await expect(dias(page)).toHaveText([/^24\/11\/2026\s*Dor muscular\s*Dor nas costas$/]);

  // CA04-3: outra anotação no mesmo dia, só com texto livre.
  await anotar(page, HOJE, [], "ombro deslocado");
  await expect(texto(page)).toHaveValue("");
  await expect(dias(page)).toHaveCount(1);
  await expect(dias(page).first().getByRole("listitem")).toHaveText([
    /^Dor muscular\s*Dor nas costas$/,
    /^ombro deslocado$/,
  ]);
  // Sem atividade registrada no dia.
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY_ATIVIDADES)).toBeNull();
  expect(await anotacoes(page)).toHaveLength(2);
  await semRolagemEAlvos(page);

  // Fecha o app e reabre numa página nova do mesmo aparelho.
  await page.close();
  const reaberta = await context.newPage();
  await reaberta.goto("./");
  await reaberta.getByRole("tab", { name: "Dor", exact: true }).click();
  await expect(dias(reaberta)).toHaveCount(1);
  await expect(dias(reaberta).first().getByRole("listitem")).toHaveText([
    /^Dor muscular\s*Dor nas costas$/,
    /^ombro deslocado$/,
  ]);
  await expect(reaberta.getByRole("alert")).toHaveCount(0);
});

test("CA04-1: anota numa data escolhida que tem atividade, ícone e texto juntos", async ({ page }) => {
  await abrir(page);
  await page.evaluate(
    ([k]) => localStorage.setItem(k, JSON.stringify([{ id: "a", data: "2026-11-20", nome: "Vôlei", horas: 1 }])),
    [KEY_ATIVIDADES],
  );
  await anotar(page, "2026-11-20", ["Cãibra"], "panturrilha");
  await expect(dias(page)).toHaveText([/^20\/11\/2026\s*Cãibra\s*panturrilha$/]);
  expect(await anotacoes(page)).toEqual([
    expect.objectContaining({ data: "2026-11-20", icones: ["caibra"], texto: "panturrilha" }),
  ]);
});

test("CA04-4: histórico só com os dias com dor, do mais recente ao mais antigo", async ({ page }) => {
  await abrir(page);
  await anotar(page, "2026-11-10", ["Dor articular"]);
  await anotar(page, "2026-11-23", ["Falta de ar ou tontura", "Outro"], "subida");
  await anotar(page, "2025-12-31", [], "joelho");
  await anotar(page, "2026-11-10", [], "tornozelo");
  await expect(dias(page)).toHaveText([
    /^23\/11\/2026\s*Falta de ar ou tontura\s*Outro\s*subida$/,
    /^10\/11\/2026\s*Dor articular\s*tornozelo$/,
    /^31\/12\/2025\s*joelho$/,
  ]);
  // Dias sem dor (ex.: 24/11 e 11/11) não aparecem.
  await expect(page.getByTestId("historico").getByText("24/11/2026")).toHaveCount(0);
  await semRolagemEAlvos(page);
});

test("CA04-2: sem ícone e sem texto nada é gravado, com erro no campo", async ({ page }) => {
  await abrir(page);
  await salvar(page).click();
  await expect(texto(page)).toHaveAttribute("aria-invalid", "true");
  const erro = page.getByText("Marque ou escreva a dor", { exact: true });
  await expect(erro).toBeVisible();
  const erroId = await erro.getAttribute("id");
  expect(erroId).toBeTruthy();
  expect((await texto(page).getAttribute("aria-describedby"))?.split(" ")).toContain(erroId);
  await nadaGravado(page);
  // Marcar um ícone tira o erro.
  await icone(page, "Outro").click();
  await expect(texto(page)).not.toHaveAttribute("aria-invalid", "true");
  await expect(erro).toHaveCount(0);
});

test("CA04-2: texto só com espaços também não grava", async ({ page }) => {
  await abrir(page);
  await anotar(page, HOJE, [], "   ");
  await expect(texto(page)).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Marque ou escreva a dor", { exact: true })).toBeVisible();
  await nadaGravado(page);
});

test("CA04-2: ícone marcado e desmarcado conta como nada marcado", async ({ page }) => {
  await abrir(page);
  await icone(page, "Cãibra").click();
  await icone(page, "Cãibra").click();
  await salvar(page).click();
  await expect(texto(page)).toHaveAttribute("aria-invalid", "true");
  await nadaGravado(page);
});

test("recusa salvar sem data, com erro no campo", async ({ page }) => {
  await abrir(page);
  await anotar(page, "", ["Outro"]);
  await expect(data(page)).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Informe a data", { exact: true })).toBeVisible();
  await nadaGravado(page);
});

// Gesto repetido no Salvar: a segunda parte encontra o formulário limpo e não
// grava uma anotação vazia nem repete a anterior.
for (const caso of [
  {
    titulo: "dblclick",
    gesto: async (page: Page) => salvar(page).dblclick(),
  },
  {
    titulo: "dois toques rápidos",
    gesto: async (page: Page) => {
      const box = (await salvar(page).boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(150);
      await page.touchscreen.tap(x, y);
    },
  },
  {
    titulo: "Enter duas vezes",
    gesto: async (page: Page) => {
      await texto(page).focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
    },
  },
]) {
  test(`${caso.titulo} no Salvar grava uma anotação só`, async ({ page }) => {
    await abrir(page);
    await icone(page, "Dor muscular").click();
    await texto(page).fill("coxa");
    await caso.gesto(page);
    await expect(dias(page)).toHaveText([/^24\/11\/2026\s*Dor muscular\s*coxa$/]);
    expect(await anotacoes(page)).toHaveLength(1);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}

test("conteúdo salvo ilegível não é sobrescrito e mostra o alerta de dispositivo", async ({ page }) => {
  await abrir(page);
  await page.evaluate((k) => localStorage.setItem(k, "{"), KEY_DOR);
  await page.reload();
  await expect(page.getByText("Nenhuma dor", { exact: true })).toBeVisible();
  await anotar(page, HOJE, ["Outro"]);
  await expect(page.getByRole("alert")).toHaveText("Não foi possível salvar neste dispositivo.");
  expect(await lerDor(page)).toBe("{");
});

// CA03 (RAFA-228): chave de dor ilegível, Recomeçar anotações de dor com
// confirmação (lição 12) e backup antes de gravar a lista nova.
const recomecar = (page: Page) => page.getByRole("button", { name: "Recomeçar anotações de dor", exact: true });
const tituloConfirmacao = (page: Page) =>
  page.getByRole("heading", { level: 2, name: "Recomeçar anotações de dor?" });
const backupsDor = (page: Page) =>
  page.evaluate(
    (k) =>
      Object.keys(localStorage)
        .filter((c) => c.startsWith(`${k}:backup:`))
        .map((c) => localStorage.getItem(c)),
    KEY_DOR,
  );
async function abrirIlegivel(page: Page, bruto = "{") {
  await abrir(page);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY_DOR, bruto]);
  await page.reload();
  await expect(recomecar(page)).toBeVisible();
}
async function nadaRecomecado(page: Page) {
  expect(await lerDor(page)).toBe("{");
  expect(await backupsDor(page)).toEqual([]);
  await expect(page.getByRole("alert")).toHaveCount(0);
}

test("CA03: chave ilegível mostra Recomeçar anotações de dor ao abrir, sem alerta e sem apagar", async ({ page }) => {
  for (const bruto of ["{", '{"a":1}']) {
    await abrirIlegivel(page, bruto);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(await lerDor(page)).toBe(bruto);
    expect(await backupsDor(page)).toEqual([]);
  }
  await semRolagemEAlvos(page);
  const box = (await recomecar(page).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test("CA03: lista legível não mostra Recomeçar anotações de dor", async ({ page }) => {
  await abrir(page);
  await expect(recomecar(page)).toHaveCount(0);
  await page.evaluate((k) => localStorage.setItem(k, "[]"), KEY_DOR);
  await page.reload();
  await expect(page.getByText("Nenhuma dor", { exact: true })).toBeVisible();
  await expect(recomecar(page)).toHaveCount(0);
});

test("CA03: Recomeçar pede confirmação e Cancelar não grava nada", async ({ page }) => {
  await abrirIlegivel(page);
  await recomecar(page).click();
  await expect(tituloConfirmacao(page)).toBeVisible();
  await expect(page.getByRole("region", { name: "Recomeçar anotações de dor?" })).toBeVisible();
  for (const alvo of await page.locator("main button").all()) {
    const box = (await alvo.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  const cancelar = page.getByRole("button", { name: "Cancelar", exact: true });
  await expect(cancelar).toHaveAccessibleDescription("Recomeçar anotações de dor?");
  await nadaRecomecado(page);
  await cancelar.click();
  await expect(recomecar(page)).toBeVisible();
  await nadaRecomecado(page);
});

test("CA03: confirmar guarda o conteúdo ilegível em backup e grava a lista nova", async ({ page }) => {
  await abrirIlegivel(page);
  await recomecar(page).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(recomecar(page)).toHaveCount(0);
  await expect(tituloConfirmacao(page)).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await backupsDor(page)).toEqual(["{"]);
  expect(await lerDor(page)).toBe("[]");
  await anotar(page, HOJE, ["Outro"]);
  await expect(dias(page)).toHaveText([/^24\/11\/2026\s*Outro$/]);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.reload();
  await expect(recomecar(page)).toHaveCount(0);
  await expect(dias(page)).toHaveText([/^24\/11\/2026\s*Outro$/]);
});

test("CA03: depois do alerta de dispositivo no Salvar, recomeçar tira a tela do alerta", async ({ page }) => {
  await abrirIlegivel(page);
  await anotar(page, HOJE, ["Outro"]);
  await expect(page.getByRole("alert")).toHaveText("Não foi possível salvar neste dispositivo.");
  expect(await lerDor(page)).toBe("{");
  await recomecar(page).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await backupsDor(page)).toEqual(["{"]);
  await salvar(page).click();
  await expect(dias(page)).toHaveText([/^24\/11\/2026\s*Outro$/]);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

// Lição 12: o segundo gesto nunca confirma e o foco volta ao gatilho.
test("CA03: dblclick no Recomeçar anotações de dor não confirma", async ({ page }) => {
  await abrirIlegivel(page);
  await recomecar(page).dblclick();
  await expect(tituloConfirmacao(page)).toBeVisible();
  await nadaRecomecado(page);
});

test("CA03: dois toques rápidos no Recomeçar anotações de dor não confirmam", async ({ page }) => {
  await abrirIlegivel(page);
  const box = (await recomecar(page).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(150);
  await page.touchscreen.tap(x, y);
  await expect(tituloConfirmacao(page)).toBeVisible();
  await nadaRecomecado(page);
});

test("CA03: Enter duas vezes no Recomeçar anotações de dor não confirma", async ({ page }) => {
  await abrirIlegivel(page);
  await recomecar(page).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await nadaRecomecado(page);
});

test("CA03: Cancelar devolve o foco ao Recomeçar anotações de dor", async ({ page }) => {
  await abrirIlegivel(page);
  await recomecar(page).click();
  const cancelar = page.getByRole("button", { name: "Cancelar", exact: true });
  await expect(cancelar).toBeFocused();
  await cancelar.click();
  await expect(recomecar(page)).toBeFocused();
});

// CA05 e L1 da RAFA-228: cota simulada no navegador. "backup" recusa as chaves
// de backup; "lista" recusa a chave da lista; null volta ao normal. Também
// registra a ordem das gravações em window.__gravadas.
async function cota(page: Page, regra: "backup" | "lista" | null) {
  await page.evaluate((r) => {
    const w = window as unknown as { __falha: string | null; __gravadas: string[]; __original?: Storage["setItem"] };
    w.__falha = r;
    if (w.__original) return;
    w.__gravadas = [];
    const original = Storage.prototype.setItem;
    w.__original = original;
    Storage.prototype.setItem = function (k: string, v: string) {
      const backup = k.includes(":backup:");
      if ((w.__falha === "backup" && backup) || (w.__falha === "lista" && !backup))
        throw new DOMException("cota", "QuotaExceededError");
      w.__gravadas.push(k);
      return original.call(this, k, v);
    };
  }, regra);
}
const gravadas = (page: Page) => page.evaluate(() => (window as unknown as { __gravadas: string[] }).__gravadas);

const confirmar = (page: Page) => page.getByRole("button", { name: "Confirmar", exact: true });
const backupsComChave = (page: Page) =>
  page.evaluate((k) => {
    const chaves = Object.keys(localStorage).filter((c) => c.startsWith(`${k}:backup:`)).sort();
    return chaves.map((c) => [c, localStorage.getItem(c)] as const);
  }, KEY_DOR);

test("CA05 na dor: sem espaço para o backup, alerta e chave intacta, sem travar", async ({ page }) => {
  await abrirIlegivel(page);
  await cota(page, "backup");
  await recomecar(page).click();
  await confirmar(page).click();
  await expect(page.getByRole("alert")).toHaveText("Não foi possível salvar neste dispositivo.");
  expect(await lerDor(page)).toBe("{");
  expect(await backupsDor(page)).toEqual([]);
  // A tela não trava: a confirmação continua com Cancelar e Confirmar ativos.
  await expect(page.getByRole("button", { name: "Cancelar", exact: true })).toBeEnabled();
  await cota(page, null);
  await confirmar(page).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(recomecar(page)).toHaveCount(0);
  expect(await backupsDor(page)).toEqual(["{"]);
  expect(await lerDor(page)).toBe("[]");
});

test("CA05 na dor: depois do alerta, Cancelar volta ao Recomeçar sem gravar", async ({ page }) => {
  await abrirIlegivel(page);
  await cota(page, "backup");
  await recomecar(page).click();
  await confirmar(page).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(recomecar(page)).toBeFocused();
  expect(await lerDor(page)).toBe("{");
  expect(await backupsDor(page)).toEqual([]);
});

test("L1 na dor: nova tentativa depois de a lista falhar não duplica o backup", async ({ page }) => {
  await abrirIlegivel(page);
  await cota(page, "lista");
  await recomecar(page).click();
  await confirmar(page).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.clock.setFixedTime(new Date(`${HOJE}T10:01:00`));
  await confirmar(page).click();
  expect(await lerDor(page)).toBe("{");
  expect(await backupsDor(page)).toEqual(["{"]);
  await cota(page, null);
  await confirmar(page).click();
  await expect(recomecar(page)).toHaveCount(0);
  expect(await backupsDor(page)).toEqual(["{"]);
  expect(await lerDor(page)).toBe("[]");
});

test("L2 na dor: colisão de instante usa o sufixo e o backup vem antes da lista nova", async ({ page }) => {
  const longo = `{${"x".repeat(5000)}`;
  await abrirIlegivel(page, longo);
  await page.evaluate((k) => localStorage.setItem(`${k}:backup:${new Date().toISOString()}`, "anterior"), KEY_DOR);
  await cota(page, null);
  await recomecar(page).click();
  await confirmar(page).click();
  await expect(recomecar(page)).toHaveCount(0);
  const base = `${KEY_DOR}:backup:${await page.evaluate(() => new Date().toISOString())}`;
  expect(await backupsComChave(page)).toEqual([
    [base, "anterior"],
    [`${base}-2`, longo],
  ]);
  expect(await gravadas(page)).toEqual([`${base}-2`, KEY_DOR]);
});

// RAFA-247 CA02, via (a): a tela Dor limpa o próprio erro ao abrir a
// confirmação do Recomeçar; se o Confirmar também falhar, fica um único alerta,
// o do Recomeçar, logo abaixo da confirmação. O CA05 da RAFA-228 segue valendo.
const ERRO = "Não foi possível salvar neste dispositivo.";
const alertaDoRecomecar = (page: Page) =>
  page.locator('section[aria-labelledby="recomecar-dor-titulo"] + p[role="alert"]');
async function alertaDeCotaNoSalvar(page: Page) {
  await abrirIlegivel(page);
  await cota(page, "lista");
  await anotar(page, HOJE, ["Outro"]);
  await expect(page.getByRole("alert")).toHaveText(ERRO);
}

test("RAFA-247 CA02: abrir a confirmação limpa o alerta de cota do Salvar", async ({ page }) => {
  await alertaDeCotaNoSalvar(page);
  await recomecar(page).click();
  await expect(tituloConfirmacao(page)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText(ERRO)).toHaveCount(0);
});

test("RAFA-247 CA02: Confirmar que também falha deixa um único alerta, o do Recomeçar", async ({ page }) => {
  await alertaDeCotaNoSalvar(page);
  await recomecar(page).click();
  await cota(page, "backup");
  await confirmar(page).click();
  await expect(page.getByRole("alert")).toHaveCount(1);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveText(ERRO);
  await expect(alertaDoRecomecar(page)).toHaveCount(1);
});

test("RAFA-247 CA02: com o CA05 da RAFA-228, nada é gravado e a confirmação segue usável", async ({ page }) => {
  await alertaDeCotaNoSalvar(page);
  await recomecar(page).click();
  await cota(page, "backup");
  const antes = (await gravadas(page)).length;
  await confirmar(page).click();
  await expect(alertaDoRecomecar(page)).toHaveText(ERRO);
  expect(await lerDor(page)).toBe("{");
  expect(await backupsDor(page)).toEqual([]);
  expect((await gravadas(page)).length).toBe(antes);
  await expect(tituloConfirmacao(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar", exact: true })).toBeEnabled();
  await expect(confirmar(page)).toBeEnabled();
  await cota(page, null);
  await confirmar(page).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(recomecar(page)).toHaveCount(0);
  expect(await backupsDor(page)).toEqual(["{"]);
  expect(await lerDor(page)).toBe("[]");
});

// RAFA-251 CA01: a tela Dor tem um único role=alert, o do erro mais recente.
// Cancelar a confirmação faz o Recomeçar limpar o próprio erro; o erro do
// Salvar fica até outra ação do usuário o resolver ou um erro novo o
// substituir. A chave ilegível faz o Salvar falhar; a cota faz o Confirmar
// falhar. O CA05 da RAFA-228 e a via (a) da RAFA-247 seguem valendo.
const alertaDoSalvar = (page: Page) => page.locator('section[aria-label="Histórico"] + p[role="alert"]');
const botaoCancelar = (page: Page) => page.getByRole("button", { name: "Cancelar", exact: true });
async function erroDoRecomecar(page: Page) {
  await abrirIlegivel(page);
  await cota(page, "backup");
  await recomecar(page).click();
  await confirmar(page).click();
  await expect(alertaDoRecomecar(page)).toHaveText(ERRO);
  await expect(page.getByRole("alert")).toHaveCount(1);
}
// Conta os role=alert a cada mudança do DOM e guarda o máximo, para pegar
// também um estado intermediário com dois alertas.
async function contarAlertas(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __maxAlertas: number };
    const contar = () => {
      w.__maxAlertas = Math.max(w.__maxAlertas, document.querySelectorAll('[role="alert"]').length);
    };
    w.__maxAlertas = 0;
    contar();
    new MutationObserver(contar).observe(document.body, { childList: true, subtree: true, attributes: true });
  });
}
const maxAlertas = (page: Page) => page.evaluate(() => (window as unknown as { __maxAlertas: number }).__maxAlertas);

test("RAFA-251 CA01: Cancelar limpa o erro do Recomeçar", async ({ page }) => {
  await erroDoRecomecar(page);
  await botaoCancelar(page).click();
  await expect(recomecar(page)).toBeFocused();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText(ERRO)).toHaveCount(0);
  expect(await lerDor(page)).toBe("{");
  expect(await backupsDor(page)).toEqual([]);
});

test("RAFA-251 CA01: Salvar que falha com o erro do Recomeçar visível deixa só o alerta do Salvar", async ({
  page,
}) => {
  await erroDoRecomecar(page);
  await anotar(page, HOJE, ["Outro"]);
  await expect(page.getByRole("alert")).toHaveCount(1);
  await expect(alertaDoSalvar(page)).toHaveText(ERRO);
  await expect(alertaDoRecomecar(page)).toHaveCount(0);
  // A confirmação segue aberta e nada foi gravado.
  await expect(tituloConfirmacao(page)).toBeVisible();
  expect(await lerDor(page)).toBe("{");
  expect(await backupsDor(page)).toEqual([]);
});

test("RAFA-251 CA01: a tela Dor nunca mostra mais de um role=alert", async ({ page }) => {
  await abrirIlegivel(page);
  await contarAlertas(page);
  const umAlerta = async (local: (page: Page) => Locator) => {
    await expect(local(page)).toHaveText(ERRO);
    await expect(page.getByRole("alert")).toHaveCount(1);
  };
  await anotar(page, HOJE, ["Outro"]);
  await umAlerta(alertaDoSalvar);
  await recomecar(page).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await cota(page, "backup");
  await confirmar(page).click();
  await umAlerta(alertaDoRecomecar);
  await salvar(page).click();
  await umAlerta(alertaDoSalvar);
  await confirmar(page).click();
  await umAlerta(alertaDoRecomecar);
  await botaoCancelar(page).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await salvar(page).click();
  await umAlerta(alertaDoSalvar);
  await recomecar(page).click();
  await confirmar(page).click();
  await umAlerta(alertaDoRecomecar);
  expect(await maxAlertas(page)).toBe(1);
});

test("RAFA-251 CA01: nenhum erro some sem ação do usuário ou sem ser substituído", async ({ page }) => {
  await abrirIlegivel(page);
  // Erro do Salvar: o tempo e mexer no formulário não o tiram da tela.
  await anotar(page, HOJE, ["Outro"]);
  await expect(alertaDoSalvar(page)).toHaveText(ERRO);
  await page.waitForTimeout(1000);
  await icone(page, "Dor muscular").click();
  await texto(page).fill("coxa");
  await expect(alertaDoSalvar(page)).toHaveText(ERRO);
  // Erro do Recomeçar: também fica com o tempo.
  await recomecar(page).click();
  await cota(page, "backup");
  await confirmar(page).click();
  await expect(alertaDoRecomecar(page)).toHaveText(ERRO);
  await page.waitForTimeout(1000);
  await expect(alertaDoRecomecar(page)).toHaveText(ERRO);
  // Substituído pelo erro do Salvar, que não sai com o Cancelar da confirmação.
  await salvar(page).click();
  await expect(alertaDoSalvar(page)).toHaveText(ERRO);
  await botaoCancelar(page).click();
  await expect(recomecar(page)).toBeFocused();
  await expect(alertaDoSalvar(page)).toHaveText(ERRO);
  await expect(page.getByRole("alert")).toHaveCount(1);
});

test("RAFA-251 CA01: CA05 da RAFA-228 e via (a) da RAFA-247 seguem valendo", async ({ page }) => {
  await erroDoRecomecar(page);
  await anotar(page, HOJE, ["Outro"]);
  await expect(alertaDoSalvar(page)).toHaveText(ERRO);
  await botaoCancelar(page).click();
  // Via (a): abrir a confirmação limpa o erro da tela.
  await recomecar(page).click();
  await expect(tituloConfirmacao(page)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  // CA05: sem espaço para o backup nada é gravado e a tela não trava.
  const antes = (await gravadas(page)).length;
  await confirmar(page).click();
  await expect(alertaDoRecomecar(page)).toHaveText(ERRO);
  await expect(page.getByRole("alert")).toHaveCount(1);
  expect(await lerDor(page)).toBe("{");
  expect(await backupsDor(page)).toEqual([]);
  expect((await gravadas(page)).length).toBe(antes);
  await expect(botaoCancelar(page)).toBeEnabled();
  await expect(confirmar(page)).toBeEnabled();
  await cota(page, null);
  await confirmar(page).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(recomecar(page)).toHaveCount(0);
  expect(await backupsDor(page)).toEqual(["{"]);
  expect(await lerDor(page)).toBe("[]");
});
