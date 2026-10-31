import { defineConfig, devices } from "@playwright/test";

// End-to-end tests (layers 3 and 4 of the pruebas skill): e2e/journeys and e2e/screens.
// On a phone of 360 × 740, the smallest the app has to work on. Run with: npm run test:e2e
const PORT = 4173;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "phone",
      testIgnore: "**/dark-mode.spec.ts",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 740 } },
    },
    {
      // The same phone in dark mode, with the browser darkening pages on its own (e2e/screens/dark-mode.spec.ts).
      name: "phone-dark",
      testMatch: "**/dark-mode.spec.ts",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 360, height: 740 },
        colorScheme: "dark",
        launchOptions: { args: ["--blink-settings=forceDarkModeEnabled=true"] },
      },
    },
  ],
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: `http://localhost:${PORT}`,
    env: { E2E_PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
