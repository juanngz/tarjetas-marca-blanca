// Amounts that never split in two lines: "¼ kg", "30% OFF". A non-breaking space between them.
export function keepTogether(text: string): string {
  return text.replace(/ (?=k?g\b)/g, " ").replace(/% OFF/g, "% OFF");
}

/** How many rewards a card has, short, for its corner in the wallet: "1 premio", "3 premios". */
export function rewardsLabel(rewards: number): string {
  return rewards === 1 ? "1 premio" : `${rewards} premios`;
}
