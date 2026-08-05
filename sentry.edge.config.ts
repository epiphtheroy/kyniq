import * as Sentry from "@sentry/nextjs";
import { resolveSentryDsn } from "./lib/sentry-dsn";

// Edge runtime (middleware) — errors-only. Guarded like the server config:
// even a disabled init wraps global error hooks in the edge isolate, so the
// un-configured state must skip init entirely.
const dsn = resolveSentryDsn(process.env.NEXT_PUBLIC_SENTRY_DSN);
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || "development",
    sendDefaultPii: false,
  });
}
