import { defineConfig } from "vitest/config";

// Layer 1 and 2 tests (pruebas skill). Layer 2 starts an in-memory D1 (test/db.ts).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Without this, Vitest replaces .css files with empty text and the tokens test can't read it.
    css: { include: [/tokens\.css/] },
  },
});
