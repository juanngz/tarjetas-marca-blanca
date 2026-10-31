// The sello en vivo on a card's screens (decided on 07/10/2026: in real time). While the screen is in sight,
// a WebSocket stays open to its card's CardWatch (platform/live/). When the phone hides the screen
// (locked, another app), it's closed; when it comes back, it reconnects and catches up with what it missed.
import { useEffect, useRef } from "react";
import type { CardChange } from "../../application/ports";

/** The phone's network drops a quiet connection: a ping now and then keeps it open. */
const PING_EVERY = 25_000;
/** Waiting before reconnecting, longer each time it fails in a row. */
const RETRY_AFTER = [1_000, 2_000, 5_000, 10_000];

export function useLiveCard(
  type: string,
  handlers: {
    /** Something happened on the card. */
    onChange: (change: CardChange) => void;
    /** It reconnected: something may have happened meanwhile. */
    onReconnect: () => void;
    /**
     * The screen shows what the phone kept, without a connection: when it connects, it's behind too. Read
     * when it opens, not when the screen mounts: the copy can turn out to be behind later (the server's
     * answer failed while the screen was already shown).
     */
    behind?: boolean;
  },
) {
  const latest = useRef(handlers);
  latest.current = handlers;
  const open = useRef(false);

  useEffect(() => {
    const url = new URL(`/live/cards/${type}`, window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    let socket: WebSocket | null = null;
    let ping: number | undefined;
    let retry: number | undefined;
    let failures = 0;
    let connectedBefore = false;
    let stopped = false;

    const connect = () => {
      window.clearTimeout(retry);
      if (stopped || socket || document.visibilityState !== "visible") return;
      const current = new WebSocket(url);
      socket = current;
      current.onopen = () => {
        failures = 0;
        open.current = true;
        if (connectedBefore || latest.current.behind) latest.current.onReconnect();
        connectedBefore = true;
        ping = window.setInterval(() => current.send("ping"), PING_EVERY);
      };
      current.onmessage = ({ data }) => {
        if (data === "pong") return;
        try {
          latest.current.onChange(JSON.parse(String(data)) as CardChange);
        } catch {
          // Not a change: ignored.
        }
      };
      current.onclose = () => {
        window.clearInterval(ping);
        if (socket === current) {
          socket = null;
          open.current = false;
        }
        if (stopped) return;
        retry = window.setTimeout(connect, RETRY_AFTER[Math.min(failures, RETRY_AFTER.length - 1)]);
        failures += 1;
      };
    };

    const followVisibility = () => {
      if (document.visibilityState === "visible") connect();
      else socket?.close();
    };

    connect();
    document.addEventListener("visibilitychange", followVisibility);
    window.addEventListener("online", connect);
    return () => {
      stopped = true;
      window.clearTimeout(retry);
      window.clearInterval(ping);
      document.removeEventListener("visibilitychange", followVisibility);
      window.removeEventListener("online", connect);
      socket?.close();
      open.current = false;
    };
  }, [type]);

  // Behind while it's already connected: it catches up now, it won't open again to do it.
  const behind = handlers.behind ?? false;
  useEffect(() => {
    if (behind && open.current) latest.current.onReconnect();
  }, [behind]);
}
