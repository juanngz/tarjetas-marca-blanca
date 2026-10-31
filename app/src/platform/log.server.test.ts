import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testDb } from "../../test/db";
import { createCustomer } from "../../test/factories";
import { log, logError } from "./log.server";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** Everything written to the logs. */
function written() {
  return [...vi.mocked(console.log).mock.calls, ...vi.mocked(console.error).mock.calls]
    .flat()
    .join("\n");
}

describe("log an event", () => {
  it("writes the event and its data", () => {
    log("stamp-added", { card: "take-away" });
    expect(written()).toMatch(/stamp-added.*take-away/);
  });

  it("redacts the DNI, with or without dots", () => {
    log("test", { detail: "signed in with 30123456 and then with 30.123.457" });
    expect(written()).not.toMatch(/30\.?123\.?45[67]/);
  });

  it("redacts the fields that never go to a log", () => {
    log("test", { name: "Marta García", document: "AB12345", pin: "482915" });
    expect(written()).not.toMatch(/Marta|AB12345|482915/);
  });
});

describe("log a database error", () => {
  let t: Awaited<ReturnType<typeof testDb>>;
  beforeAll(async () => {
    t = await testDb();
  });
  beforeEach(async () => {
    await t.clear();
  });
  afterAll(async () => {
    await t.close();
  });

  /** Signing up the same document twice: Drizzle's error carries the name in its data. */
  async function dbError() {
    await createCustomer(t.db, { dniHmac: "repeated-hmac" });
    try {
      await createCustomer(t.db, { dniHmac: "repeated-hmac", name: "Marta García" });
    } catch (error) {
      return error;
    }
    throw new Error("It should have failed.");
  }

  it("doesn't write the query's data", async () => {
    logError(await dbError(), "sign-up");
    expect(written()).not.toMatch(/Marta|repeated-hmac/);
  });

  it("writes why it failed", async () => {
    logError(await dbError(), "sign-up");
    expect(written()).toContain("UNIQUE constraint failed: customers.dni_hmac");
  });

  it("writes where it failed", async () => {
    logError(await dbError(), "sign-up");
    expect(written()).toContain("sign-up");
  });
});
