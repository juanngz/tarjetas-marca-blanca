import { describe, expect, it } from "vitest";
import { exampleCafe } from "../cafes/example";
import type { SummaryData } from "../core/summary";
import type { StaffMember, SummaryRepository } from "./ports";
import { viewSummary } from "./summary";

const NOW = new Date("2026-10-11T15:00:00Z");
const bruno: StaffMember = { id: "bruno", name: "Bruno", role: "manager" };
const ana: StaffMember = { id: "ana", name: "Ana", role: "barista" };

/** The database, in memory: says from when it was asked. */
function summaryRepository(data: Partial<SummaryData> = {}) {
  const asked: (Date | null)[] = [];
  const repository: SummaryRepository = {
    async read(since) {
      asked.push(since);
      return {
        signUps: [],
        entries: [],
        stampsBefore: new Map(),
        pendingRewards: new Map(),
        ...data,
      };
    },
  };
  return { repository, asked };
}

describe("Resumen", () => {
  it("the manager sees the Club's numbers between the dates", async () => {
    const { repository } = summaryRepository({
      signUps: [new Date("2026-10-10T13:00:00Z")],
    });
    const view = await viewSummary(
      { actor: bruno, from: "2026-10-10", to: "2026-10-11", now: NOW },
      exampleCafe,
      { summary: repository },
    );
    expect(view).toMatchObject({
      result: "ok",
      range: { from: "2026-10-10", to: "2026-10-11", says: "Del 10 al 11 de octubre." },
      totals: { newCustomers: 1 },
    });
  });

  it("reads from the start of the first day, in the café's time", async () => {
    const { repository, asked } = summaryRepository();
    await viewSummary({ actor: bruno, from: "2026-10-05", to: null, now: NOW }, exampleCafe, {
      summary: repository,
    });
    expect(asked).toEqual([new Date("2026-10-05T03:00:00Z")]);
  });

  it("a barista doesn't see it, and nothing is read", async () => {
    const { repository, asked } = summaryRepository();
    const view = await viewSummary({ actor: ana, from: null, to: null, now: NOW }, exampleCafe, {
      summary: repository,
    });
    expect(view).toEqual({ result: "forbidden" });
    expect(asked).toEqual([]);
  });
});
