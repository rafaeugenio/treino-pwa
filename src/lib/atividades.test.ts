import { describe, it, expect } from "vitest";
import { KEY, adicionar, carregar, doDia, formatHoras, hoje, parseHoras } from "./atividades";

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

describe("horas", () => {
  it("aceita vírgula brasileira, ponto e inteiro", () => {
    expect(parseHoras("1,5")).toBe(1.5);
    expect(parseHoras(" 1.5 ")).toBe(1.5);
    expect(parseHoras("2")).toBe(2);
    expect(parseHoras("0,25")).toBe(0.25);
  });
  it("recusa vazio, zero, negativo, texto e mais de 24 h", () => {
    for (const texto of ["", "0", "-1", "abc", "1,5,5", "24,5", "1e2"]) expect(parseHoras(texto)).toBeNull();
  });
  it("recusa horas que arredondam para zero", () => {
    for (const texto of ["0,001", "0,004", "0.004"]) expect(parseHoras(texto)).toBeNull();
    expect(parseHoras("0,005")).toBe(0.01);
  });
  it("formata com vírgula", () => {
    expect(formatHoras(1.5)).toBe("1,5 h");
    expect(formatHoras(2)).toBe("2 h");
  });
  it("hoje usa o dia local", () => {
    expect(hoje(new Date(2026, 10, 4, 23, 59))).toBe("2026-11-04");
  });
});

describe("atividades locais", () => {
  it("persiste e recupera por outra instância, inclusive atividade substituta", () => {
    const storage = memoria();
    expect(carregar(storage)).toEqual([]);
    adicionar(storage, { data: "2026-11-24", nome: " Vôlei ", horas: 1.5 }, "a");
    adicionar(storage, { data: "2026-11-23", nome: "Futebol", horas: 2 }, "b");
    const outra = memoria(Object.fromEntries(storage.data));
    const lista = carregar(outra);
    expect(lista).toEqual([
      { id: "a", data: "2026-11-24", nome: "Vôlei", horas: 1.5 },
      { id: "b", data: "2026-11-23", nome: "Futebol", horas: 2 },
    ]);
    expect(doDia(lista, "2026-11-24").map((a) => a.nome)).toEqual(["Vôlei"]);
    expect(doDia(lista, "2026-11-22")).toEqual([]);
  });
  it("ignora o formato antigo e conteúdo corrompido", () => {
    expect(carregar(memoria({ "treino-pwa:registro:v1": "Flexões: 12" }))).toEqual([]);
    expect(carregar(memoria({ [KEY]: "{" }))).toEqual([]);
    expect(carregar(memoria({ [KEY]: '{"a":1}' }))).toEqual([]);
    expect(carregar(memoria({ [KEY]: '[{"id":"x","data":"ontem","nome":"V","horas":1}]' }))).toEqual([]);
  });
  it("recusa atividade inválida sem gravar", () => {
    const storage = memoria();
    expect(() => adicionar(storage, { data: "2026-11-24", nome: "  ", horas: 1 })).toThrow();
    expect(() => adicionar(storage, { data: "2026-11-24", nome: "Vôlei", horas: 0 })).toThrow();
    expect(storage.data.has(KEY)).toBe(false);
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
        { data: "2026-11-24", nome: "Vôlei", horas: 1 },
      ),
    ).toThrow("quota");
  });
});
