// Sessions in a signed cookie: the database stores no sessions. See ../../../../docs/implementacion/arquitectura.md, "Las sesiones".
// The cookie says whose it is and when it expires, signed with HMAC: if one letter changes, it's useless.
// One key for customers and another for staff: changing one signs out everyone of that kind, without touching the others.
// Customers stay signed in for 12 months and staff for 30 days, and both are renewed when used.
// Staff are also checked against the database on every request: if they were deactivated or their PIN changed, they're out.
import type { Clock, SessionIssuer, StaffMember, StaffRepository } from "../../application/ports";
import type { Secrets } from "../secrets.server";
import { hmac, hmacMatches, toHex } from "./hmac.server";

type SessionKind = "customer" | "staff";

type SessionKeys = Pick<Secrets, "customerSessionKey" | "staffSessionKey">;

const DAY = 24 * 60 * 60 * 1000;

/** Without being used: each use renews them (decided on 07/10/2026 for staff, Flujo A). */
const SESSION_DURATION: Record<SessionKind, number> = {
  customer: 365 * DAY,
  staff: 30 * DAY,
};

const NAME: Record<SessionKind, string> = { customer: "session", staff: "staff-session" };

/** What goes inside the cookie, signed. */
interface Payload {
  /** The id of the customer or staff member. */
  sub: string;
  /** When it expires, in milliseconds. It's signed: the phone can't extend it. */
  exp: number;
  /** Staff only: the PIN fingerprint from when they signed in. If the PIN changes, it doesn't match. */
  pin?: string;
}

const isSecure = (request: Request) => new URL(request.url).protocol === "https:";

/** With https, the __Host- prefix ties the cookie to this site. Locally (http) it can't be used. */
const cookieName = (kind: SessionKind, request: Request) =>
  isSecure(request) ? `__Host-${NAME[kind]}` : NAME[kind];

const keyFor = (kind: SessionKind, keys: SessionKeys) =>
  kind === "customer" ? keys.customerSessionKey : keys.staffSessionKey;

function buildCookie(request: Request, kind: SessionKind, value: string, seconds: number): string {
  const parts = [
    `${cookieName(kind, request)}=${value}`,
    "Path=/",
    `Max-Age=${seconds}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isSecure(request)) parts.push("Secure");
  return parts.join("; ");
}

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

const toBase64Url = (text: string) =>
  btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

const fromBase64Url = (text: string) => atob(text.replaceAll("-", "+").replaceAll("_", "/"));

/** The kind goes into what's signed: a customer cookie never counts as a staff one, even if copied. */
const message = (kind: SessionKind, encoded: string) => `${kind}.${encoded}`;

async function sign(kind: SessionKind, keys: SessionKeys, payload: Payload) {
  const encoded = toBase64Url(JSON.stringify(payload));
  return `${encoded}.${await hmac(keyFor(kind, keys), message(kind, encoded))}`;
}

/** What the cookie says, or null if there's none, the signature doesn't match or it expired. */
async function verify(
  request: Request,
  kind: SessionKind,
  keys: SessionKeys,
  now: Date,
): Promise<Payload | null> {
  const value = readCookie(request, cookieName(kind, request));
  const [encoded, signature, ...extra] = value?.split(".") ?? [];
  if (!encoded || !signature || extra.length > 0) return null;
  if (!(await hmacMatches(keyFor(kind, keys), message(kind, encoded), signature))) return null;

  const payload = JSON.parse(fromBase64Url(encoded)) as Payload;
  return payload.exp > now.getTime() ? payload : null;
}

/** A digest of the PIN hash: it changes with the PIN, and the cookie gives no clues about it. */
async function pinFingerprint(pinHmac: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pinHmac));
  return toHex(new Uint8Array(digest));
}

/** SessionIssuer (application/ports.ts): sessions for this request, signed with these keys. */
export const cookieSessionIssuer = (
  request: Request,
  keys: SessionKeys,
  clock: Clock,
): SessionIssuer => ({
  startCustomerSession: (customerId) => createSession(request, keys, { customerId }, clock.now()),
  startStaffSession: (member) => createSession(request, keys, { member }, clock.now()),
});

/** Creates the session and returns the Set-Cookie to send to the phone. */
export async function createSession(
  request: Request,
  keys: SessionKeys,
  owner: { customerId: string } | { member: { id: string; pinHmac: string } },
  now: Date,
): Promise<string> {
  const kind: SessionKind = "customerId" in owner ? "customer" : "staff";
  const payload: Payload =
    "customerId" in owner
      ? { sub: owner.customerId, exp: now.getTime() + SESSION_DURATION.customer }
      : {
          sub: owner.member.id,
          exp: now.getTime() + SESSION_DURATION.staff,
          pin: await pinFingerprint(owner.member.pinHmac),
        };
  return buildCookie(request, kind, await sign(kind, keys, payload), SESSION_DURATION[kind] / 1000);
}

/**
 * Renewed when used, at most once a day (no need to send the cookie on every request).
 * Returns the new Set-Cookie, or null if it isn't needed yet.
 */
async function renew(
  request: Request,
  kind: SessionKind,
  keys: SessionKeys,
  payload: Payload,
  now: Date,
): Promise<string | null> {
  const duration = SESSION_DURATION[kind];
  if (payload.exp - now.getTime() > duration - DAY) return null;
  const renewed = { ...payload, exp: now.getTime() + duration };
  return buildCookie(request, kind, await sign(kind, keys, renewed), duration / 1000);
}

export interface CustomerSession {
  /** The customer's id. If they were deleted, nothing will be found with this id. */
  customerId: string;
  /** Set-Cookie to send if it was renewed; null if not needed. */
  cookie: string | null;
}

/**
 * The customer's session, without querying the database. null if there's none or it's no good.
 * With renew: false it isn't renewed: within one request only one screen renews it (the layout).
 */
export async function readCustomerSession(
  request: Request,
  keys: SessionKeys,
  now: Date,
  { renew: renewIt = true }: { renew?: boolean } = {},
): Promise<CustomerSession | null> {
  const payload = await verify(request, "customer", keys, now);
  if (!payload) return null;
  const cookie = renewIt ? await renew(request, "customer", keys, payload, now) : null;
  return { customerId: payload.sub, cookie };
}

export interface StaffSession {
  /** Who's at the register: never their PIN hash or email. */
  member: StaffMember;
  /** Set-Cookie to send if it was renewed; null if not needed. */
  cookie: string | null;
}

/**
 * The staff session. null if there's none, it's no good, they were deactivated or their PIN changed:
 * their row is read on every request. With renew: false it isn't renewed (only the layout renews it).
 */
export async function readStaffSession(
  request: Request,
  keys: SessionKeys,
  now: Date,
  staff: Pick<StaffRepository, "findById">,
  { renew: renewIt = true }: { renew?: boolean } = {},
): Promise<StaffSession | null> {
  const payload = await verify(request, "staff", keys, now);
  if (!payload) return null;

  const member = await staff.findById(payload.sub);
  if (!member || member.deactivatedAt) return null;
  if (payload.pin !== (await pinFingerprint(member.pinHmac))) return null;

  return {
    member: { id: member.id, name: member.name, role: member.role },
    cookie: renewIt ? await renew(request, "staff", keys, payload, now) : null,
  };
}

/** Returns the Set-Cookie that deletes it from the phone (Salir). */
export function endSession(request: Request, kind: SessionKind): string {
  return buildCookie(request, kind, "", 0);
}
