// Lembrete local (CA06-1 a CA06-4 da RAFA-186): derivado do plano salvo e do
// dia local de hoje, quando o app está aberto. D2: sem permissão de
// notificação, sem push no service worker e sem rede.
import { treinoDoDia, type Plano } from "./plano";

/** Linha da tela Lembretes (CA06-3). */
export const AVISO_IOS = "Sem notificação push no iPhone nesta versão.";

/**
 * Nome do treino previsto para hoje, já com o deslize do CA03, enquanto ele
 * não está feito. Sem plano, sem treino hoje (plano futuro ou terminado) ou
 * com o treino de hoje feito, não há lembrete.
 */
export function lembrete(plano: Plano | null, hoje: string): string | null {
  const treino = treinoDoDia(plano, hoje);
  if (!treino) return null;
  if (treino.feito) return null;
  return treino.nome;
}
