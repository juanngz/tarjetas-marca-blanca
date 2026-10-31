// Use cases: the Equipo screen, the manager's first own action (decided on 08/10/2026). The manager adds
// baristas with their email and name, and the app makes up their PIN, shown only once. A barista's name
// and email can change, they can get a new PIN and they can be deactivated or reactivated. Other managers
// are only seen: the developers handle them with scripts/staff.mjs.
// Who does it always comes from the session (`actor`), and the rules are in core/access.ts: a call that
// isn't allowed answers "forbidden", even if the screen hid the button. Each change is recorded.
import type { Cafe } from "../cafes/types";
import { can, canManage } from "../core/access";
import { normalizeStaffEmail, type StaffChange, validateStaffName } from "../core/staff";
import { dayAndTime } from "../core/when";
import type {
  PinIssuer,
  StaffAuditEntry,
  StaffChanges,
  StaffMember,
  StaffProfile,
  StaffRepository,
} from "./ports";

export interface TeamDeps {
  staff: StaffRepository;
  pins: PinIssuer;
}

type Forbidden = { result: "forbidden" };
type NotFound = { result: "not-found" };

/** A form mistake, in the café's voice, and the field to point out. */
export type TeamFormError = { result: "error"; field: "email" | "name"; message: string };

const MESSAGES = {
  email: "Revisá el email: tiene que ser como nombre@ejemplo.com.",
  name: "El nombre lleva solo letras y espacios.",
  taken: "Ya hay alguien del equipo con ese email.",
} as const;

const formError = (field: "email" | "name", message: string): TeamFormError => ({
  result: "error",
  field,
  message,
});

/** The email and name typed, checked; or the mistake to show. */
function readForm(input: { email: string; name: string }) {
  const email = normalizeStaffEmail(input.email);
  if (!email) return formError("email", MESSAGES.email);
  const name = validateStaffName(input.name);
  if (!name.ok) return formError("name", MESSAGES.name);
  return { email, name: name.name };
}

export type TeamRow = StaffProfile & { canChange: boolean };

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "es");

export async function viewTeam(
  input: { actor: StaffMember },
  deps: TeamDeps,
): Promise<Forbidden | { result: "ok"; active: TeamRow[]; inactive: TeamRow[] }> {
  if (!can(input.actor.role, "see-team")) return { result: "forbidden" };
  const rows = (await deps.staff.list())
    .map((member) => ({ ...member, canChange: canManage(input.actor, member) }))
    .sort(byName);
  return {
    result: "ok",
    active: rows.filter((m) => !m.deactivatedAt),
    inactive: rows.filter((m) => m.deactivatedAt),
  };
}

export async function addBarista(
  input: { actor: StaffMember; email: string; name: string; at: Date },
  deps: TeamDeps,
): Promise<
  | Forbidden
  | TeamFormError
  | { result: "added"; member: { id: string; name: string; email: string }; pin: string }
> {
  if (!can(input.actor.role, "add-barista")) return { result: "forbidden" };
  const form = readForm(input);
  if ("result" in form) return form;

  // The id goes into the PIN's hash: it's made here, before hashing.
  const id = crypto.randomUUID();
  const pin = deps.pins.generate();
  const added = await deps.staff.add(
    {
      id,
      email: form.email,
      name: form.name,
      role: "barista",
      deactivatedAt: null,
      createdAt: input.at,
      pinHmac: await deps.pins.hash(id, pin),
    },
    input.actor.id,
  );
  if (added === "email-taken") return formError("email", MESSAGES.taken);
  return { result: "added", member: { id, name: form.name, email: form.email }, pin };
}

/** The person the actor wants to change, if they can. */
async function changeable(actor: StaffMember, memberId: string, deps: TeamDeps) {
  const member = await deps.staff.findProfile(memberId);
  if (!member) return { result: "not-found" } as const;
  if (!canManage(actor, member)) return { result: "forbidden" } as const;
  return { result: "ok", member } as const;
}

/** What was done to the person, with when said in the café's voice: "8 de octubre, 20:05". */
export type HistoryLine = StaffAuditEntry & { when: string };

export async function viewTeamMember(
  input: { actor: StaffMember; memberId: string; now: Date },
  cafe: Cafe,
  deps: TeamDeps,
): Promise<
  | Forbidden
  | NotFound
  | { result: "ok"; member: StaffProfile; canChange: boolean; history: HistoryLine[] }
> {
  if (!can(input.actor.role, "see-team")) return { result: "forbidden" };
  // The person and their history at once: the database is in the EU, one trip instead of two.
  const [member, entries] = await Promise.all([
    deps.staff.findProfile(input.memberId),
    deps.staff.history(input.memberId),
  ]);
  if (!member) return { result: "not-found" };
  const history = entries.map((entry) => ({
    ...entry,
    when: dayAndTime(entry.at, input.now, cafe.timeZone),
  }));
  return { result: "ok", member, canChange: canManage(input.actor, member), history };
}

export async function changeTeamMember(
  input: { actor: StaffMember; memberId: string; name: string; email: string; at: Date },
  deps: TeamDeps,
): Promise<Forbidden | NotFound | TeamFormError | { result: "changed" }> {
  const found = await changeable(input.actor, input.memberId, deps);
  if (found.result !== "ok") return found;
  const form = readForm(input);
  if ("result" in form) return form;

  const { member } = found;
  const changes: StaffChanges = {};
  const recorded: StaffChange[] = [];
  if (form.name !== member.name) {
    changes.name = form.name;
    recorded.push("name-changed");
  }
  if (form.email !== member.email) {
    changes.email = form.email;
    recorded.push("email-changed");
  }
  if (recorded.length === 0) return { result: "changed" };

  const saved = await deps.staff.change(member.id, changes, {
    by: input.actor.id,
    at: input.at,
    changes: recorded,
  });
  return saved === "email-taken" ? formError("email", MESSAGES.taken) : { result: "changed" };
}

/**
 * For a barista who forgot their PIN or lost their phone. The one they had stops working, so their open
 * sessions end (their cookie carries the PIN's fingerprint), and they're unlocked.
 */
export async function newPinFor(
  input: { actor: StaffMember; memberId: string; at: Date },
  deps: TeamDeps,
): Promise<
  | Forbidden
  | NotFound
  | { result: "inactive" }
  | { result: "new-pin"; pin: string; name: string; email: string }
> {
  const found = await changeable(input.actor, input.memberId, deps);
  if (found.result !== "ok") return found;
  if (found.member.deactivatedAt) return { result: "inactive" };

  const pin = deps.pins.generate();
  await deps.staff.change(
    found.member.id,
    { pinHmac: await deps.pins.hash(found.member.id, pin) },
    { by: input.actor.id, at: input.at, changes: ["pin-reset"] },
  );
  return { result: "new-pin", pin, name: found.member.name, email: found.member.email };
}

/** Deactivated: they can't get in and their sessions end, but their stamps stay in their name. */
export async function setActive(
  input: { actor: StaffMember; memberId: string; active: boolean; at: Date },
  deps: TeamDeps,
): Promise<Forbidden | NotFound | { result: "changed" }> {
  const found = await changeable(input.actor, input.memberId, deps);
  if (found.result !== "ok") return found;
  // Already like that (a second tap): nothing to record.
  if (!found.member.deactivatedAt === input.active) return { result: "changed" };

  await deps.staff.change(
    found.member.id,
    { deactivatedAt: input.active ? null : input.at },
    { by: input.actor.id, at: input.at, changes: [input.active ? "reactivated" : "deactivated"] },
  );
  return { result: "changed" };
}
