import { describe, expect, it } from "vitest";
import theme from "../../../marca/tokens.json?raw";
import themeInTheApp from "./theme.ts?raw";
import { themeTs, tokensCss } from "./tokens";
import inTheApp from "./tokens.css?raw";

describe("the theme's styles", () => {
  it("tokens.css is up to date with the theme (if not: npm run tokens)", () => {
    expect(inTheApp).toBe(tokensCss(JSON.parse(theme)));
  });

  it("theme.ts is up to date with the theme (if not: npm run tokens)", () => {
    expect(themeInTheApp).toBe(themeTs(JSON.parse(theme)));
  });

  // In rem, the text follows the size the person chose in their browser; the theme writes it in px.
  it("gives the text sizes in rem", () => {
    expect(inTheApp).toContain("--app-cuerpo-size: 1.125rem;");
    expect(inTheApp).not.toMatch(/-size: \d+px;/);
  });

  // The rules that don't change with the café: text never under 16px, the body at 18px.
  it("never sets a text under 16px, and the body at 18px", () => {
    const sizes = [...inTheApp.matchAll(/-size: ([\d.]+)rem;/g)].map(([, rem]) => Number(rem) * 16);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
    expect(inTheApp).toContain("--app-cuerpo-size: 1.125rem;");
  });

  // The touch sizes are the product's, not the café's: a theme can make them bigger, never smaller.
  it("keeps the touch sizes: 48px anything, 56px the main button, 72px at the register", () => {
    const px = (name: string) => Number(inTheApp.match(new RegExp(`--${name}: (\\d+)px;`))?.[1]);
    expect(px("toque-minimo")).toBeGreaterThanOrEqual(48);
    expect(px("toque-principal")).toBeGreaterThanOrEqual(56);
    expect(px("toque-caja")).toBeGreaterThanOrEqual(72);
  });

  it("has every color the four cards need", () => {
    for (const n of [1, 2, 3, 4]) {
      for (const part of ["", "-honda", "-etiqueta", "-premio", "-pastilla", "-sobre-pastilla"]) {
        expect(inTheApp).toContain(`--tarjeta-${n}${part}: `);
      }
      expect(inTheApp).toContain(`--tarjeta-${n}-patron: `);
    }
  });
});
