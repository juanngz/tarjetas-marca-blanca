// Layer 3: the register's journeys that can't fail (pruebas skill, journeys 3 to 5).
// The register scans the customer's QR, which adds the stamp by itself; the other journeys type the code she
// reads out and tap Sumar sello, which is quicker.
// The customer keeps her code screen open and sees what the register did by itself: the sello en vivo.
import { expect, test } from "@playwright/test";
import { pointCameraAt, qrOnScreen, startCamera } from "../support/camera";
import { signUp } from "../support/customer";
import { addStamp, findCard, shortCodeOf, signInAtRegister } from "../support/register";

test("the register scans, adds a stamp and the customer sees it, live", async ({
  page: customer,
  browser,
}) => {
  const { dni } = await signUp(customer, { name: "Marta García" });
  // She opens her card's code and keeps it open while the barista scans it.
  await shortCodeOf(customer, "take-away");

  const register = await (await browser.newContext()).newPage();
  await pointCameraAt(register, await qrOnScreen(customer));
  await signInAtRegister(register);
  await startCamera(register);
  // Scanning adds the stamp by itself (decided on 08/10/2026): straight to its confirmation.
  await expect(register.getByRole("heading", { name: "Sello sumado" })).toBeVisible();
  await expect(register.getByText("Marta García")).toBeVisible();
  await expect(register.getByText("1 de 8")).toBeVisible();
  // The DNI is never shown at the register.
  for (const shown of [dni, dni.replace(/\B(?=(\d{3})+$)/g, ".")]) {
    await expect(register.locator("body")).not.toContainText(shown);
  }

  await expect(customer.getByText("1 de 8 sellos")).toBeVisible();
  // Said in words, and it stays: she was showing the phone to the barista when it arrived (Flujo 3).
  await expect(customer.getByText("Sumaste un sello · 1 de 8")).toBeVisible();
});

test("complete a card and redeem the reward, with the customer watching", async ({
  page: customer,
  browser,
}) => {
  await signUp(customer, { name: "Marta García" });
  const code = await shortCodeOf(customer, "beans-quarter");

  const register = await (await browser.newContext()).newPage();
  await signInAtRegister(register);
  for (let i = 0; i < 3; i++) await addStamp(register, code);
  // The 4th stamp: the next purchase is the reward's slot, the 5th, like on the paper card (18/10/2026).
  await addStamp(register, code);
  await expect(register.getByRole("heading", { name: "Sello sumado" })).toBeVisible();
  await expect(
    register.getByText("Marta ganó 30% OFF en su próxima bolsa de ¼ kg. Decíselo."),
  ).toBeVisible();

  // No festejo yet: it's when the reward's slot is stamped. The card stays at 4 de 5, not back to 0.
  await expect(customer.getByText("4 de 5 sellos", { exact: true })).toBeVisible();
  await expect(customer.getByRole("dialog")).toHaveCount(0);
  // The reward is used in a later purchase: the customer's screen doesn't say "premio".
  await expect(customer.locator(".code-card").getByText(/premio/)).toHaveCount(0);

  // Next time she comes, the barista opens her card and the notice pops up by itself: the reward is used now.
  await findCard(register, code);
  const notice = register.getByRole("dialog", { name: "Marta tiene un premio" });
  await expect(notice.getByText("30% OFF en ¼ kg.")).toBeVisible();
  await expect(notice.getByText("Si lo usa en esta compra, hacele el descuento.")).toBeVisible();
  await notice.getByRole("button", { name: "Canjear premio" }).click();
  await expect(register.getByRole("heading", { name: "Premio canjeado" })).toBeVisible();

  // Stamping the reward's slot completes the card: now the customer celebrates.
  const celebration = customer.getByRole("dialog", { name: "¡Completaste la tarjeta!" });
  await expect(celebration).toContainText("30% OFF en tu bolsa de ¼ kg. Que la disfrutes.");
  await celebration.getByRole("button", { name: "Seguir" }).click();
  await expect(customer.getByText("0 de 5 sellos", { exact: true })).toBeVisible();
});

test("undo at the register, and the customer sees it undone", async ({
  page: customer,
  browser,
}) => {
  await signUp(customer, { name: "Marta García" });
  const code = await shortCodeOf(customer, "take-away");

  const register = await (await browser.newContext()).newPage();
  await signInAtRegister(register);
  await addStamp(register, code);
  await expect(customer.getByText("1 de 8 sellos")).toBeVisible();

  await register.getByRole("button", { name: "Deshacer" }).click();
  // In the same sheet over the card.
  const sheet = register.getByRole("dialog", { name: "Sello deshecho" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("0 de 8")).toBeVisible();
  await expect(register.getByRole("button", { name: "Deshacer" })).toHaveCount(0);

  await expect(customer.getByText("0 de 8 sellos")).toBeVisible();
  // What was undone didn't happen, for the customer.
  await expect(customer.getByText(/Sumaste un sello/)).toHaveCount(0);
});
