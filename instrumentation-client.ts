import * as Sentry from "@sentry/nextjs";
import { resolveSentryDsn } from "./lib/sentry-dsn";

// Browser-side errors. NEXT_PUBLIC_SENTRY_DSN is inlined at build time, so
// enabling Sentry requires a redeploy after setting the env var.
const dsn = resolveSentryDsn(process.env.NEXT_PUBLIC_SENTRY_DSN);
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || "development",
  sendDefaultPii: false,
});

// Google Translate (and similar DOM-rewriting tools) swap text nodes under
// React-managed parents; React's next commit then calls removeChild/insertBefore
// against the stale tree and the whole page crashes into the error boundary
// (seen in production 2026-08-05 — the site is English-only, so Chrome offers
// translation to every non-English visitor). Absorb the mismatch instead of
// crashing, and report one warning per op per page so each occurrence stays
// visible in Sentry with its URL and translate markers.
(() => {
  if (typeof Node === "undefined") return;
  const reported = new Set<string>();
  const report = (op: string) => {
    if (reported.has(op)) return;
    reported.add(op);
    Sentry.captureMessage(`dom-guard: absorbed foreign DOM mutation (${op})`, {
      level: "warning",
      tags: { domGuard: op },
      extra: {
        htmlClass: document.documentElement.className, // "translated-ltr" ⇒ Google Translate active
        htmlLang: document.documentElement.lang,
        uiLang: navigator.language,
      },
    });
  };
  const origRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      report("removeChild");
      return child;
    }
    return origRemoveChild.call(this, child) as T;
  };
  const origInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) {
      report("insertBefore");
      return this.appendChild(node);
    }
    return origInsertBefore.call(this, node, ref) as T;
  };
})();

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
