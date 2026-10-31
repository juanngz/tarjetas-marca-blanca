// A sheet that slides up to confirm something that can't be taken back by itself (interfaz.md): a new PIN
// (the one they had stops working) or deactivating someone. It arrives as the action's answer, so it also
// works without JavaScript; Volver goes back to the same screen.
import { type ReactNode, useEffect, useRef } from "react";
import { Form, Link } from "react-router";

export function ConfirmSheet({
  title,
  intent,
  confirm,
  cancelTo,
  danger = false,
  children,
}: {
  title: string;
  /** What the form sends again, now confirmed. */
  intent: string;
  /** The button: verb + thing. */
  confirm: string;
  cancelTo: string;
  /** Red, for what takes someone's access away (Dar de baja). */
  danger?: boolean;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = sheet.current;
    if (!dialog || dialog.matches(":modal")) return;
    // Without JavaScript it arrives open but not modal; with it, it's reopened as a modal sheet.
    if (dialog.open) dialog.close();
    dialog.showModal();
  }, []);

  return (
    <dialog ref={sheet} open className="sheet" aria-labelledby="confirm-title">
      <div className="intro">
        <h2 id="confirm-title" className="title">
          {title}
        </h2>
        {children}
      </div>
      <div className="actions">
        <Form method="post">
          <input type="hidden" name="intent" value={intent} />
          <input type="hidden" name="confirmed" value="yes" />
          <button type="submit" className={danger ? "button button--danger" : "button"}>
            {confirm}
          </button>
        </Form>
        <Link to={cancelTo} replace className="button button--secondary">
          Volver
        </Link>
      </div>
    </dialog>
  );
}
