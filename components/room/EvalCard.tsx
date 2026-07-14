"use client";
/** Appraisal — the Cinecodex evaluation card (/room/film/[slug], engine ⑨ full breakdown).
 *  All numbers real (cinecodex_card RPC): V/C/R/U/S, 13 sub-scores, per-sub nearest comparison
 *  films, reliability, external signals, standing. Level bands + the aesthetic ladder are a
 *  DEFINED rubric (never invented per-film prose). Never-blend triptych: ours ≠ external ≠ canon.
 *  v3 (spec §3.15): full English strings per §5, plus a personal layer — the "My position" bar
 *  (inline ★, Keep/Seen, verdict vs Standing); basket rows and comparison chips are links. */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { verdictOf, VERDICT_FIND, VERDICT_LETDOWN, IMG, IMG185 } from "@/lib/room/format";
import { STR } from "./strings";
import { useRoomActions } from "./useRoomActions";
import Stars from "./Stars";

type CompFilm = { title: string; slug: string | null; poster_path: string | null };
type Comps = Record<string, (string | CompFilm)[] | null>;
/** cinecodex_card v2 (0046) upgraded comps entries from bare titles to
 *  {title, slug, poster_path}; normalize so both shapes render. */
const compOf = (c: string | CompFilm): CompFilm =>
  typeof c === "string" ? { title: c, slug: null, poster_path: null } : c;
export type CardData = {
  slug: string; title: string; year: number | null; director: string | null; poster_path: string | null;
  v: number; c: number; r: number; u: number; s: number;
  subs: Record<string, number>; comps: Comps | null;
  reliability: { n_samples: number | null; sd_v: number | null; sd_r: number | null; panel: string | null; prompt_version: string | null; flagged: boolean | null; scored_at: string | null };
  conf: number | null; tier: string | null; n_takes: number | null;
  ext: { imdb: number | null; rt: number | null; meta: number | null } | null;
  standing: { prestige: number | null; labels: string[] | null };
  /** v2 (0046): 20-row U-rank window around the film; rows gained rank/year/poster. */
  basket: { title: string; slug: string; year?: number | null; poster_path?: string | null; rank?: number | null; u: number; r: number; self: boolean }[] | null;
  rank?: number | null; rank_total?: number | null;
};

/** My position for this film (server-read once; optimistic after that). */
export type MyPosition = { rating: number | null; kept: boolean; seen: boolean };

/** 10-step aesthetic ladder (defined rubric — §5 verbatim). */
const AES = ["Fundamentals", "Solid craft", "Considered work", "Achieved work", "Distinct vision", "Sustained achievement", "Major work", "Provoked thought", "Transcendent", "Apex of the canon"];
const BAND = {
  v: ["Faint", "Fair", "Solid", "Strong", "Exceptional"],
  c: ["Easy entry", "Intermediate", "Demanding", "Advanced", "Expert"],
  r: ["None", "Low", "Some", "High", "Severe"],
};
const AXDESC = {
  v: "Contributes to earned value (what it gives back)",
  c: "Entry cost — difficulty, not value",
  r: "Letdown-risk signal — lower is safer",
};
type Axis = "v" | "c" | "r";
const SUBS: { code: string; key: string; nm: string; axis: Axis }[] = [
  { code: "COG", key: "cog", nm: "Cognitive charge", axis: "v" },
  { code: "AFF", key: "aff", nm: "Affective intensity", axis: "v" },
  { code: "FORM", key: "form", nm: "Formal achievement", axis: "v" },
  { code: "MORAL", key: "moral", nm: "Moral seriousness", axis: "v" },
  { code: "DUR", key: "dur", nm: "Lasting residue", axis: "v" },
  { code: "ITX", key: "itx", nm: "Intertextuality", axis: "c" },
  { code: "FR", key: "fr", nm: "Formal radicality", axis: "c" },
  { code: "ETX", key: "etx", nm: "Extratextual demand", axis: "c" },
  { code: "CTX", key: "ctx", nm: "Directorial oeuvre", axis: "c" },
  { code: "BANK", key: "bank", nm: "Intellectual bankruptcy", axis: "r" },
  { code: "INSINCERE", key: "insincere", nm: "Aesthetic insincerity", axis: "r" },
  { code: "COWARD", key: "coward", nm: "Artistic cowardice", axis: "r" },
  { code: "POLAR", key: "polar", nm: "Divisiveness", axis: "r" },
];
const lvOf = (val: number) => Math.max(1, Math.min(5, Math.round(val / 20)));
function heat(axis: Axis, lv: number): string {
  if (axis === "v") return lv >= 4 ? "g" : lv === 3 ? "m" : "n";
  if (axis === "c") return lv <= 1 ? "g" : lv === 2 ? "n" : "m";
  return lv <= 1 ? "g" : lv === 2 ? "n" : lv === 3 ? "m" : "b";
}

function Donut({ val, color, label, of }: { val: number; color: string; label: React.ReactNode; of: string }) {
  const C = 2 * Math.PI * 34;
  const off = C * (1 - Math.max(0, Math.min(100, val)) / 100);
  return (
    <div className="donutcell">
      <svg width="86" height="86" viewBox="0 0 86 86">
        <circle cx="43" cy="43" r="34" fill="none" stroke="#24242a" strokeWidth="7" />
        <circle cx="43" cy="43" r="34" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C.toFixed(1)} strokeDashoffset={off.toFixed(1)} transform="rotate(-90 43 43)" />
        <text x="43" y="40" textAnchor="middle" fontSize="20" fill="#ECEAE5" fontFamily="ui-monospace,monospace" fontWeight="600">{Math.round(val)}</text>
        <text x="43" y="54" textAnchor="middle" fontSize="8" fill="#6C6960" letterSpacing="1">/100</text>
      </svg>
      <div className="cap">{label}</div>
      <div className="note">{of}</div>
    </div>
  );
}

/* ── My position bar (spec §3.15 personal layer) ─────────────────────────── */

function MyPositionBar({ d, pos }: { d: CardData; pos: MyPosition }) {
  const { doKeep, doSeen, doRate } = useRoomActions();
  const [rating, setRating] = useState<number | null>(pos.rating);
  const [kept, setKept] = useState(pos.kept);
  const [seen, setSeen] = useState(pos.seen);
  const [busy, setBusy] = useState(false);

  const onPick = async (v: number) => {
    if (busy) return;
    setBusy(true);
    const res = await doRate(d.slug, d.title, v);
    setBusy(false);
    if (res) { setRating(res.rating); setSeen(true); }
  };
  const onKeep = async () => {
    if (busy || kept) return;
    setBusy(true);
    const ok = await doKeep(d.slug, d.title);
    setBusy(false);
    if (ok) setKept(true);
  };
  const onSeen = async () => {
    if (busy || seen) return;
    setBusy(true);
    const ok = await doSeen(d.slug, d.title);
    setBusy(false);
    if (ok) setSeen(true);
  };

  const vd = verdictOf(rating, d.standing.prestige);
  const btn = { flex: "0 0 auto", padding: "5px 12px", fontSize: 11.5 } as const;

  return (
    <div className="mod" style={{ marginBottom: 13 }}>
      <div className="modbody" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sub)" }}>My position</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Stars value={rating ?? 0} onPick={onPick} title={STR.insp.myRating} />
          <span style={{ fontSize: 10.5, color: "var(--sub)" }}>{rating != null ? `★${rating}` : STR.insp.ratingHint}</span>
        </span>
        <span className={`actbtn${kept ? " dis" : ""}`} role="button" tabIndex={kept ? -1 : 0} style={btn}
          title={kept ? "Already on your slate" : "Queue it on your slate"}
          onClick={onKeep} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onKeep(); } }}>
          {kept ? `✓ ${STR.row.kept}` : STR.row.keep}
        </span>
        <span className={`actbtn${seen ? " dis" : ""}`} role="button" tabIndex={seen ? -1 : 0} style={btn}
          title={seen ? "Logged as seen" : "Log as seen (opens a position in Holdings)"}
          onClick={onSeen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSeen(); } }}>
          {seen ? `✓ ${STR.row.seen}` : STR.row.seen}
        </span>
        {vd ? (
          <span className={`vchip ${vd.code}`} title={`gap = my ★×20 − Standing · Find ≥ +${VERDICT_FIND} · Letdown ≤ ${VERDICT_LETDOWN}`}>
            {vd.label} {vd.gap > 0 ? `+${vd.gap}` : vd.gap} vs {STR.cc.standing}
          </span>
        ) : (
          <span style={{ fontSize: 10.5, color: "var(--sub)" }}>
            {rating == null ? "No verdict yet — rate it to compare against Standing." : "Standing not yet computed."}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── the card ────────────────────────────────────────────────────────────── */

export default function EvalCard({ d, pos }: { d: CardData; pos: MyPosition }) {
  const [subsOpen, setSubsOpen] = useState(true);
  const [relOpen, setRelOpen] = useState(false);
  // v2 basket is a 20-row window: the ladder scrolls, and we anchor the film's
  // own row to the vertical center of the scroller (container-only scroll — no
  // scrollIntoView, which would also scroll the page).
  const ladderRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const box = ladderRef.current;
    if (!box) return;
    const self = box.querySelector<HTMLElement>("[data-self]");
    if (self) box.scrollTop = Math.max(0, self.offsetTop - box.clientHeight / 2 + self.offsetHeight / 2);
  }, [d.slug]);
  const v = Math.round(d.v), c = Math.round(d.c), r = Math.round(d.r);
  const al = Math.max(1, Math.min(10, Math.round(d.v / 10)));
  const polar = d.subs.polar ?? 0;
  const pBand = polar < 20 ? "Low" : polar < 40 ? "Mid" : "High";
  const pr = d.standing.prestige;
  const hiV = v >= 72, loR = r <= 20;
  const verdict = hiV && loR ? "High value · low risk — a safe masterpiece."
    : hiV && !loR ? "High value · high risk — ambitious but divisive."
    : !hiV && loR ? "Solid but not peak — a stable choice."
    : "Mid value, mid risk — approach with care.";
  const tierLabel = pr == null ? "—" : pr >= 85 ? "World canon" : pr >= 70 ? "National canon" : pr >= 50 ? "Notable" : "—";
  const nomerge = pr == null ? "Standing not yet computed."
    : pr < v - 8 ? `Standing ${pr} < our V ${v} — fundamentals catch what the market still underprices.`
    : pr > v + 8 ? `Standing ${pr} > our V ${v} — the market rates it higher; fundamentals are more cautious.`
    : `Standing ${pr} ≈ our V ${v} — market and fundamentals agree.`;
  const rel = d.reliability;

  const group = (axis: Axis, title: string, sub: string) => (
    <div key={axis}>
      <div className="grp"><span className={`ax ${axis}`}>→ {title}</span><span>{sub}</span><span className="line" /></div>
      {SUBS.filter((s) => s.axis === axis).map((s) => {
        const val = d.subs[s.key] ?? 0; const lv = lvOf(val); const h = heat(axis, lv);
        const comps = d.comps?.[s.key] ?? [];
        return (
          <div className="sub" key={s.key}>
            <div className="snm"><div className="code">{s.code}</div><div className="nm">{s.nm}</div><div className="lv">L{lv} · {BAND[axis][lv - 1]}</div></div>
            <div>
              <div className="rsn2">{BAND[axis][lv - 1]} — {AXDESC[axis]}.</div>
              {comps.length ? (
                <div className="comps">
                  {comps.map(compOf).map((cf, i) => (
                    <Link
                      className="cmp"
                      key={i}
                      href={cf.slug ? `/room/film/${cf.slug}` : `/search?q=${encodeURIComponent(cf.title)}`}
                      title={`Nearest measured neighbor on ${s.code} — ${cf.title}`}
                      style={cf.poster_path ? { display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 9px 2px 3px" } : undefined}
                    >
                      {cf.poster_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${IMG}${cf.poster_path}`} alt="" width={22} height={33} loading="lazy"
                          style={{ width: 22, height: 33, objectFit: "cover", borderRadius: 3, border: "1px solid var(--line2)", flex: "0 0 auto" }}
                        />
                      ) : null}
                      {cf.title}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="lvcell"><div className={`lvn ${h}`}>{lv}</div><div className="lvd">/5</div></div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="mainpad ec-wrap">
      <h1 className="secttl">Appraisal</h1>
      <p className="secsub">The full Cinecodex evaluation — fundamentals, confidence, and canon standing, side by side. Never blended.</p>

      {/* MY POSITION — the personal layer, above the hero */}
      <MyPositionBar d={d} pos={pos} />

      {/* HERO */}
      <div className="fhero">
        <div className="fposter" style={d.poster_path ? { backgroundImage: `url(${IMG185}${d.poster_path})` } : {}} />
        <div className="fmeta">
          <div className="ftitle">{d.title} {d.year ? <small>{d.year}</small> : null}</div>
          <div className="fsub">{[d.year, d.director, ...(d.standing.labels ?? [])].filter(Boolean).join(" · ")}</div>
          <div className="fbadges">
            <span className="tierbadge"><i className="ti ti-award" /><span className="lv">L{al}</span> {AES[al - 1]} <span className="of">/ 10 aesthetic stages</span></span>
            <span className="polarbadge"><i className="ti ti-git-branch" style={{ fontSize: 11 }} /> Divisiveness {pBand} · POLAR {pBand}</span>
          </div>
        </div>
        <div className="axisgrid">
          <Donut val={d.v} color="var(--safe)" label={<><b>V</b> Earned value</>} of="what it gives back · higher ↑" />
          <Donut val={d.c} color="var(--frontier)" label={<><b>C</b> Entry cost</>} of="difficulty · not value" />
          <Donut val={d.r} color="var(--risk)" label={<><b>R</b> Risk</>} of={r <= 20 ? "low risk · safe" : "Caution"} />
          <div className="uscell">
            <div className="usbig"><span className="n" style={{ color: "var(--safe)" }}>{d.u}</span>
              <span className="lab"><span className="k">U Net value</span><span className="d">= V {v} − λ·R (λ 1.0)</span></span></div>
            <div className="usrow"><span className="n">{d.s.toFixed(2)}</span><span className="lab">S Sharpe · value per unit of risk</span></div>
          </div>
          <div className="verdict"><i className="ti ti-shield-check" />
            <div>One-line verdict · <b>{verdict}</b> <span style={{ color: "var(--sub)" }}> Stage L{al} {"“"}{AES[al - 1]}{"”"} · Entry cost C {c} — {c < 40 ? "readily accessible" : "Preparation needed"}. The aesthetic ladder is a qualitative layer on V — read it apart from the score.</span></div>
          </div>
        </div>
      </div>

      {/* 13 SUB-SCORES */}
      <div className={`mod${subsOpen ? "" : " closed"}`}>
        <div className="modh clk" onClick={() => setSubsOpen((o) => !o)}>
          <h3><i className="ti ti-list-numbers" /> 13 sub-scores · dimensional breakdown</h3>
          <span className="meta">level + rationale + 3 nearest comparisons (measured)</span>
          <i className="ti ti-chevron-down cx" />
        </div>
        <div className="modbody">
          {group("v", "V Earned value", "Cognition · Affect · Form · Moral · Duration")}
          {group("c", "C Entry cost", "Intertext · Formal Radicalism · Extratext · Oeuvre")}
          {group("r", "R Risk", "Bankruptcy · Insincerity · Cowardice · Polarization")}
          <div className="formula"><i className="ti ti-function" style={{ color: "var(--canon)" }} /> V = mean(COG·AFF·FORM·MORAL·DUR) → <b style={{ color: "#5fd0b2" }}>{v}</b> · C = mean(ITX·FR·ETX·CTX) → <b style={{ color: "#86b9ec" }}>{c}</b> · R = 0.6·mean(BANK·INSINCERE·COWARD) + 0.4·POLAR → <b style={{ color: "#e3a3cf" }}>{r}</b>. Difficulty (C) is <b style={{ color: "var(--mut)" }}>a cost, not a value</b> · divisiveness (POLAR) is <b style={{ color: "var(--mut)" }}>a risk, not distrust</b>. Comparisons are the <b style={{ color: "var(--mut)" }}>3 measured nearest films</b> on each dimension.</div>
        </div>
      </div>

      {/* TRIPTYCH */}
      <div className="mod">
        <div className="modh"><h3><i className="ti ti-columns-3" /> Side by side · three pillars <span style={{ color: "var(--sub)", fontWeight: 400 }}>(★ never blended)</span></h3><span className="meta">ours ≠ external ≠ canon</span></div>
        <div className="modbody">
          <div className="triptych">
            <div className="tcol ours"><div className="thd"><i className="ti ti-microscope" /> Ours · Cinecodex <span className="tag">fundamentals</span></div>
              <div className="tmetric"><span className="mk">V Earned value</span><span className="mv" style={{ color: "#5fd0b2" }}>{v}</span></div>
              <div className="tmetric"><span className="mk">R Risk</span><span className="mv" style={{ color: "var(--risk)" }}>{r}</span></div>
              <div className="tmetric"><span className="mk">U Net value</span><span className="mv" style={{ color: "#5fd0b2" }}>{d.u}</span></div>
              <div className="foot">Film <b style={{ color: "var(--mut)" }}>fundamentals</b>, LLM-scored on a 13-dimension rubric. External signals and Standing never enter the formula.</div></div>
            <div className="tcol ext"><div className="thd"><i className="ti ti-world" /> External signals <span className="tag">aggregate</span></div>
              <div className="tmetric"><span className="mk">IMDb</span><span className="mv" style={{ color: "#86b9ec" }}>{d.ext?.imdb ?? "—"}<small>/10</small></span></div>
              <div className="tmetric"><span className="mk">Metacritic</span><span className="mv" style={{ color: "#86b9ec" }}>{d.ext?.meta ?? "—"}<small>/100</small></span></div>
              <div className="tmetric"><span className="mk">Rotten Tomatoes</span><span className="mv" style={{ color: "#86b9ec" }}>{d.ext?.rt ?? "—"}<small>%</small></span></div>
              <div className="foot">Audience & critics <b style={{ color: "var(--mut)" }}>aggregates</b>. Reference and validation only — never an input to our scores.</div></div>
            <div className="tcol canon"><div className="thd"><i className="ti ti-building-bank" /> Canon · Standing <span className="tag">market price</span></div>
              <div className="tmetric"><span className="mk">Standing</span><span className="mv" style={{ color: "#e0bb6e" }}>{pr ?? "—"}</span></div>
              <div className="tmetric"><span className="mk">Listings · awards</span><span className="mv" style={{ color: "var(--mut)", fontSize: 12 }}>{(d.standing.labels ?? []).slice(0, 2).join("·") || "—"}</span></div>
              <div className="tmetric"><span className="mk">Tier</span><span className="mv" style={{ color: "var(--mut)", fontSize: 12 }}>{tierLabel}</span></div>
              <div className="foot">Engine ② <b style={{ color: "var(--mut)" }}>Market price</b> — has the world recognized it. A separate axis from our V (fundamentals).</div></div>
          </div>
          <div className="nomerge"><i className="ti ti-arrows-diff" /> These three columns are <b style={{ color: "var(--ink)" }}>never merged into one number.</b> {nomerge}</div>
        </div>
      </div>

      {/* RELIABILITY */}
      <div className={`mod${relOpen ? "" : " closed"}`}>
        <div className="modh clk" onClick={() => setRelOpen((o) => !o)}>
          <h3><i className="ti ti-shield-check" /> Confidence & reproducibility</h3><span className="meta">non-determinism, disclosed honestly</span><i className="ti ti-chevron-down cx" />
        </div>
        <div className="modbody">
          <div className="relgrid">
            <div>
              <div className="ec-kv"><span className="k">panel</span><span className="v">{rel.panel ?? "—"}</span></div>
              <div className="ec-kv"><span className="k">prompt_version</span><span className="v">{rel.prompt_version ?? "—"}</span></div>
              <div className="ec-kv"><span className="k">scored_at</span><span className="v">{rel.scored_at ? String(rel.scored_at).slice(0, 10) : "—"}</span></div>
              <div className="ec-kv"><span className="k">Confidence tier</span><span className="v">{d.tier ?? "—"}{d.conf != null ? ` · ${d.conf}` : ""}</span></div>
            </div>
            <div>
              <div className="ec-kv"><span className="k">Evidence corpus</span><span className="v">{d.n_takes ?? 0} takes</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* REFERENCE BASKET — v2: 20-row U-rank window around this film */}
      {d.basket && d.basket.length ? (
        <div className="mod">
          <div className="modh">
            <h3><i className="ti ti-arrows-sort" /> Reference basket · U rank</h3>
            <span className="meta">
              {d.rank != null && d.rank_total != null ? `#${d.rank} of ${d.rank_total} · ` : ""}
              the 20 films ranked around this one · high U, low R is the ideal
            </span>
          </div>
          <div className="modbody">
            <div className="baskrow" aria-hidden style={{ gridTemplateColumns: "34px 24px 1fr 34px 30px", padding: "0 6px 5px 8px", fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sub)", borderBottom: "1px solid var(--line2, #24242a)", marginBottom: 3 }}>
              <span>#</span><span /><span>Film</span><span style={{ textAlign: "right" }}>U</span><span style={{ textAlign: "right" }}>R</span>
            </div>
            <div ref={ladderRef} style={{ maxHeight: 330, overflowY: "auto", position: "relative" }}>
              {d.basket.map((b) => (
                <div
                  className="baskrow"
                  key={b.slug}
                  data-self={b.self ? "1" : undefined}
                  style={{
                    gridTemplateColumns: "34px 24px 1fr 34px 30px",
                    padding: "3px 6px 3px 8px",
                    ...(b.self ? { background: "var(--pnl2)", borderRadius: 5, boxShadow: "inset 2px 0 0 var(--safe)" } : {}),
                  }}
                >
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: b.self ? "var(--safe)" : "var(--sub)", fontVariantNumeric: "tabular-nums" }}>{b.rank ?? "—"}</span>
                  {b.poster_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${IMG}${b.poster_path}`} alt="" width={18} height={27} loading="lazy"
                      style={{ width: 18, height: 27, objectFit: "cover", borderRadius: 2, border: "1px solid var(--line2)" }}
                    />
                  ) : (
                    <span style={{ width: 18, height: 27, borderRadius: 2, background: "var(--pnl3)" }} />
                  )}
                  {b.self ? (
                    <span className="nm" style={{ color: "#5fd0b2" }}>
                      {b.title}{b.year ? <span style={{ fontFamily: "var(--ui)", fontSize: 10, color: "var(--sub)" }}> {b.year}</span> : null}
                      <span style={{ fontFamily: "var(--ui)", fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--safe)", marginLeft: 7 }}>◂ this film</span>
                    </span>
                  ) : (
                    <Link className="nm" href={`/room/film/${b.slug}`} title={`Open the appraisal for ${b.title}`}>
                      {b.title}{b.year ? <span style={{ fontFamily: "var(--ui)", fontSize: 10, color: "var(--sub)" }}> {b.year}</span> : null}
                    </Link>
                  )}
                  <span className="bu">{b.u}</span><span className="br">{b.r}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 9.5, color: "var(--sub)", marginTop: 7 }}>U = V − λ·R. R renders in <span style={{ color: "var(--risk)" }}>--risk</span> — never --red.</div>
          </div>
        </div>
      ) : null}

      <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 2, textAlign: "center" }}>Engine ⑨ intrinsic value · Cinecodex — the second objective axis beside Standing (②) · never blended, one-way</div>
    </div>
  );
}
