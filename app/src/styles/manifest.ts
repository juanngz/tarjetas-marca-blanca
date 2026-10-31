// The app saved on the home screen (manifest.webmanifest), from the café's config and its theme: the Club's
// name, the café's under the icon, and the theme's colors. Run by scripts/tokens.mjs (npm run tokens) and
// checked by appIcon.test.ts.
import type { Cafe } from "../cafes/types";
import { colorOf, type Tokens } from "./tokens";

export function manifestJson(cafe: Cafe, tokens: Tokens): string {
  const manifest = {
    id: "/",
    name: cafe.club.name,
    short_name: cafe.name,
    description: `Tus tarjetas de ${cafe.name}, en el celular.`,
    lang: "es-AR",
    dir: "ltr",
    start_url: "/cards",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // The loading screen, the color of the icon's background; the bar, the page's.
    background_color: colorOf(tokens, "tarjeta-1"),
    theme_color: colorOf(tokens, "fondo"),
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
