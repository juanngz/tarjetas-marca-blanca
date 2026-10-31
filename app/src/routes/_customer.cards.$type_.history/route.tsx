// A card's stamps and rewards (Flujo 3), from Ver mis sellos y premios: its own screen, so the screen the
// barista sees stays only the card and its code. The newest first, up to 20, without scroll inside the screen.
// What the register undid isn't there, nor who did it (core/history.ts). It updates by itself, like the card.
import { data, Link, redirect, useRevalidator } from "react-router";
import { pageTitle } from "../../components/brand";
import { drawing } from "../../components/Card";
import { CustomerHeader } from "../../components/CustomerHeader";
import { BackIcon } from "../../components/icons";
import { shownGoal, shownStamps } from "../../core/displayCard";
import { appFor } from "../../platform/app.server";
import { movementDate } from "../../web/movementDate";
import { useLiveCard } from "../_customer.cards.$type/live";
import type { Route } from "./+types/route";

export const meta: Route.MetaFunction = ({ data: loaded, matches }) => [
  { title: pageTitle(matches, `Tus sellos y premios · ${loaded?.card.name ?? "Tu tarjeta"}`) },
];

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const app = appFor(request, context.cloudflare);
  const session = await app.readCustomerSession({ renew: false });
  if (!session) throw redirect("/");

  const outcome = await app.viewCard(session.customerId, params.type, { withHistory: true });
  if (outcome.result === "signed-out") throw redirect("/");
  if (outcome.result === "not-found") throw data("Esta tarjeta no existe.", { status: 404 });
  // "Hoy" and "Ayer" are said from the server's now: the same on the server and on the phone.
  return { card: outcome.card, history: outcome.history ?? [], now: new Date() };
}

const MOVEMENT_TEXT = { stamp: "Sumaste un sello", redeem: "Canjeaste un premio" } as const;

export default function HistoryScreen({ loaderData }: Route.ComponentProps) {
  const { card, history, now } = loaderData;
  const revalidator = useRevalidator();
  useLiveCard(card.type, {
    onChange: () => revalidator.revalidate(),
    onReconnect: () => revalidator.revalidate(),
  });

  return (
    <>
      <CustomerHeader signOut={false} />
      <main className="screen screen--bottom-bar">
        <section className="movements" aria-labelledby="movements-title">
          <h1 id="movements-title" className="title title--xl">
            Tus sellos y premios
          </h1>
          <div className={`card-chip color-${card.color}`}>
            <img src={drawing(card, "stamped")} alt="" width={28} height={42} />
            <span className="card-chip__text">
              <span className="card-chip__name">{card.name}</span>
              <span className="card-chip__count">
                {shownStamps(card)} de {shownGoal(card)} sellos
              </span>
            </span>
          </div>
          {history.length === 0 ? (
            <div className="empty-state">
              <span className={`rule__tile color-${card.color}`} aria-hidden="true">
                <img src={drawing(card, "empty")} alt="" width={24} height={36} />
              </span>
              <p>
                Todavía no sumaste sellos en esta tarjeta. Mostrale el código de tu tarjeta al
                barista cuando compres.
              </p>
            </div>
          ) : (
            <ol className="movements__list">
              {history.map((item) => (
                <li key={item.id} className={`movement movement--${item.type}`}>
                  <span className={`movement__icon color-${card.color}`} aria-hidden="true">
                    <img
                      src={drawing(card, item.type === "stamp" ? "stamped" : "reward")}
                      alt=""
                      width={20}
                      height={30}
                    />
                  </span>
                  <span className="movement__text">
                    <span className="movement__what">{MOVEMENT_TEXT[item.type]}</span>
                    <span className="movement__when">{movementDate(item.at, now)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
      {/* Fixed at the bottom, within the thumb's reach, like on the card's screen. */}
      <nav className="bottom-bar">
        <Link
          to={`/cards/${card.type}`}
          className="button button--secondary button--hover bottom-bar__button"
        >
          <BackIcon />
          Volver a la tarjeta
        </Link>
      </nav>
    </>
  );
}
