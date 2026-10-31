// StaffRepository on D1 (application/ports.ts): the register staff, their failed PINs and the Equipo
// screen's changes. Each change goes together with its audit row, in a single batch.
// The lockout itself (5 in a row, 15 minutes, in a single write) is in security/pinAttempts.server.ts.
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { StaffRepository } from "../../application/ports";
import { claimAttempt, clearAttempts, recordFailedAttempt } from "../security/pinAttempts.server";
import type { Db } from "./cafeDb.server";
import { staff, staffAudit } from "./schema";

const columns = {
  id: staff.id,
  name: staff.name,
  role: staff.role,
  pinHmac: staff.pinHmac,
  failedAttempts: staff.failedAttempts,
  lockedUntil: staff.lockedUntil,
  deactivatedAt: staff.deactivatedAt,
};

/** What the Equipo screen sees: never the PIN. */
const profile = {
  id: staff.id,
  name: staff.name,
  email: staff.email,
  role: staff.role,
  deactivatedAt: staff.deactivatedAt,
  createdAt: staff.createdAt,
};

/** Someone already has that email: the database's unique index said so (staff.email). */
function emailTaken(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if (current.message.includes("UNIQUE constraint failed: staff.email")) return true;
    current = current.cause;
  }
  return false;
}

export function d1StaffRepository(db: Db): StaffRepository {
  return {
    async findByEmail(email) {
      const [member] = await db.select(columns).from(staff).where(eq(staff.email, email));
      return member ?? null;
    },

    async findById(id) {
      const [member] = await db.select(columns).from(staff).where(eq(staff.id, id));
      return member ?? null;
    },

    claimAttempt: (memberId, now) => claimAttempt(db, memberId, now),

    recordFailedAttempt: (memberId, now) => recordFailedAttempt(db, memberId, now),

    clearAttempts: (memberId) => clearAttempts(db, memberId),

    list() {
      return db.select(profile).from(staff);
    },

    async findProfile(id) {
      const [member] = await db.select(profile).from(staff).where(eq(staff.id, id));
      return member ?? null;
    },

    history(id) {
      const by = alias(staff, "by");
      return db
        .select({ change: staffAudit.change, at: staffAudit.at, byName: by.name })
        .from(staffAudit)
        .leftJoin(by, eq(by.id, staffAudit.byId))
        .where(eq(staffAudit.staffId, id))
        .orderBy(desc(staffAudit.at));
    },

    async add(member, by) {
      try {
        await db.batch([
          db.insert(staff).values(member),
          db
            .insert(staffAudit)
            .values({ staffId: member.id, byId: by, change: "added", at: member.createdAt }),
        ]);
        return "added";
      } catch (error) {
        if (emailTaken(error)) return "email-taken";
        throw error;
      }
    },

    async change(id, changes, audit) {
      // A new PIN starts the failed attempts from zero and ends the lockout.
      const newPin = changes.pinHmac ? { failedAttempts: 0, lockedUntil: null } : {};
      try {
        await db.batch([
          db
            .update(staff)
            .set({ ...changes, ...newPin })
            .where(eq(staff.id, id)),
          db.insert(staffAudit).values(
            audit.changes.map((change) => ({
              staffId: id,
              byId: audit.by,
              change,
              at: audit.at,
            })),
          ),
        ]);
        return "changed";
      } catch (error) {
        if (emailTaken(error)) return "email-taken";
        throw error;
      }
    },
  };
}
