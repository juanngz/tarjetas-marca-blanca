// The register on the test D1, for the route tests: Marta García with her cards, and Ana signed in.
import type { testDb } from "./db";
import { createCustomer, createStaffMember, staffCookie } from "./factories";

export async function registerOnD1(t: Awaited<ReturnType<typeof testDb>>) {
  const { customer, cards } = await createCustomer(t.db);
  const card = (type: string) => {
    const found = cards.find((c) => c.type === type);
    if (!found) throw new Error(`Missing the ${type} card.`);
    return found;
  };
  const ana = await createStaffMember(t.db);
  return { customer, card, ana, cookie: await staffCookie(ana) };
}
