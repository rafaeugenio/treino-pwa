import { describe, expect, it } from "vitest";
import config from "../vercel.json";

const [fallback] = config.rewrites;
// source no formato "/(regex)": equivale à regex ancorada no caminho inteiro.
const reescreve = (path: string) =>
  new RegExp(`^/${fallback.source.slice(1)}$`).test(path);
const cache = (source: string) =>
  config.headers
    .find((rule) => rule.source === source)
    ?.headers.find((header) => header.key === "Cache-Control")?.value;

describe("vercel.json", () => {
  it("reescreve navegações da SPA para index.html", () => {
    expect(config.rewrites).toHaveLength(1);
    expect(fallback.destination).toBe("/index.html");
    for (const path of ["/", "/historico", "/plano/dia-2"])
      expect(reescreve(path)).toBe(true);
  });

  it("não captura SW, manifest, ícones nem assets", () => {
    for (const path of [
      "/sw.js",
      "/registerSW.js",
      "/workbox-2fbc6a65.js",
      "/manifest.webmanifest",
      "/apple-touch-icon.png",
      "/icon-maskable.png",
      "/assets/index-B0VwwAaY.js",
      "/assets/index-CCv4l8a5.css",
      "/assets/sem-extensao",
    ])
      expect(reescreve(path)).toBe(false);
  });

  it("serve SW e manifest sem cache longo", () => {
    for (const source of ["/sw.js", "/registerSW.js", "/manifest.webmanifest"])
      expect(cache(source)).toBe("public, max-age=0, must-revalidate");
    expect(cache("/assets/(.*)")).toContain("immutable");
  });
});
