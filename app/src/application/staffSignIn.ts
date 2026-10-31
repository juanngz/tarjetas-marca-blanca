// Use case: a staff member signs in at the register with their email and PIN (Flujo A of the staff flows).
// 5 wrong PINs in a row lock that person out for 15 minutes; while locked out, the PIN doesn't count.
// Each PIN takes one of the 5 attempts before it's checked: sending many at once doesn't get more than 5.
// One message for every way in that fails (a wrong email, a wrong PIN, locked out), and it already says to
// wait: so it never tells which emails are on the team, and whoever got locked out knows what to do.
import { normalizeStaffEmail } from "../core/staff";
import type {
  Clock,
  Logger,
  PinVerifier,
  SessionIssuer,
  StaffMember,
  StaffRepository,
} from "./ports";

export interface StaffSignInInput {
  email: string;
  pin: string;
}

export interface StaffSignInDeps {
  staff: StaffRepository;
  pins: PinVerifier;
  sessions: SessionIssuer;
  clock: Clock;
  /** Waits that long before answering (setTimeout in the Worker). */
  wait: (ms: number) => Promise<void>;
  logger: Logger;
}

export type StaffSignInResult =
  | { result: "signed-in"; cookie: string; member: StaffMember }
  | {
      result: "error";
      reason: "wrong" | "pin-format" | "locked";
      /** In the café's voice. */
      message: string;
      /** What they typed, to fix it. Never the PIN. */
      email: string;
    };

const DIDNT_MATCH = "Revisá tu email y tu PIN. Si ya probaste varias veces, esperá 15 minutos.";

const MESSAGES = {
  wrong: DIDNT_MATCH,
  "pin-format": "Tu PIN tiene 6 números. Revisalo y probá de nuevo.",
  locked: DIDNT_MATCH,
} as const;

/**
 * For an email nobody has: its attempt is taken and recorded on a row that doesn't exist, and its PIN is
 * checked all the same. The same trips to the database as a wrong PIN.
 */
const NO_ONE = { id: "no-one", pinHmac: "0".repeat(64) };

/**
 * A wrong email or PIN, or being locked out, answers no sooner than this. Writing to the database takes
 * longer than a write that changes nothing, so the same steps aren't enough: with a minimum, the time
 * never tells which emails are on the team. About twice what a wrong PIN takes (3 trips to the EU).
 */
export const FAILED_SIGN_IN_MS = 1200;

export async function staffSignIn(
  input: StaffSignInInput,
  deps: StaffSignInDeps,
): Promise<StaffSignInResult> {
  const started = deps.clock.now().getTime();
  const result = await check(input, deps);
  if (result.result === "error" && result.reason !== "pin-format") {
    await deps.wait(Math.max(0, FAILED_SIGN_IN_MS - (deps.clock.now().getTime() - started)));
  }
  return result;
}

async function check(input: StaffSignInInput, deps: StaffSignInDeps): Promise<StaffSignInResult> {
  const typed = input.email.trim();
  const error = (reason: keyof typeof MESSAGES): StaffSignInResult => ({
    result: "error",
    reason,
    message: MESSAGES[reason],
    email: typed,
  });

  if (!/^\d{6}$/.test(input.pin)) return error("pin-format");
  const email = normalizeStaffEmail(typed);
  if (!email) return error("wrong");

  const now = deps.clock.now();
  const found = await deps.staff.findByEmail(email);
  // Someone who no longer works there is like someone who doesn't exist.
  const member = found && !found.deactivatedAt ? found : null;
  // Every way that fails takes the same steps: an attempt, the PIN, a failed attempt. Locked out, or the 5
  // attempts already taken by PINs being checked (sent at once), this one waits: its PIN doesn't count.
  const subject = member ?? NO_ONE;
  const claimed = await deps.staff.claimAttempt(subject.id, now);
  const matches = await deps.pins.matches(subject.id, input.pin, subject.pinHmac);
  if (!member || !claimed) {
    await deps.staff.recordFailedAttempt(NO_ONE.id, now);
    return error(member ? "locked" : "wrong");
  }
  if (!matches) {
    const lockedUntil = await deps.staff.recordFailedAttempt(member.id, now);
    if (!lockedUntil) return error("wrong");
    deps.logger.log("staff-locked-out", { memberId: member.id });
    return error("locked");
  }

  // The attempt this PIN took, and any before it, go back to zero.
  await deps.staff.clearAttempts(member.id);
  const cookie = await deps.sessions.startStaffSession(member);
  deps.logger.log("staff-signed-in", { memberId: member.id });
  return {
    result: "signed-in",
    cookie,
    member: { id: member.id, name: member.name, role: member.role },
  };
}
