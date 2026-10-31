import { describe, expect, it } from "vitest";
import { readSecrets } from "./secrets.server";

const complete = {
  DNI_HMAC_KEY: "test-key-dni",
  PIN_HMAC_KEY: "test-key-pin",
  CUSTOMER_SESSION_KEY: "test-key-customer-session",
  STAFF_SESSION_KEY: "test-key-staff-session",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
};

describe("read the secrets", () => {
  it("with all of them, returns them", () => {
    expect(readSecrets(complete)).toEqual({
      dniHmacKey: "test-key-dni",
      pinHmacKey: "test-key-pin",
      customerSessionKey: "test-key-customer-session",
      staffSessionKey: "test-key-staff-session",
      turnstileSecretKey: "1x0000000000000000000000000000000AA",
    });
  });

  it("if one is missing, stops and says which", () => {
    const { PIN_HMAC_KEY: _, ...withoutPin } = complete;
    expect(() => readSecrets(withoutPin)).toThrow("PIN_HMAC_KEY");
  });

  it("an empty one counts as missing", () => {
    expect(() => readSecrets({ ...complete, DNI_HMAC_KEY: "" })).toThrow("DNI_HMAC_KEY");
  });

  it("the error never shows the value of the other secrets", () => {
    expect(() => readSecrets({ ...complete, TURNSTILE_SECRET_KEY: "" })).not.toThrow(
      "test-key-dni",
    );
  });
});
