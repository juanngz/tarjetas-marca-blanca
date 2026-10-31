// Each card's codes, at random, with the alphabet from core/codes.ts.
// If one collides with another already stored, the database rejects it (it's unique) and another is generated.
import type { CodeGenerator } from "../application/ports";
import { QR_CODE_LENGTH, SHORT_CODE_ALPHABET, SHORT_CODE_LENGTH } from "../core/codes";

/** No bias: bytes that don't fit evenly into the alphabet are discarded. */
function random(length: number): string {
  const alphabet = SHORT_CODE_ALPHABET;
  const limit = 256 - (256 % alphabet.length);
  let code = "";
  while (code.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && code.length < length) code += alphabet[byte % alphabet.length];
    }
  }
  return code;
}

export const randomCodeGenerator: CodeGenerator = {
  shortCode: () => random(SHORT_CODE_LENGTH),
  qrCode: () => random(QR_CODE_LENGTH),
};
