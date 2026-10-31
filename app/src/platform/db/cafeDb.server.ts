// The D1 database of the request's café. Today there's only one, in the DB binding.
// With more cafés, each one has its own database: see ../../../../docs/implementacion/varias-cafeterias.md
import { drizzle } from "drizzle-orm/d1";
import type { Cafe } from "../../cafes/types";
import * as schema from "./schema";

export function openDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof openDb>;

export function cafeDb(env: { DB: D1Database }, _cafe: Cafe): Db {
  return openDb(env.DB);
}
