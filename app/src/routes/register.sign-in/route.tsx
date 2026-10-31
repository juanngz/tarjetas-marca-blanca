// Signing in at the register (Flujo A of the staff flows): email and 6-digit PIN.
// No link to it from the customer app. The PIN field isn't a password field on purpose: that way the
// phone doesn't offer to save it, and nobody gets in as someone else (decided on 07/10/2026). The eye
// shows it, to check what was typed.
import { type ChangeEvent, useState } from "react";
import { data, Form, redirect } from "react-router";
import { Alert } from "../../components/Alert";
import { pageTitle, useBrand } from "../../components/brand";
import { ArrowIcon, EyeIcon, EyeOffIcon } from "../../components/icons";
import { appFor } from "../../platform/app.server";
import { formOf, formText } from "../../web/form";
import type { Route } from "./+types/route";

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: pageTitle(matches, "Entrar a la caja") },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const register = await appFor(request, context.cloudflare).register({
    renew: false,
  });
  if (register) throw redirect("/register");
  return null;
}

// Locked out answers like a wrong email or PIN, so the answer never tells which emails are on the team.
const STATUS = { wrong: 401, "pin-format": 400, locked: 401 } as const;

export async function action({ request, context }: Route.ActionArgs) {
  const form = await formOf(request);
  const outcome = await appFor(request, context.cloudflare).staffSignIn({
    email: formText(form, "email") ?? "",
    pin: formText(form, "pin") ?? "",
  });
  if (outcome.result === "signed-in") {
    return redirect("/register", { headers: { "Set-Cookie": outcome.cookie } });
  }
  return data({ error: outcome.message, email: outcome.email }, { status: STATUS[outcome.reason] });
}

export default function SignIn({ actionData }: Route.ComponentProps) {
  const error = actionData?.error;
  const [pinShown, setPinShown] = useState(false);
  const brand = useBrand();
  return (
    <main className="screen screen--sign-in">
      <div className="intro intro--centered">
        <img
          className="brand-badge"
          src="/brand/badge.svg"
          alt={brand.name}
          width={84}
          height={84}
        />
        <p className="eyebrow">Solo para el equipo</p>
        <h1 className="title title--xl">Entrar a la caja</h1>
        <p className="lede">Con tu email y tu PIN de 6 números.</p>
      </div>

      {/* The server checks everything: no browser bubbles, which don't speak in the café's voice. */}
      <Form method="post" className="form panel" noValidate>
        <label htmlFor="email" className="field-label">
          Tu email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="field"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={actionData?.email}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "sign-in-error" : undefined}
        />

        <label htmlFor="pin" className="field-label">
          Tu PIN
        </label>
        <div className="field-with-action">
          <input
            // After a mistake the PIN starts empty: it's never sent back.
            key={error}
            id="pin"
            name="pin"
            type="text"
            className={`field field--code field--pin${pinShown ? " field--pin-shown" : ""}`}
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            onChange={keepOnlyDigits}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "sign-in-error" : undefined}
          />
          <button
            type="button"
            className="field-action"
            aria-label={pinShown ? "Ocultar PIN" : "Ver PIN"}
            aria-controls="pin"
            onClick={() => setPinShown((shown) => !shown)}
          >
            {pinShown ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        {error && <Alert id="sign-in-error">{error}</Alert>}
        <button type="submit" className="button">
          Entrar
          <ArrowIcon />
        </button>
      </Form>
    </main>
  );
}

/** The PIN is only digits: a letter typed by mistake doesn't go in. */
function keepOnlyDigits(event: ChangeEvent<HTMLInputElement>) {
  const field = event.currentTarget;
  const digits = field.value.replace(/\D/g, "").slice(0, 6);
  if (digits !== field.value) field.value = digits;
}
