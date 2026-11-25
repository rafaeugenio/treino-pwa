import { describe, it, expect } from "vitest";
import { ICONES, KEY, adicionar, carregar, historico, vazia } from "./dor";
import { KEY as KEY_ATIVIDADES } from "./atividades";

function memoria(inicial?: Record<string, string>) {
  const data = new Map(Object.entries(inicial ?? {}));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("ícones", () => {
  it("lista fixa com os 6 ícones do CA04-1, nessa ordem", () => {
    expect(ICONES.map((i) => i.nome)).toEqual([
      "Dor muscular",
      "Dor articular",
      "Dor nas costas",
      "Cãibra",
      "Falta de ar ou tontura",
      "Outro",
    ]);
    expect(new Set(ICONES.map((i) => i.id)).size).toBe(ICONES.length);
  });
});

describe("anotações de dor locais", () => {
  it("CA04-1: grava por dia, só com ícones ou só com texto, e lê por outra instância", () => {
    const storage = memoria();
    expect(carregar(storage)).toEqual([]);
    adicionar(storage, { data: "2026-11-24", icones: ["costas", "muscular"], texto: "" }, "a");
    adicionar(storage, { data: "2026-11-20", icones: [], texto: " ombro deslocado " }, "b");
    const outra = memoria(Object.fromEntries(storage.data));
    expect(carregar(outra)).toEqual([
      { id: "a", data: "2026-11-24", icones: ["muscular", "costas"], texto: "" },
      { id: "b", data: "2026-11-20", icones: [], texto: "ombro deslocado" },
    ]);
    // Dia sem atividade: a dor não depende da chave de atividades.
    expect(storage.data.has(KEY_ATIVIDADES)).toBe(false);
  });

  it("CA04-2: sem ícone e sem texto não grava", () => {
    const storage = memoria();
    expect(vazia({ icones: [], texto: "   " })).toBe(true);
    expect(() => adicionar(storage, { data: "2026-11-24", icones: [], texto: "" })).toThrow();
    expect(() => adicionar(storage, { data: "2026-11-24", icones: [], texto: "   " })).toThrow();
    expect(storage.data.has(KEY)).toBe(false);
    expect(historico(carregar(storage))).toEqual([]);
  });

  it("recusa data vazia ou fora do calendário sem gravar", () => {
    const storage = memoria();
    for (const data of ["", "2026-02-30", "24/11/2026"])
      expect(() => adicionar(storage, { data, icones: ["outro"], texto: "" })).toThrow();
    expect(storage.data.has(KEY)).toBe(false);
  });

  it("CA04-3: duas anotações no mesmo dia ficam juntas, na ordem salva", () => {
    const storage = memoria();
    adicionar(storage, { data: "2026-11-24", icones: ["caibra"], texto: "" }, "a");
    adicionar(storage, { data: "2026-11-24", icones: [], texto: "joelho" }, "b");
    expect(historico(carregar(storage))).toEqual([
      {
        data: "2026-11-24",
        anotacoes: [
          { id: "a", data: "2026-11-24", icones: ["caibra"], texto: "" },
          { id: "b", data: "2026-11-24", icones: [], texto: "joelho" },
        ],
      },
    ]);
  });

  it("CA04-4: histórico só com dias com dor, do mais recente ao mais antigo", () => {
    const storage = memoria();
    adicionar(storage, { data: "2026-11-20", icones: ["outro"], texto: "" }, "a");
    adicionar(storage, { data: "2026-12-01", icones: ["muscular"], texto: "" }, "b");
    adicionar(storage, { data: "2025-12-31", icones: [], texto: "ombro" }, "c");
    adicionar(storage, { data: "2026-11-20", icones: [], texto: "costas" }, "d");
    expect(historico(carregar(storage)).map((d) => [d.data, d.anotacoes.map((a) => a.id)])).toEqual([
      ["2026-12-01", ["b"]],
      ["2026-11-20", ["a", "d"]],
      ["2025-12-31", ["c"]],
    ]);
  });

  it("lê conteúdo corrompido como vazio sem apagar e não sobrescreve ao gravar", () => {
    for (const bruto of ["{", '{"a":1}']) {
      const storage = memoria({ [KEY]: bruto });
      expect(carregar(storage)).toEqual([]);
      expect(() => adicionar(storage, { data: "2026-11-24", icones: ["outro"], texto: "" })).toThrow();
      expect(storage.data.get(KEY)).toBe(bruto);
    }
  });

  it("guarda itens salvos que não podem ser lidos ao gravar um novo", () => {
    const estranho = { id: "x", data: "ontem", icones: [], texto: "v" };
    const storage = memoria({ [KEY]: JSON.stringify([estranho]) });
    expect(carregar(storage)).toEqual([]);
    const lista = adicionar(storage, { data: "2026-11-24", icones: ["outro"], texto: "" }, "a");
    expect(lista.map((a) => a.id)).toEqual(["a"]);
    expect(JSON.parse(storage.data.get(KEY)!)[0]).toEqual(estranho);
  });

  it("propaga falha de quota para a interface tratar", () => {
    expect(() =>
      adicionar(
        {
          getItem: () => null,
          setItem: () => {
            throw new Error("quota");
          },
        },
        { data: "2026-11-24", icones: ["outro"], texto: "" },
      ),
    ).toThrow("quota");
  });
});
