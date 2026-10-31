// When a customer signed up, said in the café's voice (voz.md, "Formato"): "1 de octubre", without the year
// unless it's another one. By the café's day, which it receives with its time zone: it doesn't look up the time.

function localDate(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: part("day"), month: part("month"), year: part("year") };
}

export function signedUpOn(date: Date, now: Date, timeZone: string): string {
  const { day, month, year } = localDate(date, timeZone);
  const sameYear = year === localDate(now, timeZone).year;
  return `Se anotó el ${day} de ${month}${sameYear ? "" : ` de ${year}`}`;
}
