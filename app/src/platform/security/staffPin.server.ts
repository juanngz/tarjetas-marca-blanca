// The staff PIN is stored as an HMAC of the person's id and their PIN, with PIN_HMAC_KEY.
// With the person in it, two people with the same PIN don't have the same hash.
// Why HMAC and not a slow hash: ../../../../docs/implementacion/arquitectura.md, "El ingreso del equipo".
// scripts/staff.mjs uses it too: both compute the same hash.
import type { PinIssuer, PinVerifier } from "../../application/ports";
import { validatePin } from "../../core/staffPin";
import { hmac, hmacMatches } from "./hmac.server";

const message = (memberId: string, pin: string) => `${memberId}:${pin}`;

export function pinHmac(key: string, memberId: string, pin: string): Promise<string> {
  return hmac(key, message(memberId, pin));
}

export function pinMatches(
  key: string,
  memberId: string,
  pin: string,
  stored: string,
): Promise<boolean> {
  return hmacMatches(key, message(memberId, pin), stored);
}

/** PinVerifier (application/ports.ts): compares in constant time, with this environment's key. */
export const hmacPinVerifier = (key: string): PinVerifier => ({
  matches: (memberId, pin, stored) => pinMatches(key, memberId, pin, stored),
});

/**
 * A PIN of 6 digits drawn at random, never an easy one (core/staffPin.ts). No bias: bytes that don't fit
 * evenly into ten digits are discarded, like the cards' codes.
 */
export function randomPin(): string {
  for (;;) {
    let pin = "";
    while (pin.length < 6) {
      for (const byte of crypto.getRandomValues(new Uint8Array(12))) {
        if (byte < 250 && pin.length < 6) pin += String(byte % 10);
      }
    }
    if (validatePin(pin).ok) return pin;
  }
}

/** PinIssuer (application/ports.ts): new PINs for the Equipo screen, hashed with this environment's key. */
export const hmacPinIssuer = (key: string): PinIssuer => ({
  generate: randomPin,
  hash: (memberId, pin) => pinHmac(key, memberId, pin),
});
