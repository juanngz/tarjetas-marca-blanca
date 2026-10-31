// When something happened, in the café's voice (voz.md, "Formato"): "8 de octubre, 20:05", 24-hour time,
// without the year unless it's another one. In the café's time zone, which it receives: it doesn't look up
// the time.

function local(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: part("day"),
    month: part("month"),
    year: part("year"),
    time: `${Number(part("hour"))}:${part("minute")}`,
  };
}

export function dayAndTime(date: Date, now: Date, timeZone: string): string {
  const { day, month, year, time } = local(date, timeZone);
  const sameYear = year === local(now, timeZone).year;
  return `${day} de ${month}${sameYear ? "" : ` de ${year}`}, ${time}`;
}
