import { describe, it, expect } from "vitest";
import { BACKUP, ICONES, KEY, adicionar, carregar, historico, ler, recomecar, vazia } from "./dor";
import { KEY as KEY_ATIVIDADES } from "./atividades";

function memoria(inicial?: Record<string, string>) {
  const data = new Map(Object.entries(inicial ?? {}));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
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

// CA03 da RAFA-228: chave de dor ilegível, Recomeçar anotações de dor com backup.
describe("recomeçar anotações de dor", () => {
  const AGORA = new Date("2026-11-25T03:00:30.000Z");
  const CHAVE = `${BACKUP}2026-11-25T03:00:30.000Z`;

  it("ler marca como ilegível só o conteúdo que não é lista", () => {
    for (const bruto of ["{", '{"a":1}', "null", "3"]) expect(ler(memoria({ [KEY]: bruto })).ilegivel).toBe(true);
    expect(ler(memoria())).toEqual({ anotacoes: [], ilegivel: false });
    const estranho = { id: "x", data: "ontem", icones: [], texto: "v" };
    expect(ler(memoria({ [KEY]: JSON.stringify([estranho]) }))).toEqual({ anotacoes: [], ilegivel: false });
  });

  it("copia o conteúdo ilegível para o backup e só depois grava a lista nova", () => {
    for (const bruto of ["{", '{"a":1}']) {
      const storage = memoria({ [KEY]: bruto });
      const gravadas: string[] = [];
      const setItem = storage.setItem;
      storage.setItem = (key, value) => {
        gravadas.push(key);
        setItem(key, value);
      };
      expect(recomecar(storage, AGORA)).toEqual([]);
      expect(gravadas).toEqual([CHAVE, KEY]);
      expect(storage.data.get(CHAVE)).toBe(bruto);
      expect(ler(storage)).toEqual({ anotacoes: [], ilegivel: false });
      adicionar(storage, { data: "2026-11-25", icones: ["outro"], texto: "" }, "a");
      expect(carregar(storage).map((a) => a.id)).toEqual(["a"]);
    }
  });

  it("recusa recomeçar sem chave salva ou com lista legível, sem gravar", () => {
    const lista = JSON.stringify([{ id: "a", data: "2026-11-24", icones: ["outro"], texto: "" }]);
    for (const inicial of [{}, { [KEY]: lista }, { [KEY]: "[]" }] as Record<string, string>[]) {
      const storage = memoria(inicial);
      expect(() => recomecar(storage, AGORA)).toThrow();
      expect(Object.fromEntries(storage.data)).toEqual(inicial);
    }
  });

  it("não sobrescreve um backup anterior com o mesmo instante", () => {
    const storage = memoria({ [KEY]: "{", [CHAVE]: "anterior" });
    recomecar(storage, AGORA);
    expect(storage.data.get(CHAVE)).toBe("anterior");
    expect(storage.data.get(`${CHAVE}-2`)).toBe("{");
  });

  it("se o backup falhar, o conteúdo ilegível fica e o erro propaga", () => {
    const data = new Map([[KEY, "{"]]);
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key.startsWith(BACKUP)) throw new Error("quota");
        data.set(key, value);
      },
    };
    expect(() => recomecar(storage, AGORA)).toThrow("quota");
    expect(data.get(KEY)).toBe("{");
  });
});

// CA05 e L1 da RAFA-228 na dor: sem backup não há lista nova; nova tentativa sem duplicata.
describe("recomeçar sem espaço para o backup", () => {
  const AGORA = new Date("2026-11-25T03:00:30.000Z");
  const DEPOIS = new Date("2026-11-25T03:01:00.000Z");
  const backups = (storage: ReturnType<typeof memoria>) => [...storage.data.keys()].filter((k) => k.startsWith(BACKUP));
  function cheia(inicial: Record<string, string>, aceita: (key: string) => boolean) {
    const storage = memoria(inicial);
    const setItem = storage.setItem;
    storage.setItem = (key, value) => {
      if (!aceita(key)) throw new DOMException("cota", "QuotaExceededError");
      setItem(key, value);
    };
    return storage;
  }

  for (const bruto of ["{", '{"a":1}']) {
    it(`cota cheia no backup (${bruto}): lança e a chave ilegível fica intacta`, () => {
      const storage = cheia({ [KEY]: bruto }, (key) => !key.startsWith(BACKUP));
      expect(() => recomecar(storage, AGORA)).toThrow("cota");
      expect(storage.data.get(KEY)).toBe(bruto);
      expect(backups(storage)).toEqual([]);
    });

    it(`nova tentativa depois de a lista falhar (${bruto}): um backup só`, () => {
      let listaFalha = true;
      const storage = cheia({ [KEY]: bruto }, (key) => key !== KEY || !listaFalha);
      expect(() => recomecar(storage, AGORA)).toThrow("cota");
      expect(() => recomecar(storage, DEPOIS)).toThrow("cota");
      expect(storage.data.get(KEY)).toBe(bruto);
      expect(backups(storage)).toHaveLength(1);
      listaFalha = false;
      recomecar(storage, DEPOIS);
      expect(backups(storage).map((k) => storage.data.get(k))).toEqual([bruto]);
      expect(storage.data.get(KEY)).toBe("[]");
    });
  }

  it("colisão de instante com outro conteúdo usa o sufixo e guarda o texto inteiro", () => {
    const longo = `{${"x".repeat(5000)}`;
    const chave = `${BACKUP}${AGORA.toISOString()}`;
    const storage = memoria({ [KEY]: longo, [chave]: "anterior" });
    recomecar(storage, AGORA);
    expect(storage.data.get(chave)).toBe("anterior");
    expect(storage.data.get(`${chave}-2`)).toBe(longo);
  });
});
