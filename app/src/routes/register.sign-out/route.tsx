// Salir of the register (Flujo A): ends the staff session on this phone so the next person signs in.
// Without confirmation, to change people quickly (decided on 07/10/2026). Only the form uses it.
import { redirect } from "react-router";
import { appFor } from "../../platform/app.server";
import type { Route } from "./+types/route";

export function loader() {
  return redirect("/register");
}

export async function action({ request, context }: Route.ActionArgs) {
  const cookie = appFor(request, context.cloudflare).endStaffSession();
  return redirect("/register/sign-in", { headers: { "Set-Cookie": cookie } });
}
