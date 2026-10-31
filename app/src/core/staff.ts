// The register staff: their roles and the email they sign in with (Flujo A of the staff flows).
// The PIN rules are in staffPin.ts.

export type StaffRole = "barista" | "manager";

/**
 * Only simple emails: letters, digits and . _ % + -. That way scripts/staff.mjs can put it in SQL
 * without anything typed breaking it. With the usual limits of an email (RFC 5321): up to 64 characters
 * before the @ and 254 in all, no dot first, last or two in a row, and each part of the domain of up to
 * 63, without a hyphen at either end, ending in letters.
 */
const LOCAL = /^[a-z0-9_%+-]+(\.[a-z0-9_%+-]+)*$/;
const DOMAIN_PART = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const ENDING = /^[a-z]{2,}$/;
const MAX_LOCAL = 64;
const MAX_DOMAIN_PART = 63;
const MAX_EMAIL = 254;

/**
 * The email as it's stored and looked up: lowercase and without spaces around it, so Ana@Example.com
 * is the same as ana@example.com. null if it isn't an email.
 */
export function normalizeStaffEmail(text: string): string | null {
  const email = text.trim().toLowerCase();
  if (email.length > MAX_EMAIL) return null;
  const [local, domain, ...more] = email.split("@");
  if (more.length > 0 || !local || !domain) return null;
  if (local.length > MAX_LOCAL || !LOCAL.test(local)) return null;
  const parts = domain.split(".");
  if (parts.length < 2 || !ENDING.test(parts.at(-1) ?? "")) return null;
  const valid = parts.every((part) => part.length <= MAX_DOMAIN_PART && DOMAIN_PART.test(part));
  return valid ? email : null;
}

/** Letters from any language and spaces, from 2 to 30: how it shows at the register (Juan · barista). */
const NAME = /^[\p{L} ]{2,30}$/u;

export function validateStaffName(text: string): { ok: true; name: string } | { ok: false } {
  const name = text.trim().replace(/\s+/g, " ");
  return NAME.test(name) ? { ok: true, name } : { ok: false };
}

/** What's recorded about each change to a staff member (the staff_audit table). Never the PIN. */
export type StaffChange =
  | "added"
  | "name-changed"
  | "email-changed"
  | "pin-reset"
  | "deactivated"
  | "reactivated";
