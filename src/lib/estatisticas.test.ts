import { describe, it, expect } from "vitest";
import { adicionar, carregar, formatHoras, type Atividade } from "./atividades";
import { doPlano, horas, progresso } from "./estatisticas";
import { agenda, iniciar, marcarFeito } from "./plano";

let n = 0;
const reg = (nome: string, h: number, data = "2026-11-24"): Atividade => ({ id: String(n++), data, nome, horas: h });

function memoria() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("horas por atividade (CA01)", () => {
  it("soma por atividade, do maior para o menor, em pt-BR com vírgula", () => {
    const r = horas([reg("Futebol", 2, "2026-11-22"), reg("Vôlei", 1.5, "2026-11-23"), reg("Vôlei", 2, "2026-11-24")]);
    expect(r.livres).toEqual([
      { nome: "Vôlei", horas: 3.5 },
      { nome: "Futebol", horas: 2 },
    ]);
    expect(r.livres.map((l) => formatHoras(l.horas))).toEqual(["3,5 h", "2 h"]);
  });

  it("empate segue a ordem alfabética, não a de gravação", () => {
    expect(horas([reg("Vôlei", 1), reg("Corrida", 1)]).livres.map((l) => l.nome)).toEqual(["Corrida", "Vôlei"]);
  });

  it("soma em centésimos, sem resto de ponto flutuante", () => {
    const r = horas([reg("Alongamento", 0.1), reg("Alongamento", 0.2), reg("Treino 1", 0.1), reg("Treino 2", 0.2)]);
    expect(r.livres).toEqual([{ nome: "Alongamento", horas: 0.3 }]);
    expect(r.plano).toBe(0.3);
  });
});

describe("horas dos treinos do plano (CA02)", () => {
  it("nome exato de Treino 1 a Treino 28 vai para a linha do plano, fora das livres", () => {
    const r = horas([reg("Treino 1", 1), reg("Treino 28", 0.5), reg("Vôlei", 2)]);
    expect(r.plano).toBe(1.5);
    expect(r.livres).toEqual([{ nome: "Vôlei", horas: 2 }]);
  });

  it("só o nome exato conta: nomes parecidos ficam como atividade livre", () => {
    for (const nome of ["Treino 29", "Treino 0", "treino 1", "Treino 01", "Treino 1 extra", "Treino"]) {
      expect(doPlano(nome), nome).toBe(false);
      expect(horas([reg(nome, 1)]).plano, nome).toBe(0);
    }
    expect(doPlano("Treino 1")).toBe(true);
    expect(doPlano("Treino 28")).toBe(true);
  });

  it("conta Treino N de plano anterior ao Recomeçar e o digitado no Registro", () => {
    const r = horas([reg("Treino 1", 1, "2026-10-01"), reg("Treino 1", 1, "2026-11-24"), reg("Treino 5", 0.5)]);
    expect(r.plano).toBe(2.5);
    expect(r.livres).toEqual([]);
  });

  it("sem treino do plano a soma é 0", () => {
    expect(horas([reg("Vôlei", 2)]).plano).toBe(0);
  });

  it("marcar Feito pelo plano entra na linha do plano", () => {
    const storage = memoria();
    iniciar(storage, "2026-11-24");
    const { atividades } = marcarFeito(storage, "2026-11-24", 1.25);
    adicionar(storage, { data: "2026-11-24", nome: "Vôlei", horas: 1 });
    expect(horas(atividades).plano).toBe(1.25);
    expect(horas(carregar(storage))).toEqual({ plano: 1.25, livres: [{ nome: "Vôlei", horas: 1 }] });
  });
});

describe("progresso do plano (CA03)", () => {
  it("K de 28 com K treinos feitos; dias deslizados não contam", () => {
    const plano = { inicio: "2026-11-20", feitos: ["2026-11-20", "2026-11-23"] };
    // Treinos 2 e 3 deslizaram: a agenda mostra 21 e 22 sem treino feito.
    expect(agenda(plano, "2026-11-24").filter((d) => d.feito)).toHaveLength(2);
    expect(progresso(plano)).toEqual({ feitos: 2, total: 28 });
  });

  it("sem plano (ou plano ilegível, lido como null) é 0 de 28", () => {
    expect(progresso(null)).toEqual({ feitos: 0, total: 28 });
  });
});

describe("sem dados (CA04)", () => {
  it("nenhuma linha e 0 de 28", () => {
    expect(horas([])).toEqual({ plano: 0, livres: [] });
    expect(progresso(null)).toEqual({ feitos: 0, total: 28 });
  });
});
