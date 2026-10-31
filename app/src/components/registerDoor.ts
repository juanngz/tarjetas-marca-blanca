// The register's hidden door (decided on 08/10/2026): 5 taps in a row on the café's logo, on the welcome
// screen only, open /register. Never on a customer's screens: a customer isn't a barista.
// The customer app has no link to the register (Flujo A); this one isn't seen, and the register still asks
// for the email and the PIN.
import { useRef } from "react";
import { useNavigate } from "react-router";

const TAPS = 5;
/** Each tap counts if it comes within a second of the previous one. */
const BETWEEN = 1_000;

/** The taps after one more at `now`, and whether that one opens the register. */
export function afterTap(taps: readonly number[], now: number): { taps: number[]; opens: boolean } {
  const last = taps.at(-1);
  const counted = last !== undefined && now - last <= BETWEEN ? [...taps, now] : [now];
  return counted.length >= TAPS ? { taps: [], opens: true } : { taps: counted, opens: false };
}

/** What a tap on the logo does. */
export function useRegisterDoor() {
  const navigate = useNavigate();
  const taps = useRef<number[]>([]);
  return () => {
    const next = afterTap(taps.current, Date.now());
    taps.current = next.taps;
    if (next.opens) navigate("/register");
  };
}
