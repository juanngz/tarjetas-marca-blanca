// What the person sees when the gate against bots doesn't open. In the café's voice.
import type { GateResult } from "./ports";

export const GATE_MESSAGES: Record<Exclude<GateResult, "open">, string> = {
  "too-many-attempts": "Probá de nuevo en unos minutos.",
  "no-turnstile": "Algo no salió bien. Probá de nuevo.",
};
