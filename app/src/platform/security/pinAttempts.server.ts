// 5 wrong PINs in a row lock that person out for 15 minutes (Flujo A of the staff flows).
// Each PIN takes one of the 5 attempts before it's checked, in one write: PINs sent all at once can't all be
// checked before the lockout (they'd be many more than 5).
// Developers can unlock them earlier: see ../../../../docs/implementacion/entorno.md
import { and, eq, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { Db } from "../db/cafeDb.server";
import { staff } from "../db/schema";

const ATTEMPTS_BEFORE_LOCKOUT = 5;
const LOCKOUT_MINUTES = 15;

/** Until when they're locked out, or null if they can try their PIN. */
export function lockedUntil(member: { lockedUntil: Date | null }, now: Date): Date | null {
  return member.lockedUntil && member.lockedUntil > now ? member.lockedUntil : null;
}

/**
 * Takes one of the 5 attempts, before the PIN is checked. In a single query: of many PINs sent at once,
 * only those that fit in the 5 are checked. false if they're locked out or the 5 are already taken.
 */
export async function claimAttempt(db: Db, memberId: string, now: Date): Promise<boolean> {
  const taken = await db
    .update(staff)
    .set({
      failedAttempts: sql`${staff.failedAttempts} + 1`,
      // Trying a PIN isn't a change to the person: updated_at stays.
      updatedAt: sql`${staff.updatedAt}`,
    })
    .where(
      and(
        eq(staff.id, memberId),
        lt(staff.failedAttempts, ATTEMPTS_BEFORE_LOCKOUT),
        or(isNull(staff.lockedUntil), lte(staff.lockedUntil, now)),
      ),
    )
    .returning({ id: staff.id });
  return taken.length > 0;
}

/**
 * The attempt taken was a wrong PIN. If it was the fifth, locks out and starts counting from zero again.
 * Returns until when they ended up locked out, or null.
 */
export async function recordFailedAttempt(
  db: Db,
  memberId: string,
  now: Date,
): Promise<Date | null> {
  const until = new Date(now.getTime() + LOCKOUT_MINUTES * 60_000);
  const reachedLimit = sql`${staff.failedAttempts} >= ${ATTEMPTS_BEFORE_LOCKOUT}`;
  const [member] = await db
    .update(staff)
    .set({
      failedAttempts: sql`case when ${reachedLimit} then 0 else ${staff.failedAttempts} end`,
      lockedUntil: sql`case when ${reachedLimit} then ${until.getTime()} else ${staff.lockedUntil} end`,
      // A failed PIN isn't a change to the person: updated_at stays (the lockout goes to the audit log).
      updatedAt: sql`${staff.updatedAt}`,
    })
    .where(eq(staff.id, memberId))
    .returning({ lockedUntil: staff.lockedUntil });
  return member ? lockedUntil(member, now) : null;
}

/** After a correct PIN: the attempts are "in a row", so they go back to zero. */
export async function clearAttempts(db: Db, memberId: string): Promise<void> {
  await db
    .update(staff)
    .set({ failedAttempts: 0, lockedUntil: null, updatedAt: sql`${staff.updatedAt}` })
    .where(eq(staff.id, memberId));
}
