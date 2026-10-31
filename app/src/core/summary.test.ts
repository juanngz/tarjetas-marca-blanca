import { describe, expect, it } from "vitest";
import { exampleCafe } from "../cafes/example";
import { type CountedEntry, readRange, type SummaryData, summarize } from "./summary";

const TZ = exampleCafe.timeZone;
/** Sunday 11 October 2026, 12:00 in Buenos Aires (UTC−3). */
const NOW = new Date("2026-10-11T15:00:00Z");
/** A moment in Buenos Aires time: "2026-10-10 10:30". */
const local = (text: string) => new Date(`${text.replace(" ", "T")}:00-03:00`);

const none: SummaryData = {
  signUps: [],
  entries: [],
  stampsBefore: new Map(),
  pendingRewards: new Map(),
};

/** A stamp on a card; its customer is the card's, unless another one is given (a customer has three cards). */
const stamp = (
  cardId: string,
  at: string,
  cardType = "take-away",
  customerId = cardId,
): CountedEntry => ({ cardId, customerId, cardType, type: "stamp", at: local(at) });
const redeem = (
  cardId: string,
  at: string,
  cardType = "take-away",
  customerId = cardId,
): CountedEntry => ({ ...stamp(cardId, at, cardType, customerId), type: "redeem" });

/** The summary of the last 7 days, unless other dates are picked. */
const summary = (
  data: Partial<SummaryData>,
  from: string | null = null,
  to: string | null = null,
) => summarize({ ...none, ...data }, readRange(from, to, NOW, TZ), exampleCafe);

const labels = (from: string | null, to: string | null, now = NOW) =>
  readRange(from, to, now, TZ).buckets.map((b) => b.label);

describe("the dates", () => {
  it("are the last 7 days, today included, unless others are picked", () => {
    const range = readRange(null, null, NOW, TZ);
    expect(range).toMatchObject({ from: "2026-10-05", to: "2026-10-11", today: "2026-10-11" });
    expect(range.span).toEqual({
      start: local("2026-10-05 00:00"),
      end: local("2026-10-12 00:00"),
    });
    expect(range.says).toBe("Del 5 al 11 de octubre.");
  });

  it("go from the start of the first day to the end of the last one, in the café's time", () => {
    const range = readRange("2026-09-28", "2026-10-04", NOW, TZ);
    expect(range.span).toEqual({
      start: local("2026-09-28 00:00"),
      end: local("2026-10-05 00:00"),
    });
    expect(range.says).toBe("Del 28 de septiembre al 4 de octubre.");
  });

  it("picked the other way around, are swapped", () => {
    expect(readRange("2026-10-04", "2026-09-28", NOW, TZ)).toMatchObject({
      from: "2026-09-28",
      to: "2026-10-04",
    });
  });

  it("never go past today", () => {
    expect(readRange("2026-10-01", "2026-12-31", NOW, TZ).to).toBe("2026-10-11");
    expect(readRange("2026-11-01", "2026-12-31", NOW, TZ)).toMatchObject({
      from: "2026-10-11",
      to: "2026-10-11",
    });
  });

  it("one that isn't a date is like not picking it", () => {
    expect(readRange("ayer", "2026-02-30", NOW, TZ)).toMatchObject({
      from: "2026-10-05",
      to: "2026-10-11",
    });
  });

  it("a single day says so", () => {
    expect(readRange("2026-10-10", "2026-10-10", NOW, TZ).says).toBe("El 10 de octubre.");
  });

  it("say the year when it isn't this one", () => {
    const now = new Date("2027-01-10T15:00:00Z");
    expect(readRange("2026-12-28", "2027-01-03", now, TZ).says).toBe(
      "Del 28 de diciembre de 2026 al 3 de enero de 2027.",
    );
    expect(readRange("2026-12-01", "2026-12-07", now, TZ).says).toBe(
      "Del 1 al 7 de diciembre de 2026.",
    );
  });

  it("up to 2 weeks, a bar per day, today as hoy", () => {
    expect(labels(null, null)).toEqual([
      "lun 5",
      "mar 6",
      "mié 7",
      "jue 8",
      "vie 9",
      "sáb 10",
      "hoy",
    ]);
    expect(labels("2026-09-28", "2026-10-11")).toHaveLength(14);
  });

  it("up to 16 weeks, a bar per week from the first day, saying its days; the last one can be shorter", () => {
    expect(labels("2026-09-14", "2026-10-11")).toEqual([
      "14 al 20 sep",
      "21 al 27 sep",
      "28 sep al 4 oct",
      "5 al 11 oct",
    ]);
    expect(labels("2026-09-12", "2026-10-11")).toEqual([
      "12 al 18 sep",
      "19 al 25 sep",
      "26 sep al 2 oct",
      "3 al 9 oct",
      "10 al 11 oct",
    ]);
    expect(labels("2026-09-14", "2026-10-04").length).toBe(3);
    expect(labels("2026-09-13", "2026-10-04").at(-1)).toBe("4 oct");
  });

  it("longer, a bar per month, with the year when they cross one", () => {
    expect(labels("2026-06-15", "2026-10-11")).toEqual(["jun", "jul", "ago", "sep", "oct"]);
    const now = new Date("2027-02-10T15:00:00Z");
    expect(labels("2026-10-01", "2027-02-10", now)).toEqual([
      "oct 2026",
      "nov 2026",
      "dic 2026",
      "ene 2027",
      "feb 2027",
    ]);
  });

  it("the quick choices are the last 7, 30 and 90 days, and say which one is shown", () => {
    expect(readRange(null, null, NOW, TZ).presets).toEqual([
      { label: "7 días", from: "2026-10-05", to: "2026-10-11", current: true },
      { label: "30 días", from: "2026-09-12", to: "2026-10-11", current: false },
      { label: "90 días", from: "2026-07-14", to: "2026-10-11", current: false },
    ]);
    const others = readRange("2026-10-01", "2026-10-07", NOW, TZ).presets;
    expect(others.some((p) => p.current)).toBe(false);
  });
});

describe("the numbers on top", () => {
  it("count the stamps, and how many a day on average", () => {
    const entries = [
      ...Array.from({ length: 20 }, (_, i) => stamp(`c${i}`, "2026-10-06 10:00")),
      stamp("x", "2026-10-07 10:00"),
      redeem("x", "2026-10-08 10:00"),
    ];
    const { totals } = summary({ entries });
    expect(totals.stamps).toBe(21);
    expect(totals.perDay).toBe("unos 3 por día");
  });

  it("a single day doesn't say the average", () => {
    const entries = [stamp("a", "2026-10-10 10:00")];
    expect(summary({ entries }, "2026-10-10", "2026-10-10").totals.perDay).toBeNull();
  });

  it("each customer who came counts once, with any of their cards, a redeem too", () => {
    const entries = [
      stamp("a1", "2026-10-06 10:00", "take-away", "marta"),
      stamp("a2", "2026-10-06 10:00", "beans-quarter", "marta"),
      redeem("b1", "2026-10-07 10:00", "take-away", "lucia"),
    ];
    expect(summary({ entries }).totals.visitors).toBe(2);
  });

  it("came back: the customers who came on more than one day", () => {
    const entries = [
      stamp("a", "2026-10-06 10:00"),
      stamp("a", "2026-10-06 10:05"),
      stamp("b", "2026-10-06 10:00"),
      stamp("b", "2026-10-08 18:00"),
    ];
    expect(summary({ entries }).totals.cameBack).toBe(1);
  });

  it("the new customers, the redeems, and the rewards waiting today", () => {
    const { totals } = summary({
      signUps: [local("2026-10-06 09:00"), local("2026-09-30 09:00")],
      entries: [redeem("a", "2026-10-06 10:00"), redeem("b", "2026-09-30 10:00")],
      pendingRewards: new Map([
        ["take-away", 3],
        ["beans-half", 1],
      ]),
    });
    expect(totals).toMatchObject({ newCustomers: 1, redeemed: 1, pending: 4 });
  });
});

describe("day by day", () => {
  it("a row per day with its stamps and new customers, today as hoy", () => {
    const { timeline } = summary({
      signUps: [local("2026-10-05 09:00"), local("2026-10-11 08:00")],
      entries: [
        stamp("a", "2026-10-05 10:00"),
        stamp("b", "2026-10-10 10:00"),
        stamp("c", "2026-10-10 11:00"),
        redeem("a", "2026-10-10 12:00"),
      ],
    });
    expect(timeline.per).toBe("day");
    expect(timeline.rows.map((r) => [r.label, r.stamps, r.newCustomers])).toEqual([
      ["lun 5", 1, 1],
      ["mar 6", 0, 0],
      ["mié 7", 0, 0],
      ["jue 8", 0, 0],
      ["vie 9", 0, 0],
      ["sáb 10", 2, 0],
      ["hoy", 0, 1],
    ]);
  });

  it("a stamp at 23:30 in Buenos Aires counts on that day, not the next one in UTC", () => {
    const { timeline } = summary({ entries: [stamp("a", "2026-10-10 23:30")] });
    expect(timeline.rows.map((r) => r.stamps)).toEqual([0, 0, 0, 0, 0, 1, 0]);
  });

  it("says the day with the most stamps", () => {
    const entries = [stamp("a", "2026-10-10 10:00"), stamp("b", "2026-10-10 11:00")];
    expect(summary({ entries }).timeline.headline).toBe(
      "El día con más sellos fue el sábado 10, con 2.",
    );
  });

  it("with a row per week or per month, says the week or the month", () => {
    const week = summary({ entries: [stamp("a", "2026-09-22 10:00")] }, "2026-09-14", "2026-10-11");
    expect(week.timeline.per).toBe("week");
    expect(week.timeline.headline).toBe(
      "La semana con más sellos fue la del 21 al 27 de septiembre, con 1.",
    );
    const month = summary(
      { entries: [stamp("a", "2026-09-22 10:00")] },
      "2026-06-15",
      "2026-10-11",
    );
    expect(month.timeline.per).toBe("month");
    expect(month.timeline.headline).toBe("El mes con más sellos fue septiembre, con 1.");
  });

  it("a single day only says how many", () => {
    const entries = [stamp("a", "2026-10-10 10:00")];
    expect(summary({ entries }, "2026-10-10", "2026-10-10").timeline.headline).toBe(
      "Se sumó 1 sello.",
    );
  });

  it("without stamps, says so calmly", () => {
    expect(summary({}).timeline.headline).toBe("Todavía no hay sellos en este período.");
  });
});

describe("how many times each customer came", () => {
  it("counts the days each one came, with any card: 1, 2, 3 or 4 or more", () => {
    const entries = [
      stamp("a", "2026-10-06 10:00"),
      // Two cards the same day is one visit.
      stamp("b1", "2026-10-06 10:00", "take-away", "b"),
      stamp("b2", "2026-10-06 10:01", "beans-quarter", "b"),
      stamp("b1", "2026-10-07 10:00", "take-away", "b"),
      ...["05", "06", "07", "08", "09"].map((day) => stamp("c", `2026-10-${day} 10:00`)),
    ];
    const { visits } = summary({ entries });
    expect(visits.bars.map((b) => [b.label, b.value])).toEqual([
      ["1 vez", 1],
      ["2 veces", 1],
      ["3 veces", 0],
      ["4 o más", 1],
    ]);
    expect(visits.headline).toBe("2 de 3 clientes vinieron más de una vez.");
  });

  it("says when one came back, or none", () => {
    const one = [stamp("a", "2026-10-06 10:00"), stamp("a", "2026-10-07 10:00")];
    expect(summary({ entries: one }).visits.headline).toBe("1 de 1 cliente vino más de una vez.");
    const none = [stamp("a", "2026-10-06 10:00")];
    expect(summary({ entries: none }).visits.headline).toBe("Cada cliente vino una sola vez.");
    expect(summary({}).visits.headline).toBe(
      "Todavía no vino nadie con su tarjeta en este período.",
    );
  });
});

describe("per card", () => {
  it("the customers who used it, each once, and its stamps", () => {
    const entries = [
      stamp("a", "2026-10-06 10:00"),
      stamp("a", "2026-10-07 10:00"),
      redeem("b", "2026-10-08 10:00"),
      stamp("c", "2026-10-09 10:00", "beans-half"),
    ];
    const { cards } = summary({ entries });
    expect(cards.map((c) => [c.name, c.visitors, c.stamps])).toEqual([
      ["Café take-away", 2, 2],
      ["Café en grano ¼ kg", 0, 0],
      ["Café en grano ½ kg", 1, 1],
      ["Café en grano 1 kg", 0, 0],
    ]);
  });

  it("only between the dates", () => {
    const entries = [stamp("a", "2026-09-29 10:00"), stamp("b", "2026-10-06 10:00")];
    expect(summary({ entries }).cards[0]).toMatchObject({ visitors: 1, stamps: 1 });
  });

  it("says which card had the most stamps, out of all of them", () => {
    const entries = [
      stamp("a", "2026-10-06 10:00"),
      stamp("b", "2026-10-06 10:00"),
      stamp("c", "2026-10-09 10:00", "beans-half"),
    ];
    expect(summary({ entries }).cardsHeadline).toBe("Café take-away sumó 2 de los 3 sellos.");
    const one = summary({ entries: [stamp("a", "2026-10-06 10:00")] });
    expect(one.cardsHeadline).toBe("Café take-away sumó el único sello.");
    expect(summary({}).cardsHeadline).toBe("Todavía no hay sellos en este período.");
  });

  it("a short name for the table's top", () => {
    expect(summary({}).cards.map((c) => c.short)).toEqual([
      "Take-away",
      "Grano ¼ kg",
      "Grano ½ kg",
      "Grano 1 kg",
    ]);
  });
});

describe("rewards", () => {
  it("one is earned with the 7th stamp of the take-away, counting the ones before the period", () => {
    // 5 before the period, 3 in it: the 7th, in the period, earns one.
    const entries = [...[1, 2, 3].map((i) => stamp("a", `2026-10-0${5 + i} 10:00`))];
    const { cards } = summary({ entries, stampsBefore: new Map([["a", 5]]) });
    expect(cards[0]).toMatchObject({ name: "Café take-away", earned: 1 });
  });

  it("one is earned with the 4th stamp of the coffee beans", () => {
    const entries = [1, 2, 3, 4].map((i) => stamp("q", `2026-10-0${5 + i} 10:00`, "beans-quarter"));
    expect(summary({ entries }).cards[1]).toMatchObject({ earned: 1 });
  });

  it("one earned before the first day doesn't count", () => {
    const entries = [
      ...[1, 2, 3, 4].map((i) => stamp("q", `2026-09-2${i + 4} 10:00`, "beans-quarter")),
      stamp("q", "2026-10-06 10:00", "beans-quarter"),
    ];
    expect(summary({ entries }).cards[1]).toMatchObject({ earned: 0 });
  });

  it("counts the redeems of the period", () => {
    const entries = [redeem("a", "2026-09-30 10:00"), redeem("a", "2026-10-06 10:00")];
    expect(summary({ entries }).cards[0]).toMatchObject({ redeemed: 1 });
  });

  it("the ones waiting to be used are today's, whatever the period", () => {
    const pendingRewards = new Map([
      ["take-away", 3],
      ["beans-half", 1],
    ]);
    expect(summary({ pendingRewards }).cards.map((c) => c.pending)).toEqual([3, 0, 1, 0]);
  });
});

describe("days and hours", () => {
  const entries = [
    stamp("a", "2026-10-10 10:15"),
    stamp("b", "2026-10-10 10:40"),
    stamp("c", "2026-10-06 08:30", "beans-half"),
    stamp("d", "2026-10-10 17:05", "beans-half"),
    redeem("a", "2026-10-07 09:00"),
  ];

  it("up to 7 days, a column per day picked, in order, with its date; today as hoy", () => {
    const { hours } = summary({ entries }, "2026-10-06", "2026-10-11");
    expect(hours.per).toBe("date");
    expect(hours.columns).toEqual([
      { label: "ma", sub: "6", name: "martes 6" },
      { label: "mi", sub: "7", name: "miércoles 7" },
      { label: "ju", sub: "8", name: "jueves 8" },
      { label: "vi", sub: "9", name: "viernes 9" },
      { label: "sá", sub: "10", name: "sábado 10" },
      { label: "hoy", sub: "11", name: "hoy" },
    ]);
    expect(hours.rows.map((r) => [r.label, r.cells])).toEqual([
      ["8 h", [1, 0, 0, 0, 0, 0]],
      ["9 h", [0, 0, 0, 0, 0, 0]],
      ["10 h", [0, 0, 0, 0, 2, 0]],
      ["11 h", [0, 0, 0, 0, 0, 0]],
      ["12 h", [0, 0, 0, 0, 0, 0]],
      ["13 h", [0, 0, 0, 0, 0, 0]],
      ["14 h", [0, 0, 0, 0, 0, 0]],
      ["15 h", [0, 0, 0, 0, 0, 0]],
      ["16 h", [0, 0, 0, 0, 0, 0]],
      ["17 h", [0, 0, 0, 0, 1, 0]],
    ]);
    expect(hours.totals).toEqual([1, 0, 0, 0, 3, 0]);
    expect(hours.averages).toBeNull();
    expect(hours.note).toBeNull();
    expect(hours.most).toBe(2);
  });

  it("up to 7 days, says the busiest day by its date, and the hour", () => {
    expect(summary({ entries }).hours.headline).toBe(
      "El día con más sellos fue el sábado 10, y la hora, de 10 a 11.",
    );
  });

  it("longer, a column per day of the week, Monday first, all the weeks together, and says so", () => {
    const { hours } = summary({ entries }, "2026-09-12", "2026-10-11");
    expect(hours.per).toBe("weekday");
    expect(hours.columns.map((c) => c.label)).toEqual(["lu", "ma", "mi", "ju", "vi", "sá", "do"]);
    expect(hours.columns[5]).toEqual({ label: "sá", sub: null, name: "sábados" });
    expect(hours.rows[2]).toEqual({ label: "10 h", cells: [0, 0, 0, 0, 0, 2, 0] });
    expect(hours.totals).toEqual([0, 1, 0, 0, 0, 3, 0]);
    expect(hours.note).toBe(
      "Cada casilla suma todas las semanas, del 12 de septiembre al 11 de octubre.",
    );
  });

  it("longer, the average is per day of that kind: 30 days have 5 Saturdays and 4 Mondays", () => {
    // From 12/09 to 11/10: 5 Saturdays, 5 Sundays, 4 of each other day.
    const many = [
      ...["09-12", "09-19", "09-26", "10-03", "10-10"].map((d, i) =>
        stamp(`s${i}`, `2026-${d} 10:00`),
      ),
      ...["09-14", "09-21", "09-28", "10-05"].flatMap((d, i) => [
        stamp(`m${i}`, `2026-${d} 10:00`),
        stamp(`n${i}`, `2026-${d} 11:00`),
      ]),
    ];
    const { hours } = summary({ entries: many }, "2026-09-12", "2026-10-11");
    expect(hours.totals).toEqual([8, 0, 0, 0, 0, 5, 0]);
    expect(hours.averages).toEqual(["2", "0", "0", "0", "0", "1", "0"]);
    expect(hours.headline).toBe("Los lunes son los días con más sellos, y de 10 a 11 la hora.");
  });

  it("an average under 10 says one decimal", () => {
    const two = [stamp("a", "2026-09-12 10:00"), stamp("b", "2026-09-19 10:00")];
    const { hours } = summary({ entries: two }, "2026-09-12", "2026-10-11");
    expect(hours.averages?.[5]).toBe("0,4");
  });

  it("without stamps, no rows, and says so calmly", () => {
    const { hours } = summary({});
    expect(hours.rows).toEqual([]);
    expect(hours.headline).toBe("Todavía no hay sellos en este período.");
  });
});
