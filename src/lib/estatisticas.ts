// Estatísticas (CA01 a CA05 da RAFA-185): calculadas do que já está salvo,
// sem chave nova nem gravação.
import type { Atividade } from "./atividades";
import { TOTAL, TREINOS, type Plano } from "./plano";

export interface Linha {
  nome: string;
  horas: number;
}

export interface Horas {
  /** Soma dos treinos do plano (CA02); 0 quando não há nenhum. */
  plano: number;
  /** Atividades livres, do maior para o menor total (CA01). */
  livres: Linha[];
}

const NOMES_DO_PLANO = new Set(TREINOS);

/** CA02: conta como treino do plano o registro com nome exato de Treino 1 a Treino 28. */
export function doPlano(nome: string): boolean {
  return NOMES_DO_PLANO.has(nome);
}

// Soma em centésimos inteiros: 0,1 + 0,2 dá 0,3, sem resto de ponto flutuante.
const centesimos = (horas: number) => Math.round(horas * 100);

export function horas(atividades: readonly Atividade[]): Horas {
  let plano = 0;
  const livres = new Map<string, number>();
  for (const { nome, horas } of atividades) {
    if (doPlano(nome)) plano += centesimos(horas);
    else livres.set(nome, (livres.get(nome) ?? 0) + centesimos(horas));
  }
  return {
    plano: plano / 100,
    livres: [...livres]
      .sort(([a, x], [b, y]) => y - x || a.localeCompare(b, "pt-BR"))
      .map(([nome, total]) => ({ nome, horas: total / 100 })),
  };
}

/** CA03: treinos marcados como feitos; dia deslizado não entra em feitos. */
export function progresso(plano: Plano | null): { feitos: number; total: number } {
  return { feitos: plano?.feitos.length ?? 0, total: TOTAL };
}
