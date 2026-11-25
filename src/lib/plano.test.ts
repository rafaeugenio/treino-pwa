import { describe, it, expect } from "vitest";
import { KEY as KEY_ATIVIDADES, carregar as carregarAtividades } from "./atividades";
import { KEY, TOTAL, TREINOS, agenda, carregar, iniciar, marcarFeito, somarDias, treinoDoDia } from "./plano";

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
const D = "2026-11-24";
const salvo = (plano: unknown) => memoria({ [KEY]: JSON.stringify(plano) });

describe("calendário local", () => {
  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("2026-11-30", 1)).toBe("2026-12-01");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias(D, 27)).toBe("2026-12-21");
  });
});

describe("plano de 28 dias (CA02)", () => {
  it("lista os treinos 1 a 28 fixos no código", () => {
    expect(TREINOS).toHaveLength(TOTAL);
    expect(TREINOS[0]).toBe("Treino 1");
    expect(TREINOS[27]).toBe("Treino 28");
  });
  it("mostra os treinos 1 a 28 em dias consecutivos a partir de D", () => {
    const dias = agenda({ inicio: D, feitos: [] }, D);
    expect(dias.map((d) => d.n)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
    dias.forEach((dia, i) => expect(dia.data).toBe(somarDias(D, i)));
    expect(dias.every((d) => !d.feito)).toBe(true);
  });
  it("plano futuro não tem treino hoje e não desliza antes de D", () => {
    const plano = { inicio: "2026-11-26", feitos: [] };
    expect(treinoDoDia(plano, D)).toBeUndefined();
    expect(agenda(plano, D)[0].data).toBe("2026-11-26");
  });
  it("marcar o treino de hoje registra no dia com horas e avança o progresso", () => {
    const storage = memoria();
    iniciar(storage, D);
    expect(treinoDoDia(carregar(storage), D)).toMatchObject({ n: 1, nome: "Treino 1", feito: false });
    const { plano, atividades } = marcarFeito(storage, D, 1.5, "t1");
    expect(plano.feitos).toEqual([D]);
    expect(atividades).toEqual([{ id: "t1", data: D, nome: "Treino 1", horas: 1.5 }]);
    expect(carregar(storage)).toEqual({ inicio: D, feitos: [D] });
    expect(treinoDoDia(carregar(storage), D)).toMatchObject({ n: 1, feito: true });
    expect(treinoDoDia(carregar(storage), somarDias(D, 1))).toMatchObject({ n: 2, feito: false });
  });
  it("persiste numa chave própria sem tocar nas atividades já salvas", () => {
    const storage = memoria({ [KEY_ATIVIDADES]: '[{"id":"a","data":"2026-11-23","nome":"Vôlei","horas":1}]' });
    iniciar(storage, D);
    expect(JSON.parse(storage.data.get(KEY)!)).toEqual({ inicio: D, feitos: [] });
    expect(carregarAtividades(storage)).toEqual([{ id: "a", data: "2026-11-23", nome: "Vôlei", horas: 1 }]);
  });
});

describe("deslize (CA03)", () => {
  it("dia sem registro desliza o treino N e os seguintes um dia, sem pular nem repetir", () => {
    const plano = { inicio: D, feitos: [D] };
    const antes = agenda(plano, somarDias(D, 1));
    const depois = agenda(plano, somarDias(D, 2));
    expect(antes[1]).toMatchObject({ n: 2, data: somarDias(D, 1) });
    expect(depois[1]).toMatchObject({ n: 2, data: somarDias(D, 2) });
    for (let i = 1; i < 28; i++) expect(depois[i].data).toBe(somarDias(antes[i].data, 1));
    expect(depois.map((d) => d.n)).toEqual(antes.map((d) => d.n));
    expect(new Set(depois.map((d) => d.data)).size).toBe(28);
    expect(depois[27].data).toBe(somarDias(antes[27].data, 1));
  });
  it("a data final anda um dia por dia deslizado", () => {
    const plano = { inicio: D, feitos: [] };
    const fim = (hoje: string) => agenda(plano, hoje)[27].data;
    expect(fim(D)).toBe(somarDias(D, 27));
    expect(fim(somarDias(D, 1))).toBe(somarDias(D, 28));
    expect(fim(somarDias(D, 3))).toBe(somarDias(D, 30));
  });
  it("atividade substituta não conta como treino e fica no histórico com as horas", () => {
    const storage = memoria();
    iniciar(storage, D);
    // Dia D: só Futebol 2 h. No dia seguinte o Treino 1 está previsto.
    storage.setItem(KEY_ATIVIDADES, JSON.stringify([{ id: "f", data: D, nome: "Futebol", horas: 2 }]));
    const amanha = somarDias(D, 1);
    expect(treinoDoDia(carregar(storage), amanha)).toMatchObject({ n: 1, feito: false });
    marcarFeito(storage, amanha, 1, "t1");
    expect(carregarAtividades(storage)).toEqual([
      { id: "f", data: D, nome: "Futebol", horas: 2 },
      { id: "t1", data: amanha, nome: "Treino 1", horas: 1 },
    ]);
    expect(agenda(carregar(storage)!, amanha)[27].data).toBe(somarDias(D, 28));
  });
  it("depois do 28º feito não há treino previsto", () => {
    const feitos = Array.from({ length: 28 }, (_, i) => somarDias(D, i));
    const plano = { inicio: D, feitos };
    expect(agenda(plano, somarDias(D, 40))).toHaveLength(28);
    expect(treinoDoDia(plano, somarDias(D, 28))).toBeUndefined();
  });
});

describe("guardas", () => {
  it("iniciar recusa data inválida sem gravar", () => {
    for (const data of ["", "24/11/2026", "2026-1-5", "2026-02-30"]) {
      const storage = memoria();
      expect(() => iniciar(storage, data)).toThrow("data inválida");
      expect(storage.data.has(KEY)).toBe(false);
    }
  });
  it("iniciar não sobrescreve plano já iniciado", () => {
    const storage = salvo({ inicio: D, feitos: [D] });
    expect(() => iniciar(storage, "2026-12-01")).toThrow("plano já iniciado");
    expect(carregar(storage)).toEqual({ inicio: D, feitos: [D] });
  });
  it("marcar sem plano iniciado falha sem gravar", () => {
    const storage = memoria();
    expect(() => marcarFeito(storage, D, 1)).toThrow("plano não iniciado");
    expect(storage.data.size).toBe(0);
  });
  it("marcar num dia sem treino previsto falha sem gravar", () => {
    const storage = salvo({ inicio: "2026-11-26", feitos: [] });
    expect(() => marcarFeito(storage, D, 1)).toThrow("sem treino hoje");
    expect(carregar(storage)).toEqual({ inicio: "2026-11-26", feitos: [] });
    expect(storage.data.has(KEY_ATIVIDADES)).toBe(false);
  });
  it("marcar duas vezes no mesmo dia não repete treino", () => {
    const storage = salvo({ inicio: D, feitos: [D] });
    expect(() => marcarFeito(storage, D, 1)).toThrow("treino de hoje já feito");
    expect(carregar(storage)).toEqual({ inicio: D, feitos: [D] });
    expect(storage.data.has(KEY_ATIVIDADES)).toBe(false);
  });
  it("falha ao gravar a atividade devolve o plano ao estado anterior", () => {
    const storage = salvo({ inicio: D, feitos: [] });
    const original = storage.setItem;
    storage.setItem = (key, value) => {
      if (key === KEY_ATIVIDADES) throw new Error("quota");
      original(key, value);
    };
    expect(() => marcarFeito(storage, D, 1)).toThrow("quota");
    expect(carregar(storage)).toEqual({ inicio: D, feitos: [] });
  });
  it("horas inválidas não avançam o plano", () => {
    const storage = salvo({ inicio: D, feitos: [] });
    expect(() => marcarFeito(storage, D, 0)).toThrow("atividade inválida");
    expect(carregar(storage)).toEqual({ inicio: D, feitos: [] });
  });
});

describe("plano salvo inválido vira não iniciado", () => {
  const casos: [string, unknown][] = [
    ["não é objeto", "x"],
    ["nulo", null],
    ["início fora do formato", { inicio: "24/11/2026", feitos: [] }],
    ["início inexistente no calendário", { inicio: "2026-02-30", feitos: [] }],
    ["feitos não é lista", { inicio: D, feitos: {} }],
    ["mais de 28 feitos", { inicio: D, feitos: Array.from({ length: 29 }, (_, i) => somarDias(D, i)) }],
    ["feito fora do formato", { inicio: D, feitos: ["ontem"] }],
    ["feito antes do início", { inicio: D, feitos: [somarDias(D, -1)] }],
    ["dois treinos no mesmo dia", { inicio: D, feitos: [D, D] }],
  ];
  for (const [titulo, plano] of casos) it(titulo, () => expect(carregar(salvo(plano))).toBeNull());
  it("JSON corrompido", () => expect(carregar(memoria({ [KEY]: "{" }))).toBeNull());
  it("aceita o formato válido", () => expect(carregar(salvo({ inicio: D, feitos: [D] }))).toEqual({ inicio: D, feitos: [D] }));
});
