import { describe, expect, it } from "vitest";
import { SCREENS, screenFromHash } from "./screens";
describe("screenFromHash", () => {
  it("abre cada tela pelo hash", () => {
    for (const { id } of SCREENS) {
      expect(screenFromHash(`#${id}`)).toBe(id);
      expect(screenFromHash(`#/${id}`)).toBe(id);
    }
  });
  it("cai no início com hash vazio ou desconhecido", () => {
    expect(screenFromHash("")).toBe("inicio");
    expect(screenFromHash("#")).toBe("inicio");
    expect(screenFromHash("#outra")).toBe("inicio");
  });
  it("tem as seis telas do CA08, na ordem", () => {
    expect(SCREENS.map((s) => s.id)).toEqual([
      "inicio",
      "registro",
      "plano",
      "dor",
      "estatisticas",
      "lembretes",
    ]);
  });
});
