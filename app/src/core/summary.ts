// Resumen, the manager's numbers of the Club (11/10/2026, flujos-equipo.md): new customers, the customers who
// came with each card, how many times each one bought, the rewards and the busiest days and hours. Between the
// two dates the manager picks (12/10/2026), the last 7 days if none. Days and hours in the café's time, which
// it receives: it doesn't look up the time.
// The entries it gets already count (an undone stamp or redeem never comes): platform/db/summaryRepository.
import type { Cafe } from "../cafes/types";
import type { EntryType } from "./card";

/** From start (included) to end (not included). */
export interface Span {
  start: Date;
  end: Date;
}

export interface Bucket extends Span {
  /** In the chart: "sáb 10", "21 sep", "sep". */
  label: string;
  /** In a sentence: "el sábado 10", "21 de septiembre", "septiembre". */
  long: string;
}

// Local time.

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const SHORT_WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
/** Over the narrow columns of Días y horarios. */
const TINY_WEEKDAYS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];
const PLURAL_WEEKDAYS = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábados",
  "domingos",
];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const LONG_MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const ENGLISH_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface LocalTime {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
  /** 0 is Monday, 6 is Sunday. */
  weekday: number;
  hour: number;
  minute: number;
}

const formats = new Map<string, Intl.DateTimeFormat>();

/** The date and time on the café's clock. Its own names, not the browser's: they're the same everywhere. */
function localTime(date: Date, timeZone: string): LocalTime {
  let format = formats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    });
    formats.set(timeZone, format);
  }
  const parts = format.formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(part("year")),
    month: Number(part("month")),
    day: Number(part("day")),
    weekday: ENGLISH_WEEKDAYS.indexOf(part("weekday")),
    hour: Number(part("hour")),
    minute: Number(part("minute")),
  };
}

/** How far the café's clock is from UTC at that moment, in milliseconds. */
function offset(at: number, timeZone: string): number {
  const t = localTime(new Date(at), timeZone);
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute) - Math.floor(at / 60_000) * 60_000;
}

/** 00:00 on the café's clock of that day. Checked twice: a change of time that day moves it. */
function startOfDay(date: Date, timeZone: string): Date {
  const t = localTime(date, timeZone);
  const midnight = Date.UTC(t.year, t.month - 1, t.day);
  const first = midnight - offset(midnight, timeZone);
  return new Date(midnight - offset(first, timeZone));
}

/** 00:00 of the day `days` after (or before) that one, on the café's clock. */
function addDays(midnight: Date, days: number, timeZone: string): Date {
  // A few hours past, so a day of 23 or 25 hours still lands on the right one.
  return startOfDay(new Date(midnight.getTime() + days * DAY + 6 * 60 * 60 * 1000), timeZone);
}

// The dates.

/** A day of the café's calendar: 2026-10-05, as the date fields send it. */
interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

const iso = ({ year, month, day }: CalendarDay) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** "2026-10-05", or null if it isn't a day of the calendar ("2026-02-30" isn't). */
function readDay(text: string | null): CalendarDay | null {
  const match = text?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? { year, month, day }
    : null;
}

/** 00:00 of that day on the café's clock. Noon in UTC is still that day there, from −12 to +11. */
const startOfCalendarDay = ({ year, month, day }: CalendarDay, timeZone: string) =>
  startOfDay(new Date(Date.UTC(year, month - 1, day, 12)), timeZone);

const calendarDay = (date: Date, timeZone: string): CalendarDay => {
  const { year, month, day } = localTime(date, timeZone);
  return { year, month, day };
};

/** Up to this many days, a bar per day; up to WEEKS_UP_TO, a bar per week; longer, per month. */
const DAYS_UP_TO = 14;
const WEEKS_UP_TO = 16 * 7;
/** How far back the dates can go: further, the bars per month wouldn't end. */
const YEARS_BACK = 10;

export interface Preset {
  label: string;
  from: string;
  to: string;
  current: boolean;
}

/** The quick choices, ending today. */
const PRESET_DAYS = [7, 30, 90];

export interface SummaryRange {
  /** The first day, as the date field shows it: "2026-10-05". */
  from: string;
  /** The last day, included. */
  to: string;
  /** The last day that can be picked. */
  today: string;
  span: Span;
  /** The rows of Día por día: days, weeks or months, depending on how long it is. */
  buckets: Bucket[];
  per: "day" | "week" | "month";
  /** The quick choices: the last 7, 30 and 90 days, and whether it's the one shown. */
  presets: Preset[];
  /** "Del 5 al 11 de octubre." */
  says: string;
}

/** "Del 5 al 11 de octubre.", "Del 28 de septiembre al 4 de octubre.", "El 10 de octubre." The year only if it isn't this one. */
function rangeSays(from: CalendarDay, to: CalendarDay, thisYear: number): string {
  const month = (d: CalendarDay) => LONG_MONTHS[d.month - 1];
  const year = (y: number) => (y === thisYear ? "" : ` de ${y}`);
  if (iso(from) === iso(to)) return `El ${to.day} de ${month(to)}${year(to.year)}.`;
  if (from.year !== to.year) {
    return `Del ${from.day} de ${month(from)} de ${from.year} al ${to.day} de ${month(to)} de ${to.year}.`;
  }
  if (from.month === to.month)
    return `Del ${from.day} al ${to.day} de ${month(to)}${year(to.year)}.`;
  return `Del ${from.day} de ${month(from)} al ${to.day} de ${month(to)}${year(to.year)}.`;
}

/** The bars between two days: per day, per week from the first day, or per month. */
function bucketsOf(span: Span, today: Date, timeZone: string): Bucket[] {
  const days: Date[] = [];
  for (let day = span.start; day < span.end; day = addDays(day, 1, timeZone)) days.push(day);

  if (days.length <= DAYS_UP_TO) {
    return days.map((start) => {
      const t = localTime(start, timeZone);
      return {
        start,
        end: addDays(start, 1, timeZone),
        label:
          start.getTime() === today.getTime() ? "hoy" : `${SHORT_WEEKDAYS[t.weekday]} ${t.day}`,
        long: start.getTime() === today.getTime() ? "hoy" : `el ${WEEKDAYS[t.weekday]} ${t.day}`,
      };
    });
  }

  if (days.length <= WEEKS_UP_TO) {
    return days
      .filter((_, i) => i % 7 === 0)
      .map((start) => {
        const week = addDays(start, 7, timeZone);
        const end = week < span.end ? week : span.end;
        // Its days, so a shorter last week shows: "14 al 20 sep", "28 sep al 4 oct", "4 oct".
        const t = localTime(start, timeZone);
        const l = localTime(addDays(end, -1, timeZone), timeZone);
        const short = (d: LocalTime) => `${d.day} ${MONTHS[d.month - 1]}`;
        const long = (d: LocalTime) => `${d.day} de ${LONG_MONTHS[d.month - 1]}`;
        if (t.day === l.day && t.month === l.month) {
          return { start, end, label: short(t), long: long(t) };
        }
        return t.month === l.month
          ? { start, end, label: `${t.day} al ${short(l)}`, long: `${t.day} al ${long(l)}` }
          : { start, end, label: `${short(t)} al ${short(l)}`, long: `${long(t)} al ${long(l)}` };
      });
  }

  const first = calendarDay(span.start, timeZone);
  const last = calendarDay(days[days.length - 1], timeZone);
  const crossesAYear = first.year !== last.year;
  const buckets: Bucket[] = [];
  for (
    let { year, month } = first;
    year < last.year || (year === last.year && month <= last.month);
  ) {
    const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
    const start = startOfCalendarDay({ year, month, day: 1 }, timeZone);
    const end = startOfCalendarDay({ ...next, day: 1 }, timeZone);
    buckets.push({
      start: start > span.start ? start : span.start,
      end: end < span.end ? end : span.end,
      label: crossesAYear ? `${MONTHS[month - 1]} ${year}` : MONTHS[month - 1],
      long: crossesAYear ? `${LONG_MONTHS[month - 1]} de ${year}` : LONG_MONTHS[month - 1],
    });
    ({ year, month } = next);
  }
  return buckets;
}

/**
 * The days the manager picked, from the address (?from=2026-10-05&to=2026-10-11). Without them, or if one
 * isn't a date, the last 7 days. Never past today; picked the other way around, they're swapped.
 */
export function readRange(
  fromText: string | null,
  toText: string | null,
  now: Date,
  timeZone: string,
): SummaryRange {
  const today = startOfDay(now, timeZone);
  const todayDay = calendarDay(today, timeZone);
  const oldest = startOfCalendarDay({ ...todayDay, year: todayDay.year - YEARS_BACK }, timeZone);
  const within = (day: CalendarDay | null) => {
    if (!day) return null;
    const start = startOfCalendarDay(day, timeZone);
    return start > today ? today : start < oldest ? oldest : start;
  };
  let start = within(readDay(fromText)) ?? addDays(today, -6, timeZone);
  let last = within(readDay(toText)) ?? today;
  if (start > last) [start, last] = [last, start];
  const span = { start, end: addDays(last, 1, timeZone) };
  const from = calendarDay(start, timeZone);
  const to = calendarDay(last, timeZone);
  const buckets = bucketsOf(span, today, timeZone);
  const days = Math.round((span.end.getTime() - span.start.getTime()) / DAY);
  const presets = PRESET_DAYS.map((n) => {
    const presetFrom = iso(calendarDay(addDays(today, 1 - n, timeZone), timeZone));
    return {
      label: `${n} días`,
      from: presetFrom,
      to: iso(todayDay),
      current: presetFrom === iso(from) && iso(to) === iso(todayDay),
    };
  });
  return {
    from: iso(from),
    to: iso(to),
    today: iso(todayDay),
    span,
    buckets,
    per: days <= DAYS_UP_TO ? "day" : days <= WEEKS_UP_TO ? "week" : "month",
    presets,
    says: rangeSays(from, to, todayDay.year),
  };
}

// The summary.

/** A stamp or a redeem that counts (not undone), on which card and whose. */
export interface CountedEntry {
  cardId: string;
  /** The card's customer; a deleted customer's card counts as its own customer. */
  customerId: string;
  cardType: string;
  type: EntryType;
  at: Date;
}

export interface SummaryData {
  /** When each customer still in the Club signed up, from the first day picked. */
  signUps: readonly Date[];
  /** The stamps and redeems that count from the first day picked, the oldest first. */
  entries: readonly CountedEntry[];
  /** Per card with entries from the first day picked: its stamps that count from before it. */
  stampsBefore: ReadonlyMap<string, number>;
  /** The rewards waiting to be used today, per card type. */
  pendingRewards: ReadonlyMap<string, number>;
}

export interface Bar {
  label: string;
  value: number;
}

export interface Summary {
  /** The days picked, for the date fields, and "Del 5 al 11 de octubre." */
  range: Pick<SummaryRange, "from" | "to" | "today" | "says" | "presets">;
  /** The numbers on top. */
  totals: {
    stamps: number;
    /** "unos 12 por día"; nothing for a single day. */
    perDay: string | null;
    /** Each customer once, with any card. */
    visitors: number;
    /** The ones who came on more than one day. */
    cameBack: number;
    newCustomers: number;
    redeemed: number;
    /** Today's, whatever the period. */
    pending: number;
  };
  /** A row per day, week or month: its stamps and new customers. */
  timeline: {
    per: SummaryRange["per"];
    rows: { label: string; stamps: number; newCustomers: number }[];
    headline: string;
  };
  /** How many customers came 1, 2, 3, or 4 or more days, with any card. */
  visits: { bars: Bar[]; headline: string };
  /** "Café take-away sumó 445 de los 545 sellos." */
  cardsHeadline: string;
  /** Each card's numbers, side by side. */
  cards: {
    name: string;
    /** For the top of the table: "Grano ¼ kg". */
    short: string;
    visitors: number;
    stamps: number;
    earned: number;
    redeemed: number;
    pending: number;
  }[];
  /** Stamps per hour (rows) and day of the week (columns, Monday first), in the café's time. */
  hours: {
    /** Up to 7 days, a column per day picked ("date"); longer, Monday to Sunday, all the weeks together. */
    per: "date" | "weekday";
    /** Over the column, "sá" and "10"; its name where there's room, "sábado 10" or "sábados". */
    columns: { label: string; sub: string | null; name: string }[];
    rows: { label: string; cells: number[] }[];
    /** Each column's stamps. */
    totals: number[];
    /** Per weekday: the stamps of a day like that, on average ("2,5"), since 30 days have 5 of some. */
    averages: string[] | null;
    /** The largest cell: the darkest. */
    most: number;
    /** Per weekday, what a cell is. */
    note: string | null;
    headline: string;
  };
}

const within = (at: Date, span: Span) => at >= span.start && at < span.end;

/** The first of the largest: on a tie, the earliest one. -1 if they're all zero. */
function largest(values: readonly number[]): number {
  let best = -1;
  values.forEach((value, i) => {
    if (value > 0 && (best === -1 || value > values[best])) best = i;
  });
  return best;
}

const NO_STAMPS = "Todavía no hay sellos en este período.";

/** 12 from 12.3; under 10, one decimal with a comma: "2,5", "0,4", and "2" for 2. */
function decimal(n: number): string {
  if (n >= 10) return String(Math.round(n));
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

/** "El día con más sellos fue el sábado 10, con 22." */
function timelineHeadline(range: SummaryRange, stamps: number[]): string {
  const total = stamps.reduce((sum, n) => sum + n, 0);
  if (total === 0) return NO_STAMPS;
  if (stamps.length === 1) return total === 1 ? "Se sumó 1 sello." : `Se sumaron ${total} sellos.`;
  const best = largest(stamps);
  const { long } = range.buckets[best];
  const most = stamps[best];
  if (range.per === "day") return `El día con más sellos fue ${long}, con ${most}.`;
  if (range.per === "week") return `La semana con más sellos fue la del ${long}, con ${most}.`;
  return `El mes con más sellos fue ${long}, con ${most}.`;
}

/** For the top of the table: "Take-away" from "Café take-away", "Grano ¼ kg" from "Café en grano ¼ kg". */
const shortName = (name: string) =>
  name.replace(/^Café en grano /, "Grano ").replace(/^Café take-away$/, "Take-away");

export function summarize(
  data: SummaryData,
  range: SummaryRange,
  cafe: Pick<Cafe, "timeZone" | "cards">,
): Summary {
  const { timeZone } = cafe;
  const { span: current, buckets } = range;
  const inCurrent = data.entries.filter((e) => within(e.at, current));
  const stampsNow = inCurrent.filter((e) => e.type === "stamp");
  const signUpsNow = data.signUps.filter((at) => within(at, current));
  const days = Math.round((current.end.getTime() - current.start.getTime()) / DAY);

  // How many days each customer came, with any card.
  const daysCame = new Map<string, Set<string>>();
  for (const e of inCurrent) {
    const t = localTime(e.at, timeZone);
    const day = `${t.year}-${t.month}-${t.day}`;
    daysCame.set(e.customerId, (daysCame.get(e.customerId) ?? new Set()).add(day));
  }
  const timesCame = [...daysCame.values()].map((d) => d.size);
  const came = (test: (n: number) => boolean) => timesCame.filter(test).length;
  const cameBack = came((n) => n > 1);
  const visitors = timesCame.length;
  const visits = {
    bars: [
      { label: "1 vez", value: came((n) => n === 1) },
      { label: "2 veces", value: came((n) => n === 2) },
      { label: "3 veces", value: came((n) => n === 3) },
      { label: "4 o más", value: came((n) => n >= 4) },
    ],
    headline:
      visitors === 0
        ? "Todavía no vino nadie con su tarjeta en este período."
        : cameBack === 0
          ? "Cada cliente vino una sola vez."
          : `${cameBack} de ${visitors} ${visitors === 1 ? "cliente" : "clientes"} ${cameBack === 1 ? "vino" : "vinieron"} más de una vez.`,
  };

  // Rewards: earned with the stamp that ends a round, counting each card's stamps from before.
  const stampsSoFar = new Map(data.stampsBefore);
  const earned = new Map<string, number>();
  for (const e of data.entries) {
    if (e.type !== "stamp") continue;
    const perRound = cafe.cards.find((card) => card.type === e.cardType)?.stamps;
    if (!perRound) continue;
    const count = (stampsSoFar.get(e.cardId) ?? 0) + 1;
    stampsSoFar.set(e.cardId, count);
    if (count % perRound === 0 && within(e.at, current)) {
      earned.set(e.cardType, (earned.get(e.cardType) ?? 0) + 1);
    }
  }
  const cards = cafe.cards.map((card) => {
    const theirs = inCurrent.filter((e) => e.cardType === card.type);
    return {
      name: card.name,
      short: shortName(card.name),
      visitors: new Set(theirs.map((e) => e.cardId)).size,
      stamps: theirs.filter((e) => e.type === "stamp").length,
      earned: earned.get(card.type) ?? 0,
      redeemed: theirs.filter((e) => e.type === "redeem").length,
      pending: data.pendingRewards.get(card.type) ?? 0,
    };
  });

  // Day by day.
  const rows = buckets.map((b) => ({
    label: b.label,
    stamps: stampsNow.filter((e) => within(e.at, b)).length,
    newCustomers: signUpsNow.filter((at) => within(at, b)).length,
  }));

  // Days and hours, on the café's clock: up to 7 days, a column per day picked; longer, per day of the week.
  const perDate = range.per === "day" && buckets.length <= 7;
  const when = stampsNow.map((e) => {
    const t = localTime(e.at, timeZone);
    return {
      hour: t.hour,
      column: perDate ? buckets.findIndex((b) => within(e.at, b)) : t.weekday,
    };
  });
  const columns = perDate
    ? buckets.map((b) => {
        const t = localTime(b.start, timeZone);
        return b.label === "hoy"
          ? { label: "hoy", sub: String(t.day), name: "hoy" }
          : {
              label: TINY_WEEKDAYS[t.weekday],
              sub: String(t.day),
              name: `${WEEKDAYS[t.weekday]} ${t.day}`,
            };
      })
    : TINY_WEEKDAYS.map((label, day) => ({ label, sub: null, name: PLURAL_WEEKDAYS[day] }));
  const hoursSeen = when.map((w) => w.hour);
  const firstHour = Math.min(...hoursSeen);
  const hourRows =
    when.length === 0
      ? []
      : Array.from({ length: Math.max(...hoursSeen) - firstHour + 1 }, (_, i) => {
          const hour = firstHour + i;
          return {
            label: `${hour} h`,
            cells: columns.map(
              (_, column) => when.filter((w) => w.hour === hour && w.column === column).length,
            ),
          };
        });
  const totals = columns.map((_, column) => when.filter((w) => w.column === column).length);
  // How many of each weekday the days picked have.
  const weekdays = WEEKDAYS.map(() => 0);
  for (let day = current.start; day < current.end; day = addDays(day, 1, timeZone)) {
    weekdays[localTime(day, timeZone).weekday]++;
  }
  const perWeekday = totals.map((total, day) => (weekdays[day] ? total / weekdays[day] : 0));
  const busiestColumn = largest(perDate ? totals : perWeekday);
  const busiestHour = largest(hourRows.map((r) => r.cells.reduce((sum, n) => sum + n, 0)));
  const hourSays = `de ${firstHour + busiestHour} a ${firstHour + busiestHour + 1}`;
  let hoursHeadline = NO_STAMPS;
  if (busiestColumn !== -1) {
    hoursHeadline = perDate
      ? `El día con más sellos fue ${buckets[busiestColumn].long}, y la hora, ${hourSays}.`
      : `Los ${PLURAL_WEEKDAYS[busiestColumn]} son los días con más sellos, y ${hourSays} la hora.`;
  }

  const redeemed = cards.reduce((sum, c) => sum + c.redeemed, 0);
  const topCard = largest(cards.map((c) => c.stamps));
  const cardsHeadline =
    topCard === -1
      ? NO_STAMPS
      : stampsNow.length === 1
        ? `${cards[topCard].name} sumó el único sello.`
        : `${cards[topCard].name} sumó ${cards[topCard].stamps} de los ${stampsNow.length} sellos.`;
  const average = Math.round(stampsNow.length / days);
  return {
    range: {
      from: range.from,
      to: range.to,
      today: range.today,
      says: range.says,
      presets: range.presets,
    },
    totals: {
      stamps: stampsNow.length,
      perDay:
        days <= 1 || stampsNow.length === 0
          ? null
          : average === 0
            ? "menos de 1 por día"
            : `unos ${average} por día`,
      visitors,
      cameBack,
      newCustomers: signUpsNow.length,
      redeemed,
      pending: cards.reduce((sum, c) => sum + c.pending, 0),
    },
    timeline: {
      per: range.per,
      rows,
      headline: timelineHeadline(
        range,
        rows.map((r) => r.stamps),
      ),
    },
    visits,
    cardsHeadline,
    cards,
    hours: {
      per: perDate ? "date" : "weekday",
      columns,
      rows: hourRows,
      totals,
      averages: perDate ? null : perWeekday.map(decimal),
      most: Math.max(0, ...hourRows.flatMap((r) => r.cells)),
      note: perDate
        ? null
        : `Cada casilla suma todas las semanas, ${range.says.replace(/^Del/, "del").replace(/\.$/, "")}.`,
      headline: hoursHeadline,
    },
  };
}
