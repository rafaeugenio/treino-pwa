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

/**
 * RAFA-229 CA01: atividades livres com o mesmo nome, desconsiderando maiúsculas
 * e espaços das pontas, somam numa linha só. Acentos continuam no nome.
 * RAFA-247 CA03: a chave vai para NFC, então "Vôlei" em NFC e em NFD
 * (o + U+0302) somam juntos; "Volei", sem acento, segue separado.
 */
const chave = (nome: string) => nome.normalize("NFC").trim().toLocaleLowerCase("pt-BR");

export function horas(atividades: readonly Atividade[]): Horas {
  let plano = 0;
  // Rótulo do registro mais recente: maior data e, no mesmo dia, o que vem
  // depois na lista salva (ordem de gravação). Só leitura: nada é regravado.
  const livres = new Map<string, { nome: string; data: string; total: number }>();
  for (const { nome, data, horas } of atividades) {
    if (doPlano(nome)) {
      plano += centesimos(horas);
      continue;
    }
    const k = chave(nome);
    const grupo = livres.get(k);
    if (!grupo) livres.set(k, { nome: nome.trim(), data, total: centesimos(horas) });
    else {
      grupo.total += centesimos(horas);
      if (data >= grupo.data) Object.assign(grupo, { nome: nome.trim(), data });
    }
  }
  return {
    plano: plano / 100,
    livres: [...livres.values()]
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"))
      .map(({ nome, total }) => ({ nome, horas: total / 100 })),
  };
}

/** CA03: treinos marcados como feitos; dia deslizado não entra em feitos. */
export function progresso(plano: Plano | null): { feitos: number; total: number } {
  return { feitos: plano?.feitos.length ?? 0, total: TOTAL };
}
