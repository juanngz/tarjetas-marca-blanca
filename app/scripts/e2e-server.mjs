// Starts the app for the end-to-end tests (Playwright runs it: playwright.config.ts, webServer).
// Like production: built, and served by workerd with `vite preview`. With its own local D1, empty and migrated,
// in .wrangler/e2e: never the one you develop with, never dev or prod.
// The secrets come from .dev.vars (test keys; in CI, a copy of .dev.vars.example).
import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const STATE = ".wrangler/e2e";
const PORT = process.env.E2E_PORT ?? "4173";
const run = (command) => execSync(command, { stdio: "inherit" });

rmSync(STATE, { recursive: true, force: true });
run(`npx wrangler d1 migrations apply DB --local --persist-to ${STATE} -c wrangler.jsonc`);
// Ana, barista, so the tests can sign in at the register (e2e/support/register.ts).
run(`node --import tsx scripts/seed.mjs --persist-to ${STATE}`);
run("npx react-router build");

const server = spawn("npx", ["vite", "preview", "--port", PORT, "--strictPort"], {
  stdio: "inherit",
  env: { ...process.env, E2E_STATE: STATE },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
