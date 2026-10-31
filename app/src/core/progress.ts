// How many stamps the customer is missing for the reward, for the register (Flujo B of the staff flows).
// Each card says what its reward is for in its config ("el café gratis", "el 30% OFF").

export function leftForReward(card: { stamps: number; stampsPerRound: number; goal: string }) {
  const left = card.stampsPerRound - card.stamps;
  return left === 1 ? `Le falta 1 para ${card.goal}.` : `Le faltan ${left} para ${card.goal}.`;
}
