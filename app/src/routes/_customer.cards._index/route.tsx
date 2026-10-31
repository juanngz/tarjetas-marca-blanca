// The customer's cards (Flujo 3): the wallet.
// The chosen card goes in front, complete; the others peek out behind and are tapped to bring them to the front.
// Which one is in front is said by the URL (?front=): that way it also works without JavaScript.
// The phone keeps a copy of it, with each card's code, for when there's no connection (Flujo 5).
import { type CSSProperties, useEffect, useLayoutEffect, useRef } from "react";
import { redirect, useSearchParams } from "react-router";
import { pageTitle } from "../../components/brand";
import { WalletCard } from "../../components/Card";
import { CustomerHeader } from "../../components/CustomerHeader";
import { useOnline } from "../../components/OfflineNotice";
import { greeting } from "../../core/greeting";
import { appFor } from "../../platform/app.server";
import { revalidateUnlessOnlyFrontChanges } from "../../web/frontCard";
import { keptFirst, useFresh } from "../../web/instant";
import { keepWallet, keptWallet } from "../../web/offlineCopy";
import { keepPage } from "../../web/sw/phone";
import type { Route } from "./+types/route";
import { chooseFront, walletOrder } from "./wallet";

/** How many steps the wallet can tighten to fit the screen (cards.css, .screen--cards[data-fit]). */
const FIT_STEPS = 4;

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: pageTitle(matches, "Mis tarjetas") },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const app = appFor(request, context.cloudflare);
  const session = await app.readCustomerSession({ renew: false });
  // Without a session, or if the customer was deleted (their cookie points to an id that's gone).
  const wallet = session ? await app.viewWallet(session.customerId) : null;
  if (!wallet) throw redirect("/");
  return { ...wallet, timeZone: app.cafe.timeZone };
}

type WalletData = Awaited<ReturnType<typeof loader>>;

/** Coming back to it, the wallet as it was last shown, at once (web/instant.ts). Also without a connection. */
export const clientLoader = ({ request, serverLoader }: Route.ClientLoaderArgs) =>
  keptFirst(request, serverLoader, () => {
    const wallet = keptWallet<WalletData>();
    return wallet && { ...wallet, kept: true as const };
  });

/** Bringing another card to the front doesn't need the server: the wallet moves instantly. */
export const shouldRevalidate = revalidateUnlessOnlyFrontChanges;

/**
 * The greeting: the server's, or, from the phone's copy, said again by the time it is now (it was kept
 * maybe in the morning). A copy from before it kept the name says the one it kept.
 */
function greetingOf(wallet: Partial<WalletData> & { greeting: string; kept?: true }): string {
  if (!wallet.kept || !wallet.name || !wallet.timeZone) return wallet.greeting;
  return greeting(wallet.name, new Date(), wallet.timeZone);
}

export default function Cards({ loaderData }: Route.ComponentProps) {
  useFresh(loaderData);
  const { cards } = loaderData;
  const fromPhone = "kept" in loaderData;
  const online = useOnline();

  // Kept on the phone: the copy, and the page to open the app without a connection (again if it changed).
  // Only what the server said: the copy is already kept.
  useEffect(() => {
    if (!fromPhone) void keepPage("/cards", keepWallet(loaderData));
  }, [loaderData, fromPhone]);
  const [search] = useSearchParams();
  const front = chooseFront(cards, search.get("front"));
  const order = walletOrder(cards, front);

  // The tab that was tapped disappears when it comes to the front. If it had focus (keyboard or screen
  // reader), focus follows the card, which is now in front.
  const wallet = useRef<HTMLDivElement>(null);
  const keepFocus = useRef(false);
  useEffect(() => {
    if (!keepFocus.current) return;
    keepFocus.current = false;
    wallet.current
      ?.querySelector<HTMLElement>(`[aria-labelledby="card-${front}"]`)
      ?.focus({ preventScroll: true });
  }, [front]);

  // What peeks out of each card behind fits its name and its summary, even when the name takes two or three
  // lines (a narrow phone, or 200%, when the phone zooms the page).
  // And the wallet fits the screen without scrolling (10/10/2026): when it doesn't, it tightens one step at a
  // time (cards.css, data-fit) until it does, or until the last step on a very small phone. The tabs are
  // measured again at each step: a step can take a line off the names. The step is the one where the tallest
  // card fits, whichever is in front: bringing a shorter one to the front doesn't change it in the middle of
  // the slide. All of it again when the size changes, or when Sin conexión comes or goes above the screen.
  // It starts from the step it's at: it only goes up while it doesn't fit, or back down while it fits a
  // looser one, instead of measuring every step each time.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Sin conexión moves the screen, not the wallet's size.
  useLayoutEffect(() => {
    const element = wallet.current;
    const screen = element?.closest("main");
    if (!element || !screen) return;
    const heads = [...element.querySelectorAll<HTMLElement>(".card__head")];
    const cards = [...element.querySelectorAll<HTMLElement>(".card")];
    const measureTabs = () => {
      const tallest = Math.max(
        ...heads.map(
          (head) =>
            head.offsetHeight +
            (head.querySelector<HTMLElement>(".card__summary")?.offsetHeight ?? 0),
        ),
      );
      element.style.setProperty("--tab", `calc(${tallest}px + var(--tab-air))`);
    };
    const fitsAt = (step: number) => {
      screen.dataset.fit = String(step);
      measureTabs();
      // Where the page would end with the tallest card in front, without the cards being dealt: offsetHeight
      // leaves out the transforms. The cards behind are whole underneath, only cut.
      const front = element.querySelector<HTMLElement>(".wallet__card--front .card");
      const taller =
        Math.max(...cards.map((card) => card.offsetHeight)) - (front?.offsetHeight ?? 0);
      return screen.offsetTop + screen.offsetHeight + taller <= window.innerHeight;
    };
    const fitScreen = () => {
      let step = Math.min(Number(screen.dataset.fit) || 0, FIT_STEPS);
      if (fitsAt(step)) {
        while (step > 0 && fitsAt(step - 1)) step--;
        // The last try was looser and didn't fit: back to the one that does.
        if (screen.dataset.fit !== String(step)) fitsAt(step);
      } else {
        while (step < FIT_STEPS && !fitsAt(step + 1)) step++;
      }
    };
    fitScreen();
    const observer = new ResizeObserver(fitScreen);
    observer.observe(element);
    window.addEventListener("resize", fitScreen);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fitScreen);
    };
  }, [online]);

  return (
    <>
      <CustomerHeader />
      {/* The café's symbol: behind the cards, only to look at. Outside the screen,
          which slides in when it opens: it stays still in its corner. */}
      <img
        className="wallet-symbol"
        src="/brand/symbol.svg"
        alt=""
        aria-hidden="true"
        width={248}
        height={248}
      />
      <main className="screen screen--cards">
        <h1 className="title title--xl">{greetingOf(loaderData)}</h1>
        {/* Always in the fixed order: each card changes place without moving in the page. */}
        <div
          ref={wallet}
          className="wallet"
          style={{ "--behind": cards.length - 1 } as CSSProperties}
        >
          {cards.map((card) => (
            <WalletCard
              key={card.type}
              card={card}
              place={order.indexOf(card.type)}
              inFront={card.type === front}
              onBringToFront={(event) => {
                keepFocus.current = document.activeElement === event.currentTarget;
              }}
            />
          ))}
        </div>
      </main>
    </>
  );
}
