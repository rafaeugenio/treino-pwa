import { test, expect, type Page } from "@playwright/test";

// CA06-1 a CA06-4 da RAFA-186: lembrete local na tela inicial e aviso da
// limitação do iOS, com o "hoje" do aparelho controlado pelo relógio do
// Playwright. D2: sem permissão de notificação, sem push e sem rede.
const D = "2026-11-24";
const PLANO = "treino-pwa:plano:v1";
const AVISO = "Sem notificação push no iPhone nesta versão.";
function somar(dia: string, n: number) {
  const [a, m, d] = dia.split("-").map(Number);
  const data = new Date(a, m - 1, d + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}
const seguidos = (inicio: string, n: number) => Array.from({ length: n }, (_, i) => somar(inicio, i));

const lembrete = (page: Page) => page.getByTestId("lembrete");
const horas = (page: Page) => page.getByRole("textbox", { name: "Horas", exact: true });
const feito = (page: Page) => page.getByRole("button", { name: "Feito", exact: true });
const tab = (page: Page, nome: string) => page.getByRole("tab", { name: nome, exact: true }).click();
const inicio = (page: Page) => expect(page.getByRole("heading", { level: 1 })).toHaveText("Início");

/** Abre o app no dia e hora dados, com o plano salvo (ou nada salvo). */
async function abrir(page: Page, plano: unknown, quando = `${D}T10:00:00`, hash = "") {
  await page.clock.setFixedTime(new Date(quando));
  await page.goto("./");
  await page.evaluate(
    ([k, v]) => {
      localStorage.clear();
      if (v !== null) localStorage.setItem(k, v);
    },
    [PLANO, plano === null ? null : typeof plano === "string" ? plano : JSON.stringify(plano)] as const,
  );
  await page.goto(`./${hash}`);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

/**
 * Como abrir(), mas espera o SW ativo antes de gravar o plano e recarregar:
 * no WebKit, recarregar durante a instalação pode deixar o SW sem registro.
 */
async function abrirComSw(page: Page, plano: unknown) {
  await page.clock.setFixedTime(new Date(`${D}T10:00:00`));
  await page.goto("./");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [PLANO, JSON.stringify(plano)] as const);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBeTruthy();
}

async function semRolagemEAlvos(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  for (const alvo of await page.locator('[role="tab"], main button:visible, main input:visible').all()) {
    const box = (await alvo.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
}

test("CA06-1: ao abrir o app, o lembrete mostra o treino de hoje que falta", async ({ page }) => {
  await abrir(page, { inicio: D, feitos: [] });
  await inicio(page);
  await expect(lembrete(page)).toHaveText("Falta o Treino 1");
  await expect(lembrete(page).getByRole("button")).toHaveCount(0);
  await semRolagemEAlvos(page);
  // Dia seguinte ao Treino 1 feito: o lembrete é do Treino 2.
  await abrir(page, { inicio: D, feitos: [D] }, `${somar(D, 1)}T10:00:00`);
  await expect(lembrete(page)).toHaveText("Falta o Treino 2");
});

test("CA06-1: o lembrete segue o deslize do CA03", async ({ page }) => {
  // Treino 1 feito em D; 25 e 26 sem nada; o Treino 2 deslizou para 27/11.
  await abrir(page, { inicio: D, feitos: [D] }, `${somar(D, 3)}T10:00:00`);
  await expect(lembrete(page)).toHaveText("Falta o Treino 2");
  await tab(page, "Plano");
  await expect(page.getByTestId("plano").getByRole("listitem").nth(1)).toHaveAttribute("aria-current", "date");
});

test("CA06-2 guarda já treinou: ao marcar Feito o lembrete some sem reabrir o app", async ({ page }) => {
  await abrir(page, { inicio: D, feitos: [] });
  await expect(lembrete(page)).toHaveText("Falta o Treino 1");
  await horas(page).fill("1");
  await feito(page).click();
  await expect(page.locator("section", { hasText: "Hoje" })).toContainText(/Treino 1\s*Feito/);
  await expect(lembrete(page)).toHaveCount(0);
  // Continua sem lembrete ao trocar de tela e ao reabrir no mesmo dia.
  await tab(page, "Lembretes");
  await tab(page, "Início");
  await expect(lembrete(page)).toHaveCount(0);
  await page.reload();
  await inicio(page);
  await expect(lembrete(page)).toHaveCount(0);
});

test("CA06-2 guarda já treinou: o último treino feito hoje encerra o lembrete", async ({ page }) => {
  const d0 = "2026-10-28";
  await abrir(page, { inicio: d0, feitos: seguidos(d0, 27) });
  await expect(lembrete(page)).toHaveText("Falta o Treino 28");
  await horas(page).fill("1");
  await feito(page).click();
  await expect(lembrete(page)).toHaveCount(0);
});

test("CA06-2 guarda plano: sem plano iniciado, não há lembrete", async ({ page }) => {
  await abrir(page, null);
  await inicio(page);
  await expect(page.locator("section", { hasText: "Hoje" })).toContainText(/—\s*de 28/);
  await expect(lembrete(page)).toHaveCount(0);
  // Plano ilegível também não lembra nada.
  await abrir(page, "{");
  await expect(page.getByRole("button", { name: "Recomeçar plano", exact: true })).toBeVisible();
  await expect(lembrete(page)).toHaveCount(0);
});

test("CA06-2 guarda plano: plano terminado não tem lembrete", async ({ page }) => {
  const d0 = "2026-10-20";
  await abrir(page, { inicio: d0, feitos: seguidos(d0, 28) });
  await inicio(page);
  await expect(page.locator("section", { hasText: "Hoje" })).toContainText(/—\s*de 28/);
  await expect(lembrete(page)).toHaveCount(0);
});

test("CA06-2 guarda dia: plano com início futuro não lembra antes de D", async ({ page }) => {
  await abrir(page, { inicio: somar(D, 2), feitos: [] });
  await inicio(page);
  await expect(lembrete(page)).toHaveCount(0);
});

test("guarda virada do dia: ao voltar ao primeiro plano, o lembrete passa ao dia novo", async ({ page }) => {
  await abrir(page, { inicio: D, feitos: [] }, `${D}T23:59:00`);
  await expect(lembrete(page)).toHaveText("Falta o Treino 1");
  await horas(page).fill("1");
  await feito(page).click();
  await expect(lembrete(page)).toHaveCount(0);
  // App suspenso e de volta depois da meia-noite, sem reabrir.
  await page.clock.setFixedTime(new Date(`${somar(D, 1)}T00:00:30`));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(lembrete(page)).toHaveText("Falta o Treino 2");
});

test("CA06-3: a tela Lembretes tem uma única linha da limitação do iOS, sem botão nem opção", async ({ page }) => {
  await abrir(page, { inicio: D, feitos: [] }, `${D}T10:00:00`, "#lembretes");
  const painel = page.getByRole("tabpanel");
  await expect(painel.getByRole("heading", { level: 1 })).toHaveText("Lembretes");
  await expect(painel.getByTestId("aviso-ios")).toHaveText(AVISO);
  // Só o título e a linha do aviso.
  expect(
    await painel.evaluate((el) =>
      [...el.querySelectorAll("*")]
        .filter((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim()))
        .map((n) => n.textContent!.trim()),
    ),
  ).toEqual(["Lembretes", AVISO]);
  // Uma linha na tela de 390 px.
  const { altura, linha } = await painel.getByTestId("aviso-ios").evaluate((el) => ({
    altura: el.getBoundingClientRect().height,
    linha: parseFloat(getComputedStyle(el).lineHeight),
  }));
  expect(altura).toBeLessThanOrEqual(linha + 1);
  for (const papel of ["button", "switch", "checkbox", "radio", "link", "textbox", "combobox"] as const)
    await expect(painel.getByRole(papel)).toHaveCount(0);
  await expect(painel.locator("input, select, textarea, button, a")).toHaveCount(0);
  await expect(lembrete(page)).toHaveCount(0);
  await semRolagemEAlvos(page);
});

// CA06-4: instrumenta as APIs de notificação e push antes do app carregar e
// registra qualquer chamada. O WebKit do Playwright não expõe Notification nem
// PushManager; o Safari do iPhone com o app instalado expõe (iOS 16.4+). Sem
// elas, o teste cria substitutos com a mesma forma, para a guarda valer nos
// dois motores.
async function instrumentar(page: Page) {
  await page.addInitScript(() => {
    const chamadas: string[] = [];
    (window as unknown as { __chamadas: string[] }).__chamadas = chamadas;
    const g = window as unknown as Record<string, unknown>;
    if (!("Notification" in window))
      g.Notification = Object.assign(function Notification() {}, {
        permission: "default",
        requestPermission: () => Promise.resolve("default"),
      });
    if (!("PushManager" in window)) {
      class PushManager {
        subscribe() {
          return Promise.reject(new Error("sem push"));
        }
        getSubscription() {
          return Promise.resolve(null);
        }
        permissionState() {
          return Promise.resolve("prompt");
        }
      }
      g.PushManager = PushManager;
      const manager = new PushManager();
      Object.defineProperty(ServiceWorkerRegistration.prototype, "pushManager", {
        configurable: true,
        get: () => manager,
      });
    }
    const espiar = (alvo: object | undefined, metodo: string, nome: string) => {
      if (!alvo || !(metodo in alvo)) return;
      const original = (alvo as Record<string, unknown>)[metodo] as (...a: unknown[]) => unknown;
      Object.defineProperty(alvo, metodo, {
        configurable: true,
        value: function (this: unknown, ...args: unknown[]) {
          chamadas.push(nome);
          return original.apply(this, args);
        },
      });
    };
    const w = window as unknown as Record<string, { prototype?: object } & object | undefined>;
    espiar(w.Notification, "requestPermission", "Notification.requestPermission");
    espiar(w.PushManager?.prototype, "subscribe", "PushManager.subscribe");
    espiar(w.PushManager?.prototype, "permissionState", "PushManager.permissionState");
    espiar(w.ServiceWorkerRegistration?.prototype, "showNotification", "showNotification");
  });
}
const chamadas = (page: Page) => page.evaluate(() => (window as unknown as { __chamadas: string[] }).__chamadas);

async function percorrer(page: Page) {
  await expect(lembrete(page)).toHaveText("Falta o Treino 1");
  await horas(page).fill("1");
  await feito(page).click();
  await expect(lembrete(page)).toHaveCount(0);
  for (const nome of ["Registro", "Plano", "Dor", "Estatísticas", "Lembretes", "Início"]) {
    await tab(page, nome);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(nome);
  }
}

test("CA06-4 guarda permissão: nunca pede permissão de notificação nem registra push", async ({ page, request }) => {
  await instrumentar(page);
  await abrirComSw(page, { inicio: D, feitos: [] });
  await percorrer(page);
  expect(await chamadas(page)).toEqual([]);
  const estado = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return {
      permissao: "Notification" in window ? Notification.permission : "ausente",
      inscricao: reg.pushManager ? await reg.pushManager.getSubscription() : null,
    };
  });
  expect(estado.permissao).not.toBe("granted");
  expect(estado.inscricao).toBeNull();
  // O SW gerado não trata push nem mostra notificação.
  const sw = await (await request.get("sw.js")).text();
  const runtime = sw.match(/\.\/(workbox-[\w-]+)/)?.[1];
  expect(runtime).toBeTruthy();
  for (const codigo of [sw, await (await request.get(`${runtime}.js`)).text()]) {
    expect(codigo).not.toMatch(/addEventListener\(\s*["'`]push|onpush|showNotification|pushManager/);
  }
});

test("CA06-4 guarda rede: o lembrete não faz nenhuma requisição de rede", async ({ page, context, baseURL }) => {
  await abrirComSw(page, { inicio: D, feitos: [] });
  const pedidos: { metodo: string; url: URL }[] = [];
  context.on("request", (r) => pedidos.push({ metodo: r.method(), url: new URL(r.url()) }));
  // Abrir o app com o lembrete só busca os arquivos do próprio app.
  await page.reload();
  await expect(lembrete(page)).toHaveText("Falta o Treino 1");
  await page.waitForLoadState("networkidle");
  const fora = pedidos.filter(
    ({ metodo, url }) =>
      metodo !== "GET" ||
      url.origin !== new URL(baseURL!).origin ||
      !(url.pathname === "/" || /\.(html|js|css|png|webmanifest)$/.test(url.pathname)),
  );
  expect(fora.map(({ metodo, url }) => `${metodo} ${url.href}`)).toEqual([]);
  // Com o app aberto, mostrar, tirar o lembrete e trocar de tela não usa a rede.
  pedidos.length = 0;
  await percorrer(page);
  expect(pedidos.map(({ metodo, url }) => `${metodo} ${url.href}`)).toEqual([]);
});

test("CA06-4 guarda offline: o lembrete aparece ao abrir o app sem rede", async ({ page, context }) => {
  await abrirComSw(page, { inicio: D, feitos: [] });
  await context.setOffline(true);
  await page.reload();
  await inicio(page);
  await expect(lembrete(page)).toHaveText("Falta o Treino 1");
  await context.setOffline(false);
});
