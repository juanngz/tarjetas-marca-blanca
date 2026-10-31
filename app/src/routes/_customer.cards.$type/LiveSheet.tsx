// The festejo (Flujo 4 of the customer flows): what the customer sees when the register stamps the reward's
// slot, the last one, and the card is complete (18/10/2026): "¡Completaste la tarjeta! Este café va por cuenta
// de la casa." A sheet over the code, with Seguir to close it. It's the only moment that's celebrated: the
// reward's drawing appears in 480ms (movimiento.md). The stamp before it only lights the slot.
import { useEffect, useRef } from "react";
import { drawing } from "../../components/Card";
import { keepTogether } from "../../components/text";
import type { DisplayCard } from "../../core/displayCard";

export function LiveSheet({
  card,
  celebration,
  rewardRedeemed,
  onClose,
}: {
  card: DisplayCard;
  /** "¡Completaste la tarjeta!" */
  celebration: string;
  /** "Este café va por cuenta de la casa. Que lo disfrutes, Marta." */
  rewardRedeemed: string;
  onClose: () => void;
}) {
  const sheet = useRef<HTMLDialogElement>(null);
  // It opens by itself, without a tap: the focus goes to the sheet (the screen reader reads its title),
  // not to Seguir, which would show the keyboard's ring as if someone had tabbed to it.
  useEffect(() => {
    const dialog = sheet.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    dialog.focus();
  }, []);

  return (
    <dialog
      ref={sheet}
      className="sheet"
      aria-labelledby="live-title"
      tabIndex={-1}
      onClose={onClose}
    >
      <div className={`celebration color-${card.color}`}>
        <img src={drawing(card, "ready")} alt="" width={80} height={120} />
      </div>
      <div className="intro intro--centered">
        <h2 id="live-title" className="title">
          {celebration}
        </h2>
        <p>{keepTogether(rewardRedeemed)}</p>
      </div>
      <form method="dialog">
        <button type="submit" className="button">
          Seguir
        </button>
      </form>
    </dialog>
  );
}
