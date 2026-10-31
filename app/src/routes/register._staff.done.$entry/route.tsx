// The register's confirmation (Flujos B and C of the staff flows), on its own screen: what happened, with the
// data and a small Deshacer, then Escanear otra tarjeta, nothing else. From the register itself it shows in a
// sheet over it instead (08/10/2026); this screen stays for the card's Sumar sello and for going back.
// Deshacer from that sheet (in=sheet) answers with the undo's confirmation, to show there.
import { data, Form, Link, redirect } from "react-router";
import { type Receipt, receiptOf } from "../../application/receipt";
import { Alert } from "../../components/Alert";
import { ScanIcon, UndoIcon } from "../../components/icons";
import { OFFLINE_MESSAGE } from "../../components/OfflineNotice";
import { RECEIPT_TITLES, ReceiptBody } from "../../components/ReceiptBody";
import { useIgnoreRepeatedTaps } from "../../components/registerForms";
import { appFor } from "../../platform/app.server";
import { formOf, formText } from "../../web/form";
import { keepScreenWhenOffline, unlessOffline } from "../../web/offline";
import type { Route } from "./+types/route";

export const meta: Route.MetaFunction = ({ data: loaded }) => [
  { title: `${loaded ? RECEIPT_TITLES[loaded.kind] : "Caja"} · Caja` },
];

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const register = await appFor(request, context.cloudflare).register({
    renew: false,
  });
  if (!register) throw redirect("/register/sign-in");
  const view = await register.viewEntry(params.entry);
  // Undone: its confirmation is the undo's (Sello deshecho), with no Deshacer.
  if (view.result === "undone") throw redirect(`/register/done/${view.undoId}`);
  if (view.result === "not-found") throw data("No encontramos ese movimiento.", { status: 404 });
  const { result: _, ...entry } = view;
  return { id: params.entry, ...entry };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const register = await appFor(request, context.cloudflare).register({
    renew: false,
  });
  if (!register) throw redirect("/register/sign-in");
  const form = await formOf(request);
  // From the sheet over the register: the confirmation comes back to show there, without changing screens.
  const inSheet = formText(form, "in") === "sheet";
  // The undo already brings its confirmation; if not (a second tap), it's read.
  const shown = async (entryId: string, made: Receipt | null = null) => {
    const receipt = inSheet ? (made ?? (await receiptOf(register.viewEntry, entryId))) : null;
    return receipt ? { done: receipt } : redirect(`/register/done/${entryId}`);
  };
  if (formText(form, "intent") !== "undo") {
    return data({ error: "Algo no salió bien. Probá de nuevo." }, { status: 400 });
  }

  const outcome = await register.undo(params.entry);
  if (outcome.ok) return shown(outcome.entryId, outcome.receipt);
  switch (outcome.reason) {
    case "already-undone": {
      // A second tap on Deshacer: the confirmation of the undo the first one made.
      const view = await register.viewEntry(params.entry);
      if (view.result === "undone") return shown(view.undoId);
      throw data("No encontramos ese movimiento.", { status: 404 });
    }
    case "reward-redeemed":
      return data(
        {
          error:
            "Este sello completó la tarjeta y su premio ya se canjeó. Para deshacerlo, primero deshacé el canje.",
        },
        { status: 409 },
      );
    case "not-found":
    case "card-not-found":
      throw data("No encontramos ese movimiento.", { status: 404 });
    default:
      return data({ error: "Algo no salió bien. Probá de nuevo." }, { status: 503 });
  }
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
  return unlessOffline(serverAction);
}

export const shouldRevalidate = keepScreenWhenOffline();

export default function Done({ loaderData, actionData }: Route.ComponentProps) {
  // Without JavaScript, Deshacer from the sheet arrives here with the undo's confirmation.
  const receipt = actionData && "done" in actionData ? actionData.done : loaderData;
  const error =
    actionData && "offline" in actionData
      ? OFFLINE_MESSAGE
      : actionData && "error" in actionData
        ? actionData.error
        : undefined;
  const ignoreRepeatedTaps = useIgnoreRepeatedTaps();

  return (
    <main className="screen screen--done">
      <div className="done">
        <ReceiptBody
          receipt={receipt}
          undo={
            <Form
              method="post"
              action={`/register/done/${receipt.id}`}
              onSubmit={ignoreRepeatedTaps}
            >
              <input type="hidden" name="intent" value="undo" />
              <button type="submit" className="inline-link inline-link--undo">
                <UndoIcon />
                Deshacer
              </button>
            </Form>
          }
        />
        {error && <Alert>{error}</Alert>}
      </div>

      <div className="actions">
        <Link to="/register" className="button button--register">
          <ScanIcon />
          Escanear otra tarjeta
        </Link>
      </div>
    </main>
  );
}
