// When a movement happened, the way the customer reads it: "Hoy, 9:42", "Ayer, 9:42",
// "30 de septiembre, 9:42" and, if it was another year, "30 de diciembre de 2025, 20:05".
// Always in Buenos Aires time: the server's and the phone's clock don't matter.
const ZONE = "America/Argentina/Buenos_Aires";

const time = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONE,
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
});
const dayOf = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, dateStyle: "short" });
const dayAndMonth = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONE,
  day: "numeric",
  month: "long",
});
const withYear = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** The calendar day in Buenos Aires, as 2026-10-08. */
const day = (date: Date) => dayOf.format(date);

export function movementDate(at: Date, now: Date): string {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const when =
    day(at) === day(now)
      ? "Hoy"
      : day(at) === day(yesterday)
        ? "Ayer"
        : day(at).slice(0, 4) === day(now).slice(0, 4)
          ? dayAndMonth.format(at)
          : withYear.format(at);
  // es-AR always writes 09:42: the hour goes without the zero, the way it's said.
  return `${when}, ${time.format(at).replace(/^0(?=\d)/, "")}`;
}
