// The PIN the app made up for a barista, shown to the manager only once (decided on 08/10/2026): there's
// no mail to send it, so the manager hands it over in person. After Listo it can't be seen again.
import { Link } from "react-router";
import { CheckIcon } from "./icons";

export function ShownPin({ title, email, pin }: { title: string; email: string; pin: string }) {
  return (
    <main className="screen">
      <div className="intro">
        <span className="done__mark" aria-hidden="true">
          <CheckIcon />
        </span>
        <h1 className="title title--xl">{title}</h1>
        <p>Entra con su email, {email}, y este PIN:</p>
      </div>
      <p className="shown-pin">{pin}</p>
      <p className="note">Pasáselo en persona. No se vuelve a mostrar.</p>
      <Link to="/register/team" className="button">
        Listo
      </Link>
    </main>
  );
}
