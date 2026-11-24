export const SCREENS = [
  { id: "inicio", title: "Início" },
  { id: "registro", title: "Registro" },
  { id: "plano", title: "Plano" },
  { id: "dor", title: "Dor" },
  { id: "estatisticas", title: "Estatísticas" },
  { id: "lembretes", title: "Lembretes" },
] as const;
export type ScreenId = (typeof SCREENS)[number]["id"];
export function screenFromHash(hash: string): ScreenId {
  const id = hash.replace(/^#\/?/, "");
  return SCREENS.find((screen) => screen.id === id)?.id ?? "inicio";
}
