import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Reports uncaught errors from Server Components, route handlers, and server
// actions — the layer app/error.tsx (a client boundary) never sees.
export const onRequestError = Sentry.captureRequestError;
