// The shape of a café's config: everything the app says and shows that belongs to the café.
// How to set up a new one: ../../../marca/README.md. See ../../../docs/implementacion/varias-cafeterias.md

/**
 * A set of four drawings in public/stamps/, by name: "seal" is seal-empty.svg, seal-stamped.svg, seal-reward.svg
 * (the reward's slot, off) and seal-ready.svg (lit, with a reward to redeem; also the festejo's).
 */
export type StampDrawing = string;

/** The card's colors in the theme: 1 is tarjeta-1, tarjeta-1-honda… in marca/tokens.json (styles/cards.css). */
export type CardColor = 1 | 2 | 3 | 4;

export interface CardConfig {
  /** What goes in the URL: /cards/take-away. Never changes. */
  type: string;
  name: string;
  /** How many stamps complete the card and earn the reward, used in a later purchase. */
  stamps: number;
  stamp: StampDrawing;
  color: CardColor;
  /** The reward, for the register: "un café gratis". */
  reward: string;
  texts: {
    /** For the register: what the stamps are for. "Le faltan 2 para el café gratis." */
    goal: string;
    /** For the register: "Marta ganó un café gratis." */
    won: string;
    /** The festejo's title, when the reward's slot is stamped and the card is complete: "¡Completaste la tarjeta!". */
    celebration: string;
    rewardRedeemed: string;
    /** The card's rule, short, in a band below the grid: "En la 5ª compra, 30% OFF". */
    band?: string;
    /**
     * Under the reward's slot, the last one: "Gratis", "30%". Short: it fits a slot. None when the reward is
     * already drawn inside the stamp's reward drawing.
     */
    slot?: string;
  };
}

export interface Cafe {
  id: string;
  /** As the customer says it: under the app's icon, in the foot and as the logo's text for screen readers. */
  name: string;
  /** What the café is, after its name in the foot: "Cafetería de especialidad". */
  description: string;
  /** The program's name, with the word that goes in italics: El Club del *Café*. */
  club: { name: string; highlight: string };
  /** The welcome line, under the Club's name. */
  welcome: string;
  /** Who keeps the data and where, for Más información (Ley 25.326). */
  controller: { name: string; address: string };
  /** For the greeting by the café's local time. */
  timeZone: string;
  /** In the order they're shown, always the same. */
  cards: readonly CardConfig[];
}
