// The customer's cards, kept on the phone (Flujo 5, "Sin conexión"): each card's code shows without a
// connection, also the ones that were never opened. The wallet keeps a copy every time it's shown; a card's
// screen updates its own. The welcome screen forgets it (Salir, or a session that ended).
// Never the document: the wallet doesn't carry it.

const KEY = "club:wallet";
/** Goes up when what's kept changes shape: a copy from another version of the app isn't used. */
const SHAPE = 1;

export interface KeptCard {
  type: string;
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The phone's storage. On the server there's none, and a phone in private mode can refuse it. */
function phone(): Store | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function read(store: Store | null): string | null {
  try {
    return store?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

function write(store: Store | null, wallet: { cards: KeptCard[] }) {
  try {
    store?.setItem(KEY, JSON.stringify({ shape: SHAPE, wallet }));
  } catch {
    // Full or not allowed: without a connection, the code won't show. Nothing else changes.
  }
}

/** Keeps the wallet as it was shown. Says whether it changed. */
export function keepWallet(wallet: { cards: KeptCard[] }, store = phone()): boolean {
  if (!store) return false;
  const before = read(store);
  write(store, wallet);
  return before !== read(store);
}

export function keptWallet<W extends { cards: KeptCard[] }>(store = phone()): W | null {
  const text = read(store);
  if (!text) return null;
  try {
    const kept = JSON.parse(text);
    return kept?.shape === SHAPE && Array.isArray(kept.wallet?.cards) ? (kept.wallet as W) : null;
  } catch {
    return null;
  }
}

/** A card seen on its own screen, newer than the wallet's: replaces it in the copy. */
export function keepCard<C extends KeptCard>(card: C, store = phone()) {
  const wallet = keptWallet(store);
  if (!wallet) return;
  write(store, { ...wallet, cards: wallet.cards.map((c) => (c.type === card.type ? card : c)) });
}

export function keptCard<C extends KeptCard>(type: string, store = phone()): C | null {
  return (keptWallet(store)?.cards.find((c) => c.type === type) as C | undefined) ?? null;
}

export function forgetWallet(store = phone()) {
  try {
    store?.removeItem(KEY);
  } catch {
    // Not allowed: there was nothing kept either.
  }
}
