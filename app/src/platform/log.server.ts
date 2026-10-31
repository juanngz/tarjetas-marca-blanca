// The logs (Cloudflare shows them). Never a customer's DNI or name, nor a PIN or a token.
// The whole app logs with these two functions; never console.log with a person's data.
import type { Logger } from "../application/ports";

/** Fields that never go to a log, whatever their value. */
const SENSITIVE = new Set(["dni", "document", "number", "name", "pin", "token", "cookie", "key"]);

/** A DNI with 7 or 8 digits, with or without dots. */
const DNI = /\b\d{1,2}\.?\d{3}\.?\d{3}\b/g;

function redact(value: unknown, key?: string): unknown {
  if (key && SENSITIVE.has(key.toLowerCase())) return "[redacted]";
  if (typeof value === "string") return value.replace(DNI, "[redacted]");
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  }
  return value;
}

/**
 * The error without the query's data: Drizzle puts it in the message ("params: …"),
 * with the customer's name, for example. Keeps the underlying cause and where it happened.
 */
function describe(error: unknown) {
  if (!(error instanceof Error)) return { message: String(error) };

  let underlying: unknown = error.cause;
  let cause: string | undefined;
  while (underlying instanceof Error) {
    cause = underlying.message;
    underlying = underlying.cause;
  }
  return {
    type: error.name,
    message: error.message.replace(/\s*params:[\s\S]*$/, ""),
    cause,
    // Only the "at …" lines: the first line of the stack repeats the message, with the data.
    where: (error.stack ?? "")
      .split("\n")
      .filter((line) => line.trimStart().startsWith("at "))
      .slice(0, 8)
      .map((line) => line.trim()),
  };
}

export function log(event: string, data: Record<string, unknown> = {}): void {
  console.log(JSON.stringify(redact({ event, ...data })));
}

export const consoleLogger: Logger = { log };

export function logError(error: unknown, context: string): void {
  console.error(JSON.stringify(redact({ event: "error", context, ...describe(error) })));
}
