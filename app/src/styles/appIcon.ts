// The app's icon on the home screen: the tarjeta-1 background edge to edge, and the café's symbol in light
// (public/brand/symbol-light.svg) centered, 74% of the side, so it reads among the other apps. When Android
// cuts it in a circle or a drop (maskable), its own picture with the symbol at 56%, inside the safe circle
// (80%). No text: the phone writes the café's name under it. Run by scripts/icons.mjs (npm run icons),
// checked by appIcon.test.ts.

const SIDE = 512;
const SYMBOL = { any: 0.74, maskable: 0.56 };

/** The icon's SVG, with the symbol (symbol-light.svg) drawn inside. */
export function appIconSvg(
  symbolSvg: string,
  background: string,
  fit: keyof typeof SYMBOL = "any",
): string {
  const [, w, h] = symbolSvg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)?.map(Number) ?? [];
  const inside = symbolSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1];
  if (!w || !h || !inside) throw new Error("symbol-light.svg needs a viewBox starting at 0 0");
  const width = SIDE * SYMBOL[fit];
  const height = (width * h) / w;
  const round = (n: number) => Number(n.toFixed(2));
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIDE} ${SIDE}" width="${SIDE}" height="${SIDE}">`,
    `<rect width="${SIDE}" height="${SIDE}" fill="${background}"/>`,
    `<svg x="${round((SIDE - width) / 2)}" y="${round((SIDE - height) / 2)}" width="${round(width)}" height="${round(height)}" viewBox="0 0 ${w} ${h}">`,
    inside.trim(),
    "</svg>",
    "</svg>",
    "",
  ].join("\n");
}
