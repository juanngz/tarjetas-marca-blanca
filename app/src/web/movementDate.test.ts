import { describe, expect, it } from "vitest";
import { movementDate } from "./movementDate";

// Buenos Aires is UTC−3: 12:42 UTC is 9:42 there.
const now = new Date("2026-10-08T15:00:00Z");

describe("when a movement happened, said the way the customer reads it", () => {
  it("today", () => {
    expect(movementDate(new Date("2026-10-08T12:42:00Z"), now)).toBe("Hoy, 9:42");
  });

  it("yesterday", () => {
    expect(movementDate(new Date("2026-10-07T12:42:00Z"), now)).toBe("Ayer, 9:42");
  });

  it("another day this year: the day and the month in words", () => {
    expect(movementDate(new Date("2026-09-30T12:42:00Z"), now)).toBe("30 de septiembre, 9:42");
  });

  it("another year: with the year", () => {
    expect(movementDate(new Date("2025-12-30T23:05:00Z"), now)).toBe(
      "30 de diciembre de 2025, 20:05",
    );
  });

  it("the day is Buenos Aires', not the server's: 1:00 UTC is still yesterday there", () => {
    expect(movementDate(new Date("2026-10-08T01:00:00Z"), now)).toBe("Ayer, 22:00");
  });
});
