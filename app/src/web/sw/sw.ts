// The service worker (Flujo 5, "Sin conexión"): makes the app saved on the home screen open without a
// connection, with the code of each card. Built on its own as /sw.js (vite.config.ts, serviceWorker()).
// What it keeps and what it doesn't is decided in cachePlan.ts; this file only does it.
// - The app's files: kept when the app is first opened. They change name when they change.
// - The wallet and each card's code: asked to the server; without a connection, the last one kept. If the
//   server sends the customer to the welcome (their session ended), they're all forgotten.
import { cachePlan, PAGES } from "./cachePlan";

// Filled in when the app is built: the app's files, and a name that changes with them, so the phone
// notices a new version and keeps the new files.
declare const __APP_FILES__: string[];
declare const __APP_VERSION__: string;

interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}
interface FetchEvent extends ExtendableEvent {
  request: Request;
  respondWith(response: Promise<Response>): void;
}
interface ServiceWorkerScope {
  location: Location;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: "install" | "activate", listener: (event: ExtendableEvent) => void): void;
  addEventListener(type: "fetch", listener: (event: FetchEvent) => void): void;
}

const worker = self as unknown as ServiceWorkerScope;
const FILES = `club-files-${__APP_VERSION__}`;
const files = new Set(__APP_FILES__);

worker.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(FILES)
      .then((cache) => cache.addAll([...files]))
      // The new version takes over right away: its files are already kept.
      .then(() => worker.skipWaiting()),
  );
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // The kept pages point to the files of the version they were built with: they're asked again, and
      // only then the old files go. Without a connection, the old ones stay until the next version.
      if (await refreshPages()) {
        for (const name of await caches.keys()) {
          if (name.startsWith("club-files-") && name !== FILES) await caches.delete(name);
        }
      }
      await worker.clients.claim();
    })(),
  );
});

worker.addEventListener("fetch", (event) => {
  const plan = cachePlan(event.request, files, worker.location.origin);
  if (plan === "page") event.respondWith(page(event.request));
  else if (plan === "file") event.respondWith(file(event.request));
});

async function page(request: Request): Promise<Response> {
  const pages = await caches.open(PAGES);
  let response: Response;
  try {
    response = await fetch(request);
  } catch {
    return (await keptPage(pages, request.url)) ?? Response.error();
  }
  await remember(pages, request.url, response);
  return response;
}

/** Without a connection: the same page, or the wallet (a card can be opened from there with its copy). */
async function keptPage(pages: Cache, url: string): Promise<Response | undefined> {
  const same = (await pages.match(url)) ?? (await pages.match(url, { ignoreSearch: true }));
  if (same) return same;
  if (await pages.match("/cards")) return Response.redirect("/cards", 302);
  return undefined;
}

/** Keeps a page as the server sent it. Sent to the welcome, the customer is out: nothing stays. */
async function remember(pages: Cache, url: string, response: Response) {
  if (response.type === "opaqueredirect" || response.redirected) await caches.delete(PAGES);
  else if (response.ok) await pages.put(url, response.clone());
  else if (response.status === 404) await pages.delete(url);
}

/** Each kept page, asked again. False if one couldn't be asked (no connection). */
async function refreshPages(): Promise<boolean> {
  const pages = await caches.open(PAGES);
  try {
    for (const request of await pages.keys()) {
      await remember(pages, request.url, await fetch(request.url));
    }
    return true;
  } catch {
    return false;
  }
}

async function file(request: Request): Promise<Response> {
  const kept = await caches.match(request.url);
  if (kept) return kept;
  const response = await fetch(request);
  if (response.ok) await (await caches.open(FILES)).put(request.url, response.clone());
  return response;
}
