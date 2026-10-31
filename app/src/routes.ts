import type { RouteConfig } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

// React Router convention: each URL is a folder in routes/ with its route.tsx.
// Everything else in the folder (.server.ts, .test.ts, its own components) isn't a route.
// See ../../docs/implementacion/arquitectura.md
export default flatRoutes() satisfies RouteConfig;
