// The invisible anti-bot check (Cloudflare Turnstile). It almost never asks the person anything;
// if needed, it shows up on its own. It adds the cf-turnstile-response field to the form, which the server validates.
// Each token is good for a single submission: when renewOn changes (the form's response), it asks for another.
// Tapping the button before the token is ready doesn't send the form without it: it waits, and goes by itself.
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render(container: HTMLElement, options: Record<string, unknown>): string;
      remove(id: string): void;
    };
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** How long a submission waits for the token. After that it goes anyway, and the server says to try again. */
const MAX_WAIT = 10_000;

let loading: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load Turnstile."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export function Turnstile({ siteKey, renewOn }: { siteKey: string; renewOn?: unknown }) {
  const container = useRef<HTMLDivElement>(null);

  // renewOn isn't used inside: it's there so the widget is rebuilt with each response.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above.
  useEffect(() => {
    const form = container.current?.closest("form");
    let id: string | undefined;
    let current = true;
    // Until there's a token or Turnstile fails, a submission waits.
    let waiting = true;
    let held: { submitter: HTMLElement | null; timer: ReturnType<typeof setTimeout> } | null = null;

    const release = () => {
      waiting = false;
      if (!held) return;
      clearTimeout(held.timer);
      const { submitter } = held;
      held = null;
      form?.requestSubmit(submitter instanceof HTMLButtonElement ? submitter : undefined);
    };

    // A listener on the form itself runs before React's (on the root): React Router's Form sees the
    // submission already stopped and doesn't send it.
    const hold = (event: SubmitEvent) => {
      if (!waiting) return;
      event.preventDefault();
      if (held) clearTimeout(held.timer);
      held = { submitter: event.submitter, timer: setTimeout(release, MAX_WAIT) };
    };
    form?.addEventListener("submit", hold);

    loadTurnstile()
      .then(() => {
        if (!current || !container.current || !window.turnstile) return;
        id = window.turnstile.render(container.current, {
          sitekey: siteKey,
          language: "es",
          appearance: "interaction-only",
          callback: release,
          "error-callback": release,
          // The token lasts 5 minutes: Turnstile asks for another, and until then a submission waits again.
          "expired-callback": () => {
            waiting = true;
          },
        });
      })
      // If it doesn't load, the server doesn't get the token and the screen asks to try again.
      .catch(release);
    return () => {
      current = false;
      form?.removeEventListener("submit", hold);
      if (held) clearTimeout(held.timer);
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, renewOn]);

  return <div ref={container} className="turnstile" />;
}
