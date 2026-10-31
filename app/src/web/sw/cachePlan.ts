// What the service worker (sw.ts) does with each request (Flujo 5, "Sin conexión"). Only the customer's
// wallet and each card's code are kept, with the app's files to show them. Never the register (Flujo E:
// nothing is saved for later), never what's sent, never a screen's data (the screen falls back on the copy
// in web/offlineCopy.ts).

/** Where the kept pages are. The welcome screen empties it, with the copy (web/offlineCopy.ts). */
export const PAGES = "club-pages";

export type Plan =
  /** Asked to the server; without a connection, the last one kept. */
  | "page"
  /** From the phone, kept since the app was opened: the files change name when they change. */
  | "file"
  /** Not touched. */
  | "network";

/** The wallet (/cards) and a card's code (/cards/take-away). Not its stamps and rewards (…/history). */
const KEPT_PAGE = /^\/cards(\/[a-z0-9-]+)?\/?$/;

export function cachePlan(
  request: { method: string; mode: string; url: string },
  files: ReadonlySet<string>,
  /** The app's own address: anything from another site (Turnstile) isn't touched. */
  origin: string,
): Plan {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== origin) return "network";
  if (request.mode === "navigate" && KEPT_PAGE.test(url.pathname)) return "page";
  if (files.has(url.pathname)) return "file";
  return "network";
}
