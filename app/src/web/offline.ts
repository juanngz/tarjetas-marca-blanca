// A register action without a connection: the request doesn't arrive (or its answer doesn't come back).
// Instead of an error screen, the same screen stays with Sin conexión, and tapping again is safe: the
// server never records twice on the same card (the version the barista saw). Nothing is saved for later.
import type { ShouldRevalidateFunctionArgs } from "react-router";

export const OFFLINE = { offline: true } as const;

/** The route's clientAction: the server's action, or OFFLINE if it couldn't be reached. */
export async function unlessOffline<T>(
  serverAction: () => Promise<T>,
): Promise<T | typeof OFFLINE> {
  try {
    return await serverAction();
  } catch (error) {
    // fetch fails with a TypeError when there's no connection. Anything else (a redirect) goes on.
    if (error instanceof TypeError) return OFFLINE;
    throw error;
  }
}

export function wasOffline(actionResult: unknown): boolean {
  return typeof actionResult === "object" && actionResult !== null && "offline" in actionResult;
}

type Revalidate = (args: ShouldRevalidateFunctionArgs) => boolean;

/**
 * A route's shouldRevalidate: after an action that didn't reach the server, nothing is asked again
 * (it would fail too, and the screen would be lost). Otherwise, what `then` says (by default, React Router's).
 */
export const keepScreenWhenOffline =
  (then: Revalidate = ({ defaultShouldRevalidate }) => defaultShouldRevalidate): Revalidate =>
  (args) =>
    wasOffline(args.actionResult) ? false : then(args);

/**
 * A customer screen's clientLoader (Flujo 5, "Sin conexión"): what the server says, or, if it couldn't be
 * reached, what the phone kept (web/offlineCopy.ts). If the phone kept nothing, it fails as before.
 */
export async function orWhatIsKept<T, K>(
  serverLoader: () => Promise<T>,
  kept: () => K | null,
): Promise<T | K> {
  try {
    return await serverLoader();
  } catch (error) {
    const copy = error instanceof TypeError ? kept() : null;
    if (copy === null) throw error;
    return copy;
  }
}

/** Moving between screens, the register's bar is asked again at most every hour (see registerBarAgain). */
const BAR_FRESH_FOR = 60 * 60 * 1000;

/**
 * The register's layout (who's at the register): asked once, not on every screen nor after every tap. Each
 * screen and action checks the session itself, so this is only the bar. Slow from Buenos Aires (11/10/2026):
 * going back to Sumar sello waited a trip to the EU for the same name. Asked again only:
 * - after a change in Equipo: it may be whoever is at the register;
 * - moving between screens, if an hour went by: the layout renews the staff session with use (30 days).
 */
export function registerBarAgain(
  args: ShouldRevalidateFunctionArgs,
  { loadedAt, now }: { loadedAt: number; now: number },
): boolean {
  if (wasOffline(args.actionResult)) return false;
  if (args.formMethod) return args.formAction?.startsWith("/register/team") ?? false;
  return now - loadedAt >= BAR_FRESH_FOR;
}
