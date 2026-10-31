import { describe, expect, it } from "vitest";
import { can, canManage } from "./access";
import type { StaffRole } from "./staff";

const ROLES: StaffRole[] = ["barista", "manager"];

describe("what each role can do", () => {
  it.each([
    ["barista", "see-team", false],
    ["barista", "add-barista", false],
    ["manager", "see-team", true],
    ["manager", "add-barista", true],
    ["barista", "see-activity", false],
    ["manager", "see-activity", true],
    ["barista", "see-summary", false],
    ["manager", "see-summary", true],
  ] as const)("a %s, %s: %s", (role, action, allowed) => {
    expect(can(role, action)).toBe(allowed);
  });
});

describe("whom a staff member can change", () => {
  const ana = { id: "ana", role: "barista" as const };
  const bruno = { id: "bruno", role: "manager" as const };
  const carla = { id: "carla", role: "manager" as const };

  it("a manager changes a barista", () => {
    expect(canManage(bruno, ana)).toBe(true);
  });

  it("a manager never changes another manager: the developers do, with the script", () => {
    expect(canManage(bruno, carla)).toBe(false);
  });

  it("nobody changes themselves", () => {
    for (const role of ROLES) expect(canManage({ id: "x", role }, { id: "x", role })).toBe(false);
  });

  it("a barista changes nobody", () => {
    expect(canManage(ana, { id: "otra", role: "barista" })).toBe(false);
    expect(canManage(ana, bruno)).toBe(false);
  });
});
