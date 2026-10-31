// The wallet on this screen: which card goes in front and the order of the ones behind.
// How the screen looks, not a Club rule: it lives next to its route.

/** The front card: the chosen one, or the first if none was chosen (or one that doesn't exist). */
export function chooseFront(
  cards: readonly { type: string }[],
  chosen: string | null,
): string | undefined {
  return cards.find((c) => c.type === chosen)?.type ?? cards[0]?.type;
}

/**
 * The wallet from back to front: the chosen one in front; behind it, the others in the fixed order
 * reversed (the last one in the fixed order ends up furthest back).
 */
export function walletOrder(
  cards: readonly { type: string }[],
  front: string | undefined,
): string[] {
  const back = cards.filter((c) => c.type !== front).map((c) => c.type);
  return [...back.reverse(), ...(front ? [front] : [])];
}
