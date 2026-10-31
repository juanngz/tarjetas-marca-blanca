// /live/cards/:type: where a customer's code screen opens its WebSocket for the sello en vivo.
// It's handled at the Worker's entry (workers/app.ts), before React Router, which doesn't carry WebSockets.
// Only with the customer's session, only for her own card, and only from the app's own pages.
import { appFor } from "../app.server";
import { listenTo } from "./watchers.server";

const LIVE = /^\/live\/cards\/([a-z-]+)$/;

export function isLiveRequest(request: Request): boolean {
  return LIVE.test(new URL(request.url).pathname);
}

const refuse = (status: number) => new Response(null, { status });

export async function handleLiveRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const type = LIVE.exec(url.pathname)?.[1] ?? "";
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return refuse(426);
  // Another site can't open it with the customer's cookie.
  if (request.headers.get("Origin") !== url.origin) return refuse(403);

  const app = appFor(request, { env });
  const session = await app.readCustomerSession({ renew: false });
  if (!session) return refuse(401);
  const cardId = await app.cardToWatch(session.customerId, type);
  if (!cardId) return refuse(404);
  return listenTo(env.CARD_WATCH, cardId, request);
}
