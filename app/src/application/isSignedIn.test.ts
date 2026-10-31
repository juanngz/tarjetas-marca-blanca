import { describe, expect, it } from "vitest";
import { inMemoryDbWithMarta } from "../../test/fakes";
import { isSignedIn } from "./isSignedIn";

const check = async (customerId: string | null) =>
  isSignedIn({ customerId }, await inMemoryDbWithMarta());

describe("whether someone is signed in", () => {
  it("with a session of an existing customer, they are", async () => {
    expect(await check("marta")).toBe(true);
  });

  it("with a session of a deleted customer, they aren't", async () => {
    expect(await check("deleted")).toBe(false);
  });

  it("without a session, they aren't", async () => {
    expect(await check(null)).toBe(false);
  });
});
