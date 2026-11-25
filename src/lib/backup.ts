// Chave de backup local com o instante, no formato do CA03-B3 da RAFA-183:
// se a chave já existir, usa o sufixo -2, -3 e assim por diante, sem sobrescrever.
export function chaveBackup(storage: Pick<Storage, "getItem">, prefixo: string, agora: Date): string {
  const base = `${prefixo}${agora.toISOString()}`;
  let chave = base;
  for (let n = 2; storage.getItem(chave) !== null; n++) chave = `${base}-${n}`;
  return chave;
}
