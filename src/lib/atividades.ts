// Atividades diárias (CA01 da RAFA-176): data, nome e horas, só no aparelho.
// Chave nova: o texto demonstrativo de treino-pwa:registro:v1 não é migrado.
import { guardarBackup, type StorageBackup } from "./backup";

export const KEY = "treino-pwa:atividades:v1";
/** CA02 da RAFA-228: prefixo das chaves com as entradas inválidas guardadas. */
export const BACKUP = `${KEY}:backup:`;

export interface Atividade {
  id: string;
  /** Dia local no formato AAAA-MM-DD. */
  data: string;
  nome: string;
  horas: number;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Aceita "1,5", "1.5" e "2"; arredonda a centésimos e devolve null fora de (0, 24]. */
export function parseHoras(texto: string): number | null {
  const limpo = texto.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(limpo)) return null;
  const horas = Math.round(Number(limpo) * 100) / 100;
  return horas > 0 && horas <= 24 ? horas : null;
}

export function formatHoras(horas: number): string {
  return `${horas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} h`;
}

/** Hoje no fuso do aparelho, como AAAA-MM-DD. */
export function hoje(agora = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}

function valida(item: unknown): item is Atividade {
  if (typeof item !== "object" || item === null) return false;
  const a = item as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    typeof a.data === "string" &&
    DATA.test(a.data) &&
    typeof a.nome === "string" &&
    a.nome.trim() !== "" &&
    typeof a.horas === "number" &&
    a.horas > 0 &&
    a.horas <= 24
  );
}

/** Lê a lista salva; conteúdo corrompido ou de outro formato vira lista vazia. */
export function carregar(storage: Pick<Storage, "getItem">): Atividade[] {
  return salvas(storage).filter(valida);
}

/**
 * Grava uma atividade nova e devolve a lista completa. CA02 da RAFA-228:
 * entradas salvas que não passam em `valida` vão para uma chave de backup antes
 * da regravação. CA04: conteúdo salvo que não é lista JSON vai inteiro, bruto,
 * para uma chave de backup antes da gravação. CA05: se o backup falhar, nada é
 * regravado e o erro propaga. L1: backup de mesmo conteúdo não é repetido.
 */
export function adicionar(
  storage: StorageBackup,
  nova: Omit<Atividade, "id">,
  id: string = crypto.randomUUID(),
  agora: Date = new Date(),
): Atividade[] {
  const atividade: Atividade = { ...nova, id, nome: nova.nome.trim() };
  if (!valida(atividade)) throw new Error("atividade inválida");
  const bruto = storage.getItem(KEY);
  if (bruto && naoLista(bruto)) guardarBackup(storage, BACKUP, bruto, agora);
  const invalidas = salvas(storage).filter((item) => !valida(item));
  if (invalidas.length) guardarBackup(storage, BACKUP, JSON.stringify(invalidas), agora);
  const lista = [...carregar(storage), atividade];
  storage.setItem(KEY, JSON.stringify(lista));
  return lista;
}

/** CA04: JSON inválido ou valor que não é lista. */
function naoLista(bruto: string): boolean {
  try {
    return !Array.isArray(JSON.parse(bruto));
  } catch {
    return true;
  }
}

/** Itens da lista salva, válidos ou não; conteúdo que não é lista fica de fora. */
function salvas(storage: Pick<Storage, "getItem">): unknown[] {
  const bruto = storage.getItem(KEY);
  if (!bruto) return [];
  try {
    const lista: unknown = JSON.parse(bruto);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function doDia(lista: readonly Atividade[], data: string): Atividade[] {
  return lista.filter((a) => a.data === data);
}
