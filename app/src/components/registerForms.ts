// What the register's forms share. Never a disabled button (interfaz.md): a tap while the first one is still
// on its way is ignored, and the server doesn't record twice anyway (the version the barista saw).
import type { FormEvent } from "react";
import { useNavigation } from "react-router";

export function useIgnoreRepeatedTaps() {
  const busy = useNavigation().state !== "idle";
  return (event: FormEvent<HTMLFormElement>) => {
    if (busy) event.preventDefault();
  };
}

/** What a form on its way looks like (React Router's navigation). */
interface OnItsWay {
  state: "idle" | "loading" | "submitting";
  formData?: FormData;
}

/** Whether the form with these fields is the one on its way. */
export function isSending(navigation: OnItsWay, fields: Record<string, string>): boolean {
  const sent = navigation.formData;
  if (navigation.state !== "submitting" || !sent) return false;
  return Object.entries(fields).every(([name, value]) => sent.get(name) === value);
}

/**
 * Whether this form is on its way: its button says so at once (Sumando…), before the server answers. The
 * database is in the EU: without it, a tap seems to do nothing for a moment.
 */
export function useSending(fields: Record<string, string>): boolean {
  return isSending(useNavigation(), fields);
}
