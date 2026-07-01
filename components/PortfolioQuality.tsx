import Link from "next/link";

/** /me — Portfolio quality via TakeScore. A NAV-lite read of the films you've SEEN:
 *  their median TakeScore, your value/risk lean, your best & riskiest watch, and how
 *  your ★ ratings sit against our Value estimate (the value gap). Cold-start honest:
 *  under 3 scored films it says "forming". Display-only; TakeScore output, no blending. */
export type MeSummary = {
  n_watched: number; n_scored: number;
  median_ts: number | null; avg_v: number | null; avg_r: number | null;
  best: { slug: string; title: string; ts: number } | null;
  riskiest: { slug: string; title: string; r: number } | null;
  value_gap: number | null; n_gap: number;
};

function Bar({ label, v, tone }: { label: string; v: number | null; tone: string }) {
  return (
    <div className="pq-bar">
      <span className="pq-bar-l">{label}</span>
      <span className="pq-bar-t"><i className={tone} style={{ width: `${Math.max(0, Math.min(100, v ?? 0))}%` }} /></span>
      <span className="pq-bar-n">{v ?? "—"}</span>
    </div>
  );
}

export default function PortfolioQuality({ s }: { s: MeSummary }) {
  if (!s || s.n_scored === 0) return null;
  const forming = s.n_scored < 3;
  const gap = s.value_gap;

  return (
    <div className="pq">
      <div className="pq-head">
        <div className="pq-hero">
          <span className="pq-big">{forming ? "—" : s.median_ts}</span>
          <span className="pq-lbl">Median TakeScore{forming ? "" : ` · across ${s.n_scored} scored`}</span>
        </div>
        {forming ? (
          <p className="pq-forming">Forming — {s.n_scored} of your watched film{s.n_scored === 1 ? " is" : "s are"} scored. Rate a few more to see your portfolio quality.</p>
        ) : (
          <div className="pq-bars">
            <Bar label="Value lean" v={s.avg_v} tone="cx-lv" />
            <Bar label="Risk lean" v={s.avg_r} tone="cx-lr" />
          </div>
        )}
      </div>

      {!forming && (
        <div className="pq-facts">
          {s.best ? (
            <Link className="pq-fact pq-fact--best" href={`/film/${s.best.slug}`}>
              <span className="pq-fact-k">Best you&apos;ve seen</span>
              <span className="pq-fact-t">{s.best.title}</span>
              <span className="pq-fact-m">TakeScore {s.best.ts}</span>
            </Link>
          ) : null}
          {s.riskiest ? (
            <Link className="pq-fact pq-fact--risk" href={`/film/${s.riskiest.slug}`}>
              <span className="pq-fact-k">Riskiest you&apos;ve seen</span>
              <span className="pq-fact-t">{s.riskiest.title}</span>
              <span className="pq-fact-m">Risk {s.riskiest.r}</span>
            </Link>
          ) : null}
          {gap != null && s.n_gap >= 2 ? (
            <div className="pq-fact pq-fact--gap">
              <span className="pq-fact-k">Your taste vs our Value</span>
              <span className="pq-fact-t">{gap === 0 ? "In line" : `${Math.abs(gap)} pts ${gap > 0 ? "more generous" : "harsher"}`}</span>
              <span className="pq-fact-m">your ★ vs TakeScore Value</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
