// The page's side of the service worker (sw.ts): starting it, keeping the wallet for opening the app
// without a connection, and forgetting it. Everything is best effort: if the phone can't, the app works
// the same with a connection.
import { useEffect } from "react";
import { PAGES } from "./cachePlan";

/** Starts the service worker on the customer's screens. Never at the register: nothing is kept there. */
export function useServiceWorker(customer: boolean) {
  useEffect(() => {
    // In `npm run dev` there's no /sw.js (vite.config.ts builds it).
    if (!customer || !import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Without it, the app works the same with a connection.
    });
  }, [customer]);
}

/**
 * Keeps a page for opening the app without a connection. The service worker keeps the ones opened from
 * scratch; a page reached from another (sign-up, Volver a mis tarjetas) is asked here. `again`: even if
 * there's one kept already (what it shows changed).
 */
export async function keepPage(path: string, again: boolean) {
  try {
    // Only with the service worker, which shows it: not in `npm run dev`. The first time (just signed up)
    // it's still starting.
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    await navigator.serviceWorker.ready;
    const pages = await caches.open(PAGES);
    if (!again && (await pages.match(path))) return;
    const response = await fetch(path);
    // Sent to the welcome: the session ended. That isn't the page.
    if (response.ok && !response.redirected) await pages.put(path, response);
  } catch {
    // No connection, or the phone doesn't allow it: it's kept the next time.
  }
}

/** Forgets the pages kept on the phone: Salir, or a session that ended. */
export async function forgetPages() {
  try {
    await caches.delete(PAGES);
  } catch {
    // Without the cache storage there was nothing kept.
  }
}
