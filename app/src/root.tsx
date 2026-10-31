import type { ReactNode } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";
import type { Route } from "./+types/root";
import { brandOf, useBrandIfLoaded } from "./components/brand";
import { appFor } from "./platform/app.server";
import { THEME_COLOR } from "./styles/theme";
import { useServiceWorker } from "./web/sw/phone";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/cards.css";
import "./styles/register.css";

/** The café's name and its Club, for every screen (components/brand.ts). The same for the whole visit. */
export function loader({ request, context }: Route.LoaderArgs) {
  return { brand: brandOf(appFor(request, context.cloudflare).cafe) };
}

export const shouldRevalidate = () => false;

export function Layout({ children }: { children: ReactNode }) {
  // The app saved on the home screen is the customer's: the register's screens don't offer it, so a
  // barista's phone never saves the register as the customer's app (and nothing is kept there).
  const { pathname } = useLocation();
  const customer = !pathname.startsWith("/register");
  const brand = useBrandIfLoaded();
  useServiceWorker(customer);
  return (
    <html lang="es-AR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content={THEME_COLOR} />
        {/* Only the light theme, even on a phone in dark mode: without this, some browsers (Samsung Internet, Chrome)
            darken the page on their own and the QR comes out grey on black (23/10/2026). */}
        <meta name="color-scheme" content="only light" />
        {/* The same for Dark Reader, the extension that darkens pages (also on Android browsers). */}
        <meta name="darkreader-lock" />
        <meta name="robots" content="noindex" />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        {customer && (
          <>
            <link rel="manifest" href="/manifest.webmanifest" />
            {/* iPhone: the name under the icon, and without Safari's bar (older iOS don't read the manifest). */}
            {brand && <meta name="apple-mobile-web-app-title" content={brand.name} />}
            <meta name="apple-mobile-web-app-capable" content="yes" />
          </>
        )}
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  // A screen can say what wasn't found ("Esta tarjeta no existe."); otherwise, the page.
  const missing =
    notFound && typeof error.data === "string" ? error.data : "Esta página no existe.";
  return (
    <main className="screen">
      <div className="intro">
        <h1 className="title">{notFound ? missing : "Algo salió mal."}</h1>
        <p>Volvé al inicio y probá de nuevo.</p>
      </div>
      <a href="/" className="button">
        Volver al inicio
      </a>
    </main>
  );
}
