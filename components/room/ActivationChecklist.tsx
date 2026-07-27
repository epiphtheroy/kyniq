"use client";
/**
 * ActivationChecklist — the "get set up" ladder for a signed-in-but-not-activated
 * member (HANDOFF-회원가입-전환-설계.md §4.6/§7.3). Walks import → services → rate 3,
 * matching the FormingCard unlock thresholds. Derives its state from live data +
 * localStorage (services), self-dismisses when complete, and can be dismissed by hand.
 * Light room-v4 theme.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { mtEvent } from "@/components/mtTrack";

const DISMISS = "mt_activation_done";

export default function ActivationChecklist({ ratedHigh, seenCount }: { ratedHigh: number; seenCount: number }) {
  const [hasServices, setHasServices] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      const wp = JSON.parse(localStorage.getItem("mt-watch-prefs") || "{}");
      setHasServices(Array.isArray(wp.providers) && wp.providers.length > 0);
      setHidden(localStorage.getItem(DISMISS) === "1");
    } catch { setHidden(false); }
  }, []);

  const imported = seenCount > 0;
  const rated = ratedHigh >= 3;
  const done = imported && hasServices && rated;

  useEffect(() => {
    if (done) { try { localStorage.setItem(DISMISS, "1"); } catch {} }
  }, [done]);

  useEffect(() => {
    if (!hidden && !done) mtEvent("activation_shown");
  }, [hidden, done]);

  if (hidden || done) return null;

  const steps = [
    { k: "acct", label: "Account created", done: true, href: null as string | null, cta: null as string | null },
    { k: "import", label: "Import your watch history", done: imported, href: "/me/import", cta: "Import →" },
    { k: "svc", label: "Save the services you subscribe to", done: hasServices, href: "/what-to-watch", cta: "Add →" },
    { k: "rate", label: `Rate 3 films you love ★3.5+ to unlock recommendations${rated ? "" : ` (${ratedHigh}/3)`}`, done: rated, href: "/room/ledger", cta: "Rate →" },
  ];
  const left = steps.filter((s) => !s.done).length;

  return (
    <aside className="mtact" aria-label="Get set up">
      <div className="mtact-hd">
        <span className="mtact-t">Get set up</span>
        <span className="mtact-sub">{left} step{left === 1 ? "" : "s"} to your full room</span>
        <button type="button" className="mtact-x" aria-label="Dismiss" onClick={() => { try { localStorage.setItem(DISMISS, "1"); } catch {}; mtEvent("activation_dismiss"); setHidden(true); }}>✕</button>
      </div>
      <ul className="mtact-list">
        {steps.map((s) => (
          <li key={s.k} className={`mtact-row${s.done ? " done" : ""}`}>
            <span className="mtact-mark" aria-hidden="true">{s.done ? "◉" : "○"}</span>
            <span className="mtact-lab">{s.label}</span>
            {!s.done && s.href ? <Link className="mtact-cta" href={s.href} onClick={() => mtEvent(`activation_step:${s.k}`)}>{s.cta}</Link> : null}
          </li>
        ))}
      </ul>
      <style>{`
        .mtact{background:#FFFFFF;border:1px solid #E4DFD3;border-radius:12px;padding:14px 16px;margin:0 0 16px}
        .mtact-hd{display:flex;align-items:baseline;gap:10px;margin-bottom:10px}
        .mtact-t{font-family:var(--font-display,Georgia,serif);font-size:15px;font-weight:800;color:#17140f}
        .mtact-sub{font-size:12px;color:#8A857C}
        .mtact-x{margin-left:auto;border:0;background:none;color:#C6BEAC;font-size:14px;line-height:1;cursor:pointer}
        .mtact-x:hover{color:#6B6B6B}
        .mtact-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
        .mtact-row{display:flex;align-items:center;gap:9px;font-size:13px;color:#4A4640}
        .mtact-row.done{color:#8A857C}
        .mtact-mark{color:#2E7D4F;font-size:13px;flex:0 0 auto}
        .mtact-row:not(.done) .mtact-mark{color:#C6BEAC}
        .mtact-lab{flex:1;min-width:0}
        .mtact-cta{flex:0 0 auto;font-size:12.5px;font-weight:700;color:#E3120B;text-decoration:none;white-space:nowrap}
        .mtact-cta:hover{text-decoration:underline}
      `}</style>
    </aside>
  );
}
