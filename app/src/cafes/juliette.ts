// Juliette · Café de especialidad. Copiado de example.ts y adaptado (../../../marca/README.md).
// Rules: ../../../docs/propuestas-tarjeta-fidelizacion.md
// Texts: ../../../docs/flujos-cliente.md (Flujo 4) and ../../../docs/flujos-equipo.md (Flujo B and C).
import type { Cafe } from "./types";

export const juliette: Cafe = {
  id: "juliette",
  name: "Juliette",
  description: "Café de especialidad",
  club: { name: "Comunidad Juliette", highlight: "Juliette" },
  welcome: "Cada visita suma un sello. Juntá los sellos y sumate a la comunidad.",
  controller: { name: "Juliette Café de Especialidad", address: "Buenos Aires, Argentina" },
  timeZone: "America/Argentina/Buenos_Aires",
  // Only the take-away card. It has a slot more than its stamps, the reward's, like a paper card: 8. Stamping
  // it is redeeming the reward. Its band says the rule, short ("El 8º café, gratis"), and its slot what it
  // gives ("Gratis").
  // A card's type never changes once customers have it. Its stamps only change with a migration that recounts
  // every stored balance from the ledger, like 0011: the reward is earned with the 7th stamp, and
  // used in the next purchase, the card's last slot (like a paper card). Otherwise, to change a rule, add a card
  // with a new type.
  cards: [
    {
      type: "take-away",
      name: "Café take-away",
      stamps: 7,
      stamp: "gatito",
      color: 1,
      reward: "un café take-away gratis",
      texts: {
        goal: "el café gratis",
        won: "un café take-away gratis",
        celebration: "¡Completaste la tarjeta!",
        rewardRedeemed: "Este café va por cuenta de la casa. Que lo disfrutes, {name}.",
        band: "El 8º café, gratis",
        slot: "Gratis",
      },
    },
  ],
};
