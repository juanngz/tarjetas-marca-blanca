// Equipo: the people who use the register, the active ones and the ones who no longer work there in two
// tabs (decided on 08/10/2026), like any list of users: who, their role, and a tap to open them. With a
// bigger team, a field to find someone. The manager adds baristas from here.
import { type CSSProperties, useState } from "react";
import { Link, redirect, useSearchParams } from "react-router";
import { PlusIcon } from "../../components/icons";
import { RegisterBar } from "../../components/RegisterBar";
import type { StaffRole } from "../../core/staff";
import { appFor } from "../../platform/app.server";
import type { Route } from "./+types/route";

export const meta: Route.MetaFunction = () => [{ title: "Equipo · Caja" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  const register = await appFor(request, context.cloudflare).register({
    renew: false,
  });
  if (!register) throw redirect("/register/sign-in");
  const team = await register.team.view();
  if (team.result === "forbidden") throw redirect("/register");
  // Only what the screen shows, and which one is whoever is looking (vos).
  const you = register.member.id;
  const row = ({
    id,
    name,
    email,
    role,
  }: {
    id: string;
    name: string;
    email: string;
    role: StaffRole;
  }) => ({
    id,
    name,
    email,
    role,
    you: id === you,
  });
  return { active: team.active.map(row), inactive: team.inactive.map(row) };
}

const ROLE: Record<StaffRole, string> = { barista: "barista", manager: "gerente" };

type Person = { id: string; name: string; email: string; role: StaffRole; you: boolean };

/** From how many people on a tab the field to find someone shows up. */
const SEARCH_FROM = 6;

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function People({ people, inactive }: { people: Person[]; inactive: boolean }) {
  return (
    <ul className="team-list">
      {people.map((person, index) => (
        <li key={person.id} style={{ "--i": index } as CSSProperties}>
          {/* A whole row is tapped, and looks like it: a box with an arrow, like a button. */}
          <Link
            to={`/register/team/${person.id}`}
            className={`team-row team-row--${person.role}${inactive ? " team-row--inactive" : ""}`}
          >
            <span className="avatar avatar--big" aria-hidden="true">
              {person.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="team-row__text">
              <span className="team-row__name">
                {person.name}
                <span className="visually-hidden"> · </span>
                <span className={`role-chip role-chip--${person.role}`}>{ROLE[person.role]}</span>
                {person.you && <span className="role-chip role-chip--you">vos</span>}
              </span>
              <span className="team-row__email">{person.email}</span>
            </span>
            <svg
              className="team-row__arrow"
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
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function TeamList({ loaderData }: Route.ComponentProps) {
  const { active, inactive } = loaderData;
  const [params] = useSearchParams();
  const showInactive = params.get("show") === "inactive" && inactive.length > 0;
  const shown = showInactive ? inactive : active;
  const [query, setQuery] = useState("");
  const found = query.trim()
    ? shown.filter((p) => plain(`${p.name} ${p.email}`).includes(plain(query.trim())))
    : shown;

  const faces = active.slice(0, 5);
  return (
    <>
      <RegisterBar back="/register" />
      <main className="screen screen--register">
        {/* The team at a glance: their faces, and how many can get in. */}
        <section className="team-hero" aria-labelledby="team-title">
          <div className="team-hero__text">
            <h1 id="team-title" className="team-hero__title">
              Equipo
            </h1>
            <p className="team-hero__summary">
              {active.length} {active.length === 1 ? "activo" : "activos"}
            </p>
            {inactive.length > 0 && <p className="team-hero__more">{inactive.length} de baja</p>}
          </div>
          <div className="faces" aria-hidden="true">
            {faces.map((person) => (
              <span key={person.id} className={`faces__face faces__face--${person.role}`}>
                {person.name.trim().charAt(0).toUpperCase()}
              </span>
            ))}
            {active.length > faces.length && (
              <span className="faces__face faces__face--more">+{active.length - faces.length}</span>
            )}
          </div>
        </section>

        <div className="team-section">
          {/* Two tabs, as links: they work without JavaScript and each has its own address. */}
          {inactive.length > 0 && (
            <nav className="tabs" aria-label="Qué personas ver">
              <Link
                to="."
                replace
                className="tabs__tab"
                aria-current={showInactive ? undefined : "page"}
              >
                Activos <span className="tabs__count">{active.length}</span>
              </Link>
              <Link
                to="?show=inactive"
                replace
                className="tabs__tab"
                aria-current={showInactive ? "page" : undefined}
              >
                De baja <span className="tabs__count">{inactive.length}</span>
              </Link>
            </nav>
          )}

          {shown.length >= SEARCH_FROM && (
            <div className="team-search">
              <label htmlFor="team-search" className="field-label">
                Buscar por nombre o email
              </label>
              <input
                id="team-search"
                type="search"
                className="field"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          )}

          {/* A free place in the team, dashed like an empty card slot: where the next barista goes. */}
          {!showInactive && !query && (
            <Link to="/register/team/new" className="add-tile">
              <span className="add-tile__plus">
                <PlusIcon />
              </span>
              <span className="add-tile__text">Agregar barista</span>
            </Link>
          )}
          {showInactive && (
            <p className="note">No pueden entrar a la caja. Sus sellos siguen a su nombre.</p>
          )}
          <People
            key={showInactive ? "inactive" : "active"}
            people={found}
            inactive={showInactive}
          />
          {found.length === 0 && <p className="note">No hay nadie con ese nombre o email.</p>}
        </div>
      </main>
    </>
  );
}
