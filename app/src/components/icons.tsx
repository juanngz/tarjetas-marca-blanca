// The app's icons (marca/interfaz.md): line of 1.5px, round ends, no fill. Always next to a word:
// they never say anything alone.
import type { ReactNode } from "react";

function Icon({ size = 24, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Done: Sello sumado, Premio canjeado; Sumaste un sello, on the customer's card. */
export const CheckIcon = () => (
  <Icon size={28}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M7.5 12.5l3 3 6-6.5" />
  </Icon>
);

/** Deshacer. */
export const UndoIcon = () => (
  <Icon>
    <path d="M9 14L4.5 9.5 9 5" />
    <path d="M4.5 9.5H14a5.5 5.5 0 010 11h-3" />
  </Icon>
);

/** Escanear otra tarjeta. */
export const ScanIcon = () => (
  <Icon size={26}>
    <path d="M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16M4 12h16" />
  </Icon>
);

/** Canjear premio. */
export const GiftIcon = () => (
  <Icon>
    <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
    <path d="M5 12.5v8h14v-8M12 8.5v12M12 8.5c-1.5-3-5-3.5-5-1.25S10 8.5 12 8.5zM12 8.5c1.5-3 5-3.5 5-1.25S14 8.5 12 8.5z" />
  </Icon>
);

/** Ver mi código. */
export const QrIcon = () => (
  <Icon>
    <rect x="4" y="4" width="6" height="6" rx="1" />
    <rect x="14" y="4" width="6" height="6" rx="1" />
    <rect x="4" y="14" width="6" height="6" rx="1" />
    <path d="M14 14h2.5v2.5M20 14v.01M14 20h.01M17 17.5V20h3v-3" />
  </Icon>
);

/** A step forward: Seguir, Entrar. */
export const ArrowIcon = () => (
  <svg
    className="button__arrow"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** Volver: the arrow back, next to the word. */
export const BackIcon = () => (
  <Icon>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);

/** A menu that opens downwards: under who's at the register. */
export const ChevronDownIcon = () => (
  <Icon size={20}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);

/** Salir. */
export const ExitIcon = () => (
  <Icon size={20}>
    <path d="M14 4h4.5A1.5 1.5 0 0120 5.5v13a1.5 1.5 0 01-1.5 1.5H14M10 16l4-4-4-4M14 12H4" />
  </Icon>
);

/** Your data stays with us: the consent. */
export const LockIcon = () => (
  <Icon>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8 10.5V8a4 4 0 018 0v2.5" />
  </Icon>
);

/** A person, at the register. */
export const PersonIcon = () => (
  <Icon>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
  </Icon>
);

/** Movimientos: the register's history, a clock. */
export const ClockIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

/** Resumen: the Club's numbers, three bars. */
export const ChartIcon = () => (
  <Icon>
    <path d="M5 19.5h14" />
    <path d="M7.5 16V11M12 16V6.5M16.5 16v-3" />
  </Icon>
);

/** Search. */
export const SearchIcon = () => (
  <Icon>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </Icon>
);

/** Add someone. */
export const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

/** Generar PIN nuevo, on a person of Equipo. */
export const KeyIcon = () => (
  <Icon>
    <circle cx="8" cy="15" r="4.5" />
    <path d="M11.2 11.8L20 3M16.5 6.5l2.5 2.5M14 9l2 2" />
  </Icon>
);

/** Cambiar nombre o email, on a person of Equipo. */
export const PencilIcon = () => (
  <Icon>
    <path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 013 3L8 18.5 4 20z" />
    <path d="M13.5 7l3 3" />
  </Icon>
);

/** Dar de baja, on a person of Equipo. */
export const PersonOffIcon = () => (
  <Icon>
    <circle cx="10" cy="8" r="3.5" />
    <path d="M3.5 20c.6-3.6 3.2-6 6.5-6 1.4 0 2.6.4 3.6 1.1M16 16l5 5M21 16l-5 5" />
  </Icon>
);

/** Ver el PIN, while it's hidden. */
export const EyeIcon = () => (
  <Icon>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

/** Ocultar el PIN, while it's shown. */
export const EyeOffIcon = () => (
  <Icon>
    <path d="M10.6 5.6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a17 17 0 01-2.6 3.4M6.6 6.6A16.6 16.6 0 002.5 12S6 18.5 12 18.5c1.7 0 3.2-.5 4.5-1.2" />
    <path d="M9.9 9.9a3 3 0 004.2 4.2M3 3l18 18" />
  </Icon>
);
