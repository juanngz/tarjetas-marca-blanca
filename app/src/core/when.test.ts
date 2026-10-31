import { describe, expect, it } from "vitest";
import { dayAndTime } from "./when";

const BA = "America/Argentina/Buenos_Aires";
const NOW = new Date("2026-10-08T15:00:00Z");

describe("when something happened, said in the café's voice", () => {
  it("the day and the time of the café, in 24 hours", () => {
    expect(dayAndTime(new Date("2026-10-08T23:05:00Z"), NOW, BA)).toBe("8 de octubre, 20:05");
  });

  it("by the café's day, not the server's", () => {
    expect(dayAndTime(new Date("2026-10-09T01:30:00Z"), NOW, BA)).toBe("8 de octubre, 22:30");
  });

  it("with the year only if it's another one", () => {
    expect(dayAndTime(new Date("2025-12-31T12:00:00Z"), NOW, BA)).toBe(
      "31 de diciembre de 2025, 9:00",
    );
  });
});
