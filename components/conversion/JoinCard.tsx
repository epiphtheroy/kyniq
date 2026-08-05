"use client";
/**
 * JoinCard — a calm content-bottom invitation (HANDOFF-회원가입-전환-설계.md §4.3/§5).
 * Governed hard so it never burns anticipation:
 *   - signed-in users never see it
 *   - at most ONE join card per session, across the whole site
 *   - dismissible; a dismissal is remembered (30 days)
 *   - client-only mount → invisible to crawlers, never in server HTML
 * Clicking the CTA opens the shared AuthSheet with a matching intent.
 */
import { useEffect, useState } from "react";
import { mtEvent } from "@/components/mtTrack";
import { useConversion } from "./ConversionProvider";
import type { AuthContext } from "@/lib/conversion/intent";

type Variant = "film" | "director" | "hub" | "board" | "generic";

const COPY: Record<Variant, { h: string; sub: string; cta: string; ctx: AuthContext }> = {
  film: { h: "Keep a record of the films you read here", sub: "Metatake remembers what you've seen and re-centers every page on your own cinema. It takes one tap.", cta: "Start your shelf →", ctx: { kind: "claim", surface: "lens" } },
  director: { h: "Follow the directors you return to", sub: "New readings come to you, and your watching life becomes one map.", cta: "Make it yours →", ctx: { kind: "claim", surface: "room" } },
  hub: { h: "Metatake is better when it knows your films", sub: "Track what you've seen, follow directors and figures, and get picks scored for your taste.", cta: "Make it yours →", ctx: { kind: "claim", surface: "room" } },
  board: { h: "See your canon light up", sub: "Sign in and this board marks every film you've seen — coverage, blind spots, and all.", cta: "Claim your board →", ctx: { kind: "claim", surface: "board" } },
  generic: { h: "Open your cinema portfolio", sub: "Coverage, blind spots, taste — your watching life as one map.", cta: "Get started →", ctx: { kind: "claim", surface: "room" } },
};

const SESSION_KEY = "mt_join_seen";

export default function JoinCard({ variant = "generic", source }: { variant?: Variant; source: string }) {
  const conv = useConversion();
  const [show, setShow] = useState(false);
  const c = COPY[variant];

  useEffect(() => {
    if (!conv || conv.signedIn) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
      if (Number(localStorage.getItem(`mt_nd_join:${source}`) || 0) > Date.now()) return;
    } catch {}
    setShow(true);
  }, [conv, source]);

  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch {}
    mtEvent(`nudge_shown:join:${source}`);
  }, [show, source]);

  if (!show || !conv) return null;

  return (
    <aside className="mtjoin" aria-label="Join Metatake">
      <button type="button" className="mtjoin-x" aria-label="Dismiss" onClick={() => { conv.dismissNudge(`join:${source}`, 30); setShow(false); }}>✕</button>
      <div className="mtjoin-kick">Metatake</div>
      <h3 className="mtjoin-h">{c.h}</h3>
      <p className="mtjoin-sub">{c.sub}</p>
      <button type="button" className="mtjoin-cta" onClick={() => { mtEvent(`nudge_click:join:${source}`); conv.openAuth({ ctx: c.ctx }); }}>{c.cta}</button>
      <style>{`
        .mtjoin{position:relative;max-width:640px;margin:34px auto 8px;background:#FFFFFF;border:1px solid #D8D8D8;
          border-radius:12px;padding:22px 24px 20px;text-align:center;box-shadow:0 1px 0 rgba(0,0,0,.02)}
        .mtjoin-x{position:absolute;top:9px;right:12px;border:0;background:none;color:#B9B9B9;font-size:15px;line-height:1;cursor:pointer}
        .mtjoin-x:hover{color:#6B6B6B}
        .mtjoin-kick{font-family:var(--font-display,Georgia,serif);font-size:13px;color:#E3120B;font-weight:700}
        .mtjoin-h{font-family:var(--font-display,Georgia,serif);font-size:20px;line-height:1.2;margin:5px 0 6px;color:#0D0D0D;text-wrap:balance}
        .mtjoin-sub{font-family:var(--font-ui,Inter,sans-serif);font-size:13.5px;line-height:1.55;color:#6B6B6B;margin:0 auto 15px;max-width:52ch}
        .mtjoin-cta{font-family:var(--font-ui,Inter,sans-serif);font-size:14px;font-weight:700;color:#fff;background:#E3120B;
          border:1px solid #E3120B;border-radius:9px;padding:10px 20px;cursor:pointer}
        .mtjoin-cta:hover{background:#B80D05;border-color:#B80D05}
      `}</style>
    </aside>
  );
}
