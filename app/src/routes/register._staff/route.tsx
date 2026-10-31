// Layout of the register screens: requires the staff session when the register opens, so a new screen can't
// forget to ask for it, and renews it when used. It also says who's at the register, for the bar at the top.
// It isn't asked again on each screen (shouldRevalidate): each screen's loader and each action asks
// appFor(...).register() for the register itself.
import { useEffect } from "react";
import {
  data,
  isRouteErrorResponse,
  Link,
  Outlet,
  redirect,
  type ShouldRevalidateFunction,
  useFetchers,
  useNavigation,
} from "react-router";
import { useBrandIfLoaded } from "../../components/brand";
import { OfflineNotice } from "../../components/OfflineNotice";
import type { AtTheRegister } from "../../components/RegisterBar";
import { appFor } from "../../platform/app.server";
import { registerBarAgain } from "../../web/offline";
import type { Route } from "./+types/route";

export async function loader({ request, context }: Route.LoaderArgs) {
  const register = await appFor(request, context.cloudflare).register();
  if (!register) throw redirect("/register/sign-in");
  const { name, role } = register.member;
  const member = { name, role };
  // React Router adds this Set-Cookie to the response of any screen inside.
  return register.cookie
    ? data({ member }, { headers: { "Set-Cookie": register.cookie } })
    : { member };
}

/** When the bar came from the server, in this browser (registerBarAgain). */
let loadedAt = Date.now();

/** Asked once: not after each tap nor on each screen, only after Equipo or an hour (web/offline.ts). */
export const shouldRevalidate: ShouldRevalidateFunction = (args) =>
  registerBarAgain(args, { loadedAt, now: Date.now() });

export default function Staff({ loaderData }: Route.ComponentProps) {
  // Each time the bar comes from the server: loaderData isn't used inside, it says when.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above.
  useEffect(() => {
    loadedAt = Date.now();
  }, [loaderData]);
  // Something on its way to the server: a screen, a form or Deshacer in the sheet. The database is in the EU,
  // so it can take a moment; the bar says it's coming (only after a moment, so a quick answer doesn't flash).
  const navigation = useNavigation();
  const fetchers = useFetchers();
  const waiting =
    navigation.state !== "idle" || fetchers.some((fetcher) => fetcher.state !== "idle");
  // The screens inside read it with useOutletContext: a route never imports another one.
  return (
    <>
      {waiting && <div className="register-loading" role="progressbar" aria-label="Cargando" />}
      <OfflineNotice />
      <Outlet context={{ member: loaderData.member } satisfies AtTheRegister} />
    </>
  );
}

/** The error page's title, with the Club's name when the root's data is there. */
function ErrorTitle() {
  const brand = useBrandIfLoaded();
  return <title>{brand ? `Caja · ${brand.club.name}` : "Caja"}</title>;
}

/** A card or a movement that isn't there, or something that went wrong: always a way back to the register. */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  // Each screen says what it didn't find: "No encontramos esa tarjeta.", "No encontramos ese movimiento."
  const title = notFound && typeof error.data === "string" ? error.data : "Algo salió mal.";
  return (
    <main className="screen">
      <ErrorTitle />
      <div className="intro">
        <h1 className="title">{title}</h1>
        <p>
          {notFound ? "Revisá el código y probá de nuevo." : "Volvé a la caja y probá de nuevo."}
        </p>
      </div>
      <Link to="/register" className="button button--register">
        Volver a la caja
      </Link>
    </main>
  );
}
