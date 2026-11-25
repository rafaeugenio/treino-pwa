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

// Achados Bari r1 (review 6049069913): erro no campo, nada gravado e sem o alerta de dispositivo.
for (const caso of [
  { titulo: "horas que arredondam para zero", nome: "Vôlei", horas: "0,001", campo: "Horas", erro: "Horas inválidas" },
  { titulo: "nome só com espaços", nome: "   ", horas: "1", campo: "Atividade", erro: "Informe a atividade" },
]) {
  test(`recusa ${caso.titulo} com erro no campo ${caso.campo}`, async ({ page }) => {
    await page.goto("./#registro");
    await registrar(page, "2026-11-24", caso.nome, caso.horas);
    const campo = page.getByRole("textbox", { name: caso.campo, exact: true });
    await expect(campo).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(caso.erro, { exact: true })).toBeVisible();
    await expect(page.getByTestId("atividades")).toHaveCount(0);
    await expect(page.getByText("Nenhuma atividade")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText("Não foi possível salvar neste dispositivo.")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("treino-pwa:atividades:v1"))).toBeNull();
  });
}

// CA01 (RAFA-228): a data padrão acompanha a virada do dia do aparelho e a
// data escolhida à mão é mantida.
const KEY_ATIVIDADES = "treino-pwa:atividades:v1";
const salvas = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "[]") as { data: string; nome: string }[], KEY_ATIVIDADES);
const campoData = (page: Page) => page.getByRole("textbox", { name: "Data", exact: true });
async function salvarSemData(page: Page, nome: string, horas: string) {
  await page.getByRole("textbox", { name: "Atividade", exact: true }).fill(nome);
  await page.getByRole("textbox", { name: "Horas", exact: true }).fill(horas);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
}

test("CA01: aberta antes da meia-noite, sem mexer na data, grava o dia novo do aparelho", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-24T23:59:30"));
  await page.goto("./#registro");
  await expect(campoData(page)).toHaveValue("2026-11-24");
  await page.clock.setFixedTime(new Date("2026-11-25T00:00:30"));
  await salvarSemData(page, "Vôlei", "1");
  await expect(lista(page)).toHaveText([/Vôlei\s*1 h/]);
  await expect(campoData(page)).toHaveValue("2026-11-25");
  expect((await salvas(page)).map((a) => a.data)).toEqual(["2026-11-25"]);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("CA01: data escolhida à mão antes da meia-noite é mantida depois dela", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-24T23:59:30"));
  await page.goto("./#registro");
  await campoData(page).fill("2026-11-23");
  await page.clock.setFixedTime(new Date("2026-11-25T00:00:30"));
  await salvarSemData(page, "Vôlei", "1");
  await expect(campoData(page)).toHaveValue("2026-11-23");
  await expect(lista(page)).toHaveText([/Vôlei\s*1 h/]);
  expect((await salvas(page)).map((a) => a.data)).toEqual(["2026-11-23"]);
});

// CA02 (RAFA-228): entradas guardadas inválidas vão para backup antes da regravação.
test("CA02: entradas inválidas vão para backup e válidas e o registro novo ficam visíveis", async ({ page }) => {
  const validas = [{ id: "v", data: "2026-11-24", nome: "Futebol", horas: 2 }];
  const invalidas = [
    { id: "x", data: "ontem", nome: "Corrida", horas: 1 },
    { id: "y", data: "2026-11-24", nome: "Natação" },
    { id: "z", data: "2026-11-24", nome: "Remo", horas: "1" },
  ];
  await page.clock.setFixedTime(new Date("2026-11-24T10:00:00"));
  await page.goto("./#registro");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY_ATIVIDADES, JSON.stringify([...validas, ...invalidas])]);
  await page.reload();
  await expect(lista(page)).toHaveText([/Futebol\s*2 h/]);
  await salvarSemData(page, "Vôlei", "1,5");
  await expect(lista(page)).toHaveText([/Futebol\s*2 h/, /Vôlei\s*1,5 h/]);
  await expect(page.getByRole("alert")).toHaveCount(0);
  const backups = await page.evaluate((k) => {
    const chaves = Object.keys(localStorage).filter((c) => c.startsWith(`${k}:backup:`));
    return chaves.map((c) => JSON.parse(localStorage.getItem(c)!) as unknown);
  }, KEY_ATIVIDADES);
  expect(backups).toEqual([invalidas]);
  expect((await salvas(page)).map((a) => a.nome)).toEqual(["Futebol", "Vôlei"]);
  await page.reload();
  await expect(lista(page)).toHaveText([/Futebol\s*2 h/, /Vôlei\s*1,5 h/]);
});

// CA04 (RAFA-228): chave de atividades que não é lista JSON vai bruta para backup,
// sem alerta e sem Recomeçar, e um backup anterior não é sobrescrito.
test("CA04: conteúdo que não é lista vai para backup e o registro novo fica salvo e visível", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-24T10:00:00"));
  await page.goto("./#registro");
  await page.evaluate((k) => {
    localStorage.setItem(k, "{");
    localStorage.setItem(`${k}:backup:anterior`, '{"outro":1}');
  }, KEY_ATIVIDADES);
  await page.reload();
  await expect(page.getByText("Nenhuma atividade")).toBeVisible();
  await expect(page.getByRole("button", { name: /Recomeçar/ })).toHaveCount(0);
  await salvarSemData(page, "Vôlei", "1,5");
  await expect(lista(page)).toHaveText([/Vôlei\s*1,5 h/]);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Recomeçar/ })).toHaveCount(0);
  const backups = await page.evaluate((k) => {
    const chaves = Object.keys(localStorage).filter((c) => c.startsWith(`${k}:backup:`)).sort();
    return chaves.map((c) => [c.endsWith(":anterior"), localStorage.getItem(c)]);
  }, KEY_ATIVIDADES);
  expect(backups).toEqual([
    [false, "{"],
    [true, '{"outro":1}'],
  ]);
  expect((await salvas(page)).map((a) => a.nome)).toEqual(["Vôlei"]);
  await page.reload();
  await expect(lista(page)).toHaveText([/Vôlei\s*1,5 h/]);
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

const ERRO = "Não foi possível salvar neste dispositivo.";
const backupsAtividades = (page: Page) =>
  page.evaluate((k) => {
    const chaves = Object.keys(localStorage).filter((c) => c.startsWith(`${k}:backup:`)).sort();
    return chaves.map((c) => [c, localStorage.getItem(c)] as const);
  }, KEY_ATIVIDADES);
const brutoAtividades = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY_ATIVIDADES);
async function abrirRegistroCom(page: Page, bruto: string) {
  await page.clock.setFixedTime(new Date("2026-11-24T10:00:00"));
  await page.goto("./#registro");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY_ATIVIDADES, bruto]);
  await page.reload();
}
const brutoCA02 = JSON.stringify([
  { id: "v", data: "2026-11-24", nome: "Futebol", horas: 2 },
  { id: "x", data: "ontem", nome: "Corrida", horas: 1 },
]);

for (const caso of [
  { titulo: "CA04 (não é lista)", bruto: "{", copia: "{" },
  { titulo: "CA02 (entrada inválida)", bruto: brutoCA02, copia: JSON.stringify([{ id: "x", data: "ontem", nome: "Corrida", horas: 1 }]) },
]) {
  test(`CA05 no Registro, ${caso.titulo}: sem espaço para o backup, alerta e chave intacta, sem travar`, async ({ page }) => {
    await abrirRegistroCom(page, caso.bruto);
    await cota(page, "backup");
    await salvarSemData(page, "Vôlei", "1,5");
    await expect(page.getByRole("alert")).toHaveText(ERRO);
    expect(await brutoAtividades(page)).toBe(caso.bruto);
    expect(await backupsAtividades(page)).toEqual([]);
    // A tela não trava: o formulário guarda o que foi digitado e o novo Salvar funciona.
    await expect(page.getByRole("textbox", { name: "Atividade", exact: true })).toHaveValue("Vôlei");
    await cota(page, null);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(lista(page).filter({ hasText: "Vôlei" })).toHaveCount(1);
    expect((await backupsAtividades(page)).map(([, v]) => v)).toEqual([caso.copia]);
  });

  test(`L1 no Registro, ${caso.titulo}: nova tentativa depois de a lista falhar não duplica o backup`, async ({ page }) => {
    await abrirRegistroCom(page, caso.bruto);
    await cota(page, "lista");
    await salvarSemData(page, "Vôlei", "1,5");
    await expect(page.getByRole("alert")).toHaveText(ERRO);
    await page.clock.setFixedTime(new Date("2026-11-24T10:01:00"));
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(ERRO);
    expect(await brutoAtividades(page)).toBe(caso.bruto);
    expect((await backupsAtividades(page)).map(([, v]) => v)).toEqual([caso.copia]);
    await cota(page, null);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect((await backupsAtividades(page)).map(([, v]) => v)).toEqual([caso.copia]);
  });
}

test("L2 no Registro: colisão de instante usa o sufixo e o backup vem antes da lista", async ({ page }) => {
  const longo = `{${"x".repeat(5000)}`;
  await abrirRegistroCom(page, longo);
  await page.evaluate((k) => localStorage.setItem(`${k}:backup:${new Date().toISOString()}`, "anterior"), KEY_ATIVIDADES);
  await cota(page, null);
  await salvarSemData(page, "Vôlei", "1,5");
  await expect(lista(page)).toHaveText([/Vôlei\s*1,5 h/]);
  const base = `${KEY_ATIVIDADES}:backup:${await page.evaluate(() => new Date().toISOString())}`;
  expect(await backupsAtividades(page)).toEqual([
    [base, "anterior"],
    [`${base}-2`, longo],
  ]);
  expect(await gravadas(page)).toEqual([`${base}-2`, KEY_ATIVIDADES]);
});
