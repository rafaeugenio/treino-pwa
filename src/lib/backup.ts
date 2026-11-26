// Chave de backup local com o instante, no formato do CA03-B3 da RAFA-183:
// se a chave já existir, usa o sufixo -2, -3 e assim por diante, sem sobrescrever.
export function chaveBackup(storage: Pick<Storage, "getItem">, prefixo: string, agora: Date): string {
  const base = `${prefixo}${agora.toISOString()}`;
  let chave = base;
  for (let n = 2; storage.getItem(chave) !== null; n++) chave = `${base}-${n}`;
  return chave;
}

/** Storage do backup; `key` e `length` permitem achar um backup igual (L1). */
export type StorageBackup = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "key" | "length">>;

/**
 * Guarda `conteudo` numa chave de backup do prefixo e devolve a chave. L1 da
 * RAFA-228: se já existe backup do prefixo com exatamente esse texto, ele é
 * reaproveitado e nada é gravado. Falha de gravação (CA05) propaga.
 */
export function guardarBackup(storage: StorageBackup, prefixo: string, conteudo: string, agora: Date): string {
  if (storage.key && storage.length !== undefined)
    for (let i = 0; i < storage.length; i++) {
      const chave = storage.key(i);
      if (chave?.startsWith(prefixo) && storage.getItem(chave) === conteudo) return chave;
    }
  const chave = chaveBackup(storage, prefixo, agora);
  storage.setItem(chave, conteudo);
  return chave;
}
