// The name the customer signs up with: the app greets them with it and the register recognizes them by it.
// It's stored as written, without extra spaces. Messages in the café's voice.

export type NameResult = { ok: true; name: string } | { ok: false; message: string };

const MAX_LENGTH = 40;

/** Letters from any language, with spaces, apostrophes, hyphens and dots in between. */
const LETTERS_ONLY = /^\p{L}[\p{L}\p{M} '’.-]*$/u;

export function validateName(text: string): NameResult {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean === "") return { ok: false, message: "Poné tu nombre." };
  if (clean.length > MAX_LENGTH) {
    return { ok: false, message: "Ese nombre es muy largo. Poné solo tu nombre y tu apellido." };
  }
  if (!LETTERS_ONLY.test(clean)) {
    return { ok: false, message: "Escribí tu nombre solo con letras." };
  }
  return { ok: true, name: clean };
}

/** The first word of the name: "Marta ganó un café take-away gratis." at the register. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0];
}
