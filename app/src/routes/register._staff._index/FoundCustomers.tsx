// Buscar tarjeta's results, by document or name (Flujo D of the staff flows). Each customer with when they
// signed up (never the document) and their 3 cards as slim strips in their colors, all in sight on one
// screen: the name, how far it is and its own Sumar sello, so the barista taps the one of the purchase
// without scrolling. Tapping the strip opens the whole card. A card with a reward has Canjear premio too
// (09/10/2026), which opens it so its notice pops up there.
import { type CSSProperties, useId, useState } from "react";
import { Form, Link } from "react-router";
import type { FoundCustomer } from "../../application/searchCards";
import { Alert } from "../../components/Alert";
import { Progress, rewardsText } from "../../components/Card";
import { GiftIcon, PlusIcon } from "../../components/icons";
import { useIgnoreRepeatedTaps, useSending } from "../../components/registerForms";
import { type DisplayCard, shownGoal, shownStamps } from "../../core/displayCard";

function FoundCard({
  card,
  shortCode,
  version,
  index,
}: {
  card: DisplayCard;
  shortCode: string;
  version: number;
  index: number;
}) {
  const ignoreRepeatedTaps = useIgnoreRepeatedTaps();
  const sending = useSending({ intent: "stamp", shortCode });
  const nameId = useId();
  return (
    <article
      className={`found-card color-${card.color}${card.rewards > 0 ? " found-card--reward" : ""}`}
      aria-labelledby={nameId}
      style={{ "--i": index } as CSSProperties}
    >
      <Link to={`/register/card/${shortCode}`} className="found-card__info">
        <h3 id={nameId} className="found-card__name">
          {card.name}
        </h3>
        <p className="found-card__count">
          <strong>{shownStamps(card)}</strong> de {shownGoal(card)}
          {card.rewards > 0 && (
            <span className="found-card__reward"> · {rewardsText(card.rewards)}</span>
          )}
        </p>
        <Progress card={card} />
      </Link>
      <div className="found-card__actions">
        {/* At 7 de 8 the next purchase is the reward's slot (18/10/2026): only Canjear premio, which opens the
            card, where she can also keep it for later. Nobody keeps it by mistake. */}
        {!card.complete && (
          <Form method="post" onSubmit={ignoreRepeatedTaps} className="found-card__form">
            <input type="hidden" name="intent" value="stamp" />
            <input type="hidden" name="shortCode" value={shortCode} />
            <input type="hidden" name="version" value={version} />
            <button type="submit" className="found-card__action" aria-busy={sending || undefined}>
              <PlusIcon />
              {sending ? "Sumando…" : "Sumar sello"}
            </button>
          </Form>
        )}
        {card.rewards > 0 && (
          <Link
            to={`/register/card/${shortCode}`}
            className="found-card__action found-card__action--reward"
          >
            <GiftIcon />
            Canjear premio
          </Link>
        )}
      </div>
    </article>
  );
}

export function FoundCustomers({
  customers,
  more,
  collapsible,
}: {
  customers: FoundCustomer[];
  more: boolean;
  /** With JavaScript and more than one customer: each one opens with a tap. */
  collapsible: boolean;
}) {
  // Two customers can have the same name, never the same card.
  const keyOf = (customer: FoundCustomer) => customer.cards[0]?.shortCode ?? customer.name;
  const [open, setOpen] = useState<string | null>(null);
  const closing = collapsible && customers.length > 1;
  return (
    <div className="found">
      {customers.length > 1 && (
        <p className="found__count">Encontramos {customers.length} clientes. Tocá el que es.</p>
      )}
      {customers.map((customer) => {
        const key = keyOf(customer);
        const shown = !closing || open === key;
        return (
          <Customer
            key={key}
            customer={customer}
            shown={shown}
            onToggle={closing ? () => setOpen(shown ? null : key) : undefined}
          />
        );
      })}
      {more && (
        <Alert tone="info">Hay más clientes con ese nombre. Escribí también el apellido.</Alert>
      )}
    </div>
  );
}

/**
 * A customer and their cards. A name can find several: then each one is a line that opens their cards,
 * one at a time, so the screen isn't filled with all their cards (08/10/2026). Without JavaScript they're
 * all open.
 */
function Customer({
  customer,
  shown,
  onToggle,
}: {
  customer: FoundCustomer;
  shown: boolean;
  onToggle?: () => void;
}) {
  const cardsId = useId();
  const who = (
    <>
      <span className="avatar avatar--big" aria-hidden="true">
        {customer.name.trim().charAt(0).toUpperCase()}
      </span>
      <span className="intro">
        <span className="register-name">{customer.name}</span>
        <span className="secondary">{customer.signedUp}</span>
      </span>
    </>
  );
  return (
    <article
      className={`found__customer${onToggle ? " found__customer--closing" : ""}`}
      // An article, not a region: two customers can share a name, and even the day they signed up.
      aria-label={customer.name}
    >
      <h2 className="found__head">
        {onToggle ? (
          // The whole line is tapped: the name, when they signed up, and an arrow that says it opens.
          <button
            type="button"
            className="customer-head found__toggle"
            aria-expanded={shown}
            aria-controls={cardsId}
            onClick={onToggle}
          >
            {who}
            <svg
              className="found__arrow"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        ) : (
          <span className="customer-head">{who}</span>
        )}
      </h2>
      {shown && (
        <div id={cardsId} className="found__cards">
          {customer.cards.map(({ card, shortCode, version }, index) => (
            <FoundCard
              key={shortCode}
              card={card}
              shortCode={shortCode}
              version={version}
              index={index}
            />
          ))}
        </div>
      )}
    </article>
  );
}
