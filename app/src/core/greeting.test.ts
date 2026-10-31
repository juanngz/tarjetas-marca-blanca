import { describe, expect, it } from "vitest";
import { greeting } from "./greeting";

const BUENOS_AIRES = "America/Argentina/Buenos_Aires";
// Buenos Aires is UTC−3: 12:59 there is 15:59 UTC.
const inBuenosAires = (time: string) => new Date(`2026-10-06T${time}:00-03:00`);

describe("greeting by the café's local time", () => {
  it("in the morning, buenos días", () => {
    expect(greeting("Marta", inBuenosAires("09:30"), BUENOS_AIRES)).toBe("Buenos días, Marta.");
  });

  it("at 12:59, still buenos días", () => {
    expect(greeting("Marta", inBuenosAires("12:59"), BUENOS_AIRES)).toBe("Buenos días, Marta.");
  });

  it("from 13:00, buenas tardes", () => {
    expect(greeting("Marta", inBuenosAires("13:00"), BUENOS_AIRES)).toBe("Buenas tardes, Marta.");
  });

  it("at 19:59, still buenas tardes", () => {
    expect(greeting("Marta", inBuenosAires("19:59"), BUENOS_AIRES)).toBe("Buenas tardes, Marta.");
  });

  it("from 20:00, buenas noches", () => {
    expect(greeting("Marta", inBuenosAires("20:00"), BUENOS_AIRES)).toBe("Buenas noches, Marta.");
  });

  it("uses the café's time, not the server's", () => {
    // 11:00 UTC is 8:00 in Buenos Aires.
    expect(greeting("Marta", new Date("2026-10-06T11:00:00Z"), BUENOS_AIRES)).toBe(
      "Buenos días, Marta.",
    );
  });
});
