// The sello en vivo: one Durable Object per card, holding the WebSockets of that card's open code screens.
// When the register records something, it tells this object and the object tells the screens.
// It stores nothing (no name, no document): only the open connections, and only while they're open.
// With the WebSocket Hibernation API, an open connection that's quiet costs nothing.
// Only workers/app.ts imports this file: it needs the Workers runtime (cloudflare:workers).
import { DurableObject } from "cloudflare:workers";
import type { CardChange } from "../../application/ports";

export class CardWatch extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // The screens send "ping" every so often so the phone's network doesn't drop the connection;
    // answered without waking the object up.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  /** A code screen starts listening. The Worker already checked it's the card's owner. */
  async fetch(): Promise<Response> {
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Tells every open screen of this card what happened. */
  notify(change: CardChange): void {
    const message = JSON.stringify(change);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(message);
      } catch {
        // A screen that closed in the meantime: it catches up when it comes back.
      }
    }
  }
}
