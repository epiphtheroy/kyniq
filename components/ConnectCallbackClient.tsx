"use client";

/**
 * ConnectCallbackClient — finishes a web OAuth connection.
 * The provider lands here with ?code= (Trakt/Simkl) or ?request_token= (TMDB).
 * The import page stashed {provider, pending} in sessionStorage at /start time
 * ("mt-connect-pending"); we POST both to /api/connect/[provider]/callback
 * under the cookie session, then return to /me/import which shows the outcome
 * inline (?connected= / ?connect_error=). Tokens never touch this client.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const PENDING_KEY = "mt-connect-pending";

export default function ConnectCallbackClient() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // strict-mode double-mount guard — the code is single-use
    ran.current = true;
    const fail = (reason: string) =>
      router.replace(`/me/import?connect_error=${encodeURIComponent(reason)}`);
    (async () => {
      const sp = new URLSearchParams(window.location.search);
      let provider = sp.get("provider") ?? "";
      let pending: string | null = null;
      try {
        const raw = sessionStorage.getItem(PENDING_KEY);
        if (raw) {
          const j = JSON.parse(raw) as { provider?: string; pending?: string | null };
          if (!provider && typeof j.provider === "string") provider = j.provider;
          if (typeof j.pending === "string") pending = j.pending;
        }
        sessionStorage.removeItem(PENDING_KEY);
      } catch {
        /* fall through to the guards below */
      }

      if (sp.get("error") || sp.get("denied")) return fail("denied");
      const code = sp.get("code");
      const requestToken = sp.get("request_token");
      if (!provider || !pending || (!code && !requestToken)) return fail("missing_pending");

      try {
        const r = await fetch(`/api/connect/${encodeURIComponent(provider)}/callback`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, request_token: requestToken, pending }),
        });
        if (!r.ok) {
          const d = (await r.json().catch(() => ({}))) as { error?: string };
          return fail(d.error || `callback_${r.status}`);
        }
        router.replace(`/me/import?connected=${encodeURIComponent(provider)}`);
      } catch {
        fail("network");
      }
    })();
  }, [router]);

  return (
    <main style={{ maxWidth: 480, margin: "18vh auto 0", padding: "0 20px", textAlign: "center" }}>
      <p className="ui" style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
        Completing the connection…
      </p>
      <p className="ui muted" style={{ fontSize: 13, marginTop: 6 }}>
        You&apos;ll be back on the import page in a moment.
      </p>
    </main>
  );
}
