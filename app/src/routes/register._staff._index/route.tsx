// Sumar sello, the register's main screen (Flujo B of the staff flows): the camera reads the card's QR and
// adds the stamp by itself (decided on 08/10/2026). Below it, always in sight, Buscar tarjeta (Flujo D): no
// sheet to open, one tap less with a queue. A card's code goes to that card; a document or a name shows
// each customer with their cards, each with Sumar sello. The long code a QR carries never goes in a URL,
// and a document never comes back. A stamp added here shows its confirmation in a sheet over the screen
// (08/10/2026).
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { data, Form, Link, redirect, useNavigation, useSubmit } from "react-router";
import { type Receipt, receiptOf } from "../../application/receipt";
import { Alert } from "../../components/Alert";
import { DoneSheet } from "../../components/DoneSheet";
import { ArrowIcon, ScanIcon, SearchIcon } from "../../components/icons";
import { OFFLINE_MESSAGE } from "../../components/OfflineNotice";
import { RegisterBar } from "../../components/RegisterBar";
import { useIgnoreRepeatedTaps } from "../../components/registerForms";
import { canShowAgain } from "../../core/search";
import { appFor } from "../../platform/app.server";
import { formOf, formText } from "../../web/form";
import { keepScreenWhenOffline, unlessOffline } from "../../web/offline";
import type { Route } from "./+types/route";
import { FoundCustomers } from "./FoundCustomers";

// The camera only exists in the browser, and its reader only loads on this screen.
const CardScanner = lazy(() => import("./CardScanner"));

export const meta: Route.MetaFunction = () => [{ title: "Sumar sello · Caja" }];

const SEARCH_ERRORS = {
  empty: { status: 400, message: "Escribí el código de la tarjeta, el documento o el nombre." },
  "too-short": { status: 400, message: "Escribí al menos 2 letras del nombre." },
  "not-found": { status: 404, message: "No encontramos nada con eso. Probá con otro dato." },
} as const;

const AGAIN = "Algo no salió bien. Probá de nuevo.";

/** A QR the camera read that no card has: the barista asks for the code and types it. */
const SCANNED_NOT_FOUND =
  "No encontramos esa tarjeta. Pedile al cliente el código de su tarjeta y escribilo.";

export async function action({ request, context }: Route.ActionArgs) {
  const register = await appFor(request, context.cloudflare).register({
    renew: false,
  });
  if (!register) throw redirect("/register/sign-in");
  const form = await formOf(request);
  const code = formText(form, "code") ?? "";
  // A stamp added from here: its confirmation shows in a sheet over the register, without changing screens
  // (08/10/2026). The action already brings it; if not (a reading sent again), it's read. If it can't be
  // shown, its own screen.
  const done = async (entryId: string, made: Receipt | null = null) => {
    const receipt = made ?? (await receiptOf(register.viewEntry, entryId));
    return receipt ? { done: receipt } : redirect(`/register/done/${entryId}`);
  };

  // The camera read a card's QR: the stamp is added by itself, and its confirmation has Deshacer.
  // What the camera read isn't put in the field: the long code isn't for typing.
  // With the reading's id: the same reading sent again adds one stamp.
  if (formText(form, "from") === "camera") {
    const scanned = await register.stampScanned(code, formText(form, "scan") ?? "");
    switch (scanned.result) {
      case "stamped":
        return done(scanned.entryId, scanned.receipt);
      case "has-reward":
        return redirect(`/register/card/${scanned.shortCode}`);
      case "no-scan":
        return data({ error: AGAIN, code: "" }, { status: 400 });
      case "busy":
        return data({ error: AGAIN, code: "" }, { status: 503 });
      default:
        return data({ error: SCANNED_NOT_FOUND, code: "" }, { status: 404 });
    }
  }

  // Sumar sello on one of the results: like on the card, only at the version the barista saw.
  if (formText(form, "intent") === "stamp") {
    const shortCode = formText(form, "shortCode") ?? "";
    const version = formText(form, "version") ?? "";
    if (!/^\d+$/.test(version)) return data({ error: AGAIN, code: "" }, { status: 400 });
    const outcome = await register.record({
      shortCode,
      type: "stamp",
      seenVersion: Number(version),
    });
    if (outcome.ok) return done(outcome.entryId, outcome.receipt);
    if (outcome.reason === "card-changed") {
      // Their own earlier tap: its confirmation. Someone else's change: the card as it is now.
      if (outcome.ownEntryId) return done(outcome.ownEntryId);
      return redirect(`/register/card/${shortCode}?changed`);
    }
    return data({ error: AGAIN, code: "" }, { status: 503 });
  }

  const searched = await register.search(code);
  if (searched.result === "card") return redirect(`/register/card/${searched.shortCode}`);
  // A document is never shown again, not even in the field, nor anything with its digits.
  const byDocument = "by" in searched && searched.by === "document";
  const typed = byDocument || !canShowAgain(code) ? "" : code;
  if (searched.result === "customers") {
    const { customers, more } = searched;
    return { found: { customers, more }, code: typed };
  }
  const { status, message } = SEARCH_ERRORS[searched.result];
  return data({ error: message, code: typed }, { status });
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
  return unlessOffline(serverAction);
}

export const shouldRevalidate = keepScreenWhenOffline();

const noChanges = () => () => {};

/** Whether React already runs in the browser: before that (or without JavaScript), there's no camera. */
function useInBrowser() {
  return useSyncExternalStore(
    noChanges,
    () => true,
    () => false,
  );
}

export default function AddStamp({ actionData }: Route.ComponentProps) {
  const offline = actionData && "offline" in actionData;
  const failed = actionData && "error" in actionData ? actionData : undefined;
  const found = actionData && "found" in actionData ? actionData.found : undefined;
  const done = actionData && "done" in actionData ? actionData.done : undefined;
  const typed = actionData && "code" in actionData ? actionData.code : undefined;
  const error = offline ? OFFLINE_MESSAGE : failed?.error;
  const inBrowser = useInBrowser();
  const busy = useNavigation().state !== "idle";
  const submit = useSubmit();
  // Each reading has its id, sent with the code: if its answer doesn't arrive (Sin conexión) and it's read
  // again, the server knows it's the same reading and adds one stamp. Once the server answered, the next
  // reading gets a new one: two coffees are two readings.
  const reading = useRef<string | null>(null);
  useEffect(() => {
    if (actionData && !offline) reading.current = null;
  }, [actionData, offline]);
  const scanned = (code: string) => {
    reading.current ??= crypto.randomUUID();
    submit({ code, from: "camera", scan: reading.current }, { method: "post" });
  };

  // While the barista types, the camera waits: it doesn't read a card held up behind the keyboard.
  const [typing, setTyping] = useState(false);

  return (
    <>
      <RegisterBar />
      <main className="screen screen--register screen--add-stamp">
        {/* The camera says what the screen is for; the title is for screen readers. */}
        <h1 className="visually-hidden">Sumar sello</h1>
        {!inBrowser && <p>Pedile al cliente el código de su tarjeta.</p>}

        {/* With results on screen, the camera steps aside. While its code loads: the box as it looks
            off, never an empty block. */}
        {inBrowser && !found && (
          <Suspense
            fallback={
              <div className="scanner scanner--off" aria-hidden="true">
                <span className="scanner__frame" />
              </div>
            }
          >
            {/* After a stamp it starts again, off: one reading adds one stamp (Flujo B). */}
            <CardScanner key={done?.id} onCode={scanned} busy={busy || typing || Boolean(done)} />
          </Suspense>
        )}

        <SearchForm typed={typed} error={error} invalid={Boolean(failed)} onTyping={setTyping} />

        {done && <DoneSheet key={done.id} receipt={done} />}

        {found && (
          <>
            <FoundCustomers customers={found.customers} more={found.more} collapsible={inBrowser} />
            <Link to="/register" className="button button--secondary">
              <ScanIcon />
              Volver a escanear
            </Link>
          </>
        )}
      </main>
    </>
  );
}

/**
 * Buscar tarjeta: a card's code, a document or a name. One rounded bar, like a phone's search: the
 * magnifier, the field and a round button to go.
 */
function SearchForm({
  typed,
  error,
  invalid,
  onTyping,
}: {
  typed: string | undefined;
  error: string | undefined;
  invalid: boolean;
  onTyping: (typing: boolean) => void;
}) {
  const ignoreRepeatedTaps = useIgnoreRepeatedTaps();
  // The field keeps what was typed, except a document: it's cleared, so the DNI isn't left on screen.
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (field.current && typed !== undefined) field.current.value = typed;
  }, [typed]);
  return (
    <Form method="post" className="finder" onSubmit={ignoreRepeatedTaps}>
      <label htmlFor="code" className="finder__label">
        O buscá por nombre, DNI o código
      </label>
      <div className={`finder__bar${invalid ? " finder__bar--invalid" : ""}`}>
        <SearchIcon />
        <input
          ref={field}
          id="code"
          name="code"
          className="finder__field"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          defaultValue={typed}
          onFocus={() => onTyping(true)}
          onBlur={() => onTyping(false)}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={error ? "search-error" : undefined}
        />
        <button type="submit" className="finder__go" aria-label="Buscar tarjeta">
          <ArrowIcon />
        </button>
      </div>
      {error && <Alert id="search-error">{error}</Alert>}
    </Form>
  );
}
