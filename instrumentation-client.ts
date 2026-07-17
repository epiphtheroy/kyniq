import * as Sentry from "@sentry/nextjs";

// Browser-side errors. NEXT_PUBLIC_SENTRY_DSN is inlined at build time, so
// enabling Sentry requires a redeploy after setting the env var.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || "development",
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
