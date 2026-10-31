// Use case: Resumen, the manager's numbers of the Club (11/10/2026, flujos-equipo.md), between the dates they
// pick. The counting is in core/summary.ts; here, who can see it and from when it's read. Only counts: never a
// customer's name.
import type { Cafe } from "../cafes/types";
import { can } from "../core/access";
import { readRange, type Summary, summarize } from "../core/summary";
import type { StaffMember, SummaryRepository } from "./ports";

export async function viewSummary(
  input: { actor: StaffMember; from: string | null; to: string | null; now: Date },
  cafe: Cafe,
  deps: { summary: SummaryRepository },
): Promise<{ result: "forbidden" } | ({ result: "ok" } & Summary)> {
  if (!can(input.actor.role, "see-summary")) return { result: "forbidden" };
  const range = readRange(input.from, input.to, input.now, cafe.timeZone);
  const data = await deps.summary.read(range.span.start);
  return { result: "ok", ...summarize(data, range, cafe) };
}
