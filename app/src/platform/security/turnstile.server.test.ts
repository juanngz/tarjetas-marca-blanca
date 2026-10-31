import { describe, expect, it, vi } from "vitest";
import { turnstileValid } from "./turnstile.server";

const SECRET = "1x0000000000000000000000000000000AA";

function respond(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("Turnstile", () => {
  it("with Cloudflare's valid response, passes", async () => {
    const fetch = respond({ success: true });
    expect(await turnstileValid("token", { secret: SECRET, fetch })).toBe(true);
  });

  it("if Cloudflare says no, doesn't pass", async () => {
    const fetch = respond({ success: false, "error-codes": ["invalid-input-response"] });
    expect(await turnstileValid("token", { secret: SECRET, fetch })).toBe(false);
  });

  it("without a token doesn't pass, and doesn't ask Cloudflare", async () => {
    const fetch = respond({ success: true });
    expect(await turnstileValid("", { secret: SECRET, fetch })).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("if Cloudflare doesn't respond properly, doesn't pass", async () => {
    const fetch = respond({ success: true }, 500);
    expect(await turnstileValid("token", { secret: SECRET, fetch })).toBe(false);
  });

  it("if there's no connection to Cloudflare, doesn't pass", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("no connection");
    });
    expect(await turnstileValid("token", { secret: SECRET, fetch })).toBe(false);
  });

  it("sends Cloudflare the secret, the token and the connection", async () => {
    const fetch = respond({ success: true });
    await turnstileValid("token", { secret: SECRET, ip: "203.0.113.7", fetch });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const form = init.body as FormData;
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect([form.get("secret"), form.get("response"), form.get("remoteip")]).toEqual([
      SECRET,
      "token",
      "203.0.113.7",
    ]);
  });

  // So the log says why someone saw "Algo no salió bien" (sign-in on dev, 11/10/2026: sent before the token).
  describe("when it doesn't pass, the log says why", () => {
    it("without a token", async () => {
      const log = vi.fn();
      await turnstileValid(null, { secret: SECRET, fetch: respond({ success: true }), log });
      expect(log).toHaveBeenCalledWith("turnstile-rejected", { reason: "no-token" });
    });

    it("with Cloudflare's error codes", async () => {
      const log = vi.fn();
      const fetch = respond({ success: false, "error-codes": ["timeout-or-duplicate"] });
      await turnstileValid("token", { secret: SECRET, fetch, log });
      expect(log).toHaveBeenCalledWith("turnstile-rejected", {
        reason: "cloudflare-said-no",
        codes: ["timeout-or-duplicate"],
      });
    });

    it("when Cloudflare doesn't respond properly", async () => {
      const log = vi.fn();
      await turnstileValid("token", { secret: SECRET, fetch: respond({}, 500), log });
      expect(log).toHaveBeenCalledWith("turnstile-rejected", { reason: "http-500" });
    });

    it("when there's no connection to Cloudflare", async () => {
      const log = vi.fn();
      const fetch = vi.fn(async () => {
        throw new Error("no connection");
      });
      await turnstileValid("token", { secret: SECRET, fetch, log });
      expect(log).toHaveBeenCalledWith("turnstile-rejected", { reason: "unreachable" });
    });

    it("and when it passes, logs nothing", async () => {
      const log = vi.fn();
      await turnstileValid("token", { secret: SECRET, fetch: respond({ success: true }), log });
      expect(log).not.toHaveBeenCalled();
    });
  });
});
