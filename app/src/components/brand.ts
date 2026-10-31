// The café's name and its Club, for every screen: the root loader brings them from the café's config
// (root.tsx, cafes/). The logos are files in public/brand/ and the stamps in public/stamps/ (marca/README.md).
import { useRouteLoaderData } from "react-router";
import type { Cafe } from "../cafes/types";

export type Brand = Pick<Cafe, "name" | "description" | "club">;

export function brandOf(cafe: Cafe): Brand {
  return { name: cafe.name, description: cafe.description, club: cafe.club };
}

/** The brand, or nothing on an error page that came before the root loader's data. */
export function useBrandIfLoaded(): Brand | undefined {
  return (useRouteLoaderData("root") as { brand: Brand } | undefined)?.brand;
}

export function useBrand(): Brand {
  const brand = useBrandIfLoaded();
  if (!brand) throw new Error("The root loader brings the café's brand (root.tsx).");
  return brand;
}

/** A page's title, with the Club's name: "Mis tarjetas · El Club del Café". Without a title, only the Club. */
export function pageTitle(
  matches: readonly ({ id: string; data?: unknown } | undefined)[],
  title?: string,
): string {
  const root = matches.find((match) => match?.id === "root")?.data as { brand?: Brand } | undefined;
  const club = root?.brand?.club.name;
  if (!club) return title ?? "";
  return title ? `${title} · ${club}` : club;
}

/** The Club's name, uppercase and without its article, for the register's seal: "CLUB DEL CAFÉ". */
export function sealName(club: Brand["club"]): string {
  return club.name.replace(/^(el|la|los|las)\s+/i, "").toUpperCase();
}
