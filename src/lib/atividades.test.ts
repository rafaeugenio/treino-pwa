import { describe, it, expect } from "vitest";
import { BACKUP, KEY, adicionar, carregar, doDia, formatHoras, hoje, parseHoras } from "./atividades";

function memoria(inicial?: Record<string, string>) {
  const data = new Map(Object.entries(inicial ?? {}));
  const gravadas: string[] = [];
  return {
    data,
    gravadas,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      gravadas.push(key);
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

// CA02 da RAFA-228: entradas salvas inválidas vão para backup antes da regravação.
describe("entradas inválidas preservadas", () => {
  const AGORA = new Date("2026-11-25T03:00:30.000Z");
  const CHAVE = `${BACKUP}2026-11-25T03:00:30.000Z`;
  const valida = { id: "v", data: "2026-11-24", nome: "Vôlei", horas: 1.5 };
  const nova = { data: "2026-11-25", nome: "Futebol", horas: 2 };
  const backups = (storage: ReturnType<typeof memoria>) =>
    [...storage.data.keys()].filter((k) => k.startsWith(BACKUP));

  for (const caso of [
    { titulo: "item inválido", invalida: { id: "x", data: "ontem", nome: "Corrida", horas: 1 } },
    { titulo: "campo ausente", invalida: { id: "y", data: "2026-11-24", nome: "Corrida" } },
    { titulo: "tipo errado", invalida: { id: "z", data: "2026-11-24", nome: "Corrida", horas: "1" } },
    { titulo: "item que não é objeto", invalida: "Flexões: 12" },
  ]) {
    it(`${caso.titulo}: copia para o backup antes de regravar e mantém válidas e a nova`, () => {
      const storage = memoria({ [KEY]: JSON.stringify([valida, caso.invalida]) });
      const lista = adicionar(storage, nova, "n", AGORA);
      expect(storage.gravadas).toEqual([CHAVE, KEY]);
      expect(JSON.parse(storage.data.get(CHAVE)!)).toEqual([caso.invalida]);
      expect(lista).toEqual([valida, { ...nova, id: "n" }]);
      expect(carregar(storage)).toEqual(lista);
    });
  }

  it("sem entradas inválidas não cria backup", () => {
    const storage = memoria({ [KEY]: JSON.stringify([valida]) });
    adicionar(storage, nova, "n", AGORA);
    expect(backups(storage)).toEqual([]);
    expect(storage.gravadas).toEqual([KEY]);
  });

  it("não sobrescreve um backup anterior com o mesmo instante", () => {
    const invalida = { id: "x", data: "ontem", nome: "Corrida", horas: 1 };
    const storage = memoria({ [KEY]: JSON.stringify([valida, invalida]), [CHAVE]: "anterior" });
    adicionar(storage, nova, "n", AGORA);
    expect(storage.data.get(CHAVE)).toBe("anterior");
    expect(JSON.parse(storage.data.get(`${CHAVE}-2`)!)).toEqual([invalida]);
  });

  it("se o backup falhar, a chave fica como estava e o erro propaga", () => {
    const bruto = JSON.stringify([valida, { id: "x", data: "ontem", nome: "Corrida", horas: 1 }]);
    const data = new Map([[KEY, bruto]]);
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key.startsWith(BACKUP)) throw new Error("quota");
        data.set(key, value);
      },
    };
    expect(() => adicionar(storage, nova, "n", AGORA)).toThrow("quota");
    expect(data.get(KEY)).toBe(bruto);
  });
});

// CA04 da RAFA-228: chave de atividades que não é lista JSON vai inteira para backup.
describe("chave de atividades corrompida por inteiro", () => {
  const AGORA = new Date("2026-11-25T03:00:30.000Z");
  const CHAVE = `${BACKUP}2026-11-25T03:00:30.000Z`;
  const nova = { data: "2026-11-25", nome: "Futebol", horas: 2 };
  const backups = (storage: ReturnType<typeof memoria>) =>
    Object.fromEntries([...storage.data].filter(([k]) => k.startsWith(BACKUP)));

  it("não é lista: JSON inválido ou outro valor vai bruto para o backup antes de gravar", () => {
    for (const bruto of ["{", '{"a":1}', "null", "3", '"texto"', "Flexões: 12"]) {
      const storage = memoria({ [KEY]: bruto });
      const lista = adicionar(storage, nova, "n", AGORA);
      expect(storage.gravadas).toEqual([CHAVE, KEY]);
      expect(storage.data.get(CHAVE)).toBe(bruto);
      expect(lista).toEqual([{ ...nova, id: "n" }]);
    }
  });

  it("backup inexistente: o bruto vai para uma chave nova", () => {
    const storage = memoria({ [KEY]: "{" });
    expect(backups(storage)).toEqual({});
    adicionar(storage, nova, "n", AGORA);
    expect(backups(storage)).toEqual({ [CHAVE]: "{" });
  });

  it("backup existente com o mesmo conteúdo permanece, e o bruto novo também fica", () => {
    const storage = memoria({ [KEY]: "{", [CHAVE]: "{" });
    adicionar(storage, nova, "n", AGORA);
    expect(backups(storage)).toEqual({ [CHAVE]: "{", [`${CHAVE}-2`]: "{" });
  });

  it("backup existente com outro conteúdo não é sobrescrito; o bruto novo vai para uma chave livre", () => {
    const storage = memoria({ [KEY]: "{", [CHAVE]: "anterior", [`${CHAVE}-2`]: "outro" });
    adicionar(storage, nova, "n", AGORA);
    expect(backups(storage)).toEqual({ [CHAVE]: "anterior", [`${CHAVE}-2`]: "outro", [`${CHAVE}-3`]: "{" });
  });

  it("registro novo salvo e lido por outra instância", () => {
    const storage = memoria({ [KEY]: '{"a":1}' });
    adicionar(storage, nova, "n", AGORA);
    expect(carregar(memoria(Object.fromEntries(storage.data)))).toEqual([{ ...nova, id: "n" }]);
  });

  it("chave ausente ou vazia não gera backup", () => {
    for (const inicial of [{}, { [KEY]: "" }] as Record<string, string>[]) {
      const storage = memoria(inicial);
      adicionar(storage, nova, "n", AGORA);
      expect(backups(storage)).toEqual({});
    }
  });

  it("se o backup do bruto falhar, a chave fica como estava e o erro propaga", () => {
    const data = new Map([[KEY, "{"]]);
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key.startsWith(BACKUP)) throw new Error("quota");
        data.set(key, value);
      },
    };
    expect(() => adicionar(storage, nova, "n", AGORA)).toThrow("quota");
    expect(data.get(KEY)).toBe("{");
  });
});
