// The confirmation of what the register did, in a sheet over the screen: on Sumar sello's (08/10/2026) and on
// a card's (11/10/2026). The barista doesn't change screens. The X at the top right closes it; Escanear otra
// tarjeta starts the register again. Deshacer works inside it, and its confirmation shows in the same sheet.
// Without JavaScript it arrives open, and both go back to the register.
import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import { Alert } from "./Alert";
import { ScanIcon, UndoIcon } from "./icons";
import { OFFLINE_MESSAGE } from "./OfflineNotice";
import { ReceiptBody, type ShownReceipt } from "./ReceiptBody";

/** What the sheet shows: a confirmation, and its entry, to undo it from there. */
type Receipt = ShownReceipt & { id: string };

type UndoAnswer = { done: Receipt } | { error: string } | { offline: true };

export function DoneSheet({
  receipt,
  onClosed,
}: {
  receipt: Receipt;
  /** Once it's closed: the screen under it can bring itself up to date. */
  onClosed?: () => void;
}) {
  const sheet = useRef<HTMLDialogElement>(null);
  const [closed, setClosed] = useState(false);
  const closedOnce = useRef(onClosed);
  closedOnce.current = onClosed;
  useEffect(() => {
    if (closed) closedOnce.current?.();
  }, [closed]);
  const undo = useFetcher<UndoAnswer>();
  const answer = undo.data;
  const shown = answer && "done" in answer ? answer.done : receipt;
  const error =
    answer && "offline" in answer
      ? OFFLINE_MESSAGE
      : answer && "error" in answer
        ? answer.error
        : undefined;

  useEffect(() => {
    const dialog = sheet.current;
    if (!dialog || dialog.matches(":modal")) return;
    // Without JavaScript it arrives open but not modal; with it, it's reopened as a modal sheet.
    if (dialog.open) dialog.close();
    dialog.showModal();
  }, []);

  if (closed) return null;
  const close = () => {
    sheet.current?.close();
    setClosed(true);
  };

  return (
    <dialog
      ref={sheet}
      open
      className="sheet sheet--done"
      aria-labelledby="done-title"
      // Reopening it as a modal fires a close too, after it's open again: only a real close counts.
      onClose={() => {
        if (!sheet.current?.open) setClosed(true);
      }}
    >
      {/* Without JavaScript, a link back to the register; with it, it only closes the sheet. */}
      <Link
        to="/register"
        className="sheet__close"
        aria-label="Cerrar"
        onClick={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </Link>
      <div className="done">
        <ReceiptBody
          receipt={shown}
          titleId="done-title"
          Heading="h2"
          undo={
            <undo.Form method="post" action={`/register/done/${shown.id}`}>
              <input type="hidden" name="intent" value="undo" />
              <input type="hidden" name="in" value="sheet" />
              <button
                type="submit"
                className="inline-link inline-link--undo"
                disabled={undo.state !== "idle"}
              >
                <UndoIcon />
                Deshacer
              </button>
            </undo.Form>
          }
        />
        {error && <Alert>{error}</Alert>}
      </div>
      <div className="actions">
        <Link to="/register" className="button button--register">
          <ScanIcon />
          Escanear otra tarjeta
        </Link>
      </div>
    </dialog>
  );
}
