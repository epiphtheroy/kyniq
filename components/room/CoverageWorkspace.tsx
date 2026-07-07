"use client";
/** /room/coverage — the Coverage instrument (spec §3.7): the lineage-conquest
 *  board (me_coverage) + the shipping debut of me_blindspots.
 *  Honesty invariants held here:
 *   - WWI rows carry NO lineage ids, so "Fill this gap" NEVER pretends precise
 *     matching: candidates are labeled as general lineage-advancers, and the
 *     no-candidate fallback links to the public /lineage/[slug] page.
 *     (Precise matching waits on §8-R4 me_lineage_candidates.)
 *   - Blind-spot taste fit shows its formula in a .gloss and discloses the
 *     cold-start neutral 0.70 (never a fake personalization signal).
 *   - Auteur-facet lineages are excluded — they have their own instrument
 *     (/room/auteurs), matching me_portfolio_nav's "lines" facet set. */
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { num, FACET_LABEL, REASON_MAP, type WwiRow } from "@/lib/room/format";
import { STR } from "./strings";
import { useInspector } from "./InspectorContext";
import { useRoomActions } from "./useRoomActions";
import FormingCard from "./FormingCard";
import RecInsp, { type RecFilm } from "./RecInsp";
import ICard from "./insp/ICard";
import KV from "./insp/KV";

/* ── RPC row types (PostgREST numerics can arrive as strings → num()) ── */
export type CovRow = {
  list_id: string; slug: string; label: string; facet: string;
  aw: number | string | null; seen: number | string | null; total: number | string | null;
  pct: number | string | null; state: string;
};
export type BlindRow = {
  list_id: string; slug: string; label: string; facet: string;
  aw: number | string | null; seen: number | string | null; total: number | string | null;
  ratio: number | string | null; productivity: number | string | null;
  opportunity: number | string | null; gap_reason: string;
};
/** null field = that RPC failed server-side → render .errcard, not empty data. */
export type CoverageData = {
  coverage: CovRow[] | null;
  blind: BlindRow[] | null;
  wwi: WwiRow[] | null;
};

const ErrCard = () => (
  <div className="errcard"><i className="ti ti-alert-triangle" />{STR.common.errorLoad}</div>
);

const onKey = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); fn(); }
};

const FACET_TABS = [
  { key: "all", label: "All" },
  { key: "canon", label: "Canon" },
  { key: "award", label: "Award" },
  { key: "festival", label: "Festival" },
  { key: "national", label: "National" },
  { key: "section", label: "Section" },
] as const;
type TabKey = (typeof FACET_TABS)[number]["key"];

/** Board groups in display order (spec: Near on top, Done collapsed). */
const GROUPS = [
  { key: "near", label: "Near", note: "75–99%", collapsible: false },
  { key: "prog", label: "In progress", note: "50–74%", collapsible: false },
  { key: "done", label: "Done", note: "100%", collapsible: true },
  { key: "lock", label: "Locked", note: "below 50%", collapsible: false },
] as const;

const LOCK_PREVIEW = 30;

type NormRow = {
  slug: string; label: string; facet: string; state: string;
  aw: number; seen: number; total: number; pct: number;
};

/* WwiRow → shared inspector input. λ=1.0 surface, so U = V − R. */
function toRecFilm(f: WwiRow, kept: boolean): RecFilm {
  const v = num(f.v), r = num(f.r);
  return {
    slug: f.slug, title: f.title, year: f.year, director: f.director, poster_path: f.poster_path,
    reasons: f.reasons, v, c: null, r, u: v != null && r != null ? Math.round(v - r) : num(f.ts),
    prestige: num(f.prestige), discovery: num(f.disc), conf: num(f.conf), tier: f.tier, kept,
  };
}

/** Candidate line inside the lineage inspector. Local kept state keeps the
 *  snapshot honest after a Keep without re-selecting the whole inspector. */
function CandRow({ f, keptInit, onOpen, onKeep }: {
  f: WwiRow; keptInit: boolean;
  onOpen: (f: WwiRow, kept: boolean) => void;
  onKeep: (f: WwiRow) => void;
}) {
  const [kept, setKept] = useState(keptInit);
  const code = (f.reasons ?? []).find((c) => c === "gap" || c === "conquer");
  const chip = code ? REASON_MAP[code] : null;
  return (
    <div className="cv-cand">
      <span className="cv-ct" role="button" tabIndex={0} onClick={() => onOpen(f, kept)} onKeyDown={onKey(() => onOpen(f, kept))}>
        {f.title}<small>{f.year ?? ""}</small>
      </span>
      {chip ? <span className={`rsn ${chip.cls}`}>{chip.label}</span> : null}
      <span
        className={`cv-kb${kept ? " done" : ""}`}
        role="button" tabIndex={0}
        title={kept ? STR.row.kept : STR.row.keep}
        onClick={() => { if (!kept) { setKept(true); onKeep(f); } }}
        onKeyDown={onKey(() => { if (!kept) { setKept(true); onKeep(f); } })}
      >
        <i className="ti ti-bookmark-plus" />
      </span>
    </div>
  );
}

export default function CoverageWorkspace({ data, initialFacet }: { data: CoverageData; initialFacet?: string }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const { session, doKeep, doSeen, doDismiss, doRate } = useRoomActions();

  /* ?facet= deep link (Atlas country/blind-continent doors) — validated against
     FACET_TABS so an invalid/absent param falls back to "all". */
  const [tab, setTab] = useState<TabKey>(
    () => (FACET_TABS.some((t) => t.key === initialFacet) ? (initialFacet as TabKey) : "all"),
  );
  const [doneOpen, setDoneOpen] = useState(false);
  const [lockAll, setLockAll] = useState(false);

  const covErr = data.coverage == null;
  const blindErr = data.blind == null;

  /* Auteur lineages are excluded — they have their own instrument. */
  const rows = useMemo<NormRow[]>(() => {
    return (data.coverage ?? [])
      .filter((c) => c.facet !== "auteur")
      .map((c) => ({
        slug: c.slug, label: c.label, facet: c.facet, state: c.state,
        aw: num(c.aw) ?? 0, seen: num(c.seen) ?? 0, total: num(c.total) ?? 0, pct: num(c.pct) ?? 0,
      }));
  }, [data.coverage]);

  const tabRows = useMemo(() => (tab === "all" ? rows : rows.filter((r) => r.facet === tab)), [rows, tab]);
  const grouped = useMemo(() => {
    const g: Record<string, NormRow[]> = { near: [], prog: [], done: [], lock: [] };
    for (const r of tabRows) (g[r.state] ?? g.lock).push(r); // server order kept within groups
    return g;
  }, [tabRows]);

  const facetCount = useCallback((key: TabKey) => (key === "all" ? rows.length : rows.filter((r) => r.facet === key).length), [rows]);
  const hasAnySeen = rows.some((r) => r.seen > 0);

  const blindRows = useMemo(() => {
    return (data.blind ?? []).map((b) => ({
      slug: b.slug, label: b.label, facet: b.facet, gapReason: b.gap_reason,
      aw: num(b.aw) ?? 0, seen: num(b.seen) ?? 0, total: num(b.total) ?? 0,
      ratio: num(b.ratio) ?? 0, prod: num(b.productivity) ?? 0, opp: num(b.opportunity) ?? 0,
    }));
  }, [data.blind]);
  const maxOpp = blindRows.reduce((m, b) => Math.max(m, b.opp), 0);

  /* "Fill this gap" candidates: WWI rows carrying gap/conquer reasons. They are
     NOT matched to a specific lineage (WWI rows have no lineage ids) and are
     labeled accordingly — never implied to be precise. */
  const cands = useMemo(() => {
    if (data.wwi == null) return null;
    return data.wwi
      .filter((f) => !session.gone.has(f.slug) && (f.reasons ?? []).some((c) => c === "gap" || c === "conquer"))
      .slice(0, 4);
  }, [data.wwi, session.gone]);

  /* ── actions ── */
  const keep = useCallback((f: WwiRow) => { void doKeep(f.slug, f.title); }, [doKeep]);
  const pushFilm = useCallback((f: WwiRow, kept: boolean) => {
    /* push (not select) → the shell renders a back arrow to the lineage inspector. */
    insp.push(
      <RecInsp
        f={toRecFilm(f, kept || session.kept.has(f.slug))}
        onKeep={() => keep(f)}
        onSeen={() => { insp.close(); void doSeen(f.slug, f.title); }}
        onDismiss={() => { insp.close(); void doDismiss(f.slug, f.title); }}
        onRate={(_, v) => { insp.close(); void doRate(f.slug, f.title, v); }}
      />,
      "Candidate · Fill this gap");
  }, [insp, session.kept, keep, doSeen, doDismiss, doRate]);

  /* ── lineage inspector (coverage rows + blind-spot rows share it) ── */
  const openLineage = useCallback((x: NormRow, blind?: { opp: number; prod: number; gapReason: string }) => {
    const rem = Math.max(0, x.total - x.seen);
    insp.select(
      <div>
        <div className="cv-ihead">
          <div className="cv-ilb">{x.label}</div>
          <div className="cv-isub">{FACET_LABEL[x.facet] ?? x.facet} lineage · authority {x.aw.toFixed(2)}</div>
        </div>

        <ICard icon="ti-flag" title="Coverage" right={`${x.pct}%`}>
          <div className={`cv-track${x.state === "done" ? " done" : ""}`} style={{ margin: "2px 0 10px" }}>
            <i style={{ width: `${Math.min(100, x.pct)}%` }} />
          </div>
          <KV k="Progress" v={`${x.seen} / ${x.total}`} />
          <KV k="To finish" v={rem === 0 ? "Done" : rem} />
          <KV k="Authority" v={x.aw.toFixed(2)} title="Editorial authority weight of this list (0–1) — higher-authority lists rank higher in blind spots." />
        </ICard>

        {blind ? (
          <ICard icon="ti-eye-off" title="Blind spot" right={blind.gapReason === "untouched" ? "UNTOUCHED" : "SHALLOW"}>
            <KV k="Opportunity" v={blind.opp.toFixed(2)} title="opportunity = authority × gap × taste fit (plus a small selectivity bonus)." />
            <KV
              k="Taste fit"
              v={blind.prod.toFixed(2)}
              title={blind.prod === 0.7
                ? "0.70 is the cold-start neutral value — it becomes a real cosine once 3 of your rated films carry taste vectors."
                : "Cosine of your watched-films vector against this lineage's anchor, clipped to 0.35–1."}
            />
          </ICard>
        ) : null}

        <ICard icon="ti-target-arrow" title="Fill this gap">
          {cands == null ? (
            <div className="cv-honest">{STR.common.errorLoad}</div>
          ) : cands.length ? (
            <>
              <div className="cv-honest">
                Screener candidates that advance lineage campaigns — not matched to this specific list yet.
              </div>
              {cands.map((f) => (
                <CandRow key={f.slug} f={f} keptInit={!!f.in_watchlist || session.kept.has(f.slug)} onOpen={pushFilm} onKeep={keep} />
              ))}
              <Link className="actbtn" href={`/lineage/${x.slug}`} style={{ display: "block", textAlign: "center", marginTop: 10, fontSize: 11.5 }}>
                Browse this lineage publicly →
              </Link>
            </>
          ) : (
            <Link className="actbtn" href={`/lineage/${x.slug}`} style={{ display: "block", textAlign: "center", fontSize: 11.5 }}>
              No ranked candidate for this lineage yet — browse it publicly →
            </Link>
          )}
        </ICard>
      </div>,
      "Lineage · Coverage");
  }, [insp, cands, session.kept, pushFilm, keep]);

  /* ── page brief ── */
  const topBlind = blindRows[0] ?? null;
  useEffect(() => {
    setDefault(
      <div>
        <ICard icon="ti-chart-arcs" title="Coverage">
          <KV k="Lineages tracked" v={rows.length} />
          <KV k="Done" v={rows.filter((r) => r.state === "done").length} />
          <KV k="Near (75–99%)" v={rows.filter((r) => r.state === "near").length} />
          <KV k="Blind spots" v={data.blind ? blindRows.length : "—"} />
          {topBlind ? <KV k="Top blind spot" v={topBlind.label} /> : null}
        </ICard>
        <div className="emptyins">{STR.empty.coverage}</div>
      </div>
    );
  }, [setDefault, rows, blindRows.length, topBlind, data.blind]);

  const renderRow = (r: NormRow) => {
    const rem = Math.max(0, r.total - r.seen);
    const awCls = r.aw >= 0.75 ? "hi" : r.aw >= 0.55 ? "mid" : "";
    return (
      <div
        className="cv-row" key={`${r.facet}-${r.slug}`}
        role="button" tabIndex={0}
        onClick={() => openLineage(r)} onKeyDown={onKey(() => openLineage(r))}
        title={`${r.label} — ${r.seen}/${r.total} · ${r.pct}%`}
      >
        <span className={`cv-dot ${awCls}`} title={`Authority ${r.aw.toFixed(2)}`} />
        <div className="cv-main">
          <span className="cv-lb">{r.label}</span>
          <small>{FACET_LABEL[r.facet] ?? r.facet}</small>
        </div>
        <div className={`cv-track${r.state === "done" ? " done" : ""}`}><i style={{ width: `${Math.min(100, r.pct)}%` }} /></div>
        <span className={`cv-fin${r.state === "done" ? " done" : r.state === "lock" ? " lock" : ""}`}>
          {r.state === "done" ? "Done" : `${rem} to finish`}
        </span>
      </div>
    );
  };

  return (
    <div className="v2wrap">
      {/* header */}
      <div>
        <h1 className="v2title">Coverage</h1>
        <p className="v2sub">Your lineage conquest map — what is near, what is open, and where you are blind.</p>
      </div>

      {covErr ? <ErrCard /> : null}
      {!covErr && !hasAnySeen ? (
        <FormingCard feature="Coverage" need={1} have={0} unit="seen film in a tracked lineage">
          {STR.empty.coverage}
        </FormingCard>
      ) : null}

      {/* ① facet tabs */}
      {!covErr ? (
        <div className="cv-tabs" role="tablist" aria-label="Coverage facets">
          {FACET_TABS.map((t) => (
            <button
              key={t.key} type="button" role="tab" aria-selected={tab === t.key}
              className={`fchip${tab === t.key ? " on" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label} <span className="ct">{facetCount(t.key)}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* ② coverage board — Near → In progress → Done (collapsed) → Locked */}
      {!covErr ? (
        <section className="mod">
          <div className="modh">
            <h3><i className="ti ti-chart-arcs" /> Coverage board</h3>
            <span className="meta">{tabRows.length} lineages · me_coverage</span>
          </div>
          <div className="modbody">
            {tabRows.length === 0 ? (
              <div className="emptyins">No {tab === "all" ? "" : `${FACET_LABEL[tab] ?? tab} `}lineages tracked yet — lists need 5+ films to count.</div>
            ) : (
              GROUPS.map((g) => {
                const list = grouped[g.key];
                if (!list.length) return null;
                const closed = g.collapsible && !doneOpen;
                const shown = g.key === "lock" && !lockAll ? list.slice(0, LOCK_PREVIEW) : list;
                return (
                  <div key={g.key}>
                    {g.collapsible ? (
                      <div
                        className={`cv-gh clk${closed ? " closed" : ""}`}
                        role="button" tabIndex={0} aria-expanded={!closed}
                        onClick={() => setDoneOpen((v) => !v)} onKeyDown={onKey(() => setDoneOpen((v) => !v))}
                      >
                        {g.label} <span className="ct">{list.length} · {g.note}</span>
                        <span className="line" />
                        <span className="cx"><i className="ti ti-chevron-down" /></span>
                      </div>
                    ) : (
                      <div className="cv-gh">
                        {g.label} <span className="ct">{list.length} · {g.note}</span>
                        <span className="line" />
                      </div>
                    )}
                    {closed ? null : (
                      <>
                        {shown.map(renderRow)}
                        {g.key === "lock" && list.length > LOCK_PREVIEW && !lockAll ? (
                          <div className="pgn">
                            <button type="button" onClick={() => setLockAll(true)}>{STR.common.showAll} ({list.length})</button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              })
            )}
            <div className="cv-note">
              Auteur lineages have their own instrument — <Link href="/room/auteurs">Auteurs →</Link>.
              Progress counts only films marked Seen; ratings play no part here.
            </div>
          </div>
        </section>
      ) : null}

      {/* ③ blind spots — me_blindspots' debut */}
      <section className="mod">
        <div className="modh">
          <h3><i className="ti ti-eye-off" /> Blind spots</h3>
          <span className="meta">opportunity = authority × gap × taste fit</span>
        </div>
        <div className="modbody">
          {blindErr ? (
            <ErrCard />
          ) : blindRows.length ? (
            <>
              {blindRows.map((b) => {
                const norm: NormRow = {
                  slug: b.slug, label: b.label, facet: b.facet, state: "lock",
                  aw: b.aw, seen: b.seen, total: b.total, pct: Math.round(b.ratio * 100),
                };
                const gloss =
                  `opportunity ${b.opp.toFixed(2)} = authority ${b.aw.toFixed(2)} × gap ${(1 - b.ratio).toFixed(2)} × taste fit ${b.prod.toFixed(2)}` +
                  `${b.prod === 0.7 ? " (cold-start neutral)" : ""} — plus a small selectivity bonus.`;
                return (
                  <div
                    className="cv-bs" key={`${b.facet}-${b.slug}`}
                    role="button" tabIndex={0}
                    onClick={() => openLineage(norm, { opp: b.opp, prod: b.prod, gapReason: b.gapReason })}
                    onKeyDown={onKey(() => openLineage(norm, { opp: b.opp, prod: b.prod, gapReason: b.gapReason }))}
                  >
                    <div className="cv-main">
                      <span className="cv-lb">{b.label}</span>
                      <small>{FACET_LABEL[b.facet] ?? b.facet}</small>
                    </div>
                    <span className="cv-sn">{b.seen}/{b.total}</span>
                    <span className={`cv-badge ${b.gapReason === "untouched" ? "untouched" : "shallow"}`}>
                      {b.gapReason === "untouched" ? "UNTOUCHED" : "SHALLOW"}
                    </span>
                    <div className="cv-opp">
                      <div className="cv-otrack"><i style={{ width: `${maxOpp > 0 ? Math.round((b.opp / maxOpp) * 100) : 0}%` }} /></div>
                      <span className="cv-ov gloss" title={gloss}>{b.opp.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
              <div className="cv-note">
                Taste fit is the cosine of your watched-films vector against each lineage&apos;s anchor, clipped to 0.35–1.
                With fewer than 3 rated films carrying taste vectors it stays at the neutral 0.70 — cold starts are never penalized.
              </div>
            </>
          ) : (
            <div className="emptyins">
              No qualifying blind spots — they surface for high-authority lineages (10+ films, authority ≥ 0.55) you haven&apos;t entered, or have barely entered (under 3%).
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
