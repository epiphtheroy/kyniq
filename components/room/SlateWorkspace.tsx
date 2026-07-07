"use client";
/** Slate — the real watchlist (spec §3.3): me_watchlist_scored's /room debut and
 *  the only screen that handles the decay of commitment. Deal-flow table with
 *  V/C/R microbars (returned but never rendered in v2), added date and an
 *  honest Age badge (Fresh <30d / Aging 30–90d / Stale >90d). Row actions are
 *  the conversion verbs: Seen (me_mark_seen), Rate (Stars → rate_film, rating
 *  implies seen) and Release (me_set_watchlist off). The streaming rollup rail
 *  is an honest placeholder until §8-R6 wires availability into the RPC — the
 *  header shows NO streaming count for the same reason (never fake a number). */
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { IMG, num } from "@/lib/room/format";
import { STR } from "./strings";
import CinecodexCard from "./CinecodexCard";
import Stars from "./Stars";
import ICard from "./insp/ICard";
import KV from "./insp/KV";
import SelHead from "./insp/SelHead";
import ActBar from "./insp/ActBar";
import { useInspector } from "./InspectorContext";
import { useRoomActions } from "./useRoomActions";

/** me_watchlist_scored row (0033 snapshot) — PostgREST numerics may arrive as strings. */
export type SlateRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  rating: number | string | null;
  added_at: string | null;
  v: number | string | null; c: number | string | null; r: number | string | null;
};

const PAGE = 50;

type SortKey = "added" | "utility" | "age";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "added", label: "Added" },
  { key: "utility", label: "Utility (V−R)" },
  { key: "age", label: "Age" },
];

/** Whole days since the film was added; null when the date is missing/unparsable. */
function ageDays(added: string | null): number | null {
  if (!added) return null;
  const t = Date.parse(added);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function AgeBadge({ d }: { d: number | null }) {
  if (d == null) return null;
  if (d > 90) return <span className="agebd stale">{STR.common.ageStale(d)}</span>;
  if (d >= 30) return <span className="agebd aging">{STR.common.ageAging(d)}</span>;
  return <span className="agebd">{STR.common.ageFresh}</span>;
}

/** V/C/R microbars — ours only (never blended with ★ or external signals). */
function Vcr({ v, c, r }: { v: number | null; c: number | null; r: number | null }) {
  if (v == null && c == null && r == null) return <div className="sl-unscored">Unscored</div>;
  const bar = (k: string, val: number | null, cls: string) => (
    <div className={`b ${cls}`}>
      <span className="k">{k}</span>
      <span className="tr"><i style={{ width: `${val == null ? 0 : Math.max(0, Math.min(100, val))}%` }} /></span>
      <span className="n">{val == null ? "—" : Math.round(val)}</span>
    </div>
  );
  return (
    <div className="sl-vcr">
      {bar("V", v, "v")}
      {bar("C", c, "c")}
      {bar("R", r, "r")}
    </div>
  );
}

const onKey = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); fn(); }
};

export default function SlateWorkspace({ rows }: { rows: SlateRow[] }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const { session, doSeen, doRate, doRelease } = useRoomActions();

  const [q, setQ] = useState("");
  const [staleOnly, setStaleOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("added");
  const [page, setPage] = useState(0);
  /* Rows released this session — server rows need a local mask (SessionStore's
     kept set only tracks session keeps, not server-loaded slate rows). */
  const [released, setReleased] = useState<ReadonlySet<string>>(new Set<string>());

  /* ── visible slate: session conversions (seen/rated → gone) and releases drop out ── */
  const visible = useMemo(
    () => rows.filter((f) => !session.gone.has(f.slug) && !released.has(f.slug)),
    [rows, session.gone, released],
  );

  const oldest = useMemo(() => {
    let max: number | null = null;
    for (const f of visible) {
      const d = ageDays(f.added_at);
      if (d != null && (max == null || d > max)) max = d;
    }
    return max;
  }, [visible]);
  const staleCount = useMemo(
    () => visible.filter((f) => (ageDays(f.added_at) ?? 0) > 90).length,
    [visible],
  );

  const filtered = useMemo(() => {
    let a = visible;
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      a = a.filter((f) => f.title.toLowerCase().includes(t) || (f.director ?? "").toLowerCase().includes(t));
    }
    if (staleOnly) a = a.filter((f) => (ageDays(f.added_at) ?? 0) > 90);
    return a;
  }, [visible, q, staleOnly]);

  const sorted = useMemo(() => {
    if (sort === "added") return filtered; // server order: added_at desc
    if (sort === "utility") {
      return [...filtered].sort((x, y) => {
        const ux = num(x.v) != null && num(x.r) != null ? (num(x.v) as number) - (num(x.r) as number) : null;
        const uy = num(y.v) != null && num(y.r) != null ? (num(y.v) as number) - (num(y.r) as number) : null;
        return (uy ?? -Infinity) - (ux ?? -Infinity);
      });
    }
    // age: oldest first (largest age on top); rows without a date sink
    return [...filtered].sort((x, y) => (ageDays(y.added_at) ?? -1) - (ageDays(x.added_at) ?? -1));
  }, [filtered, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const p = Math.min(page, pages - 1);
  const pageRows = useMemo(() => sorted.slice(p * PAGE, (p + 1) * PAGE), [sorted, p]);

  /* ── conversion verbs (same-mutation principle: useRoomActions only) ── */
  const handleSeen = useCallback((f: SlateRow) => { insp.close(); void doSeen(f.slug, f.title); }, [doSeen, insp]);
  const handleRate = useCallback((f: SlateRow, v: number) => { insp.close(); void doRate(f.slug, f.title, v); }, [doRate, insp]);
  const handleRelease = useCallback(async (f: SlateRow) => {
    insp.close();
    setReleased((s) => new Set(s).add(f.slug)); // optimistic — rolls back on failure
    const ok = await doRelease(f.slug, f.title);
    if (!ok) setReleased((s) => { const n = new Set(s); n.delete(f.slug); return n; });
  }, [doRelease, insp]);

  const openFilm = useCallback((f: SlateRow) => {
    const d = ageDays(f.added_at);
    insp.select(
      <div>
        <SelHead
          title={f.title}
          sub={<>{f.year ?? "?"}{f.director ? ` · ${f.director}` : ""}</>}
          posterPath={f.poster_path}
          href={`/room/film/${f.slug}`}
        />
        <ICard icon="ti-stack-2" title="On the slate">
          <KV k="Added" v={f.added_at ? f.added_at.slice(0, 10) : "—"} />
          <KV k="Age" v={d == null ? "—" : `${d}d`} />
        </ICard>
        <CinecodexCard d={{ v: num(f.v), c: num(f.c), r: num(f.r) }} slug={f.slug} />
        <ICard icon="ti-player-play" title={STR.insp.actNow}>
          <ActBar
            acts={[
              { label: STR.row.seen, primary: true, onClick: () => handleSeen(f) },
              { label: "Release", title: "Release from the slate", onClick: () => void handleRelease(f) },
            ]}
            style={{ marginBottom: 10, marginTop: 0 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Stars
              value={session.reRated[f.slug] ?? num(f.rating) ?? 0}
              onPick={(v) => handleRate(f, v)}
              title={STR.insp.myRating}
            />
            <span style={{ fontSize: 10.5, color: "var(--sub)" }}>{STR.insp.ratingHint}</span>
          </div>
        </ICard>
      </div>,
      f.title,
    );
  }, [insp, session.reRated, handleSeen, handleRelease, handleRate]);

  /* ── page brief (Brief button — never auto-opened) ── */
  useEffect(() => {
    setDefault(
      <div>
        <ICard icon="ti-stack-2" title="Slate brief">
          <KV k="Kept films" v={visible.length} />
          <KV k="Oldest" v={oldest == null ? "—" : `${oldest}d`} />
          <KV k={"Stale (>90d)"} v={staleCount} />
        </ICard>
        <div className="emptyins">
          Commitments age honestly. Seen converts a film into a position, Release lets it go. Streaming counts appear once availability is wired to this list — never faked.
        </div>
      </div>,
    );
  }, [visible.length, oldest, staleCount, setDefault]);

  return (
    <div className="v2wrap">
      <div>
        <h1 className="v2title">Slate</h1>
        <p className="v2sub">Your kept films — the real watchlist. Commitments age here; convert or release them.</p>
      </div>

      <div className="sl-cols">
        <div>
          {/* ═══ header stats — count · oldest age (no streaming count: RPC lacks it) ═══ */}
          <div className="kpis sl-kpis">
            <div className="kpi">
              <div className="kl">On the slate</div>
              <div className="kn">{visible.length}</div>
            </div>
            <div className="kpi">
              <div className="kl">Oldest commitment</div>
              <div className="kn">{oldest == null ? "—" : `${oldest}d`}</div>
            </div>
          </div>

          {visible.length ? (
            <>
              {/* ═══ toolbar ═══ */}
              <div className="toolbar sl-bar">
                <div className="srch">
                  <i className="ti ti-search" />
                  <input
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setPage(0); }}
                    placeholder="Search title · director"
                  />
                </div>
                <div className="xseg">
                  {SORTS.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      className={sort === s.key ? "on" : ""}
                      onClick={() => { setSort(s.key); setPage(0); }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {sort !== "added" ? <span className="sl-resorted">{STR.common.resortedClient}</span> : null}
                <button
                  type="button"
                  className={`qtoggle${staleOnly ? " on" : ""}`}
                  onClick={() => { setStaleOnly((v) => !v); setPage(0); }}
                >
                  <span className="dot sl-staledot" /> Stale only
                </button>
              </div>

              {/* ═══ deal-flow table ═══ */}
              {pageRows.length ? pageRows.map((f) => {
                const d = ageDays(f.added_at);
                return (
                  <div key={f.slug} className="sl-row" role="button" tabIndex={0}
                    onClick={() => openFilm(f)} onKeyDown={onKey(() => openFilm(f))}>
                    <span className="sl-po" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}} />
                    <div style={{ minWidth: 0 }}>
                      <div className="sl-t">{f.title}<small>{f.year ?? ""}{f.director ? ` · ${f.director}` : ""}</small></div>
                      <div className="sl-m">
                        <span className="sl-added" title="Added to the slate">{f.added_at ? f.added_at.slice(0, 10) : "—"}</span>
                      </div>
                    </div>
                    <Vcr v={num(f.v)} c={num(f.c)} r={num(f.r)} />
                    <div className="sl-agecell"><AgeBadge d={d} /></div>
                    <div className="sl-act" onClick={(e) => e.stopPropagation()}>
                      <Stars
                        value={session.reRated[f.slug] ?? num(f.rating) ?? 0}
                        onPick={(v) => handleRate(f, v)}
                        size={14}
                        title="Rate — logs as seen"
                      />
                      <span className="ab" role="button" tabIndex={0} title={STR.row.seen}
                        onClick={() => handleSeen(f)} onKeyDown={onKey(() => handleSeen(f))}>
                        <i className="ti ti-check" />
                      </span>
                      <span className="ab" role="button" tabIndex={0} title="Release from the slate"
                        onClick={() => void handleRelease(f)} onKeyDown={onKey(() => void handleRelease(f))}>
                        <i className="ti ti-bookmark-off" />
                      </span>
                    </div>
                  </div>
                );
              }) : (
                <div className="emptyins">No slate films match the current filters.</div>
              )}

              {/* ═══ pagination (50/page over the .range()-loaded full list) ═══ */}
              {pages > 1 ? (
                <div className="pgn">
                  <button type="button" disabled={p === 0} onClick={() => setPage(p - 1)}>←</button>
                  <span className="pc">{p + 1} / {pages}</span>
                  <button type="button" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>→</button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="sl-empty">
              {STR.empty.slate}
              <div><Link href="/room/screener">Open the Screener →</Link></div>
            </div>
          )}
        </div>

        {/* ═══ streaming rollup rail — honest placeholder until §8-R6 wires avail ═══ */}
        <aside className="sl-rail">
          <div className="icard">
            <h4><i className="ti ti-antenna-bars-3" /> Streaming rollup</h4>
            <p className="sl-railcopy">Availability not yet wired to the slate (≠ unavailable).</p>
            <p className="sl-railnote">When it lands, this rail rolls your slate up by provider. Until then we show nothing rather than a made-up number.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
