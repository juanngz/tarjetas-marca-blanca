// Layout of the customer screens: requires the session only once, so a new screen can't
// forget to ask for it. It also renews it when used (the other screens read it without renewing): when the
// app opens, and each time a screen asks the server again (a screen shown from the phone's copy does it
// right away, web/instant.ts).
// Without a connection, every screen says so at the top (Flujo 5), the phone shows what it kept, and when
// the connection is back the screen asks again: "Tus sellos se actualizan cuando vuelva".
import { useEffect } from "react";
import { data, Outlet, redirect, useRevalidator } from "react-router";
import { CUSTOMER_OFFLINE_MESSAGE, OfflineNotice } from "../../components/OfflineNotice";
import { appFor } from "../../platform/app.server";
import { revalidateOnlyWhenAsked, useShownScreen } from "../../web/instant";
import { orWhatIsKept } from "../../web/offline";
import { keptWallet } from "../../web/offlineCopy";
import type { Route } from "./+types/route";

export async function loader({ request, context }: Route.LoaderArgs) {
  // Only checks the cookie's signature: doesn't query the database. If the customer was deleted, each screen stops them.
  const session = await appFor(request, context.cloudflare).readCustomerSession();
  if (!session) throw redirect("/");
  // React Router adds this Set-Cookie to the response of any screen inside.
  return session.cookie ? data(null, { headers: { "Set-Cookie": session.cookie } }) : null;
}

/** Without a connection, the session can't be asked: the customer is let in if the phone kept their cards. */
export const clientLoader = ({ serverLoader }: Route.ClientLoaderArgs) =>
  orWhatIsKept(serverLoader, () => (keptWallet() ? { kept: true } : null));

/** Going from one screen to another doesn't wait for it: only the screen is asked (web/instant.ts). */
export const shouldRevalidate = revalidateOnlyWhenAsked;

export default function Customer() {
  useShownScreen();
  const { revalidate } = useRevalidator();
  useEffect(() => {
    const again = () => void revalidate();
    window.addEventListener("online", again);
    return () => window.removeEventListener("online", again);
  }, [revalidate]);

  return (
    <>
      <OfflineNotice message={CUSTOMER_OFFLINE_MESSAGE} tone="info" />
      <Outlet />
    </>
  );
}
