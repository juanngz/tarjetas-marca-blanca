// The staff PIN: 6 digits, no sequences or repeats.
// See ../../../docs/implementacion/arquitectura.md, "El ingreso del equipo".

export type PinResult = { ok: true } | { ok: false; reason: "format" | "weak" };

function isSequence(pin: string, step: 1 | -1): boolean {
  for (let i = 1; i < pin.length; i++) {
    if (Number(pin[i]) - Number(pin[i - 1]) !== step) return false;
  }
  return true;
}

/** 000000, 121212, 123123: the PIN is a short block that repeats. */
function isRepeated(pin: string): boolean {
  return [1, 2, 3].some((length) => pin === pin.slice(0, length).repeat(pin.length / length));
}

export function validatePin(pin: string): PinResult {
  if (!/^\d{6}$/.test(pin)) return { ok: false, reason: "format" };
  if (isRepeated(pin) || isSequence(pin, 1) || isSequence(pin, -1)) {
    return { ok: false, reason: "weak" };
  }
  return { ok: true };
}
