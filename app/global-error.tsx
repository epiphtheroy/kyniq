"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Last-resort boundary: replaces the root layout when it (or its children)
// throw during render, so it must supply its own <html>/<body> and cannot
// rely on globals.css — inline styles only.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Digest ⇒ server-originated, already reported in full via onRequestError.
    if (!error.digest) Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#faf9f7",
          color: "#1a1a1a",
        }}
      >
        <main style={{ textAlign: "center", padding: "80px 20px" }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 16, marginTop: 12, color: "#666" }}>
            {error.message || "An unexpected error occurred."}
          </p>
          <div
            style={{
              marginTop: 24,
              display: "flex",
              gap: 16,
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => reset()}
              style={{
                padding: "8px 18px",
                fontSize: 15,
                cursor: "pointer",
                border: "1px solid #1a1a1a",
                background: "transparent",
                borderRadius: 4,
              }}
            >
              Try again
            </button>
            <a href="/" style={{ alignSelf: "center", color: "#b3261e" }}>
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
