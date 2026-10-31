// HMAC-SHA256 with a secret key, using Web Crypto (available in Workers and in Node).
// The key is used as is, as text: the one from Bitwarden, not decoded.

const encoder = new TextEncoder();

function importKey(secret: string, usage: "sign" | "verify") {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** null if it isn't the 32 bytes of an HMAC-SHA256 in hex. */
function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-f]{64}$/.test(hex)) return null;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export async function hmac(secret: string, message: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await importKey(secret, "sign"),
    encoder.encode(message),
  );
  return toHex(new Uint8Array(signature));
}

/** Compares in constant time (Web Crypto does it), so the timing gives nothing away. */
export async function hmacMatches(
  secret: string,
  message: string,
  stored: string,
): Promise<boolean> {
  const signature = fromHex(stored);
  if (!signature) return false;
  return crypto.subtle.verify(
    "HMAC",
    await importKey(secret, "verify"),
    signature,
    encoder.encode(message),
  );
}
