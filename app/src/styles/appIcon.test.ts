import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import theme from "../../../marca/tokens.json?raw";
import { activeCafe } from "../cafes";
import { appIconSvg } from "./appIcon";
import { manifestJson } from "./manifest";
import { colorOf } from "./tokens";

const inPublic = (path: string) => new URL(`../../public${path}`, import.meta.url);
const symbol = readFileSync(inPublic("/brand/symbol-light.svg"), "utf8");
const manifestFile = readFileSync(inPublic("/manifest.webmanifest"), "utf8");
const manifest = JSON.parse(manifestFile);
const color = (name: string) => colorOf(JSON.parse(theme), name);

/** Width and height of a PNG, from its header. */
function pngSize(path: string) {
  const png = readFileSync(inPublic(path));
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
}

describe("the app's icon", () => {
  it("is up to date with the café's symbol and theme (if not: npm run icons)", () => {
    expect(readFileSync(inPublic("/icons/icon.svg"), "utf8")).toBe(
      appIconSvg(symbol, color("tarjeta-1")),
    );
    expect(readFileSync(inPublic("/icons/icon-maskable.svg"), "utf8")).toBe(
      appIconSvg(symbol, color("tarjeta-1"), "maskable"),
    );
  });

  it("has the tarjeta-1 background, edge to edge", () => {
    expect(appIconSvg(symbol, "#1d1d1b")).toContain(
      '<rect width="512" height="512" fill="#1d1d1b"/>',
    );
  });

  /** Where the symbol goes: x, y, width and height. */
  const symbolIn = (svg: string) =>
    svg
      .match(/<svg x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/)
      ?.slice(1)
      .map(Number) ?? [];

  // Big, so it reads at a glance among the other apps.
  it("the symbol takes 74% of the side, centered", () => {
    const [x = 0, y = 0, width = 0, height = 0] = symbolIn(appIconSvg(symbol, "#1d1d1b"));
    expect(width / 512).toBeCloseTo(0.74, 2);
    expect(x * 2 + width).toBeCloseTo(512, 1);
    expect(y * 2 + height).toBeCloseTo(512, 1);
  });

  // Android cuts it in a circle or a drop: there, the symbol has to fit in the safe circle (80%).
  it("when Android cuts it, the symbol takes 56%, inside the safe circle", () => {
    const [x = 0, y = 0, width = 0, height = 0] = symbolIn(
      appIconSvg(symbol, "#1d1d1b", "maskable"),
    );
    expect(width / 512).toBeCloseTo(0.56, 2);
    expect(x * 2 + width).toBeCloseTo(512, 1);
    expect(y * 2 + height).toBeCloseTo(512, 1);
    expect(Math.hypot(width, height) / 2).toBeLessThan(512 * 0.4);
  });

  it("each picture has the size it says", () => {
    const pictures = manifest.icons.filter((icon: { type: string }) => icon.type === "image/png");
    for (const icon of pictures) expect(pngSize(icon.src)).toBe(icon.sizes);
    expect(pngSize("/icons/apple-touch-icon.png")).toBe("180x180");
  });
});

describe("the app saved on the home screen", () => {
  it("is up to date with the café and its theme (if not: npm run tokens)", () => {
    expect(manifestFile).toBe(manifestJson(activeCafe, JSON.parse(theme)));
  });

  it("is called by the café's name under its icon, and by the Club's when installed", () => {
    expect(manifest.short_name).toBe(activeCafe.name);
    expect(manifest.name).toBe(activeCafe.club.name);
  });

  it("opens on the cards, without the browser's bar", () => {
    expect(manifest.start_url).toBe("/cards");
    expect(manifest.display).toBe("standalone");
  });

  it("the bar is the page's background and the loading screen the icon's", () => {
    expect(manifest.theme_color).toBe(color("fondo"));
    expect(manifest.background_color).toBe(color("tarjeta-1"));
  });

  it("can be cut in a circle by Android, with its own picture", () => {
    const maskable = manifest.icons.filter(
      (icon: { purpose?: string }) => icon.purpose === "maskable",
    );
    expect(maskable.map((icon: { src: string }) => icon.src)).toEqual([
      "/icons/icon-maskable-512.png",
    ]);
  });
});
