// Document format. The hash with the secret key lives in platform/security/documentHasher.server.ts.
// Messages in the café's voice: ../../../marca/voz.md

export type DocumentType = "dni" | "other";

/** The type as it comes from the form: "other" is another document; anything else counts as a DNI. */
export function documentTypeFrom(value: string | null): DocumentType {
  return value === "other" ? "other" : "dni";
}

export type DocumentResult = { ok: true; number: string } | { ok: false; message: string };

const EMPTY = "Poné tu número de documento.";
const DNI_DIGITS = 8;

function validateDni(text: string): DocumentResult {
  if (text.includes(".")) return { ok: false, message: "Escribilo sin puntos, solo los números." };
  if (!/^\d+$/.test(text)) {
    return { ok: false, message: "El DNI lleva solo números. Revisalo y probá de nuevo." };
  }
  if (text.length < 7) {
    return { ok: false, message: "Ese número tiene pocos dígitos. Revisalo y probá de nuevo." };
  }
  if (text.length > DNI_DIGITS) {
    return { ok: false, message: "Ese número tiene dígitos de más. Revisalo y probá de nuevo." };
  }
  return { ok: true, number: text };
}

function validateOther(text: string): DocumentResult {
  if (!/^[A-Za-z0-9]+$/.test(text)) {
    return { ok: false, message: "Poné solo las letras y los números del documento." };
  }
  if (text.length < 5) {
    return {
      ok: false,
      message: "Ese número es muy corto. Revisalo y probá de nuevo.",
    };
  }
  if (text.length > 20) {
    return {
      ok: false,
      message: "Ese número es muy largo. Revisalo y probá de nuevo.",
    };
  }
  return { ok: true, number: text.toUpperCase() };
}

export function validateDocument(type: DocumentType, text: string): DocumentResult {
  const clean = text.trim();
  if (clean === "") return { ok: false, message: EMPTY };
  return type === "dni" ? validateDni(clean) : validateOther(clean);
}

/** What goes into the HMAC: with the type in front, an equal DNI and passport don't collide. */
export function documentKey(type: DocumentType, number: string): string {
  return `${type}:${number}`;
}

/** What stays in the field while typing or pasting: only digits, up to 8 (30.123.456 → 30123456). */
export function cleanDniWhileTyping(text: string): string {
  return text.replace(/\D/g, "").slice(0, DNI_DIGITS);
}

/** 30123456 → 30.123.456 */
export function formatDni(number: string): string {
  return number.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
