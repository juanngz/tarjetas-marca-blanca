// Sign-up (Flujo 1): name and consent. Arrives from the document confirmation.
// It has no loader: the document travels in the form, never in the URL.
import { data, Form, Link, redirect } from "react-router";
import { Alert } from "../../components/Alert";
import { pageTitle } from "../../components/brand";
import { ArrowIcon, BackIcon, LockIcon } from "../../components/icons";
import { MoreInfo } from "../../components/MoreInfo";
import { Turnstile } from "../../components/Turnstile";
import { appFor } from "../../platform/app.server";
import { formOf, formText } from "../../web/form";
import type { Route } from "./+types/route";

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: pageTitle(matches, "Anotarme") },
];

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.cloudflare;
  const form = await formOf(request);
  const text = (name: string) => formText(form, name);
  const app = appFor(request, context.cloudflare);
  const outcome = await app.signUp({
    step: text("step"),
    type: text("type"),
    number: text("number") ?? "",
    name: text("name") ?? "",
    consent: text("consent"),
    turnstileToken: text("cf-turnstile-response"),
  });
  if (outcome.result === "start-over") return redirect("/");
  // Just signed up or already signed up before (for example, if they tapped twice): goes to their cards.
  if (outcome.result === "signed-up" || outcome.result === "already-signed-up") {
    return redirect("/cards", { headers: { "Set-Cookie": outcome.cookie } });
  }
  const { error } = outcome;
  const field =
    error?.reason === "invalid-name" ? "name" : error?.reason === "no-consent" ? "consent" : null;
  const status = !error ? 200 : error.reason === "too-many-attempts" ? 429 : 400;
  return data(
    {
      step: "name" as const,
      type: outcome.type,
      number: outcome.number,
      name: outcome.name,
      error: error?.message ?? null,
      /** The field to point out; null if the error isn't about a field. */
      field,
      siteKey: env.TURNSTILE_SITE_KEY,
      controller: app.cafe.controller,
      club: app.cafe.club,
    },
    { status },
  );
}

export default function SignUp({ actionData }: Route.ComponentProps) {
  // If someone opens /sign-up directly, without going through the welcome screen.
  if (!actionData) {
    return (
      <main className="screen">
        <h1 className="title">Empezá por tu documento</h1>
        <p>Para anotarte en el Club, primero poné tu número de documento.</p>
        <Link to="/" className="button">
          Poner mi documento
        </Link>
      </main>
    );
  }

  const { type, number, name, error, field, siteKey, controller, club } = actionData;
  // The error goes next to what it's about, so it's read where the fix is: the name, the consent, or
  // (if it's about neither) before Anotarme.
  const errorHere = (where: typeof field) =>
    error && field === where ? <Alert id="sign-up-error">{error}</Alert> : null;
  return (
    <>
      <nav className="top-bar">
        <Link to="/" className="back">
          <BackIcon />
          Volver
        </Link>
      </nav>
      <main className="screen screen--with-back">
        <div className="intro">
          <p className="steps">
            <span className="steps__bars" aria-hidden="true">
              <span />
              <span />
            </span>
            Paso 2 de 2
          </p>
          <h1 className="title title--xl">¿Cómo te llamás?</h1>
          <p className="lede">Así te saludamos cuando venís.</p>
        </div>

        <Form method="post" className="form panel">
          <input type="hidden" name="step" value="sign-up" />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="number" value={number} />
          <label htmlFor="name" className="field-label">
            Tu nombre
          </label>
          <input
            id="name"
            name="name"
            className="field"
            autoComplete="name"
            autoCapitalize="words"
            defaultValue={name}
            aria-invalid={field === "name" ? true : undefined}
            aria-describedby={field === "name" ? "sign-up-error" : undefined}
          />
          {errorHere("name")}

          <div className="consent">
            <p className="consent__lock">
              <LockIcon />
              <span>
                Guardamos tu nombre y tu documento solo para el Club. No los compartimos con nadie.
              </span>
            </p>
            <label className="checkbox">
              <input
                type="checkbox"
                name="consent"
                value="yes"
                aria-invalid={field === "consent" ? true : undefined}
                aria-describedby={field === "consent" ? "sign-up-error" : undefined}
              />
              <span>Estoy de acuerdo</span>
            </label>
            {errorHere("consent")}
            <MoreInfo controller={controller} club={club} />
          </div>

          {errorHere(null)}
          <Turnstile siteKey={siteKey} renewOn={actionData} />
          <button type="submit" className="button">
            Anotarme
            <ArrowIcon />
          </button>
        </Form>
      </main>
    </>
  );
}
