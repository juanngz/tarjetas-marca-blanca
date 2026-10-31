// BotGate (application/ports.ts): the attempt cap per connection and Turnstile, in that order.
// The messages the person sees are in application/gate.ts.
import type { BotGate } from "../../application/ports";
import { type Limiter, withinLimit } from "./rateLimit.server";
import { turnstileValid } from "./turnstile.server";

export function turnstileBotGate(
  request: Request,
  options: {
    turnstileSecret: string;
    limiter?: Limiter;
  },
): BotGate {
  return {
    async check(token) {
      if (!(await withinLimit(options.limiter, request))) return "too-many-attempts";
      const valid = await turnstileValid(token, {
        secret: options.turnstileSecret,
        ip: request.headers.get("CF-Connecting-IP"),
      });
      return valid ? "open" : "no-turnstile";
    },
  };
}
