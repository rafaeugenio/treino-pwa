import { describe, it, expect } from "vitest";
import { KEY, load, save } from "./storage";
describe("registro local", () => {
  it("recupera um registro persistido por outra instância", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    expect(load(storage)).toBe("");
    save(storage, " Flexões ");
    expect(data.get(KEY)).toBe("Flexões");
    expect(load(storage)).toBe("Flexões");
  });
  it("propaga falha de quota para a interface tratar", () => {
    expect(() =>
      save(
        {
          setItem: () => {
            throw new Error("quota");
          },
        },
        "Treino",
      ),
    ).toThrow("quota");
  });
});
