// The front card of the wallet goes in the URL (?front=), so it also works without JavaScript.
// Shared by the customer layout and the wallet: bringing a card to the front doesn't need the server.
import type { ShouldRevalidateFunctionArgs } from "react-router";

/** Whether going from one URL to the other only changes the front card: then nothing needs fetching. */
export function onlyFrontChanges(before: URL, after: URL): boolean {
  if (before.pathname !== after.pathname) return false;
  const withoutFront = (url: URL) => {
    const search = new URLSearchParams(url.search);
    search.delete("front");
    search.sort();
    return search.toString();
  };
  return (
    before.searchParams.get("front") !== after.searchParams.get("front") &&
    withoutFront(before) === withoutFront(after)
  );
}

/** The routes' shouldRevalidate: bringing another card to the front doesn't ask the server for anything. */
export function revalidateUnlessOnlyFrontChanges({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean {
  return onlyFrontChanges(currentUrl, nextUrl) ? false : defaultShouldRevalidate;
}
