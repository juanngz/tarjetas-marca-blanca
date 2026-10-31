import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findInDb, testDb } from "../../../test/db";
import { createCustomer } from "../../../test/factories";
import { hmacDocumentHasher } from "./documentHasher.server";

const KEY = "test-key-dni";

describe("document hash", () => {
  it("the same DNI with the same key gives the same hash", async () => {
    expect(await hmacDocumentHasher(KEY).hmac("dni", "30123456")).toBe(
      await hmacDocumentHasher(KEY).hmac("dni", "30123456"),
    );
  });

  it("with another key gives another hash", async () => {
    expect(await hmacDocumentHasher(KEY).hmac("dni", "30123456")).not.toBe(
      await hmacDocumentHasher("other-key").hmac("dni", "30123456"),
    );
  });

  it("two different DNIs give different hashes", async () => {
    expect(await hmacDocumentHasher(KEY).hmac("dni", "30123456")).not.toBe(
      await hmacDocumentHasher(KEY).hmac("dni", "30123457"),
    );
  });

  it("a DNI and another document with the same number don't get mixed up", async () => {
    expect(await hmacDocumentHasher(KEY).hmac("dni", "30123456")).not.toBe(
      await hmacDocumentHasher(KEY).hmac("other", "30123456"),
    );
  });

  it("the hash doesn't contain the number", async () => {
    expect(await hmacDocumentHasher(KEY).hmac("dni", "30123456")).not.toContain("30123456");
  });
});

describe("the DNI in the database", () => {
  let t: Awaited<ReturnType<typeof testDb>>;
  beforeAll(async () => {
    t = await testDb();
  });
  afterAll(async () => {
    await t.close();
  });

  it("is never stored as text in any column", async () => {
    await createCustomer(t.db, { dniHmac: await hmacDocumentHasher(KEY).hmac("dni", "30123456") });
    expect(await findInDb(t.d1, "30123456")).toEqual([]);
  });
});
