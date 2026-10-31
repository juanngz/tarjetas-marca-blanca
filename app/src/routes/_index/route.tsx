// Welcome (Flujo 1 of the customer flows): a single field, the document.
// If they're already in the Club, they're in; if they're new, they confirm the number on a sheet and continue at /sign-up.
// Whoever sees it has no session (Salir, or it ended): nothing of the last customer stays on the phone.
import { type ChangeEvent, useEffect, useRef } from "react";
import { data, Form, Link, redirect } from "react-router";
import { Alert } from "../../components/Alert";
import { pageTitle, useBrand } from "../../components/brand";
import { drawing } from "../../components/Card";
import { ArrowIcon } from "../../components/icons";
import { useRegisterDoor } from "../../components/registerDoor";
import { SiteFoot } from "../../components/SiteFoot";
import { Turnstile } from "../../components/Turnstile";
import { cleanDniWhileTyping, formatDni } from "../../core/document";
import { appFor } from "../../platform/app.server";
import { formOf, formText } from "../../web/form";
import { forgetWallet } from "../../web/offlineCopy";
import { forgetPages } from "../../web/sw/phone";
import type { Route } from "./+types/route";

export const meta: Route.MetaFunction = ({ matches }) => [{ title: pageTitle(matches) }];

/** How many cards the welcome fans out: its three places are drawn in base.css. */
const FAN_CARDS = 3;

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.cloudflare;
  const app = appFor(request, context.cloudflare);
  const session = await app.readCustomerSession({ renew: false });
  if (await app.isSignedIn(session?.customerId ?? null)) throw redirect("/cards");
  const { cafe } = app;
  const other = new URL(request.url).searchParams.get("document") === "other";
  return {
    type: other ? ("other" as const) : ("dni" as const),
    siteKey: env.TURNSTILE_SITE_KEY,
    welcome: cafe.welcome,
    address: cafe.controller.address,
    // The fan has room for three (base.css, .card-fan): the first ones, like paper cards on the
    // counter. The rest are in the wallet.
    cards: cafe.cards
      .slice(0, FAN_CARDS)
      .map(({ type, name, color, stamp }) => ({ type, name, color, stamp })),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await formOf(request);
  const text = (name: string) => formText(form, name);
  const outcome = await appFor(request, context.cloudflare).signIn({
    type: text("type"),
    document: text("document") ?? "",
    turnstileToken: text("cf-turnstile-response"),
  });
  if (outcome.result === "signed-in") {
    return redirect("/cards", { headers: { "Set-Cookie": outcome.cookie } });
  }
  if (outcome.result === "new") {
    return { step: "confirm" as const, type: outcome.type, number: outcome.number };
  }
  return data(
    { error: outcome.message, type: outcome.type, text: outcome.text },
    { status: outcome.reason === "too-many-attempts" ? 429 : 400 },
  );
}

export default function Welcome({ loaderData, actionData }: Route.ComponentProps) {
  const confirm = actionData && "step" in actionData ? actionData : undefined;
  const failed = actionData && "error" in actionData ? actionData : undefined;
  const type = actionData?.type ?? loaderData.type;
  const error = failed?.error;
  const brand = useBrand();
  const { club } = brand;
  const [before, after] = club.name.split(club.highlight);
  const knock = useRegisterDoor();
  useEffect(() => {
    forgetWallet();
    void forgetPages();
  }, []);
  return (
    <main className="screen screen--welcome">
      <div className="welcome-hero">
        <img
          className="welcome-hero__symbol"
          src="/brand/symbol.svg"
          alt=""
          aria-hidden="true"
          width={210}
          height={210}
        />
        {/* 5 taps in a row open the register (components/registerDoor.ts). */}
        <img
          onPointerUp={knock}
          className="brand-badge"
          src="/brand/badge.svg"
          alt={brand.name}
          width={84}
          height={84}
        />
        <h1 className="brand-title">
          {before}
          <em>{club.highlight}</em>
          {after}
        </h1>
        <p className="lede">{loaderData.welcome}</p>
      </div>

      {/* The three cards, fanned out on the counter: only to look at. */}
      <div className="card-fan" aria-hidden="true">
        {loaderData.cards.map((card) => (
          <div key={card.type} className={`card-fan__card color-${card.color}`}>
            <img
              className="card-fan__wordmark"
              src="/brand/wordmark-light.svg"
              alt=""
              width={76}
              height={17}
            />
            <img src={drawing(card, "stamped")} alt="" width={22} height={33} />
          </div>
        ))}
      </div>

      <section className="panel" aria-label="Entrar">
        <Form method="post" className="form">
          <input type="hidden" name="type" value={type} />
          <label htmlFor="document" className="field-label">
            {type === "dni" ? "Tu número de documento" : "El número de tu documento o pasaporte"}
          </label>
          <input
            // When the document type changes, the field starts empty.
            key={type}
            id="document"
            name="document"
            className="field field--code"
            inputMode={type === "dni" ? "numeric" : "text"}
            placeholder={type === "dni" ? "Solo los números, sin puntos" : undefined}
            onChange={type === "dni" ? keepOnlyDni : undefined}
            autoComplete="off"
            autoCapitalize={type === "dni" ? "off" : "characters"}
            defaultValue={failed?.text}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "document-error" : undefined}
          />
          {error && <Alert id="document-error">{error}</Alert>}
          {/* Turnstile gives one token per submission: it asks for a new one with each response. */}
          <Turnstile siteKey={loaderData.siteKey} renewOn={actionData} />
          <button type="submit" className="button">
            Seguir
            <ArrowIcon />
          </button>
        </Form>

        <Link to={type === "dni" ? "/?document=other" : "/"} className="link">
          {type === "dni" ? "No tengo DNI argentino" : "Tengo DNI argentino"}
        </Link>
      </section>

      <SiteFoot address={loaderData.address} />

      {confirm && <ConfirmDocument response={confirm} />}
    </main>
  );
}

/**
 * While typing or pasting, the DNI field keeps only the digits (up to 8). If JavaScript doesn't
 * load, the server rejects the same thing with its message.
 */
function keepOnlyDni(event: ChangeEvent<HTMLInputElement>) {
  const field = event.currentTarget;
  const clean = cleanDniWhileTyping(field.value);
  if (clean === field.value) return;
  // The cursor stays where it was, minus what was removed before it.
  const cursor = cleanDniWhileTyping(
    field.value.slice(0, field.selectionStart ?? undefined),
  ).length;
  field.value = clean;
  field.setSelectionRange(cursor, cursor);
}

/**
 * Sign-up only: avoids creating an account with a mistyped document. It's a sheet that slides up from
 * the bottom (interfaz.md) over the welcome screen: *Corregir* closes it and leaves the number in the field.
 */
function ConfirmDocument({ response }: { response: { type: "dni" | "other"; number: string } }) {
  const { type, number } = response;
  const sheet = useRef<HTMLDialogElement>(null);

  // Opens with each form response, even if it brings the same number as the previous one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: response changes on every submission.
  useEffect(() => {
    if (!sheet.current?.open) sheet.current?.showModal();
  }, [response]);

  return (
    <dialog
      ref={sheet}
      className="sheet"
      aria-labelledby="confirm-title"
      onClose={() => document.getElementById("document")?.focus()}
    >
      <div className="intro">
        <p className="eyebrow">Revisalo antes de seguir</p>
        <h2 id="confirm-title" className="title">
          ¿Es correcto este número?
        </h2>
      </div>
      <p className="big-number">{type === "dni" ? formatDni(number) : number}</p>
      <div className="actions">
        <Form method="post" action="/sign-up">
          <input type="hidden" name="step" value="name" />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="number" value={number} />
          <button type="submit" className="button">
            Sí, es correcto
          </button>
        </Form>
        <form method="dialog">
          <button type="submit" className="button button--secondary">
            Corregir
          </button>
        </form>
      </div>
    </dialog>
  );
}
