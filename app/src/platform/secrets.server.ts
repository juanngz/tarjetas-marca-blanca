// The Worker's secrets. They're read with this validation and not as env.DNI_HMAC_KEY:
// CI has no .dev.vars, so the Env type doesn't include them. See ../../../docs/implementacion/plan.md

export interface Secrets {
  dniHmacKey: string;
  pinHmacKey: string;
  customerSessionKey: string;
  staffSessionKey: string;
  turnstileSecretKey: string;
}

const SECRETS = {
  dniHmacKey: "DNI_HMAC_KEY",
  pinHmacKey: "PIN_HMAC_KEY",
  customerSessionKey: "CUSTOMER_SESSION_KEY",
  staffSessionKey: "STAFF_SESSION_KEY",
  turnstileSecretKey: "TURNSTILE_SECRET_KEY",
} as const;

/** Stops with a clear error if any is missing: without them the app can't work. */
export function readSecrets(env: object): Secrets {
  const values = env as Record<string, unknown>;
  const read = (name: string) => {
    const value = values[name];
    return typeof value === "string" && value !== "" ? value : null;
  };

  const missing = Object.values(SECRETS).filter((name) => read(name) === null);
  if (missing.length > 0) {
    throw new Error(
      `Missing Worker secrets: ${missing.join(", ")}. See docs/implementacion/entorno.md, paso 5.`,
    );
  }
  return {
    dniHmacKey: read(SECRETS.dniHmacKey) as string,
    pinHmacKey: read(SECRETS.pinHmacKey) as string,
    customerSessionKey: read(SECRETS.customerSessionKey) as string,
    staffSessionKey: read(SECRETS.staffSessionKey) as string,
    turnstileSecretKey: read(SECRETS.turnstileSecretKey) as string,
  };
}
