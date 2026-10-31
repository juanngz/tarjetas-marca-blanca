// The Club card and its parts. Its colors come from the theme (styles/cards.css) and its drawings from
// public/stamps/ (marca/README.md).
import { type CSSProperties, Fragment, type MouseEvent } from "react";
import { Link } from "react-router";
import {
  bandText,
  type DisplayCard,
  rewardReady,
  rewardSlotReady,
  shownGoal,
  shownStamps,
} from "../core/displayCard";
import { QrIcon } from "./icons";
import { keepTogether, rewardsLabel } from "./text";

/** "reward": the reward's drawing, off. "ready": lit, with a reward to redeem; also the festejo's drawing. */
type StampState = "empty" | "stamped" | "reward" | "ready";

/** The card's stamp drawing in that state: seal-empty.svg, seal-stamped.svg… */
export function drawing(card: Pick<DisplayCard, "stamp">, state: StampState): string {
  return `/stamps/${card.stamp}-${state}.svg`;
}

export function rewardsText(rewards: number): string {
  return rewards === 1 ? "1 premio para canjear" : `${rewards} premios para canjear`;
}

export function Counter({ card }: { card: DisplayCard }) {
  return (
    <p className="counter">
      <span className="counter__number">
        {shownStamps(card)} <span className="counter__of">de</span> {shownGoal(card)}
      </span>{" "}
      <span className="label">sellos</span>
    </p>
  );
}

function Stamp({ card, stamped, number }: { card: DisplayCard; stamped: boolean; number: number }) {
  return (
    <div className="stamp">
      <img src={drawing(card, stamped ? "stamped" : "empty")} alt="" width={52} height={78} />
      {/* Under the missing ones, their number: what matters is how many are left. */}
      <span className="stamp__number">{stamped ? "" : number}</span>
    </div>
  );
}

/**
 * The reward's slot, the last one, like on the paper card (18/10/2026): "Gratis", "30%". Off (dashed) until the
 * stamp before it; then lit, it's the next purchase. Stamping it is redeeming the reward.
 */
function RewardSlot({ card }: { card: DisplayCard }) {
  const ready = rewardSlotReady(card);
  return (
    <div className={ready ? "stamp stamp--reward stamp--ready" : "stamp stamp--reward"}>
      <img src={drawing(card, ready ? "ready" : "reward")} alt="" width={52} height={78} />
      <span className="stamp__number stamp__reward">{card.slot}</span>
    </div>
  );
}

/** Every slot, the reward's too: 8 or 5. */
const slots = (card: DisplayCard) => shownGoal(card);

/** How many columns the slots take: a single row up to 5 (coffee beans), rows of 4 if more (take-away). */
const columns = (card: DisplayCard) => (slots(card) <= 5 ? slots(card) : 4);

/**
 * The slots, like on the paper card: the stamps, 7 or 4, and the reward's (RewardSlot); under them, the band
 * (RewardTile). The counter already says it in words: the slots are only to look at.
 */
export function StampGrid({ card }: { card: DisplayCard }) {
  return (
    <div className="grid">
      <div
        className="grid__stamps"
        style={{ "--columns": columns(card), "--count": slots(card) } as CSSProperties}
        aria-hidden="true"
      >
        {Array.from({ length: card.stampsPerRound }, (_, i) => (
          <Stamp
            // biome-ignore lint/suspicious/noArrayIndexKey: the slots are fixed and don't change place.
            key={i}
            card={card}
            stamped={i < shownStamps(card)}
            number={i + 1}
          />
        ))}
        <RewardSlot card={card} />
      </div>
      <RewardTile card={card} />
    </div>
  );
}

/**
 * The band under the slots, in one piece: the reward's drawing and the card's rule, short ("El 8º café,
 * gratis", 19/10/2026). Off, until there's one to redeem; then lit,
 * with an aura, until it's redeemed (10/10/2026).
 */
export function RewardTile({ card }: { card: DisplayCard }) {
  const ready = rewardReady(card);
  return (
    <p className={ready ? "reward-tile reward-tile--on" : "reward-tile"}>
      <img
        className="reward-tile__icon"
        src={drawing(card, ready ? "ready" : "reward")}
        alt=""
        width={40}
        height={60}
      />
      <span>
        {ready && <span className="visually-hidden">Premio para canjear: </span>}
        {keepTogether(bandText(card))}
      </span>
    </p>
  );
}

/**
 * All the slots in a row, the reward's last, for the card's screen at the counter. `fresh`: the stamp that just arrived (the sello
 * en vivo), which is "printed" as it appears (movimiento.md).
 */
export function StampRow({ card, fresh }: { card: DisplayCard; fresh?: number }) {
  return (
    <div
      className="stamp-row"
      style={{ "--count": slots(card) } as CSSProperties}
      aria-hidden="true"
    >
      {Array.from({ length: card.stampsPerRound }, (_, i) => (
        <img
          // biome-ignore lint/suspicious/noArrayIndexKey: the slots are fixed and don't change place.
          key={i}
          src={drawing(card, i < shownStamps(card) ? "stamped" : "empty")}
          className={i === fresh ? "stamp-row__fresh" : undefined}
          alt=""
          width={32}
          height={48}
        />
      ))}
      {/* The reward's slot, last: lit while it's the next purchase. */}
      <img
        src={drawing(card, rewardSlotReady(card) ? "ready" : "reward")}
        alt=""
        width={32}
        height={48}
      />
    </div>
  );
}

/** One segment per stamp, the last one (the one that earns the reward) in the reward's color. Only to look at. */
export function Progress({ card }: { card: DisplayCard }) {
  const goal = shownGoal(card);
  const on = shownStamps(card);
  return (
    <div className="progress" style={{ "--goal": goal } as CSSProperties} aria-hidden="true">
      {Array.from({ length: goal }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: the segments are fixed and don't change place.
          key={i}
          className={i < on ? "is-on" : undefined}
        />
      ))}
    </div>
  );
}

/** The café's wordmark engraved in the card's corner, like on a printed one. */
export function CardMark() {
  return (
    <img
      className="card__mark"
      src="/brand/wordmark-light.svg"
      alt=""
      aria-hidden="true"
      width={84}
      height={19}
    />
  );
}

/**
 * In the card's corner, instead of the wordmark, how many rewards it has: the reward's drawing, lit, and the number,
 * with the same aura as the reward under the stamps. It's seen in front and behind, on the tab, and it's narrow
 * so the name keeps its line. Without rewards, the mark.
 */
function CardCorner({ card }: { card: DisplayCard }) {
  if (card.rewards < 1) return <CardMark />;
  const [number, word] = rewardsLabel(card.rewards).split(" ");
  return (
    <p className="card__rewards">
      <img src={drawing(card, "ready")} alt="" width={16} height={24} />
      {number}
      <span className="visually-hidden"> {word}</span>
    </p>
  );
}

export function RewardPill({ rewards }: { rewards: number }) {
  if (rewards < 1) return null;
  return <p className="pill">{rewardsText(rewards)}</p>;
}

/** The name, word by word, so that when it doesn't fit it breaks between words. */
function CardName({ name }: { name: string }) {
  // The space goes outside each word: inside, it couldn't break there.
  return name.split(" ").map((word, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: the words of a name don't change place.
    <Fragment key={i}>
      {i > 0 && " "}
      <span className="card__name-word">{word}</span>
    </Fragment>
  ));
}

/**
 * A card in the wallet. In front it's seen complete; behind, only the top peeks out (the name and its
 * stamps, small) and tapping it brings it to the front. It's always the same card in another place: that's why,
 * when the front one changes, each one slides to its new place (cards.css).
 */
export function WalletCard({
  card,
  place,
  inFront,
  onBringToFront,
}: {
  card: DisplayCard;
  /** 0 is the one furthest back. */
  place: number;
  inFront: boolean;
  onBringToFront: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const id = `card-${card.type}`;
  return (
    <section
      className={`wallet__card ${inFront ? "wallet__card--front" : "wallet__card--back"}`}
      style={{ "--place": place } as CSSProperties}
      aria-labelledby={inFront ? id : undefined}
      // To move focus to it when it comes to the front with the keyboard or a screen reader.
      tabIndex={inFront ? -1 : undefined}
    >
      {/* Behind, what's inside can't be tapped and the screen reader doesn't read it: the tab says it. */}
      <div
        className={`card color-${card.color}`}
        inert={!inFront}
        // In case the browser doesn't know inert (iPhone with iOS before 15.5).
        aria-hidden={inFront ? undefined : true}
      >
        {/* In front, the whole card can be tapped: it opens the same screen as Ver mi código, the only one to
            show at the counter. Only for the finger: the keyboard and the screen reader have Ver mi código. */}
        {inFront && (
          <Link
            to={`/cards/${card.type}`}
            className="card__open"
            tabIndex={-1}
            aria-hidden="true"
          />
        )}
        <div className="card__head">
          <h2 id={id} className="card__name">
            <CardName name={keepTogether(card.name)} />
          </h2>
          <CardCorner card={card} />
          <p className="card__summary" aria-hidden="true">
            {shownStamps(card)} <span className="counter__of">de</span> {shownGoal(card)}
          </p>
        </div>
        <div className="card__body">
          <Counter card={card} />
          <Progress card={card} />
          <StampGrid card={card} />
          <Link to={`/cards/${card.type}`} className="button button--on-card">
            <QrIcon />
            Ver mi código
          </Link>
        </div>
      </div>
      {!inFront && (
        <Link
          to={`/cards?front=${card.type}`}
          replace
          preventScrollReset
          onClick={onBringToFront}
          className="card__tab"
          aria-label={`${card.name}: ${shownStamps(card)} de ${shownGoal(card)} sellos${card.rewards > 0 ? `, ${rewardsText(card.rewards)}` : ""}. Pasarla adelante.`}
        />
      )}
    </section>
  );
}
