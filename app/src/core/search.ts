// What the barista typed in Buscar tarjeta (Flujo D of the staff flows): a card's code, a document or a
// name. A code has letters and numbers, a document only numbers (or letters and numbers, another document)
// and a name only letters. Names are compared in lowercase and without accents: "garcia" finds "García".
import { type CardCode, readCardCode } from "./codes";

export type Search =
  /**
   * 6 letters and numbers can be a short code or another document (orDocument, with a number); only
   * letters, a short code or a name (orName). If no card has that code, it's looked up as the other.
   */
  | { kind: "code"; code: CardCode; orDocument?: string; orName?: string[] }
  | { kind: "document"; number: string }
  /** Each word has to be the start of a word of the name: "mar gar" finds Marta García. */
  | { kind: "name"; words: string[] }
  | { kind: "empty" }
  | { kind: "too-short" };

/** A name as it's stored to search it: lowercase, without accents and with single spaces. */
export function nameForSearch(name: string): string {
  return name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().split(/\s+/).join(" ");
}

export function readSearch(text: string): Search {
  const typed = text.trim();
  if (typed === "") return { kind: "empty" };

  const code = readCardCode(typed);
  if (code) {
    const orDocument =
      // Like a document below: letters and numbers, with at least one number.
      "shortCode" in code && /^[A-Za-z0-9]+$/.test(typed) && /\d/.test(typed)
        ? { orDocument: typed.toUpperCase() }
        : {};
    const orName = /^\p{L}+$/u.test(typed) ? { orName: [nameForSearch(typed)] } : {};
    return { kind: "code", code, ...orDocument, ...orName };
  }

  // A DNI can come as it's on the card (30.123.456), with spaces or dashes, or with "DNI" in front.
  const dni = typed.replace(/^dni[\s:.]*(?=\d)/i, "");
  if (/^\d[\d .-]*$/.test(dni)) return { kind: "document", number: dni.replace(/\D/g, "") };
  if (/^[A-Za-z0-9]+$/.test(typed) && /\d/.test(typed)) {
    return { kind: "document", number: typed.toUpperCase() };
  }

  if (/^[\p{L}' -]+$/u.test(typed)) {
    const name = nameForSearch(typed);
    if (name.replace(/[^\p{L}]/gu, "").length >= 2) return { kind: "name", words: name.split(" ") };
  }
  return { kind: "too-short" };
}

/** A DNI has at least 7 digits: text with that many is never shown again at the register. */
const DOCUMENT_DIGITS = 7;

/**
 * Whether the field can show what was typed again, after searching. A DNI never shows at the register
 * (CLAUDE.md), not even mistyped or among other words: anything with a document's digits is cleared.
 */
export function canShowAgain(text: string): boolean {
  return (text.match(/\d/g) ?? []).length < DOCUMENT_DIGITS;
}
