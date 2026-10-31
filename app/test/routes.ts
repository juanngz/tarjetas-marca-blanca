// To test loaders and actions end to end on the server (layer 2), with the test D1.
// Turnstile is replaced in each test with vi.mock: Cloudflare is never asked.
import type { ShouldRevalidateFunction } from "react-router";

export const IN_PROD = "https://club.example.test";

/** Test keys, never the dev or prod ones. */
export const TEST_SECRETS = {
  DNI_HMAC_KEY: "test-key-dni",
  PIN_HMAC_KEY: "test-key-pin",
  CUSTOMER_SESSION_KEY: "test-key-customer-session",
  STAFF_SESSION_KEY: "test-key-staff-session",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
};

/** The context loaders and actions receive, with the test D1 and an attempt cap that lets through. */
function testContext(d1: D1Database, env: Record<string, unknown> = {}) {
  return {
    cloudflare: {
      env: {
        DB: d1,
        ...TEST_SECRETS,
        SIGN_IN_LIMIT: { limit: async () => ({ success: true }) },
        // A failed sign-in at the register doesn't wait its minimum here (platform/app.server.ts).
        TEST_NO_SIGN_IN_WAIT: true,
        ...env,
      },
      ctx: {},
    },
  };
}

/** A loader's or action's arguments. */
export function args(
  request: Request,
  d1: D1Database,
  params: Record<string, string> = {},
  env: Record<string, unknown> = {},
  // biome-ignore lint/suspicious/noExplicitAny: each route has its own argument type; here they're built by hand.
): any {
  return { request, params, context: testContext(d1, env) };
}

export function get(path: string, cookie?: string): Request {
  return new Request(`${IN_PROD}${path}`, { headers: cookie ? { cookie } : {} });
}

/** A submitted form, as the phone sends it. */
export function post(path: string, fields: Record<string, string>, cookie?: string): Request {
  const form = new FormData();
  for (const [field, value] of Object.entries(fields)) form.append(field, value);
  return new Request(`${IN_PROD}${path}`, {
    method: "POST",
    body: form,
    headers: cookie ? { cookie } : {},
  });
}

/** What a loader or action returned, without the data() wrapper. */
export function dataOf<T = Record<string, unknown>>(result: unknown): T {
  if (result && typeof result === "object" && "init" in result && "data" in result) {
    return (result as { data: T }).data;
  }
  return result as T;
}

/** The HTTP status of what an action returned with data(..., { status }). */
export function statusOf(result: unknown): number {
  if (result instanceof Response) return result.status;
  if (result && typeof result === "object" && "init" in result) {
    return (result as { init?: { status?: number } }).init?.status ?? 200;
  }
  return 200;
}

/** The headers of what a loader returned with data(..., { headers }). */
export function headersOf(result: unknown): Headers {
  if (result instanceof Response) return result.headers;
  if (result && typeof result === "object" && "init" in result) {
    return new Headers((result as { init?: { headers?: HeadersInit } }).init?.headers);
  }
  return new Headers();
}

/** Runs something that must redirect (returning or throwing the response) and returns the redirect. */
export async function redirectOf(result: Promise<unknown>): Promise<Response> {
  try {
    const response = await result;
    if (response instanceof Response && response.headers.has("Location")) return response;
  } catch (thrown) {
    if (thrown instanceof Response && thrown.headers.has("Location")) return thrown;
    throw thrown;
  }
  throw new Error("It should have redirected and didn't.");
}

/** The cookie the phone sends on the next request, from a response with Set-Cookie. */
export function cookieOf(response: Response | Headers): string {
  const headers = response instanceof Response ? response.headers : response;
  return (headers.get("Set-Cookie") ?? "").split(";")[0];
}

/** Whether a route asks the server for its data again when going from one URL to another, without a form. */
export function refetches(
  shouldRevalidate: ShouldRevalidateFunction,
  from: string,
  to: string,
): boolean {
  return shouldRevalidate({
    currentUrl: new URL(from, IN_PROD),
    nextUrl: new URL(to, IN_PROD),
    currentParams: {},
    nextParams: {},
    defaultShouldRevalidate: true,
  });
}
