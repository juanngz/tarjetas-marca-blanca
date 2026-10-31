// Cap on document attempts per connection, with Workers Rate Limiting (SIGN_IN_LIMIT in wrangler.jsonc).
// It's a second brake against bots, after Turnstile. The cap is high on purpose:
// customers who sign up at the café share the WiFi, and therefore the connection.

export interface Limiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export async function withinLimit(
  limiter: Limiter | undefined,
  request: Request,
): Promise<boolean> {
  // Without the binding (misconfigured) nobody is stopped: Turnstile still guards the gate.
  if (!limiter) return true;
  const connection = request.headers.get("CF-Connecting-IP") ?? "no-connection";
  const { success } = await limiter.limit({ key: connection });
  return success;
}
