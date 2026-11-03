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
  // Each card has a slot more than its stamps, the reward's, like a paper card: 8 for the coffee, 5 for the
  // coffee beans. Stamping it is redeeming the reward. Its band says the rule, short ("En la 5ª compra, 30% OFF"),
  // and its slot what it gives ("Gratis", "30%").
  // A card's type never changes once customers have it. Its stamps only change with a migration that recounts
  // every stored balance from the ledger, like 0011: the reward is earned with the 7th and the 4th stamp, and
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
    {
      type: "beans-quarter",
      name: "Café en grano ¼ kg",
      stamps: 4,
      stamp: "gatito",
      color: 2,
      reward: "30% OFF en ¼ kg",
      texts: {
        goal: "el 30% OFF",
        won: "30% OFF en su próxima bolsa de ¼ kg",
        celebration: "¡Completaste la tarjeta!",
        rewardRedeemed: "30% OFF en tu bolsa de ¼ kg. Que la disfrutes.",
        band: "En la 5ª compra, 30% OFF",
        slot: "30%",
      },
    },
    {
      type: "beans-half",
      name: "Café en grano ½ kg",
      stamps: 4,
      stamp: "gatito",
      color: 3,
      reward: "30% OFF en ½ kg",
      texts: {
        goal: "el 30% OFF",
        won: "30% OFF en su próxima bolsa de ½ kg",
        celebration: "¡Completaste la tarjeta!",
        rewardRedeemed: "30% OFF en tu bolsa de ½ kg. Que la disfrutes.",
        band: "En la 5ª compra, 30% OFF",
        slot: "30%",
      },
    },
    {
      type: "beans-kilo",
      name: "Café en grano 1 kg",
      stamps: 4,
      stamp: "gatito",
      color: 4,
      reward: "30% OFF en 1 kg",
      texts: {
        goal: "el 30% OFF",
        won: "30% OFF en su próxima bolsa de 1 kg",
        celebration: "¡Completaste la tarjeta!",
        rewardRedeemed: "30% OFF en tu bolsa de 1 kg. Que la disfrutes.",
        band: "En la 5ª compra, 30% OFF",
        slot: "30%",
      },
    },
  ],
};
