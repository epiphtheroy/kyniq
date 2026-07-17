import * as Sentry from "@sentry/nextjs";

// Edge runtime (middleware) — errors-only. Guarded like the server config:
// even a disabled init wraps global error hooks in the edge isolate, so the
// un-configured state must skip init entirely.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.VERCEL_ENV || "development",
    sendDefaultPii: false,
  });
}
