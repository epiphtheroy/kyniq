"use client";
/**
 * GoogleOneTap — the quiet, one-tap sign-in prompt (HANDOFF-회원가입-전환-설계.md §3.2).
 * Env-GATED: renders nothing unless NEXT_PUBLIC_GOOGLE_CLIENT_ID is set, so it is a
 * pure no-op until the owner provisions a GIS client id. Never on first-paint —
 * ConversionProvider only mounts it on an earned moment, and it self-suppresses for
 * signed-in users and for 7 days after a dismissal.
 */
import { useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { mtEvent } from "@/components/mtTrack";

const CID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const DISMISS_KEY = "mt_onetap_until";

declare global { interface Window { google?: any } }

export default function GoogleOneTap({ enabled }: { enabled: boolean }) {
  const done = useRef(false);
  useEffect(() => {
    if (!CID || !enabled || done.current) return;
    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (until && Date.now() < until) return;
    } catch {}
    done.current = true;

    const boot = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: CID,
        cancel_on_tap_outside: true,
        callback: async (resp: { credential?: string }) => {
          if (!resp?.credential) return;
          mtEvent("onetap:accept");
          try {
            const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
            await sb.auth.signInWithIdToken({ provider: "google", token: resp.credential });
            // providers read auth once on mount → reload so the session is picked up
            window.location.reload();
          } catch {}
        },
      });
      mtEvent("onetap:shown");
      window.google.accounts.id.prompt((n: any) => {
        if (n?.isDismissedMoment?.() || n?.isSkippedMoment?.()) {
          try { localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 864e5)); } catch {}
        }
      });
    };

    const existing = document.getElementById("gsi-client");
    if (existing) { boot(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true; s.id = "gsi-client";
    s.onload = boot;
    document.head.appendChild(s);
  }, [enabled]);

  return null;
}
