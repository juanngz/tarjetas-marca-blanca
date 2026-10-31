// A card at the counter (Flujo 3): the one screen the customer shows the barista, from Ver mi código or
// from tapping the card. The card in its color with the name in big letters (so the wrong one isn't shown),
// its stamps, the QR and the short code to read out. Its movements have their own screen (…/history).
// The sello en vivo (Flujo 4): while it's open, what the register does shows up by itself.
// Without a connection (Flujo 5), the card from the copy the phone kept: the code doesn't change, only the
// stamps can be behind until the connection is back.
import { useEffect, useRef, useState } from "react";
import { data, Link, redirect, useRevalidator } from "react-router";
import type { CardChange } from "../../application/ports";
import { pageTitle, useBrand } from "../../components/brand";
import { Counter, StampRow } from "../../components/Card";
import { CustomerHeader } from "../../components/CustomerHeader";
import { BackIcon, CheckIcon } from "../../components/icons";
import { useOnline } from "../../components/OfflineNotice";
import { Qr } from "../../components/Qr";
import { shownGoal, shownStamps } from "../../core/displayCard";
import { appFor } from "../../platform/app.server";
import { keptFirst, useFresh } from "../../web/instant";
import { keepCard, keptCard } from "../../web/offlineCopy";
import type { Route } from "./+types/route";
import { LiveSheet } from "./LiveSheet";
import { useLiveCard } from "./live";

export const meta: Route.MetaFunction = ({ data: loaded, matches }) => [
  { title: pageTitle(matches, loaded?.card.name ?? "Mi código") },
];

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const app = appFor(request, context.cloudflare);
  const session = await app.readCustomerSession({ renew: false });
  if (!session) throw redirect("/");

  const outcome = await app.viewCard(session.customerId, params.type);
  if (outcome.result === "signed-out") throw redirect("/");
  if (outcome.result === "not-found") throw data("Esta tarjeta no existe.", { status: 404 });
  // Ver mis sellos y premios only shows when there's something to see (hasMovements).
  const { result: _, card, ...live } = outcome;
  return { card, ...live };
}

type CardData = Awaited<ReturnType<typeof loader>>;

/**
 * Going to it, the card as the phone kept it, at once (web/instant.ts): the code doesn't change, and what the
 * server says comes right after. Without a connection, the copy stays; nothing happens on it until the
 * connection is back.
 */
export const clientLoader = ({ request, serverLoader, params }: Route.ClientLoaderArgs) =>
  keptFirst(request, serverLoader, () => {
    const card = keptCard<CardData["card"]>(params.type);
    if (!card) return null;
    const kept: CardData = {
      card,
      version: 0,
      celebration: "",
      rewardRedeemed: "",
      hasMovements: false,
    };
    return { ...kept, kept: true as const };
  });

/**
 * What the register did, once the screen has the card as it left it: a new stamp is printed and said (the 7th
 * too: it lights the reward's slot), and stamping the reward's slot, redeeming it, is celebrated: the card is
 * complete (18/10/2026). An undo only updates the card. Anything else than a new stamp takes back "Sumaste un
 * sello": it's no longer what last happened.
 */
function useWhatHappened(type: string, version: number, stamps: number, behind: boolean) {
  const revalidator = useRevalidator();
  const [pending, setPending] = useState<CardChange | null>(null);
  const [fresh, setFresh] = useState<number | undefined>(undefined);
  const [celebrating, setCelebrating] = useState(false);
  const shownVersion = useRef(version);
  shownVersion.current = version;

  useLiveCard(type, {
    onChange: (change) => {
      if (change.version <= shownVersion.current) return;
      setPending(change);
      revalidator.revalidate();
    },
    onReconnect: () => revalidator.revalidate(),
    behind,
  });

  useEffect(() => {
    if (!pending || version < pending.version) return;
    const stamped = pending.kind === "stamp" || pending.kind === "completed";
    setFresh(stamped ? stamps - 1 : undefined);
    if (pending.kind === "redeem") setCelebrating(true);
    setPending(null);
  }, [pending, version, stamps]);

  return { fresh, celebrating, closeSheet: () => setCelebrating(false) };
}

export default function CardScreen({ loaderData }: Route.ComponentProps) {
  const brand = useBrand();
  const { waiting } = useFresh(loaderData);
  const { card, version, celebration, rewardRedeemed, hasMovements } = loaderData;
  const fromPhone = "kept" in loaderData;
  // The phone's copy, once it's clear the server can't be reached. While the server is asked, the screen
  // is as with a connection: the sello en vivo connects right away.
  const kept = fromPhone && !waiting;
  const online = useOnline();
  // While the card is complete, all its stamps are shown: the one that completed it is the last one.
  const { fresh, celebrating, closeSheet } = useWhatHappened(
    card.type,
    version,
    shownStamps(card),
    kept,
  );

  // The phone's copy of the card, as the server says it is now (web/offlineCopy.ts). Not the copy itself.
  useEffect(() => {
    if (!fromPhone) keepCard(card);
  }, [card, fromPhone]);

  return (
    <>
      <CustomerHeader signOut={false} />
      <main className="screen screen--code screen--bottom-bar">
        <div className="ticket">
          <div className={`card code-card color-${card.color}`}>
            <div className="intro intro--centered">
              <p className="eyebrow">{brand.club.name}</p>
              <h1 className="title">{card.name}</h1>
            </div>
            {/* The same counter as in the wallet. It doesn't say "premio": the reward is the next
                purchase, the customer doesn't have it yet (the register offers it when scanning). */}
            <Counter card={card} />
            {/* A new key with each version: the stamp that just arrived is printed again, even in the same slot. */}
            <StampRow key={version} card={card} fresh={fresh} />
            {/* The stamp that just arrived, in words, until the screen closes. The region is always
                there, so it's read out when it fills. */}
            <div role="status" className="stamp-news-region">
              {fresh !== undefined && (
                <p className="stamp-news">
                  <CheckIcon />
                  <span>
                    <span className="nowrap">Sumaste un sello ·</span>{" "}
                    <span className="nowrap">
                      {shownStamps(card)} de {shownGoal(card)}
                    </span>
                  </span>
                </p>
              )}
            </div>
          </div>
          <div className="ticket__stub">
            <p className="ticket__hint">Mostrale este código al barista</p>
            <Qr code={card.qrCode} name={card.name} />
            <p className="short-code">
              <span className="label">Código</span>
              <span className="short-code__text">{card.shortCode}</span>
            </p>
            <p className="note">Si no lo lee, subí el brillo o dictale el código.</p>
          </div>
        </div>
        {/* Its stamps and rewards aren't kept on the phone: without a connection, they can't open. */}
        {hasMovements && online && !kept && (
          <Link to={`/cards/${card.type}/history`} className="link">
            Ver mis sellos y premios
          </Link>
        )}
        {celebrating && (
          <LiveSheet
            card={card}
            celebration={celebration}
            rewardRedeemed={rewardRedeemed}
            onClose={closeSheet}
          />
        )}
      </main>
      {/* Fixed at the bottom, within the thumb's reach, always in view. */}
      <nav className="bottom-bar">
        <Link
          to={`/cards?front=${card.type}`}
          className="button button--secondary button--hover bottom-bar__button"
        >
          <BackIcon />
          Volver a mis tarjetas
        </Link>
      </nav>
    </>
  );
}
