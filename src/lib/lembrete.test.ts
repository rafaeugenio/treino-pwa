import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AVISO_IOS, lembrete } from "./lembrete";
import { TOTAL, somarDias } from "./plano";

const D = "2026-11-24";
const feitos = (inicio: string, n: number) => Array.from({ length: n }, (_, i) => somarDias(inicio, i));

describe("CA06-1: lembrete quando falta o treino de hoje", () => {
  it("mostra o treino previsto para hoje", () => {
    expect(lembrete({ inicio: D, feitos: [] }, D)).toBe("Treino 1");
    expect(lembrete({ inicio: D, feitos: [D] }, somarDias(D, 1))).toBe("Treino 2");
  });
  it("segue o deslize do CA03: o pendente vem para hoje", () => {
    expect(lembrete({ inicio: D, feitos: [D] }, somarDias(D, 3))).toBe("Treino 2");
    expect(lembrete({ inicio: D, feitos: [] }, somarDias(D, 5))).toBe("Treino 1");
  });
  it("lembra o último treino quando ele é o de hoje", () => {
    const inicio = "2026-10-28";
    expect(lembrete({ inicio, feitos: feitos(inicio, 27) }, D)).toBe("Treino 28");
  });
});

describe("CA06-2: sem lembrete quando não há o que lembrar", () => {
  it("guarda já treinou hoje: treino de hoje feito", () => {
    expect(lembrete({ inicio: D, feitos: [D] }, D)).toBeNull();
    const inicio = "2026-10-28";
    expect(lembrete({ inicio, feitos: feitos(inicio, 28) }, somarDias(inicio, 27))).toBeNull();
  });
  it("guarda plano não iniciado (ou ilegível)", () => {
    expect(lembrete(null, D)).toBeNull();
  });
  it("guarda plano terminado em dia anterior", () => {
    const inicio = "2026-10-20";
    expect(lembrete({ inicio, feitos: feitos(inicio, TOTAL) }, D)).toBeNull();
  });
  it("guarda dia de hoje: plano com início futuro não lembra antes de D", () => {
    expect(lembrete({ inicio: somarDias(D, 2), feitos: [] }, D)).toBeNull();
  });
});

describe("CA06-3: aviso da limitação do iOS", () => {
  it("é uma única frase curta sobre o push no iPhone nesta versão", () => {
    expect(AVISO_IOS).toBe("Sem notificação push no iPhone nesta versão.");
    expect(AVISO_IOS).not.toMatch(/\n/);
  });
});

// CA06-4: guarda de permissão e de push no código do app. Nenhum fonte chama
// as APIs de notificação ou de push, e o SW gerado não recebe código próprio.
describe("CA06-4: sem permissão de notificação e sem push", () => {
  const repo = fileURLToPath(new URL("../..", import.meta.url));
  const fontes = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? fontes(join(dir, e.name))
        : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)
          ? [join(dir, e.name)]
          : [],
    );
  const PROIBIDO = /\bNotification\b|requestPermission|pushManager|PushManager|showNotification|\.subscribe\(/;
  it("nenhum fonte do app usa Notification, PushManager ou showNotification", () => {
    const todos = ["src", "components", "utils"].flatMap((d) => fontes(join(repo, d)));
    expect(todos.length).toBeGreaterThan(10);
    const achados = todos.filter((f) => PROIBIDO.test(readFileSync(f, "utf8")));
    expect(achados).toEqual([]);
  });
  it("o service worker gerado não recebe código próprio (sem push)", () => {
    const config = readFileSync(join(repo, "vite.config.ts"), "utf8");
    expect(config).not.toMatch(/injectManifest|importScripts|swSrc/);
  });
});
