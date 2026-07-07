"use client";
/** Screener — the recommendation engine's cockpit (spec §3.2). Pure discovery:
 *  kept films are fully excluded here (they live in the Slate), and the
 *  candidate pool is masked by SessionStore kept/gone so films never resurrect
 *  across routes. Control bar = search · λ risk-appetite segments · reason-chip
 *  multi toggles (only codes present in the data) · Streaming now · Hide high
 *  risk. Rows keep the one-number budget (Fit); the chevron expander opens the
 *  score anatomy (u_util / t_taste / s_standing / conf + projected +N NAV).
 *  λ re-dials go through the SessionStore cache (`wwi:${λ}`) — a cache hit must
 *  never re-run the RPC (acceptance gate). Server order is the default sort
 *  (trust the server); any other sort is labeled "re-sorted client-side". */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { num, REASON_MAP, type WwiRow } from "@/lib/room/format";
import { STR } from "./strings";
import FilmRow from "./FilmRow";
import RecInsp, { type RecFilm } from "./RecInsp";
import FormingCard from "./FormingCard";
import ICard from "./insp/ICard";
import KV from "./insp/KV";
import CRow from "./insp/CRow";
import { useInspector } from "./InspectorContext";
import { useRoomActions } from "./useRoomActions";

const LIMIT = 60;
const BANNER_KEY = "mt_scr_banner_v3";
const wwiKey = (lambda: number) => `wwi:${lambda.toFixed(1)}`;

/** λ risk-appetite dial — three discrete values (0029 exposes p_lambda; first UI). */
const DIALS = [
  { label: "Cautious", value: 1.4, hint: "λ 1.4 — risk penalized harder" },
  { label: "Balanced", value: 1.0, hint: "λ 1.0 — the server default" },
  { label: "Bold", value: 0.6, hint: "λ 0.6 — risk tolerated for upside" },
] as const;

type SortKey = "fit" | "nav" | "taste" | "standing";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "fit", label: "Fit" },
  { key: "nav", label: "NAV impact" },
  { key: "taste", label: "Taste" },
  { key: "standing", label: "Standing" },
];

function toRecFilm(f: WwiRow): RecFilm {
  return {
    slug: f.slug, title: f.title, year: f.year, director: f.director, poster_path: f.poster_path,
    reasons: f.reasons,
    v: num(f.v), r: num(f.r),
    prestige: num(f.prestige), discovery: num(f.disc), conf: num(f.conf), tier: f.tier,
  };
}

/** Score anatomy — the 4 sub-scores the WWI payload always carried, finally rendered.
 *  All four are 0–100 ints from the RPC. The NAV chip links ONLY to Performance. */
function ScoreAnatomy({ f }: { f: WwiRow }) {
  const wwi = num(f.wwi);
  const delta = num(f.delta);
  return (
    <div>
      <div className="bars">
        <CRow label="u_util" value={num(f.u_util)} />
        <CRow label="t_taste" value={num(f.t_taste)} color="var(--reading)" />
        <CRow label="s_standing" value={num(f.s_standing)} color="var(--canon)" />
        <CRow label="conf" value={num(f.conf)} color="var(--frontier)" />
      </div>
      <div className="scr-xfoot">
        <span className="wwi gloss" title="WWI = conf × (0.45·u_util + 0.35·t_taste + 0.20·s_standing)">
          WWI {wwi == null ? "—" : Math.round(wwi)}
        </span>
        {delta != null && delta > 0 ? (
          <Link className="scr-navchip" href="/room/performance" title="Projected NAV gain if you watch this — see Performance">
            +{Math.round(delta)} NAV
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function ScreenerWorkspace({ initialRows, formingHave, initialReason }: {
  /** Server-fetched me_recommend_wwi(1.0, 60). */
  initialRows: WwiRow[];
  /** Films rated ★3.5+ (exact count, for the forming gate when the engine returns nothing). */
  formingHave: number;
  /** Canonical reason code from ?reason= (the frontier chip deep-links here). */
  initialReason?: string | null;
}) {
  const insp = useInspector();
  const { setDefault } = insp;
  const { supabase, session, doKeep, doSeen, doDismiss, doRate, doRestore } = useRoomActions();

  const [lambda, setLambda] = useState(1.0);
  const [rows, setRows] = useState<WwiRow[]>(initialRows);
  const [dialing, setDialing] = useState(false);
  const [dialError, setDialError] = useState<string | null>(null);
  const dialReq = useRef(0);

  const [q, setQ] = useState("");
  const [reasonsSel, setReasonsSel] = useState<ReadonlySet<string>>(
    () => new Set(initialReason && REASON_MAP[initialReason] ? [initialReason] : []),
  );
  const [streamOnly, setStreamOnly] = useState(false);
  const [hideRisk, setHideRisk] = useState(false);
  const [sort, setSort] = useState<SortKey>("fit");
  const [banner, setBanner] = useState(false);
  const [passedOpen, setPassedOpen] = useState(false);

  /* Seed the λ cache with the server payload so re-selecting Balanced is a cache hit. */
  useEffect(() => {
    if (!session.getCache<WwiRow[]>(wwiKey(1.0))) session.setCache(wwiKey(1.0), initialRows);
    // Seed once per mount — the server payload does not change client-side.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* First-release banner ("kept films moved to Slate") — dismiss persists per device. */
  useEffect(() => {
    try { setBanner(localStorage.getItem(BANNER_KEY) !== "1"); } catch { setBanner(true); }
  }, []);
  const dismissBanner = useCallback(() => {
    try { localStorage.setItem(BANNER_KEY, "1"); } catch { /* private mode — banner just returns next visit */ }
    setBanner(false);
  }, []);

  /* λ re-dial: SessionStore cache first (hit = NO RPC), fetch + cache on miss. */
  const dial = useCallback(async (l: number, force = false) => {
    setLambda(l);
    setDialError(null);
    const req = ++dialReq.current; // invalidate any in-flight dial, cache hit included
    if (!force) {
      const hit = session.getCache<WwiRow[]>(wwiKey(l));
      if (hit) { setRows(hit); setDialing(false); return; }
    }
    setDialing(true);
    const { data, error } = await supabase.rpc("me_recommend_wwi", { p_lambda: l, p_limit: LIMIT });
    if (req !== dialReq.current) return; // a newer dial superseded this one
    setDialing(false);
    if (error) { setDialError(error.message); return; }
    const rs = (data as WwiRow[] | null) ?? [];
    session.setCache(wwiKey(l), rs);
    setRows(rs);
  }, [supabase, session]);

  /* ── candidate pool: kept films (server flag or session) and gone films excluded ── */
  const pool = useMemo(
    () => rows.filter((f) => !f.in_watchlist && !session.kept.has(f.slug) && !session.gone.has(f.slug)),
    [rows, session.kept, session.gone],
  );

  /* Reason toggles render only codes actually present in the pool (server data only). */
  const presentReasons = useMemo(() => {
    const s = new Set<string>();
    for (const f of pool) for (const c of f.reasons ?? []) if (REASON_MAP[c]) s.add(c);
    return Object.keys(REASON_MAP).filter((c) => s.has(c));
  }, [pool]);

  /* Prune selections whose code vanished from the data (e.g. after a λ re-dial). */
  useEffect(() => {
    setReasonsSel((prev) => {
      const next = new Set([...prev].filter((c) => presentReasons.includes(c)));
      return next.size === prev.size ? prev : next;
    });
  }, [presentReasons]);

  const hasFilters = q.trim() !== "" || reasonsSel.size > 0 || streamOnly || hideRisk;
  const filtered = useMemo(() => {
    let a = pool;
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      a = a.filter((f) => f.title.toLowerCase().includes(t) || (f.director ?? "").toLowerCase().includes(t));
    }
    if (reasonsSel.size) a = a.filter((f) => (f.reasons ?? []).some((c) => reasonsSel.has(c)));
    if (streamOnly) a = a.filter((f) => f.avail?.state === "on");
    if (hideRisk) a = a.filter((f) => (num(f.r) ?? 0) < 26);
    return a;
  }, [pool, q, reasonsSel, streamOnly, hideRisk]);

  /* Default = server order (trust the server); anything else is labeled client-side. */
  const sorted = useMemo(() => {
    if (sort === "fit") return filtered;
    const by = (get: (f: WwiRow) => number | null) =>
      [...filtered].sort((x, y) => (get(y) ?? -1) - (get(x) ?? -1));
    if (sort === "nav") return by((f) => num(f.delta));
    if (sort === "taste") return by((f) => num(f.sim));
    return by((f) => num(f.s_standing));
  }, [filtered, sort]);

  /* ── same-mutation principle: everything writes through useRoomActions, which
     records into SessionStore — pool memos react, rows leave without local sets. ── */
  const handleKeep = useCallback((f: WwiRow) => { void doKeep(f.slug, f.title); }, [doKeep]);
  const handleSeen = useCallback((f: WwiRow) => { insp.close(); void doSeen(f.slug, f.title); }, [doSeen, insp]);
  const handleDismiss = useCallback((f: WwiRow) => { insp.close(); void doDismiss(f.slug, f.title); }, [doDismiss, insp]);
  const handleRate = useCallback((f: WwiRow, v: number) => { void doRate(f.slug, f.title, v); }, [doRate]);

  const openFilm = useCallback((f: WwiRow) => {
    insp.select(
      <RecInsp
        f={toRecFilm(f)}
        onKeep={() => handleKeep(f)}
        onSeen={() => handleSeen(f)}
        onDismiss={() => handleDismiss(f)}
        onRate={(_r, v) => handleRate(f, v)}
      />,
      f.title,
    );
  }, [insp, handleKeep, handleSeen, handleDismiss, handleRate]);

  const toggleReason = useCallback((code: string) => {
    setReasonsSel((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }, []);
  const resetFilters = useCallback(() => {
    setQ(""); setReasonsSel(new Set<string>()); setStreamOnly(false); setHideRisk(false);
  }, []);

  /* ── page brief (opened by the app-bar Brief button — never auto-opened) ── */
  const hiRisk = useMemo(() => pool.filter((f) => (num(f.r) ?? 0) >= 26).length, [pool]);
  useEffect(() => {
    setDefault(
      <div>
        <ICard icon="ti-target-arrow" title="Screener brief">
          <KV k="Candidates" v={pool.length} />
          <KV k="High risk (R≥26)" v={hiRisk} />
          <KV k="λ dial" v={lambda.toFixed(1)} />
        </ICard>
        <div className="emptyins">
          Pure discovery — kept films live in the Slate. Click a row for the why; the chevron opens its score anatomy. Keep, Seen and Not interested save immediately.
        </div>
      </div>,
    );
  }, [pool.length, hiRisk, lambda, setDefault]);

  /* ── forming gate: the engine needs 3 films rated ★3.5+ before it returns anything ── */
  if (initialRows.length === 0) {
    return (
      <div className="v2wrap">
        <div>
          <h1 className="v2title">Screener</h1>
          <p className="v2sub">The recommendation engine&apos;s cockpit — dial risk, filter by reason, keep what belongs on your slate.</p>
        </div>
        <FormingCard feature="Recommendations" need={3} have={formingHave} unit="films rated ★3.5+">
          {STR.empty.screener}
        </FormingCard>
      </div>
    );
  }

  const passed = session.passed;

  return (
    <div className="v2wrap">
      <div>
        <h1 className="v2title">Screener</h1>
        <p className="v2sub">The recommendation engine&apos;s cockpit — dial risk, filter by reason, keep what belongs on your slate.</p>
      </div>

      {banner ? (
        <div className="scr-banner">
          <i className="ti ti-stack-2" />
          <span>Looking for your kept films? They moved to <Link href="/room/slate">Slate →</Link></span>
          <button className="bx" title="Dismiss" onClick={dismissBanner}><i className="ti ti-x" /></button>
        </div>
      ) : null}

      <section>
        {/* ═══ control bar ═══ */}
        <div className="toolbar scr-bar">
          <div className="srch">
            <i className="ti ti-search" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title · director" />
          </div>
          <div className="lambda" title="λ scales the risk penalty inside utility: u = V − λ·R">
            <span className="lbl">λ</span>
            {DIALS.map((d) => (
              <button
                key={d.value}
                type="button"
                className={`seg${lambda === d.value ? " on" : ""}`}
                title={d.hint}
                onClick={() => void dial(d.value)}
              >
                {d.label} {d.value.toFixed(1)}
              </button>
            ))}
          </div>
          {presentReasons.map((code) => {
            const def = REASON_MAP[code];
            return (
              <button
                key={code}
                type="button"
                className={`stratchip${reasonsSel.has(code) ? " on" : ""}`}
                onClick={() => toggleReason(code)}
              >
                <span className="dot" style={{ background: `var(--${def.cls})` }} />
                {def.label}
              </button>
            );
          })}
          <button type="button" className={`qtoggle${streamOnly ? " on" : ""}`} onClick={() => setStreamOnly((v) => !v)}>
            <span className="avdot" /> {STR.row.streaming}
          </button>
          <button type="button" className={`qtoggle${hideRisk ? " on" : ""}`} onClick={() => setHideRisk((v) => !v)}>
            <span className="dot scr-riskdot" /> Hide high risk
          </button>
        </div>

        {/* ═══ results header ═══ */}
        <div className="scr-head">
          <span className="scr-count">{sorted.length} candidate{sorted.length === 1 ? "" : "s"}</span>
          <div className="xseg">
            {SORTS.map((s) => (
              <button key={s.key} type="button" className={sort === s.key ? "on" : ""} onClick={() => setSort(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
          {sort !== "fit" ? <span className="scr-resorted">{STR.common.resortedClient}</span> : null}
        </div>

        {/* ═══ results ═══ */}
        {dialing ? (
          <div>
            <div className="ghline w80" />
            <div className="ghline w60" />
            <div className="ghline w80" />
            <div className="ghline w40" />
          </div>
        ) : dialError ? (
          <div className="errcard">
            <i className="ti ti-alert-triangle" />
            {STR.common.errorLoad}
            <button type="button" className="scr-retry" onClick={() => void dial(lambda, true)}>{STR.common.retry}</button>
          </div>
        ) : sorted.length ? (
          sorted.map((f) => (
            <FilmRow
              key={f.slug}
              f={{
                slug: f.slug, title: f.title, year: f.year, director: f.director, poster_path: f.poster_path,
                reason: f.reasons?.[0] ?? null,
                fit: num(f.wwi), avail: f.avail, risk: num(f.r),
              }}
              onOpen={() => openFilm(f)}
              onKeep={() => handleKeep(f)}
              onSeen={() => handleSeen(f)}
              onDismiss={() => handleDismiss(f)}
              expand={<ScoreAnatomy f={f} />}
            />
          ))
        ) : hasFilters ? (
          <div className="emptyins">
            No candidates match the current filters.
            <button type="button" className="scr-reset" onClick={resetFilters}>Reset filters</button>
          </div>
        ) : (
          <div className="emptyins">
            Every candidate at this dial is on your slate or already handled — re-dial λ or open the <Link href="/room/slate" style={{ color: "var(--ink)" }}>Slate</Link>.
          </div>
        )}
      </section>

      {/* ═══ passed-on strip (session-level regret handling — no RPC) ═══ */}
      {passed.length ? (
        <section className="scr-passed">
          <div className="pline">
            <i className="ti ti-arrow-back-up" />
            <span>{`You've passed on ${passed.length} film${passed.length === 1 ? "" : "s"} this session`}</span>
            <button type="button" className="prev" onClick={() => setPassedOpen((v) => !v)}>
              {passedOpen ? "hide" : "review"}
            </button>
          </div>
          {passedOpen ? (
            <div className="plist">
              {passed.map((p) => (
                <span key={p.slug} className="scr-pass">
                  {p.title}
                  <button type="button" onClick={() => void doRestore(p.slug, p.title)}>Restore</button>
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
