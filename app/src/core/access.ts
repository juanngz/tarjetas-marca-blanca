// What each staff role can do (decision 2d, docs/implementacion/arquitectura.md, "Los roles del equipo").
// Pure rules: the use cases check them and answer "forbidden"; the screens only hide what can't be done.

import type { StaffRole } from "./staff";

/** The manager-only actions. Scanning, searching, stamping and redeeming are for every role. */
export type StaffAction = "see-team" | "add-barista" | "see-activity" | "see-summary";

const MANAGER_ONLY: readonly StaffAction[] = [
  "see-team",
  "add-barista",
  "see-activity",
  "see-summary",
];

export function can(role: StaffRole, action: StaffAction): boolean {
  return role === "manager" || !MANAGER_ONLY.includes(action);
}

/**
 * Whether `actor` can change `target` (name, email, a new PIN, deactivating). A manager changes the
 * baristas, never another manager or themselves: those go through the developers, with scripts/staff.mjs
 * (decided on 08/10/2026).
 */
export function canManage(
  actor: { id: string; role: StaffRole },
  target: { id: string; role: StaffRole },
): boolean {
  return actor.role === "manager" && target.role === "barista" && actor.id !== target.id;
}
