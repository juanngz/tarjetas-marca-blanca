// Each card's short code: the one the customer reads out and the barista types if the QR can't be read.
// It's generated at random in platform/codes.server.ts with this alphabet.

/** No 0/O or 1/I/L, which get mixed up when read out or read. */
export const SHORT_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const SHORT_CODE_LENGTH = 6;
/** What the QR carries: long, so it can't be guessed (about 119 bits). */
export const QR_CODE_LENGTH = 24;

const VALID = new RegExp(`^[${SHORT_CODE_ALPHABET}]{${SHORT_CODE_LENGTH}}$`);

/** What the barista types, uppercased and without spaces. null if it can't be a code. */
export function normalizeShortCode(text: string): string | null {
  const clean = text.replace(/\s+/g, "").toUpperCase();
  return VALID.test(clean) ? clean : null;
}

const QR = new RegExp(`^[${SHORT_CODE_ALPHABET}]{${QR_CODE_LENGTH}}$`);

/** A card's code: the short one, or the long one its QR carries. */
export type CardCode = { shortCode: string } | { qrCode: string };

/**
 * What the register typed or read with the camera: a card's short code, the long code its QR carries,
 * or null if it isn't a Club card (a QR from somewhere else, a typo).
 */
export function readCardCode(text: string): CardCode | null {
  const shortCode = normalizeShortCode(text);
  if (shortCode) return { shortCode };
  const clean = text.replace(/\s+/g, "").toUpperCase();
  return QR.test(clean) ? { qrCode: clean } : null;
}
