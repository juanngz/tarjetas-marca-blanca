import { describe, expect, it } from "vitest";
import { signedUpOn } from "./signedUp";

const BA = "America/Argentina/Buenos_Aires";
const NOW = new Date("2026-10-08T15:00:00Z");

describe("when a customer signed up, to tell two with the same name apart", () => {
  it("this year, the day and the month", () => {
    expect(signedUpOn(new Date("2026-10-01T15:00:00Z"), NOW, BA)).toBe("Se anotó el 1 de octubre");
  });

  it("another year, with the year", () => {
    expect(signedUpOn(new Date("2025-03-20T15:00:00Z"), NOW, BA)).toBe(
      "Se anotó el 20 de marzo de 2025",
    );
  });

  it("by the café's day, not by UTC's", () => {
    // 1:00 in UTC on 2 October is still 1 October in Buenos Aires.
    expect(signedUpOn(new Date("2026-10-02T01:00:00Z"), NOW, BA)).toBe("Se anotó el 1 de octubre");
  });
});
