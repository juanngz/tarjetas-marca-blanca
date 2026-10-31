// The card the barista found (Flujo B of the staff flows), in this order: the customer's name, big; the
// card as she sees it; how many stamps are left; and inside the card, Sumar sello (72px). Sumar sello is
// direct: tapping it is the confirmation. The camera doesn't come here: scanning adds the stamp by itself
// (register._staff._index), and only a card with a reward opens here.
// If she has a reward, a notice pops up by itself (08/10/2026), like the customer's festejo, telling the
// barista to give the discount, with Canjear premio. Sumar sello is there too, in the notice and on the card
// (09/10/2026): she may keep the reward for later. Redeeming doesn't add a stamp.
// At 7 de 8 (4 de 5) the next purchase is the reward's slot, like on the paper card (18/10/2026): the card's
// main button is Canjear premio, and Sumar sello y guardarlo keeps it for later.
// The form carries the card's version on screen: tapping twice or retrying never records twice.
// What it did shows in a sheet over the card (11/10/2026), like on Sumar sello's screen: no trip to another
// screen to read it again. Closing it brings the card up to date.
import { useEffect, useRef, useState } from "react";
import { data, Form, Link, redirect, useRevalidator } from "react-router";
import { type Receipt, receiptOf } from "../../application/receipt";
import { Alert } from "../../components/Alert";
import { rewardsText } from "../../components/Card";
import { DoneSheet } from "../../components/DoneSheet";
import { GiftIcon } from "../../components/icons";
import { OFFLINE_MESSAGE } from "../../components/OfflineNotice";
import { RegisterBar } from "../../components/RegisterBar";
import { RegisterCard } from "../../components/RegisterCard";
import { useIgnoreRepeatedTaps, useSending } from "../../components/registerForms";
import { appFor } from "../../platform/app.server";
import { formOf, formText } from "../../web/form";
import { keepScreenWhenOffline, unlessOffline } from "../../web/offline";
import type { Route } from "./+types/route";

export const meta: Route.MetaFunction = ({ data: loaded }) => [
  { title: `${loaded?.customerName ?? "Tarjeta"} · Caja` },
];

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const register = await appFor(request, context.cloudflare).register({
    renew: false,
  });
  if (!register) throw redirect("/register/sign-in");
  const view = await register.viewCard(params.code);
  if (view.result === "not-found") throw data("No encontramos esa tarjeta.", { status: 404 });
  const { result: _, ...card } = view;
  return { ...card, changed: new URL(request.url).searchParams.has("changed") };
}

/**
 * An action that didn't reach the server doesn't ask for the card again either. Nor one that shows its
 * confirmation: the barista reads it first, and closing it asks for the card (one trip less while waiting).
 */
export const shouldRevalidate = keepScreenWhenOffline(
  ({ actionResult, defaultShouldRevalidate }) =>
    isDone(actionResult) ? false : defaultShouldRevalidate,
);

const isDone = (result: unknown): result is { done: Receipt } =>
  typeof result === "object" && result !== null && "done" in result;

const AGAIN = "Algo no salió bien. Probá de nuevo.";

export async function action({ request, context, params }: Route.ActionArgs) {
  const register = await appFor(request, context.cloudflare).register({
    renew: false,
  });
  if (!register) throw redirect("/register/sign-in");
  const form = await formOf(request);
  const intent = formText(form, "intent");
  const version = formText(form, "version") ?? "";
  if ((intent !== "stamp" && intent !== "redeem") || !/^\d+$/.test(version)) {
    return data({ error: AGAIN }, { status: 400 });
  }

  // Its confirmation in the sheet. The action already brings it; if not (an earlier tap), it's read. If it
  // can't be shown, its own screen.
  const done = async (entryId: string, made: Receipt | null = null) => {
    const receipt = made ?? (await receiptOf(register.viewEntry, entryId));
    return receipt ? { done: receipt } : redirect(`/register/done/${entryId}`);
  };

  const outcome = await register.record({
    shortCode: params.code,
    type: intent,
    seenVersion: Number(version),
  });
  if (outcome.ok) return done(outcome.entryId, outcome.receipt);
  switch (outcome.reason) {
    case "card-changed":
      // Their own earlier tap (a double tap, or an answer lost on a bad connection): its confirmation.
      // Someone else's change: the card again, as it is now, to look at it before going on.
      return outcome.ownEntryId
        ? done(outcome.ownEntryId)
        : redirect(`/register/card/${params.code}?changed`);
    case "card-not-found":
      throw data("No encontramos esa tarjeta.", { status: 404 });
    case "no-rewards":
      return data({ error: "Esta tarjeta no tiene premios para canjear." }, { status: 409 });
    default:
      return data({ error: AGAIN }, { status: 503 });
  }
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
  return unlessOffline(serverAction);
}

export default function ScannedCard({ loaderData, actionData }: Route.ComponentProps) {
  const { customerName, firstName, card, leftForReward, reward, version, changed } = loaderData;
  const hasReward = card.rewards > 0;
  // The notice pops up by itself. If it's closed by mistake, Canjear premio opens it again.
  const [noticeClosed, setNoticeClosed] = useState(false);
  const error =
    actionData && "offline" in actionData
      ? OFFLINE_MESSAGE
      : actionData && "error" in actionData
        ? actionData.error
        : undefined;
  const ignoreRepeatedTaps = useIgnoreRepeatedTaps();
  const stamping = useSending({ intent: "stamp" });
  const redeeming = useSending({ intent: "redeem" });
  // 7 de 8 (4 de 5): the next purchase is the reward's slot. Stamping it is redeeming it (18/10/2026).
  const complete = card.complete;
  const done = isDone(actionData) ? actionData.done : undefined;
  // With the confirmation on screen, the reward's notice steps aside: what was done is what matters now.
  const showNotice = hasReward && !noticeClosed && !done;
  const { revalidate } = useRevalidator();

  return (
    <>
      <RegisterBar back="/register" />
      <main className="screen screen--register">
        <div className="customer-head">
          <span className="avatar avatar--big" aria-hidden="true">
            {customerName.trim().charAt(0).toUpperCase()}
          </span>
          <div className="intro">
            <h1 className="register-name">{customerName}</h1>
            <p className="secondary">
              {hasReward ? `Tiene ${rewardsText(card.rewards)}.` : leftForReward}
            </p>
          </div>
        </div>
        {changed && <Alert tone="info">La tarjeta cambió recién. Revisala antes de seguir.</Alert>}
        {error && !showNotice && <Alert>{error}</Alert>}

        <RegisterCard card={card}>
          {complete ? (
            <>
              <Form method="post" onSubmit={ignoreRepeatedTaps}>
                <input type="hidden" name="intent" value="redeem" />
                <input type="hidden" name="version" value={version} />
                <button
                  type="submit"
                  className="button button--on-card button--register"
                  aria-busy={redeeming || undefined}
                >
                  <GiftIcon />
                  {redeeming ? "Canjeando…" : "Canjear premio"}
                </button>
              </Form>
              {/* She keeps it for later: a stamp of the next round, and the reward stays saved. */}
              <Form method="post" onSubmit={ignoreRepeatedTaps}>
                <input type="hidden" name="intent" value="stamp" />
                <input type="hidden" name="version" value={version} />
                <button
                  type="submit"
                  className="button button--secondary-on-card button--register"
                  aria-busy={stamping || undefined}
                >
                  {stamping ? "Sumando…" : "Sumar sello y guardarlo"}
                </button>
              </Form>
            </>
          ) : (
            <>
              <Form method="post" onSubmit={ignoreRepeatedTaps}>
                <input type="hidden" name="intent" value="stamp" />
                <input type="hidden" name="version" value={version} />
                <button
                  type="submit"
                  className="button button--on-card button--register"
                  aria-busy={stamping || undefined}
                >
                  {stamping ? "Sumando…" : "Sumar sello"}
                </button>
              </Form>
              {/* A reward kept for later: it can be used in any purchase. */}
              {hasReward && (
                <button
                  type="button"
                  className="inline-link inline-link--on-card"
                  onClick={() => setNoticeClosed(false)}
                >
                  <GiftIcon />
                  Canjear premio
                </button>
              )}
            </>
          )}
        </RegisterCard>

        {done && <DoneSheet key={done.id} receipt={done} onClosed={() => void revalidate()} />}

        {showNotice && (
          <RewardNotice
            firstName={firstName}
            complete={complete}
            reward={reward}
            version={version}
            error={error}
            onSubmit={ignoreRepeatedTaps}
            onClose={() => setNoticeClosed(true)}
          />
        )}
      </main>
    </>
  );
}

/**
 * Marta tiene un premio: a sheet that pops up over the card (interfaz.md), like the customer's festejo.
 * It says which reward, so the barista gives the discount and charges right. Sumar sello if she keeps it
 * for later; Volver goes back to scanning (the wrong card). The phone's back closes it, and Canjear premio
 * on the card opens it again.
 */
function RewardNotice({
  firstName,
  complete,
  reward,
  version,
  error,
  onSubmit,
  onClose,
}: {
  firstName: string;
  /** 7 de 8: this purchase is the reward's slot; keeping it adds a stamp of the next round. */
  complete: boolean;
  reward: string;
  version: number;
  error: string | undefined;
  onSubmit: ReturnType<typeof useIgnoreRepeatedTaps>;
  onClose: () => void;
}) {
  const sheet = useRef<HTMLDialogElement>(null);
  const reopening = useRef(false);
  const redeeming = useSending({ intent: "redeem" });
  const stamping = useSending({ intent: "stamp" });

  useEffect(() => {
    const dialog = sheet.current;
    if (!dialog || dialog.matches(":modal")) return;
    // Without JavaScript it arrives open but not modal; with it, it's reopened as a modal sheet.
    if (dialog.open) {
      reopening.current = true;
      dialog.close();
    }
    dialog.showModal();
  }, []);

  const close = () => {
    if (reopening.current) {
      reopening.current = false;
      return;
    }
    onClose();
  };

  return (
    <dialog ref={sheet} open className="sheet" aria-labelledby="reward-title" onClose={close}>
      <span className="medallion" aria-hidden="true">
        <GiftIcon />
      </span>
      <div className="intro">
        <h2 id="reward-title" className="title">
          {firstName} tiene un premio
        </h2>
        <p className="big-reward">{`${reward[0].toUpperCase()}${reward.slice(1)}.`}</p>
        <p>Si lo usa en esta compra, hacele el descuento.</p>
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="actions">
        <Form method="post" onSubmit={onSubmit}>
          <input type="hidden" name="intent" value="redeem" />
          <input type="hidden" name="version" value={version} />
          <button
            type="submit"
            className="button button--register"
            aria-busy={redeeming || undefined}
          >
            <GiftIcon />
            {redeeming ? "Canjeando…" : "Canjear premio"}
          </button>
        </Form>
        <Form method="post" onSubmit={onSubmit}>
          <input type="hidden" name="intent" value="stamp" />
          <input type="hidden" name="version" value={version} />
          <button
            type="submit"
            className="button button--secondary button--register"
            aria-busy={stamping || undefined}
          >
            {stamping ? "Sumando…" : complete ? "Sumar sello y guardarlo" : "Sumar sello"}
          </button>
        </Form>
        <Link to="/register" className="inline-link">
          Volver
        </Link>
      </div>
    </dialog>
  );
}
