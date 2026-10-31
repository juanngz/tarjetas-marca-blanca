import { defineConfig } from "drizzle-kit";

// Generates the SQL migrations from the schema: npm run db:generate -- --name=what-changes
// wrangler applies them, locally and in CI. See ../docs/implementacion/ci-cd.md
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/platform/db/schema.ts",
  out: "./migrations",
});
