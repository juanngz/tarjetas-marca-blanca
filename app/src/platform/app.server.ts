// The composition root: the only place that connects the use cases (application/) with their adapters
// (platform/). The routes ask for the app of their request and only call use cases with plain data.
// See ../../../docs/implementacion/arquitectura.md

import { viewActivity } from "../application/activity";
import { isSignedIn } from "../application/isSignedIn";
import { recordOnCard, stampScannedCard, undoEntry } from "../application/registerEntry";
import { searchCards } from "../application/searchCards";
import { type SignInInput, signIn } from "../application/signIn";
import { type SignUpInput, signUp } from "../application/signUp";
import { type StaffSignInInput, staffSignIn } from "../application/staffSignIn";
import { viewSummary } from "../application/summary";
import {
  addBarista,
  changeTeamMember,
  newPinFor,
  setActive,
  viewTeam,
  viewTeamMember,
} from "../application/team";
import { viewCard } from "../application/viewCard";
import { viewEntry } from "../application/viewEntry";
import { viewRegisterCard } from "../application/viewRegisterCard";
import { viewWallet } from "../application/viewWallet";
import { cardToWatch } from "../application/watchCard";
import { systemClock } from "./clock";
import { randomCodeGenerator } from "./codes.server";
import { currentCafe } from "./currentCafe.server";
import { cafeDb } from "./db/cafeDb.server";
import { d1CardRepository } from "./db/cardRepository.server";
import { d1CustomerRepository } from "./db/customerRepository.server";
import { d1StaffRepository } from "./db/staffRepository.server";
import { d1SummaryRepository } from "./db/summaryRepository.server";
import { durableCardWatchers } from "./live/watchers.server";
import { consoleLogger } from "./log.server";
import { readSecrets } from "./secrets.server";
import { turnstileBotGate } from "./security/botGate.server";
import { hmacDocumentHasher } from "./security/documentHasher.server";
import {
  cookieSessionIssuer,
  endSession,
  readCustomerSession,
  readStaffSession,
} from "./security/sessions.server";
import { hmacPinIssuer, hmacPinVerifier } from "./security/staffPin.server";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * How a failed sign-in at the register waits before answering (staffSignIn). Always, except in the server
 * tests, whose context says so (test/routes.ts): there it would only make them slow.
 */
function signInWait(env: Env): (ms: number) => Promise<void> {
  const inTests = (env as { TEST_NO_SIGN_IN_WAIT?: unknown }).TEST_NO_SIGN_IN_WAIT === true;
  return inTests ? async () => {} : sleep;
}

/**
 * Everything a screen can do, for this request. It takes the Worker's env and ctx together, so no screen
 * can pass one without the other: ctx.waitUntil lets the sello en vivo go on after answering.
 */
export function appFor(request: Request, { env, ctx }: { env: Env; ctx?: ExecutionContext }) {
  const cafe = currentCafe(request);
  const db = cafeDb(env, cafe);
  const secrets = readSecrets(env);
  const clock = systemClock;
  const customers = d1CustomerRepository(db);
  const cards = d1CardRepository(db);
  const staff = d1StaffRepository(db);
  const summary = d1SummaryRepository(db);
  // The sello en vivo goes on after answering the register (ctx.waitUntil): the barista doesn't wait for it.
  const later = ctx?.waitUntil ? (task: Promise<unknown>) => ctx.waitUntil(task) : undefined;
  const watchers = durableCardWatchers(env.CARD_WATCH, later);
  const registerDeps = { cards, watchers, logger: consoleLogger };
  const teamDeps = { staff, pins: hmacPinIssuer(secrets.pinHmacKey) };
  const hasher = hmacDocumentHasher(secrets.dniHmacKey);
  const sessions = cookieSessionIssuer(request, secrets, clock);
  const gate = turnstileBotGate(request, {
    turnstileSecret: secrets.turnstileSecretKey,
    limiter: env.SIGN_IN_LIMIT,
  });

  return {
    cafe,

    /** The customer's session from the cookie, without querying the database. Renews it unless told not to. */
    readCustomerSession: (options?: { renew?: boolean }) =>
      readCustomerSession(request, secrets, clock.now(), options),

    /** The Set-Cookie that deletes the customer's session from this phone (Salir). */
    endCustomerSession: () => endSession(request, "customer"),

    signIn: (input: SignInInput) => signIn(input, { customers, hasher, gate, sessions }),

    signUp: (input: SignUpInput) =>
      signUp(input, cafe, {
        customers,
        hasher,
        gate,
        sessions,
        codes: randomCodeGenerator,
        clock,
        logger: consoleLogger,
      }),

    isSignedIn: (customerId: string | null) => isSignedIn({ customerId }, { customers }),

    viewWallet: (customerId: string) =>
      viewWallet({ customerId }, cafe, { customers, cards, clock }),

    viewCard: (customerId: string, type: string | undefined, options?: { withHistory?: boolean }) =>
      viewCard({ customerId, type, ...options }, cafe, { customers, cards }),

    /** The card a customer's code screen listens to for the sello en vivo, or null if it isn't hers. */
    cardToWatch: (customerId: string, type: string) => cardToWatch({ customerId, type }, { cards }),

    staffSignIn: (input: StaffSignInInput) =>
      staffSignIn(input, {
        staff,
        pins: hmacPinVerifier(secrets.pinHmacKey),
        sessions,
        clock,
        wait: signInWait(env),
        logger: consoleLogger,
      }),

    /**
     * The register of the staff member signed in on this phone, or null if there's no valid session.
     * Every register loader and action starts here: without a session there's no register, and who
     * did each thing always comes from the cookie, never from the form. Renews the session unless told not to.
     */
    register: async (options?: { renew?: boolean }) => {
      const session = await readStaffSession(request, secrets, clock.now(), staff, options);
      if (!session) return null;
      const { member } = session;
      return {
        member,
        cookie: session.cookie,

        /** Buscar tarjeta: by a card's code, a document or a name (Flujo D). */
        search: (text: string) =>
          searchCards({ text, memberId: member.id, at: clock.now() }, cafe, {
            customers,
            cards,
            hasher,
            logger: consoleLogger,
          }),

        viewCard: (shortCode: string) => viewRegisterCard({ shortCode }, cafe, { cards }),

        /** The camera read a card's QR: the stamp is added by itself (decided on 08/10/2026). */
        stampScanned: (code: string, scanId: string) =>
          stampScannedCard(
            { code, scanId, staffId: member.id, at: clock.now() },
            cafe,
            registerDeps,
          ),

        /** Sumar sello or Canjear premio on the card at the version the barista saw. */
        record: (input: { shortCode: string; type: "stamp" | "redeem"; seenVersion: number }) =>
          recordOnCard({ ...input, staffId: member.id, at: clock.now() }, cafe, registerDeps),

        undo: (entryId: string) =>
          undoEntry({ entryId, staffId: member.id, at: clock.now() }, cafe, registerDeps),

        viewEntry: (entryId: string) => viewEntry({ entryId }, cafe, { cards }),

        /** Movimientos: the register's history, the manager's. One person's, with memberId. */
        activity: (input: { memberId?: string; pages?: number }) =>
          viewActivity({ actor: member, ...input, now: clock.now() }, cafe, { cards, staff }),

        /** Resumen: the Club's numbers between two days ("2026-10-05"), the manager's. */
        summary: (dates: { from: string | null; to: string | null }) =>
          viewSummary({ actor: member, ...dates, now: clock.now() }, cafe, { summary }),

        /** Equipo: the manager's (core/access.ts). For anyone else, the use cases answer "forbidden". */
        team: {
          view: () => viewTeam({ actor: member }, teamDeps),
          viewMember: (memberId: string) =>
            viewTeamMember({ actor: member, memberId, now: clock.now() }, cafe, teamDeps),
          addBarista: (input: { email: string; name: string }) =>
            addBarista({ actor: member, ...input, at: clock.now() }, teamDeps),
          change: (memberId: string, input: { email: string; name: string }) =>
            changeTeamMember({ actor: member, memberId, ...input, at: clock.now() }, teamDeps),
          newPin: (memberId: string) =>
            newPinFor({ actor: member, memberId, at: clock.now() }, teamDeps),
          setActive: (memberId: string, active: boolean) =>
            setActive({ actor: member, memberId, active, at: clock.now() }, teamDeps),
        },
      };
    },

    /** The Set-Cookie that deletes the staff session from this phone (Salir). */
    endStaffSession: () => endSession(request, "staff"),
  };
}
