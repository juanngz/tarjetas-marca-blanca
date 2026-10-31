// Agregar barista: email and name; the app makes up the PIN and shows it once (decided on 08/10/2026).
// The PIN arrives as the action's answer, never in the address, and isn't shown again.
import { data, Form, redirect } from "react-router";
import { Alert } from "../../components/Alert";
import { RegisterBar } from "../../components/RegisterBar";
import { ShownPin } from "../../components/ShownPin";
import { appFor } from "../../platform/app.server";
import { formOf, formText } from "../../web/form";
import type { Route } from "./+types/route";

export const meta: Route.MetaFunction = () => [{ title: "Agregar barista · Caja" }];

export async function action({ request, context }: Route.ActionArgs) {
  const register = await appFor(request, context.cloudflare).register({
    renew: false,
  });
  if (!register) throw redirect("/register/sign-in");
  const form = await formOf(request);
  const typed = { email: formText(form, "email") ?? "", name: formText(form, "name") ?? "" };
  const outcome = await register.team.addBarista(typed);
  if (outcome.result === "forbidden")
    throw data("Solo el gerente agrega baristas.", { status: 403 });
  if (outcome.result === "error") {
    return data(
      { kind: "mistake" as const, error: outcome.message, field: outcome.field, ...typed },
      { status: 400 },
    );
  }
  const { name, email } = outcome.member;
  return { kind: "added" as const, name, email, pin: outcome.pin };
}

export default function AddBarista({ actionData }: Route.ComponentProps) {
  if (actionData?.kind === "added") {
    const { name, email, pin } = actionData;
    return <ShownPin title={`Listo: ${name} ya puede entrar`} email={email} pin={pin} />;
  }
  const failed = actionData?.kind === "mistake" ? actionData : undefined;
  const invalid = (field: "email" | "name") => (failed?.field === field ? true : undefined);
  return (
    <>
      <RegisterBar back="/register/team" />
      <main className="screen screen--register">
        <div className="intro">
          <h1 className="title">Agregar barista</h1>
          <p>Con su email y su nombre.</p>
        </div>
        {/* The server checks everything: no browser bubbles, which don't speak in the café's voice. */}
        <Form method="post" className="form" noValidate>
          <label htmlFor="email" className="field-label">
            Su email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="field"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={failed?.email}
            aria-invalid={invalid("email")}
            aria-describedby={failed?.field === "email" ? "add-error" : undefined}
          />
          {/* The error next to what it's about: the email here, the name (or anything else) below. */}
          {failed?.field === "email" && <Alert id="add-error">{failed.error}</Alert>}
          <label htmlFor="name" className="field-label">
            Su nombre, como se va a ver en la caja
          </label>
          <input
            id="name"
            name="name"
            className="field"
            autoComplete="off"
            autoCapitalize="words"
            defaultValue={failed?.name}
            aria-invalid={invalid("name")}
            aria-describedby={failed?.field === "name" ? "add-error" : undefined}
          />
          {failed && failed.field !== "email" && <Alert id="add-error">{failed.error}</Alert>}
          <button type="submit" className="button">
            Agregar barista
          </button>
        </Form>
      </main>
    </>
  );
}
