import { describe, expect, it } from "vitest";
import { afterTap } from "./registerDoor";

/** Taps at these times, in milliseconds; whether the last one opened the register. */
function tapAt(times: number[]) {
  let taps: number[] = [];
  let opens = false;
  for (const at of times) ({ taps, opens } = afterTap(taps, at));
  return opens;
}

describe("the register's hidden door on the logo", () => {
  it("5 taps in a row open it", () => {
    expect(tapAt([0, 300, 600, 900, 1200])).toBe(true);
  });

  it("4 taps don't", () => {
    expect(tapAt([0, 300, 600, 900])).toBe(false);
  });

  it("a pause of more than a second starts counting again", () => {
    expect(tapAt([0, 300, 600, 2000, 2300])).toBe(false);
  });

  it("after a pause, 5 taps in a row open it", () => {
    expect(tapAt([0, 300, 2000, 2300, 2600, 2900, 3200])).toBe(true);
  });

  it("once open, it starts counting again", () => {
    let taps: number[] = [];
    for (const at of [0, 300, 600, 900, 1200]) ({ taps } = afterTap(taps, at));
    expect(taps).toEqual([]);
  });
});
