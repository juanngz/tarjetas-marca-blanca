// Sign out (Flujo 5): ends the session on this phone. Doesn't delete the account. From the wallet, Salir
// opens the same question as a sheet (CustomerHeader); this screen is where the form posts, and the
// question on its own page without JavaScript.
import { Link, redirect } from "react-router";
import { pageTitle } from "../../components/brand";
import { CustomerHeader, SignOutQuestion } from "../../components/CustomerHeader";
import { appFor } from "../../platform/app.server";
import type { Route } from "./+types/route";

export const meta: Route.MetaFunction = ({ matches }) => [{ title: pageTitle(matches, "Salir") }];

export async function action({ request, context }: Route.ActionArgs) {
  const cookie = appFor(request, context.cloudflare).endCustomerSession();
  return redirect("/", { headers: { "Set-Cookie": cookie } });
}

export default function SignOut() {
  return (
    <>
      <CustomerHeader signOut={false} />
      <main className="screen">
        <SignOutQuestion headingId="sign-out-title" headingLevel={1}>
          <Link to="/cards" className="button button--secondary">
            Seguir en mis tarjetas
          </Link>
        </SignOutQuestion>
      </main>
    </>
  );
}
