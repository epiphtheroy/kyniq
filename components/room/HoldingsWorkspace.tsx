"use client";
/** /room/holdings — every seen film as a position (v3, spec §3.5). The ONLY full
 *  surface of me_collection's 20 columns. Core table = poster · position ·
 *  Standing · My ★ (inline re-rate) · Verdict; the remaining columns ride on
 *  column-set toggle chips (persisted in localStorage) grouped BY SCORE FAMILY —
 *  ours / external / canon stay visually separated (never-blend invariant).
 *  Page offset lives in the URL (?p=3, replaceState) so back-nav is safe.
 *  Verdict + Contrarian math comes from lib/room/format (thresholds disclosed
 *  in .gloss tooltips — no hidden formulas). */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  num, IMG, verdictOf, VERDICT_FIND, VERDICT_LETDOWN, FACET_LABEL, type CollRow,
} from "@/lib/room/format";
import { STR } from "./strings";
import { useInspector } from "./InspectorContext";
import { useRoomActions } from "./useRoomActions";
import Stars from "./Stars";
import CinecodexCard from "./CinecodexCard";
import SelHead from "./insp/SelHead";
import ICard from "./insp/ICard";
import KV from "./insp/KV";

const PAGE = 50;
const LS_COLS = "mt_holdings_cols";
const VTIP = `Verdict = My ★×20 − Standing · Find ≥ +${VERDICT_FIND} · Letdown ≤ ${VERDICT_LETDOWN} · else Aligned`;

/* Column sets — one chip per score family (never-blend: families toggle as blocks,
   never interleaved). "log" is bookkeeping (added_at · facets), not a score. */
const COLSETS = [
  { key: "ours", label: "Ours V·C·R·U", title: "Our fundamentals — never blended with external or canon" },
  { key: "external", label: "External IMDb·RT·MC", title: "Audience & critics — a separate family" },
  { key: "canon", label: "Canon detail", title: "Discovery · confidence · tier" },
  { key: "log", label: "Log added·facets", title: "When the position opened, and its coverage facets" },
] as const;
type ColKey = (typeof COLSETS)[number]["key"];

const GRID_CORE = "44px minmax(190px,1.7fr) 70px 116px 96px";
const GRID_EXTRA: Record<ColKey, string> = {
  ours: " 44px 44px 44px 44px",
  external: " 52px 48px 44px 62px",
  canon: " 52px 48px 76px",
  log: " 92px minmax(110px,1fr)",
};
const MINW_EXTRA: Record<ColKey, number> = { ours: 216, external: 246, canon: 216, log: 242 };

const fmtInt = (x: unknown) => { const n = num(x); return n == null ? "—" : String(Math.round(n)); };
const fmtVotes = (x: unknown) => {
  const n = num(x);
  return n == null ? "—" : new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
};
const fmtGap = (g: number) => (g > 0 ? `+${g}` : String(g));
/* Contrarian magnitude = |My ★×20 − V| (my call vs the codex analysis). */
const contra = (r: CollRow): number | null => {
  const rt = num(r.rating), v = num(r.v);
  return rt == null || v == null ? null : Math.abs(rt * 20 - v);
};

/** Position inspector — SelHead + bookkeeping + the CinecodexCard triptych fed
 *  ENTIRELY from row data (imdb/rt/meta/votes/conf/tier/discovery — no extra RPC)
 *  + inline re-rate. Composed from the shared primitives because RecInsp's
 *  RecFilm contract has no external-signal fields. */
function PositionInsp({ f, onRate }: { f: CollRow; onRate: (f: CollRow, v: number) => void }) {
  const [local, setLocal] = useState<number | null>(null);
  useEffect(() => { setLocal(null); }, [f.slug]);
  const rt = local ?? num(f.rating);
  const vd = verdictOf(rt, num(f.prestige));
  return (
    <div>
      <SelHead title={f.title} sub={<>{f.year ?? "?"}{f.director ? ` · ${f.director}` : ""}</>} posterPath={f.poster_path} />
      <ICard icon="ti-list-details" title="Position">
        <KV k="Opened" v={(f.added_at ?? "").slice(0, 10) || "—"} />
        <KV k="My rating" v={rt != null ? `★${rt.toFixed(1)}` : "—"} />
        <KV k="Verdict" v={vd ? `${vd.label} ${fmtGap(vd.gap)}` : "—"} title={VTIP} />
        {f.facets?.length ? (
          <div className="hfacets" style={{ marginTop: 6 }}>
            {f.facets.map((x) => <span className="fct" key={x}>{FACET_LABEL[x] ?? x}</span>)}
          </div>
        ) : null}
      </ICard>
      <CinecodexCard showBadge slug={f.slug} d={{
        v: num(f.v), c: num(f.c), r: num(f.r), u: num(f.u),
        prestige: num(f.prestige), discovery: num(f.discovery), conf: num(f.conf), tier: f.tier,
        imdb: num(f.imdb), rt: num(f.rt), meta: num(f.meta), votes: num(f.votes),
        ratingPct: rt != null ? Math.round(rt * 20) : null,
      }} />
      <ICard icon="ti-player-play" title={STR.insp.actNow}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Stars value={rt ?? 0} onPick={(v) => { setLocal(v); onRate(f, v); }} title={STR.insp.myRating} />
          <span style={{ fontSize: 10.5, color: "var(--sub)" }}>{STR.insp.ratingHint}</span>
        </div>
      </ICard>
    </div>
  );
}

export default function HoldingsWorkspace({ rows, initialPage }: { rows: CollRow[]; initialPage: number }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const { session, doRate } = useRoomActions();

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "rating" | "prestige" | "contrarian">("recent");
  const [facetsSel, setFacetsSel] = useState<Set<string>>(new Set());
  const [decade, setDecade] = useState<string>("all");
  const [findsOnly, setFindsOnly] = useState(false);
  const [page, setPage] = useState(initialPage);
  const [colsets, setColsets] = useState<Set<ColKey>>(new Set());

  /* Column-set chips persist in localStorage (loaded post-mount — SSR-safe). */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_COLS);
      if (raw) {
        const keys = (JSON.parse(raw) as string[]).filter((k): k is ColKey => COLSETS.some((c) => c.key === k));
        setColsets(new Set(keys));
      }
    } catch { /* corrupt storage → core columns */ }
  }, []);
  const toggleColset = useCallback((k: ColKey) => {
    setColsets((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      try { localStorage.setItem(LS_COLS, JSON.stringify([...next])); } catch { /* private mode */ }
      return next;
    });
  }, []);

  /* Optimistic re-rate overlay (SessionStore — survives route changes). */
  const eff = useMemo(
    () => rows.map((r) => (session.reRated[r.slug] != null ? { ...r, rating: session.reRated[r.slug] } : r)),
    [rows, session.reRated]
  );

  /* Portfolio-level summary (all positions, unfiltered). */
  const sum = useMemo(() => {
    let rated = 0, finds = 0, letdowns = 0, rSum = 0;
    for (const r of eff) {
      const rt = num(r.rating);
      if (rt != null) { rated += 1; rSum += rt; }
      const vd = verdictOf(rt, num(r.prestige));
      if (vd?.code === "find") finds += 1;
      else if (vd?.code === "letdown") letdowns += 1;
    }
    return { total: eff.length, rated, finds, letdowns, avg: rated ? rSum / rated : null };
  }, [eff]);

  /* Facet chips render only facets that actually exist in the data. */
  const facetCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) for (const f of r.facets ?? []) m.set(f, (m.get(f) ?? 0) + 1);
    return m;
  }, [rows]);
  const facetKeys = useMemo(() => {
    const known = Object.keys(FACET_LABEL).filter((k) => facetCounts.has(k));
    const extra = [...facetCounts.keys()].filter((k) => !(k in FACET_LABEL)).sort();
    return [...known, ...extra];
  }, [facetCounts]);

  const decades = useMemo(() => {
    const ds = new Set<number>();
    for (const r of rows) if (r.year != null) ds.add(Math.floor(r.year / 10) * 10);
    return [...ds].sort((a, b) => b - a);
  }, [rows]);

  /* ── filter + sort → view ── */
  const facetSig = useMemo(() => [...facetsSel].sort().join(","), [facetsSel]);
  const view = useMemo(() => {
    let a = eff;
    const t = q.trim().toLowerCase();
    if (t) a = a.filter((r) => r.title.toLowerCase().includes(t) || (r.director ?? "").toLowerCase().includes(t));
    if (facetsSel.size) a = a.filter((r) => (r.facets ?? []).some((x) => facetsSel.has(x))); // chips union (OR)
    if (decade !== "all") a = a.filter((r) => r.year != null && Math.floor(r.year / 10) * 10 === Number(decade));
    if (findsOnly) a = a.filter((r) => verdictOf(num(r.rating), num(r.prestige))?.code === "find");
    const s = [...a];
    if (sort === "recent") s.sort((x, y) => (y.added_at ?? "").localeCompare(x.added_at ?? ""));
    else if (sort === "rating") s.sort((x, y) => (num(y.rating) ?? -1) - (num(x.rating) ?? -1));
    else if (sort === "prestige") s.sort((x, y) => (num(y.prestige) ?? -1) - (num(x.prestige) ?? -1));
    else s.sort((x, y) => (contra(y) ?? -1) - (contra(x) ?? -1));
    return s;
  }, [eff, q, facetsSel, decade, findsOnly, sort]);

  /* Filter changes reset to page 1 — but never clobber the URL-restored initial page. */
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    setPage(1);
  }, [q, facetSig, decade, findsOnly, sort]);

  const pages = Math.max(1, Math.ceil(view.length / PAGE));
  const cur = Math.min(Math.max(1, page), pages);

  /* Keep ?p= in the URL (replaceState — no history spam; back-nav restores the offset). */
  useEffect(() => {
    const url = new URL(window.location.href);
    if (cur > 1) url.searchParams.set("p", String(cur)); else url.searchParams.delete("p");
    window.history.replaceState(null, "", url.toString());
  }, [cur]);

  const slice = view.slice((cur - 1) * PAGE, cur * PAGE);

  const rate = useCallback(async (f: CollRow, v: number) => {
    await doRate(f.slug, f.title, v); // reRated overlay updates the table live
  }, [doRate]);

  const openRow = useCallback((f: CollRow) => {
    insp.select(<PositionInsp f={f} onRate={rate} />, f.title);
  }, [insp, rate]);

  /* ── page brief ── */
  useEffect(() => {
    setDefault(
      <div>
        <ICard icon="ti-list-details" title="Holdings summary">
          <KV k="Positions (seen)" v={sum.total} />
          <KV k="Rated" v={sum.rated} />
          <KV k={STR.common.verdictFind + "s"} v={sum.finds} title={VTIP} />
          <KV k={STR.common.verdictLetdown + "s"} v={sum.letdowns} title={VTIP} />
          <KV k="Avg ★" v={sum.avg != null ? sum.avg.toFixed(2) : "—"} />
        </ICard>
        <div className="emptyins">Click any row — the full Cinecodex card and re-rating open here.</div>
      </div>
    );
  }, [setDefault, sum]);

  /* ── grid template + min width follow the active column sets ── */
  const template = GRID_CORE + COLSETS.map((c) => (colsets.has(c.key) ? GRID_EXTRA[c.key] : "")).join("");
  const minWidth = 570 + COLSETS.reduce((w, c) => w + (colsets.has(c.key) ? MINW_EXTRA[c.key] : 0), 0);

  if (rows.length === 0) {
    return (
      <div className="v2wrap">
        <div>
          <h1 className="v2title">Holdings</h1>
          <p className="v2sub">Every seen film, held as a position.</p>
        </div>
        <div className="emptyins" style={{ textAlign: "left", padding: "10px 4px" }}>
          {STR.empty.holdings}{" "}
          <Link href="/me/import" style={{ color: "var(--mut)", textDecoration: "underline" }}>{STR.forming.importCta}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="v2wrap">
      <div>
        <h1 className="v2title">Holdings</h1>
        <p className="v2sub">{sum.total} positions · {sum.rated} rated — my ★, Standing and fundamentals never blend.</p>
      </div>

      <div>
        {/* toolbar: search · sort · facets · decade · Finds only */}
        <div className="xtoolbar">
          <div className="xsearch"><i className="ti ti-search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search holdings" /></div>
          <div className="xseg">
            {([["recent", "Recent", "Latest positions first"], ["rating", "My ★", "My rating, high to low"],
              ["prestige", "Standing", "Canon standing, high to low"],
              ["contrarian", "Contrarian", "Sort by |My ★×20 − V| — your boldest calls vs the codex"]] as const).map(([k, l, tip]) => (
              <button key={k} type="button" className={sort === k ? "on" : ""} title={tip} onClick={() => setSort(k)}>{l}</button>
            ))}
          </div>
          <select className="select" value={decade} onChange={(e) => setDecade(e.target.value)} title="Filter by release decade">
            <option value="all">All decades</option>
            {decades.map((d) => <option key={d} value={String(d)}>{d}s</option>)}
          </select>
          <div className={`findtoggle${findsOnly ? " on" : ""}`} onClick={() => setFindsOnly((v) => !v)} title={VTIP}>
            <i className="ti ti-diamond" /> Finds only <span className="ct">{sum.finds}</span>
          </div>
        </div>
        <div className="xtoolbar colbar">
          {facetKeys.length ? (
            <>
              <span className="lbl">Facets</span>
              {facetKeys.map((k) => (
                <button key={k} type="button" className={`fchip${facetsSel.has(k) ? " on" : ""}`}
                  onClick={() => setFacetsSel((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; })}>
                  {FACET_LABEL[k] ?? k} <span className="ct">{facetCounts.get(k)}</span>
                </button>
              ))}
              <span className="csep" />
            </>
          ) : null}
          <span className="lbl">Columns</span>
          {COLSETS.map((c) => (
            <button key={c.key} type="button" className={`fchip${colsets.has(c.key) ? " on" : ""}`} title={c.title}
              onClick={() => toggleColset(c.key)}>{c.label}</button>
          ))}
        </div>

        {/* positions table */}
        <div className="htwrap">
          <div style={{ minWidth }}>
            <div className="hthead" style={{ gridTemplateColumns: template }}>
              <span />
              <span className="hh">Position</span>
              <span className="hh r gsep gloss" title="Canon standing — listings, awards, tier (0–100)">Standing</span>
              <span className="hh gsep">My ★</span>
              <span className="hh gsep gloss" title={VTIP}>Verdict</span>
              {colsets.has("ours") ? (<>
                <span className="hh r gsep gloss" title="Ours — earned value">V</span>
                <span className="hh r gloss" title="Ours — entry cost (difficulty, not value)">C</span>
                <span className="hh r gloss" title="Ours — letdown risk (lower is safer)">R</span>
                <span className="hh r gloss" title="Ours — net value">U</span>
              </>) : null}
              {colsets.has("external") ? (<>
                <span className="hh r gsep">IMDb</span><span className="hh r">RT</span>
                <span className="hh r">MC</span><span className="hh r">Votes</span>
              </>) : null}
              {colsets.has("canon") ? (<>
                <span className="hh r gsep gloss" title="Canon — discovery score">Disc</span>
                <span className="hh r gloss" title="Measured confidence">Conf</span>
                <span className="hh gloss" title="Confidence tier">Tier</span>
              </>) : null}
              {colsets.has("log") ? (<>
                <span className="hh gsep">Added</span><span className="hh">Facets</span>
              </>) : null}
            </div>

            {slice.map((f) => {
              const rt = num(f.rating), p = num(f.prestige);
              const vd = verdictOf(rt, p);
              return (
                <div key={f.slug} className="hrow" style={{ gridTemplateColumns: template }} onClick={() => openRow(f)}>
                  <span className="fpo" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}} />
                  <div style={{ minWidth: 0 }}>
                    <div className="ht">{f.title}<small>{f.year ?? ""}{f.director ? ` · ${f.director}` : ""}</small></div>
                  </div>
                  <span className="hnum br gsep">{p != null ? Math.round(p) : "—"}</span>
                  <span className="gsep"><Stars value={rt ?? 0} size={13} onPick={(v) => rate(f, v)} title={STR.insp.ratingHint} /></span>
                  <span className="gsep">
                    {vd
                      ? <span className={`vchip ${vd.code} gloss`} title={`My ★×20 − Standing = ${fmtGap(vd.gap)} · ${VTIP}`}>{vd.label} {fmtGap(vd.gap)}</span>
                      : <span className="hnum" style={{ textAlign: "left" }}>—</span>}
                  </span>
                  {colsets.has("ours") ? (<>
                    <span className="hnum gsep">{fmtInt(f.v)}</span><span className="hnum">{fmtInt(f.c)}</span>
                    <span className="hnum">{fmtInt(f.r)}</span><span className="hnum">{fmtInt(f.u)}</span>
                  </>) : null}
                  {colsets.has("external") ? (<>
                    <span className="hnum gsep">{num(f.imdb)?.toFixed(1) ?? "—"}</span>
                    <span className="hnum">{num(f.rt) != null ? `${Math.round(num(f.rt)!)}%` : "—"}</span>
                    <span className="hnum">{fmtInt(f.meta)}</span>
                    <span className="hnum">{fmtVotes(f.votes)}</span>
                  </>) : null}
                  {colsets.has("canon") ? (<>
                    <span className="hnum gsep">{fmtInt(f.discovery)}</span>
                    <span className="hnum">{fmtInt(f.conf)}</span>
                    <span className="htxt">{f.tier ?? "—"}</span>
                  </>) : null}
                  {colsets.has("log") ? (<>
                    <span className="hnum gsep" style={{ textAlign: "left" }}>{(f.added_at ?? "").slice(0, 10) || "—"}</span>
                    <span className="hfacets">{(f.facets ?? []).map((x) => <span className="fct" key={x}>{FACET_LABEL[x] ?? x}</span>)}</span>
                  </>) : null}
                </div>
              );
            })}
          </div>
        </div>

        {view.length === 0 ? (
          <div className="emptyins">No positions match — adjust search or filters.</div>
        ) : (
          <div className="pgn">
            <button type="button" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>←</button>
            <span className="pc">{cur}/{pages}</span>
            <button type="button" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>→</button>
            <span className="pc">{(cur - 1) * PAGE + 1}–{Math.min(cur * PAGE, view.length)} of {view.length}</span>
          </div>
        )}

        {/* position summary strip */}
        <div className="sumstrip mono">
          <span><b>{sum.total}</b> positions</span>
          <span><b>{sum.rated}</b> rated</span>
          <span><b>{sum.finds}</b> {STR.common.verdictFind}s</span>
          <span><b>{sum.letdowns}</b> {STR.common.verdictLetdown}s</span>
          <span>avg ★ <b>{sum.avg != null ? sum.avg.toFixed(2) : "—"}</b></span>
        </div>
      </div>
    </div>
  );
}
