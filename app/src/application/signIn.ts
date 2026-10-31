// Use case: sign in with the document (Flujo 1). If they're already in the Club, they're in;
// if they're new, they're asked to confirm the number before signing up.
import { type DocumentType, documentTypeFrom, validateDocument } from "../core/document";
import { GATE_MESSAGES } from "./gateMessages";
import type {
  BotGate,
  CustomerRepository,
  DocumentHasher,
  GateResult,
  SessionIssuer,
} from "./ports";

export interface SignInInput {
  /** "other" for another document; anything else counts as a DNI. */
  type: string | null;
  document: string;
  turnstileToken: string | null;
}

export interface SignInDeps {
  customers: CustomerRepository;
  hasher: DocumentHasher;
  gate: BotGate;
  sessions: SessionIssuer;
}

export type SignInResult =
  | {
      result: "error";
      reason: "invalid-document" | Exclude<GateResult, "open">;
      /** In the café's voice. */
      message: string;
      type: DocumentType;
      /** What they typed, to fix it. */
      text: string;
    }
  | { result: "signed-in"; cookie: string }
  | { result: "new"; type: DocumentType; number: string };

export async function signIn(input: SignInInput, deps: SignInDeps): Promise<SignInResult> {
  const type = documentTypeFrom(input.type);
  const text = input.document;

  const document = validateDocument(type, text);
  if (!document.ok) {
    return { result: "error", reason: "invalid-document", message: document.message, type, text };
  }

  const gate = await deps.gate.check(input.turnstileToken);
  if (gate !== "open") {
    return { result: "error", reason: gate, message: GATE_MESSAGES[gate], type, text };
  }

  const dniHmac = await deps.hasher.hmac(type, document.number);
  const customer = await deps.customers.findByDniHmac(dniHmac);
  if (!customer) return { result: "new", type, number: document.number };

  return { result: "signed-in", cookie: await deps.sessions.startCustomerSession(customer.id) };
}
