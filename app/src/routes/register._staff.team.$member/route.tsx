// A person of the team (decided on 08/10/2026), like a user's page in any admin: who and their state on
// top, then what can be done, one row each. The manager makes a barista a new PIN (shown once; the one
// they had stops working and their sessions end), changes their name or email (its own step, ?edit) and
// deactivates or reactivates them. Another manager, or themselves, is only seen: the developers handle
// those with scripts/staff.mjs. Below, the history: who did what and when.
import { data, Form, Link, redirect, useSearchParams } from "react-router";
import { Alert } from "../../components/Alert";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { KeyIcon, PencilIcon, PersonOffIcon } from "../../components/icons";
import { RegisterBar } from "../../components/RegisterBar";
import { ShownPin } from "../../components/ShownPin";
import type { StaffChange, StaffRole } from "../../core/staff";
import { appFor } from "../../platform/app.server";
import { formOf, formText } from "../../web/form";
import type { Route } from "./+types/route";

export const meta: Route.MetaFunction = ({ data: loaded }) => [
  { title: `${loaded?.member.name ?? "Equipo"} · Caja` },
];

const NOT_FOUND = "No encontramos a esa persona.";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const register = await appFor(request, context.cloudflare).register({
    renew: false,
  });
  if (!register) throw redirect("/register/sign-in");
  const view = await register.team.viewMember(params.member);
  if (view.result === "forbidden") throw redirect("/register");
  if (view.result === "not-found") throw data(NOT_FOUND, { status: 404 });
  const { id, name, email, role, deactivatedAt } = view.member;
  return {
    member: { id, name, email, role, active: !deactivatedAt },
    canChange: view.canChange,
    history: view.history.map(({ change, when, byName }) => ({ change, when, byName })),
  };
}

const FORBIDDEN = "Solo el gerente cambia a los baristas.";

/** What every change answers when it can't be made: not the manager (403), or nobody with that id (404). */
function refuseUnless<T extends { result: string }>(
  outcome: T,
): asserts outcome is Exclude<T, { result: "forbidden" } | { result: "not-found" }> {
  if (outcome.result === "forbidden") throw data(FORBIDDEN, { status: 403 });
  if (outcome.result === "not-found") throw data(NOT_FOUND, { status: 404 });
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const register = await appFor(request, context.cloudflare).register({
    renew: false,
  });
  if (!register) throw redirect("/register/sign-in");
  const form = await formOf(request);
  const intent = formText(form, "intent");
  const confirmed = formText(form, "confirmed") === "yes";
  const { team } = register;

  if (intent === "save") {
    const typed = { email: formText(form, "email") ?? "", name: formText(form, "name") ?? "" };
    const outcome = await team.change(params.member, typed);
    refuseUnless(outcome);
    if (outcome.result === "error") {
      return data(
        { kind: "mistake" as const, error: outcome.message, field: outcome.field, ...typed },
        { status: 400 },
      );
    }
    return { kind: "saved" as const };
  }

  if (intent === "new-pin" || intent === "deactivate") {
    // First the sheet to confirm; with it confirmed, it's done.
    if (!confirmed) return { kind: "confirm" as const, confirm: intent };
    if (intent === "deactivate") {
      const outcome = await team.setActive(params.member, false);
      refuseUnless(outcome);
      return { kind: "deactivated" as const };
    }
    const outcome = await team.newPin(params.member);
    refuseUnless(outcome);
    if (outcome.result === "inactive") {
      return data(
        { kind: "error" as const, error: "Está de baja: primero volvé a activarla." },
        { status: 409 },
      );
    }
    const { name, email, pin } = outcome;
    return { kind: "new-pin" as const, name, email, pin };
  }

  if (intent === "reactivate") {
    const outcome = await team.setActive(params.member, true);
    refuseUnless(outcome);
    return { kind: "reactivated" as const };
  }

  return data(
    { kind: "error" as const, error: "Algo no salió bien. Probá de nuevo." },
    { status: 400 },
  );
}

const ROLE: Record<StaffRole, string> = { barista: "barista", manager: "gerente" };

/** What was done, in words: "Se generó un PIN nuevo". */
const CHANGES: Record<StaffChange, string> = {
  added: "Se dio de alta",
  "name-changed": "Se cambió el nombre",
  "email-changed": "Se cambió el email",
  "pin-reset": "Se generó un PIN nuevo",
  deactivated: "Se dio de baja",
  reactivated: "Se volvió a activar",
};

function Chevron() {
  return (
    <svg
      className="action-row__arrow"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function TeamMember({ loaderData, actionData }: Route.ComponentProps) {
  const { member, canChange, history } = loaderData;
  const [params] = useSearchParams();
  if (actionData?.kind === "new-pin") {
    const { name, email, pin } = actionData;
    return <ShownPin title={`PIN nuevo para ${name}`} email={email} pin={pin} />;
  }
  const mistake = actionData?.kind === "mistake" ? actionData : undefined;
  const saved = actionData?.kind === "saved";
  // Editing is its own step; once saved, back to the person.
  const editing = canChange && member.active && !saved && (params.has("edit") || Boolean(mistake));
  const field = mistake?.field;
  const error = actionData?.kind === "error" ? actionData.error : undefined;
  const confirm = actionData?.kind === "confirm" ? actionData.confirm : undefined;
  const here = `/register/team/${member.id}`;

  if (editing) {
    return (
      <>
        <RegisterBar back={here} />
        <main className="screen screen--register">
          <div className="intro">
            <p className="eyebrow">{member.name}</p>
            <h1 className="title">Cambiar nombre o email</h1>
          </div>
          <Form method="post" className="form" noValidate>
            <input type="hidden" name="intent" value="save" />
            <label htmlFor="name" className="field-label">
              Su nombre
            </label>
            <input
              id="name"
              name="name"
              className="field"
              autoComplete="off"
              autoCapitalize="words"
              defaultValue={mistake?.name ?? member.name}
              aria-invalid={field === "name" ? true : undefined}
              aria-describedby={field === "name" ? "save-error" : undefined}
            />
            {mistake && field === "name" && <Alert id="save-error">{mistake.error}</Alert>}
            <label htmlFor="email" className="field-label">
              Su email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="field"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              defaultValue={mistake?.email ?? member.email}
              aria-invalid={field === "email" ? true : undefined}
              aria-describedby={field === "email" ? "save-error" : undefined}
            />
            {/* Next to what it's about: the name above, the email (or anything else) here. */}
            {mistake && field !== "name" && <Alert id="save-error">{mistake.error}</Alert>}
            <button type="submit" className="button button--register">
              Guardar cambios
            </button>
          </Form>
          <Link to={here} className="inline-link inline-link--center">
            Cancelar
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <RegisterBar back="/register/team" />
      <main className="screen screen--register">
        {/* Who, at a glance: their initial in their role's color, their role and whether they're De baja. */}
        <section
          className={`person-card person-card--${member.role}${member.active ? "" : " person-card--inactive"}`}
        >
          <span className="avatar person-card__avatar" aria-hidden="true">
            {member.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="person-card__text">
            <h1 className="title">{member.name}</h1>
            <p className="person-card__chips">
              <span className={`role-chip role-chip--${member.role}`}>{ROLE[member.role]}</span>
              {!member.active && <span className="state-chip state-chip--off">De baja</span>}
            </p>
            <p className="person-card__email">{member.email}</p>
          </div>
        </section>

        {!member.active && (
          <Alert tone="info">
            Está de baja: no puede entrar a la caja. Sus sellos siguen a su nombre.
          </Alert>
        )}
        {saved && <Alert tone="info">Cambios guardados.</Alert>}
        {error && <Alert>{error}</Alert>}

        {canChange && member.active && (
          <ul className="action-list">
            <li>
              <Form method="post">
                <input type="hidden" name="intent" value="new-pin" />
                <button type="submit" className="action-row">
                  <span className="action-row__icon">
                    <KeyIcon />
                  </span>
                  <span className="action-row__text">
                    Generar PIN nuevo
                    <span className="action-row__hint">Si se olvidó el suyo</span>
                  </span>
                  <Chevron />
                </button>
              </Form>
            </li>
            <li>
              <Link to="?edit" className="action-row">
                <span className="action-row__icon">
                  <PencilIcon />
                </span>
                <span className="action-row__text">Cambiar nombre o email</span>
                <Chevron />
              </Link>
            </li>
            <li>
              <Form method="post">
                <input type="hidden" name="intent" value="deactivate" />
                <button type="submit" className="action-row action-row--danger">
                  <span className="action-row__icon">
                    <PersonOffIcon />
                  </span>
                  <span className="action-row__text">
                    Dar de baja
                    <span className="action-row__hint">Si ya no trabaja en el local</span>
                  </span>
                  <Chevron />
                </button>
              </Form>
            </li>
          </ul>
        )}

        {canChange && !member.active && (
          <Form method="post" className="actions">
            <input type="hidden" name="intent" value="reactivate" />
            <button type="submit" className="button button--register">
              Volver a activar
            </button>
          </Form>
        )}

        {history.length > 0 && (
          <section className="team-section" aria-labelledby="history-title">
            <h2 id="history-title" className="subtitle">
              Historial
            </h2>
            <ol className="timeline">
              {history.map((line) => (
                <li
                  key={`${line.change}-${line.when}`}
                  className={`timeline__item timeline__item--${line.change}`}
                >
                  <span className="timeline__what">{CHANGES[line.change]}</span>
                  <span className="timeline__when">
                    {line.when}
                    {line.byName ? ` · por ${line.byName}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {confirm === "new-pin" && (
          <ConfirmSheet
            title={`¿Generar un PIN nuevo para ${member.name}?`}
            intent="new-pin"
            confirm="Generar PIN nuevo"
            cancelTo={here}
          >
            <p>El que tiene deja de servir y se le cierra la caja en su celular.</p>
          </ConfirmSheet>
        )}
        {confirm === "deactivate" && (
          <ConfirmSheet
            title={`¿Dar de baja a ${member.name}?`}
            intent="deactivate"
            confirm="Dar de baja"
            cancelTo={here}
          >
            <p>Ya no va a poder entrar a la caja. Sus sellos siguen a su nombre.</p>
          </ConfirmSheet>
        )}
      </main>
    </>
  );
}
