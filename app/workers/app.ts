import { createRequestHandler } from "react-router";
import { handleLiveRequest, isLiveRequest } from "../src/platform/live/liveRequest.server";

// The sello en vivo's Durable Object: Cloudflare finds it among the Worker's exports.
export { CardWatch } from "../src/platform/live/cardWatch.server";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  fetch(request, env, ctx) {
    // The code screen's WebSocket doesn't go through React Router.
    if (isLiveRequest(request)) return handleLiveRequest(request, env);
    return requestHandler(request, { cloudflare: { env, ctx } });
  },
} satisfies ExportedHandler<Env>;
