// Use case: Movimientos, the manager's history of the register (10/10/2026). Every stamp, redeem and undo of
// everybody, baristas and managers, the newest first: what, on which card, whose, when and who did it. One
// person's only, if the manager picks them. Like the Ficha del cliente (Flujo F): never the document.
import type { Cafe } from "../cafes/types";
import { can } from "../core/access";
import type { StaffRole } from "../core/staff";
import { dayAndTime } from "../core/when";
import type { CardRepository, StaffMember, StaffRepository } from "./ports";

/** How many lines each Ver anteriores brings. */
export const ACTIVITY_PAGE = 50;
/** Up to how many pages are shown together: past that, the list would be too long for a phone. */
const MAX_PAGES = 20;

export type ActivityKind = "stamp" | "redeem" | "undo-stamp" | "undo-redeem";

export interface ActivityLine {
  id: string;
  kind: ActivityKind;
  /** "Café take-away". */
  cardName: string;
  /** null: the customer was deleted. */
  customerName: string | null;
  /** Who did it: the phone shows one person's from the lines already on screen. */
  byId: string;
  byName: string;
  byRole: StaffRole;
  /** "8 de octubre, 20:05". */
  when: string;
  /** A stamp or a redeem that was undone afterwards. */
  undone: boolean;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "es");

export async function viewActivity(
  input: { actor: StaffMember; memberId?: string; pages?: number; now: Date },
  cafe: Cafe,
  deps: { cards: CardRepository; staff: StaffRepository },
): Promise<
  | { result: "forbidden" }
  | {
      result: "ok";
      lines: ActivityLine[];
      /** The whole team, to pick whose to see. */
      people: { id: string; name: string; role: StaffRole }[];
      /** Whose is shown; null: everybody's. */
      memberId: string | null;
      /** How many pages are shown. */
      pages: number;
      /** Whether there are older ones to bring with Ver anteriores. */
      more: boolean;
    }
> {
  if (!can(input.actor.role, "see-activity")) return { result: "forbidden" };
  const pages = Math.min(Math.max(Math.trunc(input.pages ?? 1) || 1, 1), MAX_PAGES);
  const limit = pages * ACTIVITY_PAGE;
  // One more than shown, to know if there are more. The team and the movements at once: the database is
  // in the EU, one trip instead of two.
  const movements = (staffId?: string) => deps.cards.activity({ staffId, limit: limit + 1 });
  const [team, asked] = await Promise.all([deps.staff.list(), movements(input.memberId)]);
  const who = new Map(team.map((member) => [member.id, member]));
  // Someone who isn't on the team (an old link, a typo): everybody's, asked again.
  const memberId = input.memberId && who.has(input.memberId) ? input.memberId : null;
  const records = input.memberId && !memberId ? await movements() : asked;
  const lines = records.slice(0, limit).map((record): ActivityLine => {
    const by = who.get(record.staffId);
    return {
      id: record.id,
      kind: record.type === "undo" ? `undo-${record.undoneType ?? "stamp"}` : record.type,
      cardName: cafe.cards.find((card) => card.type === record.cardType)?.name ?? record.cardType,
      customerName: record.customerName,
      byId: record.staffId,
      byName: by?.name ?? "",
      byRole: by?.role ?? "barista",
      when: dayAndTime(record.at, input.now, cafe.timeZone),
      undone: record.undone,
    };
  });

  return {
    result: "ok",
    lines,
    people: team.map(({ id, name, role }) => ({ id, name, role })).sort(byName),
    memberId,
    pages,
    more: records.length > limit,
  };
}
