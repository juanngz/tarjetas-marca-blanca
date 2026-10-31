// The current time. The rules don't look it up, they receive it (core/), and tests pin it.
import type { Clock } from "../application/ports";

export function now(): Date {
  return new Date();
}

export const systemClock: Clock = { now };
