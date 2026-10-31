// A local, in-memory D1 with the repo's migrations: for layer 2 tests.
// Uses Wrangler's getPlatformProxy (the Workers pool requires Vitest 4). See ../../docs/implementacion/plan.md
// Never touches dev or prod: no persistence and no remote bindings.
import { getPlatformProxy } from "wrangler";
import { openDb } from "../src/platform/db/cafeDb.server";

const migrations = import.meta.glob<string>("../migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * The statements of each migration, in order, split the way Drizzle writes them.
 * With `before` ("0005"), only the ones before it; with `from`, that one and the ones after.
 */
function statements({ before, from }: { before?: string; from?: string } = {}): string[] {
  return Object.keys(migrations)
    .sort()
    .filter((file) => {
      const name = file.split("/").pop() ?? "";
      return (!before || name < before) && (!from || name >= from);
    })
    .flatMap((file) => migrations[file].split("--> statement-breakpoint"))
    .map((statement) => statement.trim())
    .filter((statement) => statement !== "");
}

/** The app's tables, without SQLite's and Cloudflare's own. */
async function tableNames(d1: D1Database): Promise<string[]> {
  const { results } = await d1
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
    )
    .all<{ name: string }>();
  return results.map(({ name }) => name);
}

/**
 * Where a text shows up across the whole database, as "table.column". Empty if it doesn't.
 * To check that the DNI or a token is never stored.
 */
export async function findInDb(d1: D1Database, text: string): Promise<string[]> {
  const found: string[] = [];
  for (const table of await tableNames(d1)) {
    const { results: columns } = await d1
      .prepare(`SELECT name FROM pragma_table_info('${table}')`)
      .all<{ name: string }>();
    for (const { name: column } of columns) {
      const row = await d1
        .prepare(`SELECT 1 FROM "${table}" WHERE CAST("${column}" AS TEXT) LIKE ? LIMIT 1`)
        .bind(`%${text}%`)
        .first();
      if (row) found.push(`${table}.${column}`);
    }
  }
  return found;
}

/**
 * The underlying reason a query failed, for example
 * "UNIQUE constraint failed: customers.dni_hmac". Fails if the query didn't fail.
 */
export async function errorCause(query: Promise<unknown>): Promise<string> {
  try {
    await query;
  } catch (error) {
    let current: unknown = error;
    while (current instanceof Error && current.cause instanceof Error) current = current.cause;
    return current instanceof Error ? current.message : String(current);
  }
  throw new Error("The query should have failed and didn't.");
}

/**
 * Starts an empty D1 with the migrations applied. One per test file:
 * in beforeAll, and clear() in beforeEach so each test starts from scratch.
 * To test a migration on existing data: testDb({ before: "0005" }), insert rows, then migrate(). To test it
 * alone, without the ones that came later: migrate("0006").
 */
export async function testDb({ before }: { before?: string } = {}) {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: "wrangler.jsonc",
    persist: false,
    remoteBindings: false,
    envFiles: [],
  });
  const d1 = proxy.env.DB;
  const run = (list: string[]) => d1.batch(list.map((statement) => d1.prepare(statement)));
  await run(statements({ before }));

  return {
    db: openDb(d1),
    d1,
    /** Deletes every row from every table. */
    async clear() {
      await d1.batch([
        d1.prepare("PRAGMA defer_foreign_keys = on"),
        ...(await tableNames(d1)).map((name) => d1.prepare(`DELETE FROM "${name}"`)),
      ]);
    },
    /** Applies the migrations left out with `before`; with `until`, only the ones before that one. */
    migrate: (until?: string) => run(statements({ from: before ?? "~", before: until })),
    close: () => proxy.dispose(),
  };
}
