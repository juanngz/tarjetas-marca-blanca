import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "src",
  ssr: true,
  // The whole map of screens comes with the page: without a connection, a card's code opens without asking
  // the server where it is (Flujo 5, "Sin conexión"). With "lazy" it asks /__manifest on each link.
  routeDiscovery: { mode: "initial" },
  // Cambios de React Router 8 activados desde ya, para que migrar sea más fácil.
  // v8_middleware queda apagado: cambia cómo llega `context.cloudflare` a las rutas.
  future: {
    v8_viteEnvironmentApi: true,
    v8_splitRouteModules: true,
    v8_passThroughRequests: true,
    v8_trailingSlashAwareDataRequests: true,
  },
} satisfies Config;
