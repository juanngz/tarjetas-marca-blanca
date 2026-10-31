// Which café the request is for. Today, always the active one (cafes/index.ts): one café per deployment.
// With more cafés, by domain. See ../../../docs/implementacion/varias-cafeterias.md
import { activeCafe } from "../cafes";
import type { Cafe } from "../cafes/types";

export function currentCafe(_request: Request): Cafe {
  return activeCafe;
}
