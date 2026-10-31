// The bar at the top of the register, one slim row: the café's wordmark and who's signed in (Juan), always
// in sight, so nobody serves with the other person's account. On Sumar sello, their name opens a menu with
// Equipo, Movimientos and Resumen (only the manager) and Salir, to change who's at the register (Flujo A). Its color
// says the mode: secundario for a barista, acento for the manager (styles/register.css).
import { useEffect, useRef, useState } from "react";
import { Form, Link, useOutletContext } from "react-router";
import { can } from "../core/access";
import type { StaffRole } from "../core/staff";
import { useBrand } from "./brand";
import { BackIcon, ChartIcon, ChevronDownIcon, ClockIcon, ExitIcon, PersonIcon } from "./icons";

/** What the register layout passes to its screens. */
export interface AtTheRegister {
  member: { name: string; role: StaffRole };
}

/** Who's at the register, for a screen inside the register layout. */
export function useStaffMember() {
  return useOutletContext<AtTheRegister>().member;
}

/** The logo goes back to the start of the register, from any screen: Sumar sello, to scan. */
function Wordmark() {
  const brand = useBrand();
  return (
    <Link to="/register" className="register-bar__home" aria-label="Ir al inicio">
      <img
        className="register-bar__wordmark"
        src="/brand/wordmark-light.svg"
        alt={brand.name}
        width={112}
        height={26}
      />
    </Link>
  );
}

function Who({ name }: { name: string }) {
  return (
    <>
      <span className="avatar" aria-hidden="true">
        {name.trim().charAt(0).toUpperCase()}
      </span>
      <span className="register-bar__name">{name}</span>
    </>
  );
}

/** Whether the browser has menus that open by themselves (popover): Chrome 114 and later, from 2023. */
function hasPopover() {
  return typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;
}

/**
 * Their name, as a button that opens the menu. A native popover: it opens without JavaScript, closes
 * tapping outside or with Escape, and sits above everything, so the bar doesn't cut it.
 * An older phone (a TCL at the café, 11/10/2026) ignores it and left the menu always open: there it opens
 * and closes the same way, with JavaScript, and the CSS keeps it closed until then (register.css).
 */
function StaffMenu({ member }: AtTheRegister) {
  const [native, setNative] = useState(true);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => setNative(hasPopover()), []);

  useEffect(() => {
    if (native || !open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [native, open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="register-bar__who staff-menu__open"
        {...(native
          ? { popoverTarget: "staff-menu" }
          : { onClick: () => setOpen((was) => !was), "aria-expanded": open })}
      >
        <Who name={member.name} />
        <span className="staff-menu__chevron">
          <ChevronDownIcon />
        </span>
      </button>
      <div
        ref={menu}
        id="staff-menu"
        className="staff-menu"
        {...(native ? { popover: "auto" as const } : { hidden: !open })}
      >
        {/* Only the manager has Equipo (core/access.ts); the screens behind it check it again. */}
        {can(member.role, "see-team") && (
          <Link to="/register/team" className="staff-menu__item">
            <PersonIcon />
            Equipo
          </Link>
        )}
        {can(member.role, "see-activity") && (
          <Link to="/register/activity" className="staff-menu__item">
            <ClockIcon />
            Movimientos
          </Link>
        )}
        {can(member.role, "see-summary") && (
          <Link to="/register/summary" className="staff-menu__item">
            <ChartIcon />
            Resumen
          </Link>
        )}
        {/* A whole new page: the next person starts from scratch. No confirmation, to change people quickly. */}
        <Form method="post" action="/register/sign-out" reloadDocument>
          <button type="submit" className="staff-menu__item">
            <ExitIcon />
            Salir
          </button>
        </Form>
      </div>
    </>
  );
}

/**
 * Whether a bar was already on screen in this page. Each screen draws its own: only the first comes in
 * (it slides down when the register opens); changing screens, it's already there (11/10/2026: it seemed
 * to arrive late).
 */
let barShown = false;

/** On Sumar sello: the wordmark and the menu with their name. On the other screens: ← Volver, the wordmark and who. */
export function RegisterBar({ back }: { back?: string }) {
  const member = useStaffMember();
  // Read once, on the first render: the server and the browser draw the first bar the same way.
  const [comesIn] = useState(() => !barShown);
  useEffect(() => {
    barShown = true;
  }, []);

  return (
    <header
      className={`register-bar register-bar--${member.role}${comesIn ? " register-bar--comes-in" : ""}`}
    >
      {/* The café's symbol, cut at the bar's edge; the menu, outside it, isn't. */}
      <span className="register-bar__symbol" aria-hidden="true" />
      <div className="register-bar__inner">
        {back ? (
          <>
            <Link to={back} className="back">
              <BackIcon />
              Volver
            </Link>
            <Wordmark />
            <div className="register-bar__end">
              <p className="register-bar__who">
                <Who name={member.name} />
              </p>
            </div>
          </>
        ) : (
          <>
            <Wordmark />
            <div className="register-bar__end">
              <StaffMenu member={member} />
            </div>
          </>
        )}
      </div>
    </header>
  );
}
