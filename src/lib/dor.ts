// Dor ou desconforto por dia (CA04 da RAFA-176, CA04-1 a CA04-4 da RAFA-184),
// só no aparelho. A anotação é do dia, não de uma atividade, e um dia pode ter
// várias. Chave nova: atividades e plano ficam nas suas chaves, sem migração.
import {
  RiBodyScanLine,
  RiFlashlightLine,
  RiFootprintLine,
  RiLungsLine,
  RiMoreLine,
  RiUser3Line,
} from "@remixicon/react";
import { hoje } from "./atividades";
import { chaveBackup } from "./backup";

export const KEY = "treino-pwa:dor:v1";
/** CA03 da RAFA-228: prefixo das chaves com o conteúdo ilegível, uma por recomeço. */
export const BACKUP = `${KEY}:backup:`;

/**
 * Os 6 ícones do CA04-1 da RAFA-184, nessa ordem, todos com texto livre
 * opcional. Lista fixa só aqui (nome e ícone). O `id` é o que fica salvo;
 * anotações com id fora da lista continuam salvas e aparecem no histórico
 * pelo próprio id.
 */
export const ICONES = [
  { id: "muscular", nome: "Dor muscular", icone: RiBodyScanLine },
  { id: "articular", nome: "Dor articular", icone: RiFootprintLine },
  { id: "costas", nome: "Dor nas costas", icone: RiUser3Line },
  { id: "caibra", nome: "Cãibra", icone: RiFlashlightLine },
  { id: "ar-tontura", nome: "Falta de ar ou tontura", icone: RiLungsLine },
  { id: "outro", nome: "Outro", icone: RiMoreLine },
] as const;

export interface Anotacao {
  id: string;
  /** Dia local no formato AAAA-MM-DD. */
  data: string;
  /** Ids de ICONES marcados, na ordem da lista. */
  icones: string[];
  texto: string;
}

export interface DiaComDor {
  data: string;
  anotacoes: Anotacao[];
}

/** AAAA-MM-DD que existe no calendário local. */
function dataValida(data: unknown): data is string {
  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [a, m, d] = data.split("-").map(Number);
  return hoje(new Date(a, m - 1, d)) === data;
}

/** CA04-2: sem ícone e sem texto não há anotação. */
export function vazia(nova: Pick<Anotacao, "icones" | "texto">): boolean {
  return nova.icones.length === 0 && nova.texto.trim() === "";
}

function valida(item: unknown): item is Anotacao {
  if (typeof item !== "object" || item === null) return false;
  const a = item as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    dataValida(a.data) &&
    Array.isArray(a.icones) &&
    a.icones.every((i) => typeof i === "string" && i !== "") &&
    typeof a.texto === "string" &&
    !vazia(a as unknown as Anotacao)
  );
}

/** Conteúdo bruto salvo: lista (com itens que podem não ser lidos) ou null. */
function bruto(storage: Pick<Storage, "getItem">): unknown[] | null {
  const texto = storage.getItem(KEY);
  if (!texto) return [];
  try {
    const lista: unknown = JSON.parse(texto);
    return Array.isArray(lista) ? lista : null;
  } catch {
    return null;
  }
}

/** Lê as anotações válidas; conteúdo corrompido vira lista vazia, sem apagar. */
export function carregar(storage: Pick<Storage, "getItem">): Anotacao[] {
  return (bruto(storage) ?? []).filter(valida);
}

/** Anotações válidas e se o conteúdo salvo não pode ser lido como lista (CA03 da RAFA-228). */
export function ler(storage: Pick<Storage, "getItem">): { anotacoes: Anotacao[]; ilegivel: boolean } {
  const atual = bruto(storage);
  return { anotacoes: (atual ?? []).filter(valida), ilegivel: atual === null };
}

/**
 * CA03 da RAFA-228: só com conteúdo salvo que não pode ser lido. Copia esse
 * conteúdo para uma chave de backup e, depois, grava a lista nova, vazia.
 */
export function recomecar(storage: Pick<Storage, "getItem" | "setItem">, agora: Date = new Date()): Anotacao[] {
  const texto = storage.getItem(KEY);
  if (texto === null || bruto(storage) !== null) throw new Error("conteúdo salvo legível");
  storage.setItem(chaveBackup(storage, BACKUP, agora), texto);
  storage.setItem(KEY, "[]");
  return [];
}

/**
 * Grava uma anotação nova e devolve a lista válida. Recusa anotação vazia
 * (CA04-2) ou fora do formato. Itens salvos que não podem ser lidos ficam como
 * estão; conteúdo que não é lista não é sobrescrito. Falha de quota propaga.
 */
export function adicionar(
  storage: Pick<Storage, "getItem" | "setItem">,
  nova: Omit<Anotacao, "id">,
  id: string = crypto.randomUUID(),
): Anotacao[] {
  const marcados = new Set(nova.icones);
  const icones = [
    ...ICONES.map((i) => i.id as string).filter((i) => marcados.has(i)),
    ...[...marcados].filter((i) => !ICONES.some((c) => c.id === i)),
  ];
  const anotacao: Anotacao = { id, data: nova.data, icones, texto: nova.texto.trim() };
  if (!valida(anotacao)) throw new Error("anotação inválida");
  const atual = bruto(storage);
  if (atual === null) throw new Error("conteúdo salvo ilegível");
  const lista = [...atual, anotacao];
  storage.setItem(KEY, JSON.stringify(lista));
  return lista.filter(valida);
}

/** CA04-4: só os dias com dor, do mais recente ao mais antigo; no dia, na ordem salva. */
export function historico(lista: readonly Anotacao[]): DiaComDor[] {
  const dias = new Map<string, Anotacao[]>();
  for (const a of lista) dias.set(a.data, [...(dias.get(a.data) ?? []), a]);
  return [...dias.keys()]
    .sort((x, y) => (x < y ? 1 : x > y ? -1 : 0))
    .map((data) => ({ data, anotacoes: dias.get(data)! }));
}
