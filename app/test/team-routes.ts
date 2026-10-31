// Equipo on the test D1, for the route tests: Bruno (manager) signed in, and Ana (barista) with her PIN.
import type { testDb } from "./db";
import { createStaffMember, staffCookie } from "./factories";

export const ANAS_PIN = "428613";

export async function teamOnD1(t: Awaited<ReturnType<typeof testDb>>) {
  const bruno = await createStaffMember(t.db, {
    name: "Bruno",
    role: "manager",
    email: "bruno@example.com",
  });
  const ana = await createStaffMember(t.db, {
    name: "Ana",
    email: "ana@example.com",
    pin: ANAS_PIN,
  });
  return {
    bruno,
    ana,
    asManager: await staffCookie(bruno),
    asBarista: await staffCookie(ana),
  };
}
