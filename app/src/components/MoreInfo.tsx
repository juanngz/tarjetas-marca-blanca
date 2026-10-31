// "Más información" for the consent (Ley 25.326), in a sheet that slides up from the bottom (interfaz.md).
// PROVISIONAL TEXT: the final one is pending in the spec (section 6) and in
// ../../../docs/implementacion/datos-personales.md, "Propuesta".
import { useRef } from "react";
import type { Cafe } from "../cafes/types";

export function MoreInfo({ controller, club }: Pick<Cafe, "controller" | "club">) {
  const sheet = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="inline-link" onClick={() => sheet.current?.showModal()}>
        Más información
      </button>
      <dialog ref={sheet} className="sheet" aria-labelledby="more-info-title">
        <h2 id="more-info-title" className="title">
          Tus datos
        </h2>
        <div className="long-text">
          <p>
            Tus datos los guarda {controller.name}, {controller.address}, solo para{" "}
            {club.name.replace(/^El /, "el ")}: para reconocerte, sumar tus sellos y darte tus
            premios.
          </p>
          <p>Tu documento se guarda de una forma que nadie puede leer, ni siquiera en el local.</p>
          <p>
            Cuando quieras, podés pedir ver, corregir o borrar tus datos. Pedíselo al barista en el
            local. Es tu derecho por la Ley 25.326 de protección de datos personales.
          </p>
        </div>
        <form method="dialog">
          <button type="submit" className="button">
            Cerrar
          </button>
        </form>
      </dialog>
    </>
  );
}
