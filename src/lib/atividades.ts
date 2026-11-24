// Atividades diárias (CA01 da RAFA-176): data, nome e horas, só no aparelho.
// Chave nova: o texto demonstrativo de treino-pwa:registro:v1 não é migrado.
export const KEY = "treino-pwa:atividades:v1";

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
  const bruto = storage.getItem(KEY);
  if (!bruto) return [];
  try {
    const lista: unknown = JSON.parse(bruto);
    return Array.isArray(lista) ? lista.filter(valida) : [];
  } catch {
    return [];
  }
}

/** Grava uma atividade nova e devolve a lista completa. Falha de quota propaga. */
export function adicionar(
  storage: Pick<Storage, "getItem" | "setItem">,
  nova: Omit<Atividade, "id">,
  id: string = crypto.randomUUID(),
): Atividade[] {
  const atividade: Atividade = { ...nova, id, nome: nova.nome.trim() };
  if (!valida(atividade)) throw new Error("atividade inválida");
  const lista = [...carregar(storage), atividade];
  storage.setItem(KEY, JSON.stringify(lista));
  return lista;
}

export function doDia(lista: readonly Atividade[], data: string): Atividade[] {
  return lista.filter((a) => a.data === data);
}
