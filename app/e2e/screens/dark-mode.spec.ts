// Layer 4, on a phone in dark mode whose browser darkens pages on its own (Samsung Internet, Chrome with
// "dark theme for sites"): the "phone-dark" project in playwright.config.ts. The app is only in its light theme
// (23/10/2026): with nothing said, that browser inverted the colors and the QR came out grey on black.
import { expect, type Locator, type Page, test } from "@playwright/test";
import { signUp } from "../support/customer";

/**
 * The lightest and darkest of what the person sees in an element, from 0 (black) to 255 (white).
 * Only its top part if asked: what's at the bottom of the screen (Volver a mis tarjetas) can cover the rest.
 */
async function lightness(page: Page, element: Locator, top = 1) {
  const png = (await element.screenshot()).toString("base64");
  return page.evaluate(
    async ({ data, top }) => {
      const image = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${data}`)).blob(),
      );
      const canvas = new OffscreenCanvas(image.width, image.height);
      const context = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, Math.ceil(image.height * top)).data;
      let lightest = 0;
      let darkest = 255;
      let total = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const value = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        lightest = Math.max(lightest, value);
        darkest = Math.min(darkest, value);
        total += value;
      }
      return { lightest, darkest, average: total / (pixels.length / 4) };
    },
    { data: png, top },
  );
}

test("the screens stay in the light theme", async ({ page }) => {
  await page.goto("/");
  const { average } = await lightness(page, page.locator("body"));
  expect(average, "la bienvenida se ve oscura").toBeGreaterThan(180);
});

test("the QR stays black on white", async ({ page }) => {
  await signUp(page);
  await page.getByRole("link", { name: "Ver mi código" }).click();
  const qr = page.getByRole("img", { name: /^Código QR de la tarjeta/ });
  await expect(qr).toBeVisible();
  const { lightest, darkest } = await lightness(page, qr, 0.3);
  expect(lightest, "el QR no es blanco").toBeGreaterThan(240);
  expect(darkest, "el QR no es negro").toBeLessThan(20);
});
