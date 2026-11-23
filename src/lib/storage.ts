export const KEY = "treino-pwa:registro:v1";
export function load(storage: Pick<Storage, "getItem">): string {
  return storage.getItem(KEY) ?? "";
}
export function save(storage: Pick<Storage, "setItem">, value: string): void {
  storage.setItem(KEY, value.trim());
}
