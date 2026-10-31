import { describe, expect, it, vi } from "vitest";
import { withinLimit } from "./rateLimit.server";

const from = (ip: string) =>
  new Request("https://club.example.test/", { headers: { "CF-Connecting-IP": ip } });

describe("attempt cap per connection", () => {
  it("within the cap, lets through", async () => {
    const limiter = { limit: vi.fn(async () => ({ success: true })) };
    expect(await withinLimit(limiter, from("203.0.113.7"))).toBe(true);
  });

  it("past the cap, stops", async () => {
    const limiter = { limit: vi.fn(async () => ({ success: false })) };
    expect(await withinLimit(limiter, from("203.0.113.7"))).toBe(false);
  });

  it("counts per connection", async () => {
    const limiter = { limit: vi.fn(async () => ({ success: true })) };
    await withinLimit(limiter, from("203.0.113.7"));
    expect(limiter.limit).toHaveBeenCalledWith({ key: "203.0.113.7" });
  });
});
