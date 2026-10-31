// The greeting by the café's local time and the first name: ../../../marca/voz.md,
// "El saludo". Buenos días in the morning.
// It doesn't look up the time: it receives it, along with the café's time zone.

function localHour(now: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("es-AR", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone,
  }).format(now);
  return Number(hour);
}

export function greeting(name: string, now: Date, timeZone: string): string {
  const hour = localHour(now, timeZone);
  if (hour < 13) return `Buenos días, ${name}.`;
  if (hour < 20) return `Buenas tardes, ${name}.`;
  return `Buenas noches, ${name}.`;
}
