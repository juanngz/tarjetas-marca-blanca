// Asks Cloudflare whether the form's Turnstile is valid. Without it there's no sign-up or sign-in.
// Locally and in tests the test key is used, which always lets through (.dev.vars.example).
// When it doesn't pass, the log says why (never the token), so "Algo no salió bien" can be explained.
import { log as platformLog } from "../log.server";

const VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;
type Log = (event: string, data: Record<string, unknown>) => void;

export async function turnstileValid(
  token: string | null | undefined,
  options: { secret: string; ip?: string | null; fetch?: Fetch; log?: Log },
): Promise<boolean> {
  const log = options.log ?? platformLog;
  const rejected = (data: Record<string, unknown>) => {
    log("turnstile-rejected", data);
    return false;
  };
  if (!token) return rejected({ reason: "no-token" });

  const form = new FormData();
  form.append("secret", options.secret);
  form.append("response", token);
  if (options.ip) form.append("remoteip", options.ip);

  const doFetch: Fetch = options.fetch ?? fetch;
  try {
    const response = await doFetch(VERIFY, { method: "POST", body: form });
    if (!response.ok) return rejected({ reason: `http-${response.status}` });
    const result = (await response.json()) as { success?: unknown; "error-codes"?: unknown };
    if (result.success === true) return true;
    return rejected({ reason: "cloudflare-said-no", codes: result["error-codes"] });
  } catch {
    // If it can't ask, it doesn't let through.
    return rejected({ reason: "unreachable" });
  }
}
