import { describe, expect, it } from "vitest";
import { isSending } from "./registerForms";

const sending = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return { state: "submitting" as const, formData };
};

describe("which form is on its way", () => {
  it("the one whose fields were sent: its button says so", () => {
    const navigation = sending({ intent: "stamp", shortCode: "K7M2QX", version: "3" });
    expect(isSending(navigation, { intent: "stamp", shortCode: "K7M2QX" })).toBe(true);
  });

  it("not another card's, nor another action on the same card", () => {
    const navigation = sending({ intent: "stamp", shortCode: "K7M2QX" });
    expect(isSending(navigation, { intent: "stamp", shortCode: "BBBBBB" })).toBe(false);
    expect(isSending(navigation, { intent: "redeem", shortCode: "K7M2QX" })).toBe(false);
  });

  it("nothing, when nothing is on its way or only a screen is loading", () => {
    expect(isSending({ state: "idle", formData: undefined }, { intent: "stamp" })).toBe(false);
    expect(isSending({ state: "loading", formData: undefined }, { intent: "stamp" })).toBe(false);
  });
});
