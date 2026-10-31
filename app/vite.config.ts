import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { build } from "esbuild";
import { defineConfig, type Plugin } from "vite";

// E2E_STATE: where the local D1 lives. The end-to-end tests use their own (.wrangler/e2e), so they never
// touch the one you develop with (.wrangler/state). See scripts/e2e-server.mjs.
const state = process.env.E2E_STATE;

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" }, persistState: state ? { path: state } : true }),
    reactRouter(),
    serviceWorker(),
  ],
});

/**
 * Builds src/web/sw/sw.ts as /sw.js, with the list of the app's files to keep on the phone (Flujo 5, "Sin
 * conexión"): everything in build/client, except the register's QR reader (1 MB, only for the register).
 * At the end, because React Router writes its map of screens (assets/manifest-*.js) while building the
 * server, after the client. On its own, with esbuild: a service worker can't import the app's chunks.
 * Only when building: in `npm run dev` there's no service worker.
 */
function serviceWorker(): Plugin {
  const SOURCE = fileURLToPath(new URL("./src/web/sw/sw.ts", import.meta.url));
  let client = "";
  return {
    name: "club-service-worker",
    apply: "build",
    buildStart() {
      const { name, config } = this.environment;
      if (name === "client") client = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      if (this.environment.name !== "ssr" || !client) return;
      const files = readdirSync(client, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => join(entry.parentPath, entry.name).slice(client.length))
        .filter((name) => name !== "/sw.js" && !/\/\./.test(name) && !/\.(wasm|map)$/.test(name))
        .sort();
      // A name that changes when any file changes: the ones in public/ keep their name.
      const version = createHash("sha256");
      for (const name of files) version.update(name).update(readFileSync(client + name));

      await build({
        entryPoints: [SOURCE],
        outfile: join(client, "sw.js"),
        bundle: true,
        format: "iife",
        target: "es2020",
        minify: true,
        define: {
          __APP_FILES__: JSON.stringify(files),
          __APP_VERSION__: JSON.stringify(version.digest("hex").slice(0, 12)),
        },
      });
    },
  };
}
