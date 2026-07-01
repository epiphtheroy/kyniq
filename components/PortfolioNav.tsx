/** /me — Portfolio index (NAV). A monotonic 0-100 built from the Standing of films
 *  you've seen (geometric-decayed, non-punishing). With essentials seen, lineage lines
 *  covered, and average Standing. Cold-start honest under 8 films. Standing-based
 *  (the "market price" axis); sits next to the TakeScore quality panel. */
export type NavData = {
  n_watched: number; n_scored: number; essentials: number;
  avg_standing: number | null; lines: number; nav: number | null;
};

export default function PortfolioNav({ nav }: { nav: NavData }) {
  if (!nav || nav.n_watched === 0) return null;
  const forming = nav.nav == null;
  return (
    <div className="nv">
      <div className="nv-hero">
        <span className="nv-big">{forming ? "—" : nav.nav}</span>
        <span className="nv-lbl">Portfolio index{forming ? " · forming" : ""}</span>
      </div>
      <div className="nv-stats">
        <div className="nv-stat"><b>{nav.essentials}</b><span>essential works seen<br /><i>Standing ≥ 70</i></span></div>
        <div className="nv-stat"><b>{nav.lines}</b><span>lineage lines<br /><i>canons · awards · nations</i></span></div>
        <div className="nv-stat"><b>{nav.avg_standing ?? "—"}</b><span>avg Standing<br /><i>of your films</i></span></div>
      </div>
      {forming ? <p className="nv-note">Under 8 seen — index forms as you log more.</p> : null}
    </div>
  );
}
