/**
 * TakeScoreBoxes — the 4 TakeScore metrics as a boxed scorecard (2026-07-09):
 * a filled, tier-banded U (the headline verdict) followed by Value / Cost /
 * Risk in outline boxes. Numbers-first so a score reads as a scorecard, not
 * loose digits in a sentence. Pure render; sizes via the `size` prop.
 */
import { displayTs } from "@/lib/cinecodex_dims";

export type TakeScoreVals = { u: number; v: number; c: number; r: number; tier?: string | null };

function uBand(u: number): string {
  if (u >= 70) return "tsc-u-hi";
  if (u >= 45) return "tsc-u-mid";
  return "tsc-u-lo";
}

export default function TakeScoreBoxes({ s, showUKicker = true }: { s: TakeScoreVals; showUKicker?: boolean }) {
  const u = displayTs(s.u);
  return (
    <span className="tsc-boxes">
      <span className={`tsc-box tsc-box--u ${uBand(u)}`} title={s.tier ? `${s.tier} — TakeScore ${u}` : `TakeScore ${u}`}>
        <span className="tsc-box__n">{u}</span>
        <span className="tsc-box__k">{showUKicker ? (s.tier || "Score") : "Score"}</span>
      </span>
      <span className="tsc-box" title="Value — what the film offers, 0–100">
        <span className="tsc-box__n">{Math.round(s.v)}</span><span className="tsc-box__k">Value</span>
      </span>
      <span className="tsc-box" title="Entry cost — the price of admission, kept apart from merit">
        <span className="tsc-box__n">{Math.round(s.c)}</span><span className="tsc-box__k">Cost</span>
      </span>
      <span className="tsc-box" title="Risk — how divisive the payoff is">
        <span className="tsc-box__n">{Math.round(s.r)}</span><span className="tsc-box__k">Risk</span>
      </span>
    </span>
  );
}
