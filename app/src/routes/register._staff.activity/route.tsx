// Movimientos (10/10/2026): the register's history, only for the manager. Every stamp, redeem and undo of
// everybody at the register, baristas and managers, the newest first: what, on which card, whose, when and
// who. On top, whose to see: everybody's or one person's, as links (each has its own address and works
// without JavaScript). Ver anteriores brings the older ones below the ones already seen.
// Picking one person with everybody's on screen shows theirs right away, from the lines already there, while
// the server brings their complete list (slow from Buenos Aires, 11/10/2026).
import { Link, redirect, useLocation, useNavigation } from "react-router";
import { RECEIPT_TITLES } from "../../components/ReceiptBody";
import { RegisterBar } from "../../components/RegisterBar";
import { keepTogether } from "../../components/text";
import { appFor } from "../../platform/app.server";
import type { Route } from "./+types/route";

export const meta: Route.MetaFunction = () => [{ title: "Movimientos · Caja" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  const register = await appFor(request, context.cloudflare).register({
    renew: false,
  });
  if (!register) throw redirect("/register/sign-in");
  const params = new URL(request.url).searchParams;
  const view = await register.activity({
    memberId: params.get("member") ?? undefined,
    pages: Number(params.get("pages") ?? 1),
  });
  if (view.result === "forbidden") throw redirect("/register");
  return { ...view, you: register.member.id };
}

/** Where a link goes, keeping whose is shown and how many pages. */
function address(memberId: string | null, pages = 1) {
  const params = new URLSearchParams();
  if (memberId) params.set("member", memberId);
  if (pages > 1) params.set("pages", String(pages));
  const query = params.toString();
  return query ? `?${query}` : ".";
}

export default function Activity({ loaderData }: Route.ComponentProps) {
  const { people, memberId, pages, you } = loaderData;
  const preview = usePickedNow(memberId);
  const lines = preview
    ? loaderData.lines.filter((line) => line.byId === preview)
    : loaderData.lines;
  // While it's on its way: no Ver anteriores, and no "todavía no tiene" (older ones may come).
  const more = !preview && loaderData.more;
  const whose = preview ?? memberId;
  const shown = people.find((person) => person.id === whose);

  return (
    <>
      <RegisterBar back="/register" />
      <main className="screen screen--register">
        <div className="intro">
          <h1 className="title">Movimientos</h1>
          <p>
            {shown
              ? `Lo que hizo ${shown.name} en la caja.`
              : "Lo que hizo todo el equipo en la caja."}
          </p>
        </div>

        <nav className="who-filter" aria-label="De quién ver los movimientos">
          <Link
            to={address(null)}
            replace
            className="who-filter__chip"
            aria-current={whose ? undefined : "page"}
          >
            Todos
          </Link>
          {people.map((person) => (
            <Link
              key={person.id}
              to={address(person.id)}
              replace
              className={`who-filter__chip who-filter__chip--${person.role}`}
              aria-current={person.id === whose ? "page" : undefined}
            >
              {person.id === you ? `${person.name} (vos)` : person.name}
            </Link>
          ))}
        </nav>

        {lines.length === 0 && preview ? null : lines.length === 0 ? (
          <p className="note">
            {shown ? `${shown.name} todavía no tiene movimientos.` : "Todavía no hay movimientos."}
          </p>
        ) : (
          <ol className="activity">
            {lines.map((line) => (
              <li
                key={line.id}
                className={`activity__item activity__item--${line.kind}${line.undone ? " activity__item--undone" : ""}`}
              >
                <span className="activity__what">
                  <span className="activity__title">{RECEIPT_TITLES[line.kind]}</span>
                  {line.undone && <span className="state-chip state-chip--off">Deshecho</span>}
                </span>
                <span className="activity__card">
                  {line.customerName ?? "Cliente borrado"} · {keepTogether(line.cardName)}
                </span>
                <span className="activity__when">
                  {line.when} · por {line.byName}
                </span>
              </li>
            ))}
          </ol>
        )}

        {more && (
          <Link
            to={address(memberId, pages + 1)}
            replace
            preventScrollReset
            className="button button--secondary"
          >
            Ver anteriores
          </Link>
        )}
      </main>
    </>
  );
}

/**
 * The person just picked, while their movements are on their way, if everybody's is on screen: theirs can
 * be shown right away from it. Otherwise (going back to Todos, from one person to another, Ver anteriores),
 * null: the screen waits for the server.
 */
function usePickedNow(memberId: string | null): string | null {
  const here = useLocation();
  const going = useNavigation().location;
  if (memberId || !going || going.pathname !== here.pathname) return null;
  const next = new URLSearchParams(going.search);
  return next.has("pages") ? null : next.get("member");
}
