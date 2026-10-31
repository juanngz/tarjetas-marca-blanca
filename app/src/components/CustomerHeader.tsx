// The café's banner on the customer's screens with a session: the logo, which goes back to the start
// (the wallet), and Salir (only in the wallet). It stays at the top while scrolling, frosted (base.css, .header).
// Salir opens a sheet over the wallet to confirm (Flujo 5): three cards slip into a pocket, so it's
// clear at a glance that nothing is lost. Without JavaScript the link goes to /sign-out, the same question
// on its own screen.
import { type MouseEvent, type ReactNode, type RefObject, useRef } from "react";
import { Form, Link } from "react-router";
import { useBrand } from "./brand";
import { ExitIcon } from "./icons";

export function CustomerHeader({ signOut = true }: { signOut?: boolean }) {
  const brand = useBrand();
  const sheet = useRef<HTMLDialogElement>(null);
  const openSheet = (event: MouseEvent) => {
    if (!sheet.current) return;
    event.preventDefault();
    sheet.current.showModal();
  };
  return (
    <header className="header">
      <div className="header__inner">
        <Link to="/cards" className="header__home" aria-label="Ir al inicio">
          <img src="/brand/logo.svg" alt={brand.name} width={178} height={49} />
        </Link>
        {signOut && (
          <Link to="/sign-out" className="header-action" onClick={openSheet}>
            <ExitIcon />
            Salir
          </Link>
        )}
      </div>
      {signOut && <SignOutSheet sheet={sheet} />}
    </header>
  );
}

function SignOutSheet({ sheet }: { sheet: RefObject<HTMLDialogElement | null> }) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard closes a modal dialog with Escape; the click is only for the darkened screen.
    <dialog
      ref={sheet}
      className="sheet sheet--sign-out"
      aria-labelledby="sign-out-title"
      // A tap on the darkened screen around it closes it, like Seguir en mis tarjetas.
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <SignOutQuestion headingId="sign-out-title">
        <form method="dialog" className="sign-out__stay">
          <button type="submit" className="button button--secondary">
            Seguir en mis tarjetas
          </button>
        </form>
      </SignOutQuestion>
    </dialog>
  );
}

/** The question, the same in the sheet and on /sign-out: the pocket, the words and the two ways. */
export function SignOutQuestion({
  headingId,
  headingLevel = 2,
  children,
}: {
  headingId: string;
  headingLevel?: 1 | 2;
  /** The way to stay: closing the sheet, or a link back to the cards. */
  children: ReactNode;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className="sign-out">
      {/* Three cards going into a pocket: they stay saved. Only to look at. */}
      <div className="pocket" aria-hidden="true">
        <span className="pocket__card color-1" />
        <span className="pocket__card color-2" />
        <span className="pocket__card color-3" />
        <span className="pocket__sleeve">
          <img src="/brand/symbol.svg" alt="" width={44} height={44} />
        </span>
      </div>
      <div className="intro intro--centered">
        <Heading id={headingId} className="title">
          ¿Salir?
        </Heading>
        <p>
          Tus tarjetas y tus sellos quedan guardados. Para volver a entrar, solo te pedimos tu
          documento.
        </p>
      </div>
      <div className="actions">
        <Form method="post" action="/sign-out">
          <button type="submit" className="button button--danger">
            <ExitIcon />
            Salir
          </button>
        </Form>
        {children}
      </div>
    </div>
  );
}
