// Writes, from the café's theme (marca/tokens.json) and config (src/cafes/): src/styles/tokens.css,
// src/styles/theme.ts and public/manifest.webmanifest. Usage, from app/: npm run tokens
// Run it every time the theme or the café's name change (the tokens and icon tests warn).
import { readFileSync, writeFileSync } from "node:fs";
import { activeCafe } from "../src/cafes";
import { manifestJson } from "../src/styles/manifest";
import { themeTs, tokensCss } from "../src/styles/tokens";

const tokens = JSON.parse(readFileSync("../marca/tokens.json", "utf8"));
writeFileSync("src/styles/tokens.css", tokensCss(tokens));
writeFileSync("src/styles/theme.ts", themeTs(tokens));
writeFileSync("public/manifest.webmanifest", manifestJson(activeCafe, tokens));
console.log("Listo: src/styles/tokens.css, src/styles/theme.ts y public/manifest.webmanifest");
