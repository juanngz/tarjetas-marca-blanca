// Use case: sign up (Flujo 1). Confirm the document, ask for the name and the consent, and sign up
// the customer with the café's cards and their session.
import type { Cafe } from "../cafes/types";
import { validateName } from "../core/customerName";
import { type DocumentType, documentTypeFrom, validateDocument } from "../core/document";
import { GATE_MESSAGES } from "./gateMessages";
import type {
  BotGate,
  Clock,
  CodeGenerator,
  CustomerRepository,
  DocumentHasher,
  GateResult,
  Logger,
  SessionIssuer,
} from "./ports";

export interface SignUpInput {
  /** "sign-up" to sign up; anything else only asks for the name (coming from the confirmation). */
  step: string | null;
  type: string | null;
  /** Comes from the previous screen: it's validated again, in case it was changed. */
  number: string;
  name: string;
  consent: string | null;
  turnstileToken: string | null;
}

export interface SignUpDeps {
  customers: CustomerRepository;
  hasher: DocumentHasher;
  gate: BotGate;
  sessions: SessionIssuer;
  codes: CodeGenerator;
  clock: Clock;
  logger: Logger;
}

export type SignUpResult =
  | { result: "start-over" }
  | {
      result: "ask-name";
      type: DocumentType;
      number: string;
      name: string;
      /** null the first time, when it only asks for the name. */
      error: {
        reason: "invalid-name" | "no-consent" | Exclude<GateResult, "open">;
        /** In the café's voice. */
        message: string;
      } | null;
    }
  | { result: "signed-up"; cookie: string }
  | { result: "already-signed-up"; cookie: string };

const NO_CONSENT = "Para anotarte, marcá que estás de acuerdo.";

/** If the random codes collide with others already stored, it tries other ones. */
const CODE_ATTEMPTS = 3;

export async function signUp(
  input: SignUpInput,
  cafe: Cafe,
  deps: SignUpDeps,
): Promise<SignUpResult> {
  const type = documentTypeFrom(input.type);
  const document = validateDocument(type, input.number);
  if (!document.ok) return { result: "start-over" };

  const askName = (
    error: Extract<SignUpResult, { result: "ask-name" }>["error"],
  ): SignUpResult => ({
    result: "ask-name",
    type,
    number: document.number,
    name: input.name,
    error,
  });

  if (input.step !== "sign-up") return askName(null);

  const name = validateName(input.name);
  if (!name.ok) return askName({ reason: "invalid-name", message: name.message });
  if (input.consent !== "yes") return askName({ reason: "no-consent", message: NO_CONSENT });

  const gate = await deps.gate.check(input.turnstileToken);
  if (gate !== "open") return askName({ reason: gate, message: GATE_MESSAGES[gate] });

  const dniHmac = await deps.hasher.hmac(type, document.number);

  // If they were already signed up (for example, they tapped Anotarme twice), they get into their account.
  const existing = await deps.customers.findByDniHmac(dniHmac);
  if (existing)
    return {
      result: "already-signed-up",
      cookie: await deps.sessions.startCustomerSession(existing.id),
    };

  for (let attempt = 1; attempt <= CODE_ATTEMPTS; attempt++) {
    const customer = {
      id: crypto.randomUUID(),
      name: name.name,
      createdAt: deps.clock.now(),
      dniHmac,
    };
    const cards = cafe.cards.map((card) => ({
      type: card.type,
      qrCode: deps.codes.qrCode(),
      shortCode: deps.codes.shortCode(),
    }));
    try {
      await deps.customers.createWithCards(customer, cards);
      deps.logger.log("customer-signed-up", { cards: cards.length });
      return { result: "signed-up", cookie: await deps.sessions.startCustomerSession(customer.id) };
    } catch (error) {
      // Another request signed them up at the same time: they get into that account.
      const signedUp = await deps.customers.findByDniHmac(dniHmac);
      if (signedUp)
        return {
          result: "already-signed-up",
          cookie: await deps.sessions.startCustomerSession(signedUp.id),
        };
      if (attempt === CODE_ATTEMPTS) throw error;
    }
  }
  throw new Error("Couldn't sign up the customer.");
}
