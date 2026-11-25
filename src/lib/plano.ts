// Plano de 28 dias e deslize (CA02 e CA03 da RAFA-176), só no aparelho.
// Guarda o dia de início e o dia em que cada treino foi feito; a agenda dos
// pendentes é derivada do dia de hoje, então "o dia termina" é avaliado no
// calendário local quando o app abre (sem backend nem job à meia-noite).
import { adicionar, type Atividade } from "./atividades";

export const KEY = "treino-pwa:plano:v1";
export const TOTAL = 28;

/** Conteúdo fixo no código: sem programa clínico definido, só os nomes. */
export const TREINOS: readonly string[] = Array.from({ length: TOTAL }, (_, i) => `Treino ${i + 1}`);

export interface Plano {
  /** Dia D de início, AAAA-MM-DD local. */
  inicio: string;
  /** feitos[i] é o dia em que o treino i + 1 foi marcado como feito. */
  feitos: string[];
}

export interface DiaDoPlano {
  n: number;
  nome: string;
  data: string;
  feito: boolean;
}

function paraDate(data: string): Date {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(a, m - 1, d);
}

function paraTexto(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Soma dias no calendário local (sem horas, imune a horário de verão). */
export function somarDias(data: string, dias: number): string {
  const date = paraDate(data);
  date.setDate(date.getDate() + dias);
  return paraTexto(date);
}

/** AAAA-MM-DD que existe no calendário: a ida e volta pelo Date recusa o resto. */
function dataValida(data: unknown): data is string {
  return typeof data === "string" && paraTexto(paraDate(data)) === data;
}

function valido(item: unknown): item is Plano {
  // null ou primitivo: o acesso abaixo lança e carregar() devolve null.
  const p = item as Record<string, unknown>;
  if (!dataValida(p.inicio)) return false;
  if (!Array.isArray(p.feitos)) return false;
  if (p.feitos.length > TOTAL) return false;
  let minimo = p.inicio;
  for (const feito of p.feitos) {
    if (!dataValida(feito)) return false;
    // Um treino por dia, em ordem, nunca antes do início.
    if (feito < minimo) return false;
    minimo = somarDias(feito, 1);
  }
  return true;
}

/** Lê o plano salvo; ausente, corrompido ou fora do formato vira null. */
export function carregar(storage: Pick<Storage, "getItem">): Plano | null {
  const bruto = storage.getItem(KEY);
  if (!bruto) return null;
  try {
    const plano: unknown = JSON.parse(bruto);
    return valido(plano) ? { inicio: plano.inicio, feitos: [...plano.feitos] } : null;
  } catch {
    return null;
  }
}

/** Estado salvo: plano válido, nenhum, ou conteúdo que não pode ser lido (CA03-B3). */
export function ler(storage: Pick<Storage, "getItem">): { plano: Plano | null; invalido: boolean } {
  const plano = carregar(storage);
  return { plano, invalido: plano === null && storage.getItem(KEY) !== null };
}

/** Prefixo das chaves de backup do conteúdo inválido, uma por recomeço. */
export const BACKUP = `${KEY}:backup:`;

/**
 * CA03-B3: só com plano salvo que não pode ser lido. Guarda o conteúdo
 * inválido numa chave de backup e, depois, grava o plano novo a partir de hoje.
 */
export function recomecar(
  storage: Pick<Storage, "getItem" | "setItem">,
  hoje: string,
  agora: Date = new Date(),
): Plano {
  const bruto = storage.getItem(KEY);
  if (bruto === null) throw new Error("sem plano salvo");
  if (carregar(storage) !== null) throw new Error("plano válido");
  // Nunca sobrescreve um backup anterior com o mesmo instante.
  const base = `${BACKUP}${agora.toISOString()}`;
  let chave = base;
  for (let n = 2; storage.getItem(chave) !== null; n++) chave = `${base}-${n}`;
  storage.setItem(chave, bruto);
  const plano: Plano = { inicio: hoje, feitos: [] };
  storage.setItem(KEY, JSON.stringify(plano));
  return plano;
}

/**
 * Treinos 1 a 28 com o dia de cada um. O próximo pendente fica no dia seguinte
 * ao último feito (ou em D); se esse dia já passou sem ele feito, desliza para
 * hoje, e os seguintes andam junto, um por dia.
 */
export function agenda(plano: Plano, hoje: string): DiaDoPlano[] {
  const dias = plano.feitos.map((data, i) => ({ n: i + 1, nome: TREINOS[i], data, feito: true }));
  const k = plano.feitos.length;
  if (k === TOTAL) return dias;
  const previsto = k === 0 ? plano.inicio : somarDias(plano.feitos[k - 1], 1);
  const proximo = previsto < hoje ? hoje : previsto;
  for (let i = k; i < TOTAL; i++)
    dias.push({ n: i + 1, nome: TREINOS[i], data: somarDias(proximo, i - k), feito: false });
  return dias;
}

export function treinoDoDia(plano: Plano | null, hoje: string): DiaDoPlano | undefined {
  return plano ? agenda(plano, hoje).find((dia) => dia.data === hoje) : undefined;
}

/** Inicia o plano na data D. Não sobrescreve um plano já iniciado. */
export function iniciar(storage: Pick<Storage, "getItem" | "setItem">, inicio: string): Plano {
  if (!dataValida(inicio)) throw new Error("data inválida");
  if (storage.getItem(KEY) !== null) throw new Error("plano já iniciado");
  const plano: Plano = { inicio, feitos: [] };
  storage.setItem(KEY, JSON.stringify(plano));
  return plano;
}

/**
 * Marca o treino de hoje como feito: avança o plano e registra a atividade no
 * dia, com as horas. Se a gravação da atividade falhar, o plano volta como
 * estava e o erro propaga.
 */
export function marcarFeito(
  storage: Pick<Storage, "getItem" | "setItem">,
  hoje: string,
  horas: number,
  id?: string,
): { plano: Plano; atividades: Atividade[] } {
  const plano = carregar(storage);
  if (!plano) throw new Error("plano não iniciado");
  const treino = treinoDoDia(plano, hoje);
  if (!treino) throw new Error("sem treino hoje");
  if (treino.feito) throw new Error("treino de hoje já feito");
  const anterior = storage.getItem(KEY)!;
  const novo: Plano = { inicio: plano.inicio, feitos: [...plano.feitos, hoje] };
  storage.setItem(KEY, JSON.stringify(novo));
  try {
    const atividades = adicionar(storage, { data: hoje, nome: treino.nome, horas }, id);
    return { plano: novo, atividades };
  } catch (erro) {
    try {
      storage.setItem(KEY, anterior);
    } catch {
      // O erro que importa é o da gravação da atividade.
    }
    throw erro;
  }
}
