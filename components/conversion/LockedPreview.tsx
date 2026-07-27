"use client";
/**
 * LockedPreview — the "no blank walls" soft-gate (HANDOFF-회원가입-전환-설계.md §4.2/§5).
 * Wrap a personalized panel; for a signed-OUT viewer it renders the content behind a
 * gentle dim/blur with a centered claim CTA (a preview of what becomes theirs). For a
 * signed-in viewer it renders the children untouched. Opens the shared AuthSheet.
 */
import { type ReactNode } from "react";
import { mtEvent } from "@/components/mtTrack";
import { useConversion } from "./ConversionProvider";
import { copyFor, type AuthContext } from "@/lib/conversion/intent";

type Surface = "board" | "lens" | "pool" | "coverage" | "services" | "room";

export default function LockedPreview({
  surface, children, headline, sub, cta = "Claim this →", blur = true, minHeight,
}: {
  surface: Surface;
  children: ReactNode;
  headline?: string;
  sub?: string;
  cta?: string;
  blur?: boolean;
  minHeight?: number;
}) {
  const conv = useConversion();
  const ctx: AuthContext = { kind: "claim", surface };
  const def = copyFor(ctx);

  // signed-in (or no provider) → untouched
  if (!conv || conv.signedIn) return <>{children}</>;

  return (
    <div className="mtlock" style={minHeight ? { minHeight } : undefined}>
      <div className={`mtlock-body${blur ? " mtlock-blur" : ""}`} aria-hidden="true">{children}</div>
      <div className="mtlock-ov">
        <div className="mtlock-card">
          <h3 className="mtlock-h">{headline ?? def.h}</h3>
          <p className="mtlock-sub">{sub ?? def.sub}</p>
          <button type="button" className="mtlock-cta" onClick={() => { mtEvent(`nudge_click:locked:${surface}`); conv.openAuth({ ctx }); }}>{cta}</button>
        </div>
      </div>
      <style>{`
        .mtlock{position:relative;border-radius:10px;overflow:hidden}
        .mtlock-body{pointer-events:none;user-select:none}
        .mtlock-blur{filter:blur(3px) saturate(.9);opacity:.55}
        .mtlock-ov{position:absolute;inset:0;display:grid;place-items:center;padding:16px;
          background:linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,.72))}
        .mtlock-card{background:#FFFFFF;border:1px solid #D8D8D8;border-radius:11px;padding:18px 20px;max-width:360px;text-align:center;
          box-shadow:0 14px 34px -18px rgba(0,0,0,.4)}
        .mtlock-h{font-family:var(--font-display,Georgia,serif);font-size:18px;line-height:1.2;margin:0 0 5px;color:#0D0D0D;text-wrap:balance}
        .mtlock-sub{font-family:var(--font-ui,Inter,sans-serif);font-size:13px;line-height:1.5;color:#6B6B6B;margin:0 0 13px}
        .mtlock-cta{font-family:var(--font-ui,Inter,sans-serif);font-size:13.5px;font-weight:700;color:#fff;background:#E3120B;
          border:1px solid #E3120B;border-radius:9px;padding:9px 18px;cursor:pointer}
        .mtlock-cta:hover{background:#B80D05;border-color:#B80D05}
      `}</style>
    </div>
  );
}
