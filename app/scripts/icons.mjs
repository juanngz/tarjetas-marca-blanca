// Writes the app's icon (public/icons/) from the café's symbol. Usage, from app/: npm run icons
// Run it every time public/brand/symbol-light.svg or the tarjeta-1 color change (appIcon.test.ts warns).
// The pictures are drawn by the browser the end-to-end tests use (Playwright's Chromium), so nothing else needs installing.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { appIconSvg } from "../src/styles/appIcon";
import { colorOf } from "../src/styles/tokens";

const tokens = JSON.parse(readFileSync("../marca/tokens.json", "utf8"));
const background = colorOf(tokens, "tarjeta-1");
const symbol = readFileSync("public/brand/symbol-light.svg", "utf8");
const any = appIconSvg(symbol, background);
// When Android cuts it in a circle or a drop: the symbol smaller, inside the safe circle.
const maskable = appIconSvg(symbol, background, "maskable");

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon.svg", any);
writeFileSync("public/icons/icon-maskable.svg", maskable);

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, svg] of [
  ["icon-192.png", 192, any],
  ["icon-512.png", 512, any],
  ["icon-maskable-512.png", 512, maskable],
  ["apple-touch-icon.png", 180, any],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  writeFileSync(`public/icons/${name}`, await page.screenshot({ omitBackground: false }));
}
await browser.close();
console.log("Listo: public/icons/");
