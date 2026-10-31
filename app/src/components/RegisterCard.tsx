// The card at the register, the same as the customer sees it in her wallet (Flujo B): its color, its name,
// the stamps and the rewards, with the register's buttons inside.
import { type ReactNode, useId } from "react";
import type { DisplayCard } from "../core/displayCard";
import { CardMark, Counter, RewardPill, StampGrid } from "./Card";
import { keepTogether } from "./text";

export function RegisterCard({
  card,
  children,
  headingLevel = 2,
}: {
  card: DisplayCard;
  children?: ReactNode;
  /** 3 when it's under its customer's name, in Buscar tarjeta's results. */
  headingLevel?: 2 | 3;
}) {
  // Its own id: Buscar tarjeta shows several cards on the same screen.
  const nameId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className={`card color-${card.color}`} aria-labelledby={nameId}>
      <div className="card__head">
        <Heading id={nameId} className="card__name">
          {keepTogether(card.name)}
        </Heading>
        <CardMark />
      </div>
      <div className="card__body">
        <Counter card={card} />
        <StampGrid card={card} />
        <RewardPill rewards={card.rewards} />
        {children && <div className="card__actions">{children}</div>}
      </div>
    </section>
  );
}
