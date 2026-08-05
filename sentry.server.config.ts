import * as Sentry from "@sentry/nextjs";
import { resolveSentryDsn } from "./lib/sentry-dsn";

// Errors-only setup: no tracing, no replay. The init is wrapped (not just
// `enabled: false`) because Sentry.init registers process-wide OpenTelemetry
// globals, a SIGTERM handler, and NEXT_OTEL_FETCH_DISABLED even when disabled —
// the guard makes the un-configured state a true zero-effect no-op.
// Activation: set NEXT_PUBLIC_SENTRY_DSN in Vercel env — see HANDOFF-관측성-Sentry.md.
const dsn = resolveSentryDsn(process.env.NEXT_PUBLIC_SENTRY_DSN);
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || "development",
    // Errors-only: tracing/replay/logs stay OFF by omission (setting
    // tracesSampleRate: 0 would still initialize the tracing plumbing).
    sendDefaultPii: false,
  });
}
