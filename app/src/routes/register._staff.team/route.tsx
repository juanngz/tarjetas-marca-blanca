// Layout of Equipo: only the manager gets in (core/access.ts). A barista who opens the address goes back
// to the register. It's a comfort: the use cases check it again, also on a POST with the button hidden.
import { Outlet, redirect, useOutletContext } from "react-router";
import type { AtTheRegister } from "../../components/RegisterBar";
import { appFor } from "../../platform/app.server";
import type { Route } from "./+types/route";

export async function loader({ request, context }: Route.LoaderArgs) {
  const register = await appFor(request, context.cloudflare).register({
    renew: false,
  });
  if (!register) throw redirect("/register/sign-in");
  if (register.member.role !== "manager") throw redirect("/register");
  return null;
}

export default function Team() {
  // Who's at the register, from the register's layout, for the screens inside.
  return <Outlet context={useOutletContext<AtTheRegister>()} />;
}
