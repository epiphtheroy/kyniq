"use client";
/** Desk — /room (My Room v3 §3.1). The 3-second daily loop: one desktop screen,
 *  five bands, no scroll.
 *    ① Log bar      — QuickRate + session line (me_rate_stats)
 *    ② Tonight hero — one pick from me_recommend_wwi(1.0, 24); the rotation
 *                     cursor persists in localStorage("mt_tonight"), keyed by
 *                     local date (fixes the v2 refresh-reset bug)
 *    ③ Session tape — me_recent_ratings(12) poster strip (★ · loved flame ·
 *                     date on hover)
 *    ④ NAV line     — me_portfolio_nav + 90-day sparkline (me_nav_history);
 *                     the summary inspector links ONLY to Performance
 *    ⑤ Open jobs    — one-line link tiles: doors only, no modules behind them
 *  Invariants: reason chips render only server-sent codes; no fake numbers
 *  (honest empty copy instead); NAV surfaces never link to the Ledger. */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SentenceTicker from "@/components/SentenceTicker";
import { useInspector } from "./InspectorContext";
import RecInsp, { type RecFilm } from "./RecInsp";
import QuickRate, { type QuickHit } from "./QuickRate";
import FormingCard from "./FormingCard";
import ICard from "./insp/ICard";
import KV from "./insp/KV";
import { useRoomActions } from "./useRoomActions";
import MiniWorld from "./MiniWorld";
import { STR } from "./strings";
import { NAV_ITEMS } from "@/lib/room/nav";
import { num, IMG185, IMG342, tierOf, chipsOf, type WwiRow, type NavHistRow } from "@/lib/room/format";

/* ── RPC row types (PostgREST numerics may arrive as strings → coerce with num()) ── */
export type RateStats = {
  rated: number | string | null; loved: number | string | null; seen: number | string | null;
  watchlist: number | string | null; session_new: number | string | null;
  forming: boolean | null; loved_target: number | string | null;
};
export type RecentRow = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  rating: number | string | null; loved: boolean | null; watched_at: string | null; added_at: string | null;
  v: number | string | null; r: number | string | null; prestige: number | string | null;
};
export type NavJson = {
  nav: number | string | null; n_watched: number | string | null; n_scored: number | string | null;
  essentials: number | string | null; avg_standing: number | string | null; lines: number | string | null;
} | null;
/** me_pair_state — verified LANGUAGE sql STABLE with zero write side effects
 *  (0033_room_rpc_snapshot.sql), so the Masquerade teaser ships WITH numbers. */
export type PairState = { candidates: number | string | null; loved_n: number | string | null; forming: boolean | null };
/** Nearest-conquest tile, precomputed by the server page from me_coverage. */
export type ConquestTile = { label: string; rem: number; ms: number };
/** Top blind spot (me_blindspots row 1 — label + gap reason only). */
export type BlindTile = { label: string; gap_reason: string };

/** v4.1 preview types — the desk shows the map instead of linking to it. */
export type NavPrev = { dir: string; label: string; seen: number; total: number; pct: number };
export type CovBar = { label: string; seen: number; total: number; pct: number };
export type AuteurLite = { slug: string; name: string; profile_path: string | null; seen: number; total: number; pct: number };
export type GeoDot = { o: number; a: number; s: number }; // lng, lat, setting?

export type DeskData = {
  /** me_recommend_wwi(1.0, 24); null = RPC failed → errcard. */
  recs: WwiRow[] | null;
  /** me_rate_stats single row; null = failed/missing → session line hidden. */
  stats: RateStats | null;
  /** me_recent_ratings(12); null = RPC failed → errcard. */
  recent: RecentRow[] | null;
  nav: NavJson;
  navErr: boolean;
  /** me_nav_history(90); null = failed → no sparkline (never fake one). */
  hist: NavHistRow[] | null;
  conquest: ConquestTile | null;
  blind: BlindTile | null;
  pair: PairState | null;
  /** me_pair_state failed → numberless teaser tile (spec §3.1 fallback). */
  pairErr: boolean;
  /** Count of films rated ★3.5+ (server-computed only when recs is empty — FormingCard meter). */
  ratedHigh: number;
  /** v4.1 previews (null = RPC failed → card self-omits, honest empty). */
  covRows: CovBar[] | null;
  auteurs: AuteurLite[] | null;
  geoDots: GeoDot[] | null;
  /** Navigator resume preview — top in-progress director (null = none/failed). */
  navPrev: NavPrev | null;
};

/* ── route lookups (nav.ts is the single source — never hardcode /room/* here) ── */
const hrefOf = (label: string) => NAV_ITEMS.find((x) => x.label === label)?.href ?? "/room";
const HREF = {
  screener: hrefOf("Screener"),
  ledger: hrefOf("Ledger"),
  masquerade: hrefOf("Masquerade"),
  performance: hrefOf("Performance"),
  coverage: hrefOf("Coverage"),
};

/* WwiRow → shared inspector input. λ=1.0 fixed on this screen, so U = V − R. */
function toRecFilm(f: WwiRow, kept: boolean): RecFilm {
  const v = num(f.v), r = num(f.r);
  return {
    slug: f.slug, title: f.title, year: f.year, director: f.director, poster_path: f.poster_path,
    reasons: f.reasons, v, c: null, r,
    u: v != null && r != null ? Math.round(v - r) : num(f.ts),
    prestige: num(f.prestige), discovery: num(f.disc), conf: num(f.conf), tier: f.tier, kept,
  };
}

/** 90-day NAV sparkline — real snapshots only; under 2 points renders nothing. */
function Spark({ rows }: { rows: NavHistRow[] }) {
  const pts = rows.map((r) => num(r.nav)).filter((v): v is number => v != null);
  if (pts.length < 2) return null;
  const w = 150, h = 26;
  const min = Math.min(...pts), max = Math.max(...pts);
  if (max === min) return null; // a flat line reads as a stray rule, not a pulse
  const span = max - min || 1;
  const d = pts.map((v, i) =>
    `${i === 0 ? "M" : "L"}${(1 + (i / (pts.length - 1)) * (w - 2)).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`,
  ).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ display: "block", flex: "0 0 auto" }}>
      <path d={d} fill="none" stroke="var(--canon)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function pairLine(d: DeskData): string {
  if (d.pairErr || !d.pair) return "A masked partner may be waiting";
  const lovedN = num(d.pair.loved_n) ?? 0;
  if (d.pair.forming) return STR.empty.masquerade(lovedN);
  const cand = num(d.pair.candidates) ?? 0;
  return `${cand} masked partner${cand === 1 ? "" : "s"} in the pool`;
}

/* Open-jobs tiles reuse .vline (hover + hairline) as compact one-line links. */

/** Session tape card (server rows + optimistic prepends from the log bar). */
type TapeCard = {
  slug: string; title: string; year: number | null; poster_path: string | null; director: string | null;
  rating: number | null; date: string | null;
  v?: number | null; r?: number | null; prestige?: number | null;
};

export default function DeskWorkspace({ data }: { data: DeskData }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const { session, doKeep, doSeen, doDismiss, doRate } = useRoomActions();

  const [cursor, setCursor] = useState(0);           // tonight rotation position
  const [extra, setExtra] = useState<TapeCard[]>([]); // optimistic tape prepends

  const dayKey = useMemo(() => new Date().toLocaleDateString("en-CA"), []); // local YYYY-MM-DD

  /* Restore today's rotation cursor after mount — localStorage is client-only,
     so reading it during render would break SSR hydration. Stale (yesterday's)
     entries reset to 0. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mt_tonight");
      if (!raw) return;
      const s = JSON.parse(raw) as { d?: string; i?: number };
      if (s.d === dayKey && typeof s.i === "number" && Number.isInteger(s.i) && s.i > 0) setCursor(s.i);
    } catch { /* corrupt storage — start at 0 */ }
  }, [dayKey]);

  const another = useCallback(() => {
    setCursor((c) => {
      const n = c + 1;
      try { localStorage.setItem("mt_tonight", JSON.stringify({ d: dayKey, i: n })); } catch { /* storage blocked */ }
      return n;
    });
  }, [dayKey]);

  /* ── mutations — useRoomActions records into SessionStore on success, which
        re-renders this tree (kept/gone/reRated are context state). ── */
  const keep = useCallback((f: { slug: string; title: string }) => { void doKeep(f.slug, f.title); }, [doKeep]);
  const seen = useCallback((f: { slug: string; title: string }) => { insp.close(); void doSeen(f.slug, f.title); }, [doSeen, insp]);
  const dismiss = useCallback((f: { slug: string; title: string }) => { insp.close(); void doDismiss(f.slug, f.title); }, [doDismiss, insp]);
  /* Rating a candidate: optimistic prepend onto the tape, rolled back on failure. */
  const rateNew = useCallback(async (f: TapeCard, v: number) => {
    setExtra((a) => [{ ...f, rating: v, date: f.date ?? dayKey }, ...a.filter((x) => x.slug !== f.slug)]);
    const row = await doRate(f.slug, f.title, v);
    if (!row) setExtra((a) => a.filter((x) => x.slug !== f.slug));
  }, [doRate, dayKey]);
  const reRate = useCallback((f: { slug: string; title: string }, v: number) => { void doRate(f.slug, f.title, v); }, [doRate]);

  /* ── ② Tonight rotation — session-gone filtered out; reasons + streaming
        first (Fit desc), then the rest (Fit desc); "Another" cycles. ── */
  const alive = useMemo(() => (data.recs ?? []).filter((f) => !session.gone.has(f.slug)), [data.recs, session.gone]);
  const rotation = useMemo(() => {
    const w = (f: WwiRow) => num(f.wwi) ?? -1;
    const prime = alive.filter((f) => (f.reasons?.length ?? 0) > 0 && f.avail?.state === "on").sort((a, b) => w(b) - w(a));
    const ids = new Set(prime.map((f) => f.slug));
    const rest = alive.filter((f) => !ids.has(f.slug)).sort((a, b) => w(b) - w(a));
    return [...prime, ...rest];
  }, [alive]);
  const today = rotation.length ? rotation[((cursor % rotation.length) + rotation.length) % rotation.length] : null;
  const todayKept = today ? today.in_watchlist === true || session.kept.has(today.slug) : false;

  /* pool made browsable: the side rail peeks 4; the grid below tonight shows the next 9 */
  const upNext = useMemo(() => rotation.filter((f) => f.slug !== today?.slug), [rotation, today?.slug]);
  const journey9 = useMemo(() => upNext.slice(4, 13), [upNext]);
  /* several Navigator destinations to suggest (in-progress director conquests, minus the resume one) */
  const navDests = useMemo(() => (data.auteurs ?? [])
    .filter((a) => a.pct < 100 && a.seen > 0 && a.slug !== data.navPrev?.dir)
    .slice(0, 4)
    .map((a) => ({ href: `/room/navigator?dir=${a.slug}`, label: a.name, meta: `${a.seen}/${a.total} · ${a.pct}%` })),
  [data.auteurs, data.navPrev]);

  const openRec = useCallback((f: WwiRow, kept: boolean) => {
    insp.select(
      <RecInsp f={toRecFilm(f, kept)}
        onKeep={() => keep(f)} onSeen={() => seen(f)} onDismiss={() => dismiss(f)}
        onRate={(_, v) => void rateNew({
          slug: f.slug, title: f.title, year: f.year, poster_path: f.poster_path, director: f.director,
          rating: null, date: null, v: num(f.v), r: num(f.r), prestige: num(f.prestige),
        }, v)} />,
    );
  }, [insp, keep, seen, dismiss, rateNew]);

  /* ── ③ Session tape — server 12 + optimistic prepends (dedup by slug) ── */
  const tape = useMemo(() => {
    const ids = new Set<string>();
    const rows: TapeCard[] = [];
    const server: TapeCard[] = (data.recent ?? []).map((r) => ({
      slug: r.slug, title: r.title, year: r.year, poster_path: r.poster_path, director: r.director,
      rating: num(r.rating), date: r.watched_at ?? (r.added_at ? r.added_at.slice(0, 10) : null),
      v: num(r.v), r: num(r.r), prestige: num(r.prestige),
    }));
    for (const f of [...extra, ...server]) {
      if (ids.has(f.slug)) continue;
      ids.add(f.slug); rows.push(f);
    }
    return rows.slice(0, 12);
  }, [extra, data.recent]);

  const openTape = useCallback((f: TapeCard) => {
    insp.select(
      <RecInsp f={{
        slug: f.slug, title: f.title, year: f.year, director: f.director, poster_path: f.poster_path,
        v: f.v ?? null, r: f.r ?? null, prestige: f.prestige ?? null,
        rating: session.reRated[f.slug] ?? f.rating,
      }} onRate={(_, v) => reRate(f, v)} />,
    );
  }, [insp, session.reRated, reRate]);

  /* ── ④ NAV line → Performance-summary inspector (Performance is the ONLY link) ── */
  const navV = num(data.nav?.nav);
  const tier = tierOf(navV);
  const avgStanding = num(data.nav?.avg_standing);
  const openNav = useCallback(() => {
    insp.select(
      <div>
        <ICard icon="ti-chart-line" title={STR.shell.navSummaryTitle}>
          <KV k="NAV" v={navV ?? "—"} />
          <KV k="Tier" v={tier} />
          <KV k="Watched" v={num(data.nav?.n_watched) ?? "—"} />
          <KV k="Scored" v={num(data.nav?.n_scored) ?? "—"} />
          <KV k="Essentials" v={num(data.nav?.essentials) ?? "—"} />
          <KV k="Avg standing" v={avgStanding != null ? Math.round(avgStanding) : "—"} />
          <KV k="Lineage lines" v={num(data.nav?.lines) ?? "—"} />
          <div style={{ marginTop: 10 }}>
            <Link href={HREF.performance} style={{ fontSize: 12, color: "var(--sub)" }}>{STR.shell.openPerformance}</Link>
          </div>
        </ICard>
        <div className="emptyins">{STR.common.navCovenant}</div>
      </div>,
      STR.shell.navSummaryTitle,
    );
  }, [insp, data.nav, navV, tier, avgStanding]);

  /* ── page brief (app-bar Brief button — registered, never auto-opened) ── */
  useEffect(() => {
    setDefault(
      <ICard icon="ti-sun" title="Desk — the daily loop">
        <KV k="Tonight" v={today?.title ?? "—"} />
        <KV k="Pool" v={alive.length} />
        <KV k="NAV" v={navV ?? "Forming"} />
        <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 8, lineHeight: 1.5 }}>
          Log what you just watched, take tonight&apos;s pick, glance at NAV — three seconds, done.
        </div>
      </ICard>,
    );
  }, [setDefault, today?.title, alive.length, navV]);

  /* ── ① session line under the log bar ── */
  const sNew = num(data.stats?.session_new) ?? 0;
  const loved = num(data.stats?.loved) ?? 0;
  const lovedTarget = num(data.stats?.loved_target) ?? 8;
  const lovedLeft = Math.max(0, lovedTarget - loved);
  const sessionLine = data.stats
    ? `${sNew} rating${sNew === 1 ? "" : "s"} today${data.stats.forming
      ? ` · ${lovedLeft} more loved film${lovedLeft === 1 ? "" : "s"} to unlock Masquerade`
      : " · Masquerade unlocked"}`
    : null;

  const todayChips = today ? chipsOf(today.reasons).slice(0, 2) : [];
  const todayFit = today ? num(today.wwi) : null;
  const todayDelta = today ? num(today.delta) : null;

  return (
    <div className="v2wrap" style={{ gap: 18, paddingBottom: 40 }}>
      {/* ⓪ Connection ticker — ambient tape of computed cross-film links */}
      <SentenceTicker variant="room" n={40} />

      {/* v4 (마이룸-v4 §1-4): the desk is three questions — Tonight / My Map /
          Records — with sticky anchor tabs. Bands below are v3 logic, regrouped. */}
      <nav className="dk-tabs" aria-label="Room sections">
        <a className="dk-tab" href="#tonight">Tonight</a>
        <a className="dk-tab" href="#mymap">My Map</a>
        <a className="dk-tab" href="#records">Records</a>
      </nav>

      {/* identity strip — who this room belongs to, in one dense line */}
      {data.nav || data.stats ? (
        <div className="dk-id">
          <b>{num(data.nav?.n_watched) ?? 0}</b> films watched
          <span className="dot">·</span><b>{loved}</b> loved
          <span className="dot">·</span>NAV <b>{navV ?? "—"}</b> <span className="dk-tier">{tier}</span>
          {data.hist?.length ? <span className="dk-idspark"><Spark rows={data.hist} /></span> : null}
        </div>
      ) : null}

      {/* ═ TONIGHT — what should I watch? ═ */}
      <section id="tonight" className="dk-sec">
      <div className="dk-sechd">
        <h2>Tonight</h2><span className="sub">what should I watch?</span>
      </div>

      {/* ★ The Navigator — the flagship: resume the drive, or pick a destination */}
      <div className="nav-block">
        {data.navPrev ? (
          <Link className="nav-resume" href={`/room/navigator?dir=${data.navPrev.dir}`}>
            <span className="nav-ic"><i className="ti ti-navigation" /></span>
            <span className="nav-tx">
              <span className="nav-k">The Navigator · Continue your drive</span>
              <span className="nav-n">{data.navPrev.label} — turn-by-turn to your next film</span>
              <span className="nav-m">{data.navPrev.seen}/{data.navPrev.total} watched · {data.navPrev.pct}% · excludes films you&apos;ve seen</span>
            </span>
            <span className="nav-go">Drive →</span>
          </Link>
        ) : (
          <Link className="nav-resume nav-resume--new" href="/room/navigator">
            <span className="nav-ic"><i className="ti ti-navigation" /></span>
            <span className="nav-tx">
              <span className="nav-k">The Navigator</span>
              <span className="nav-n">Pick a destination and your unwatched films become the route — guided one turn at a time.</span>
            </span>
            <span className="nav-go">Start →</span>
          </Link>
        )}
        {navDests.length ? (
          <div className="nav-dests">
            <span className="nav-dests-lbl">Or set a destination</span>
            <div className="nav-dests-row">
              {navDests.map((d) => (
                <Link key={d.href} className="nav-dest" href={d.href}>
                  <span className="nav-dest-n">{d.label}</span>
                  <span className="nav-dest-m">{d.meta}</span>
                </Link>
              ))}
              <Link className="nav-dest nav-dest--all" href="/room/navigator">All destinations →</Link>
            </div>
          </div>
        ) : null}
      </div>

      {/* ① Log bar */}
      <div style={{ marginBottom: 14 }}>
        <QuickRate onRate={(h: QuickHit, v: number) => void rateNew({ ...h, rating: null, date: null }, v)} />
        {sessionLine ? <div style={{ fontSize: 11.5, color: "var(--sub)", marginTop: 8 }}>{sessionLine}</div> : null}
      </div>

      <div className="dk-2col">
      <div className="dk-2col-main">
      {/* ② Tonight hero */}
      {data.recs == null ? (
        <div className="errcard"><i className="ti ti-alert-triangle" />{STR.common.errorLoad}</div>
      ) : data.recs.length === 0 ? (
        <FormingCard feature="Recommendations" need={3} have={data.ratedHigh} unit="films rated ★3.5+">
          {STR.empty.desk}
        </FormingCard>
      ) : today ? (
        <div className="today">
          <span className="tpo" style={today.poster_path ? { backgroundImage: `url(${IMG342}${today.poster_path})` } : {}} />
          <div style={{ minWidth: 0 }}>
            {/* Opener: a real button whose hit-area is stretched over the whole card
                (.tt-open::after) so clicking the poster/title still opens the inspector,
                while the chips and Keep/Seen/Another below remain independent controls. */}
            <button type="button" className="tt-open" aria-label={`Open details for ${today.title}`}
              onClick={() => openRec(today, todayKept)}>
              <span style={{ fontSize: 10.5, letterSpacing: ".12em", color: "var(--sub)" }}>TONIGHT</span>
            </button>
            <div className="tt ser">{today.title}</div>
            <div className="tsub">{today.year ?? "?"}{today.director ? ` · ${today.director}` : ""}</div>
            <div className="twhy" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {todayChips.map((c, i) => c.href
                ? <Link key={i} className={`rsn ${c.cls}`} href={c.href}>{c.label}</Link>
                : <span key={i} className={`rsn ${c.cls}`}>{c.label}</span>)}
              {todayFit != null ? <span className="mono" style={{ fontSize: 11.5, color: "var(--sub)" }}>{STR.row.fit} {Math.round(todayFit)}</span> : null}
              {todayDelta != null && todayDelta >= 2 ? <span className="mono" style={{ fontSize: 11.5, color: "var(--canon)" }}>+{Math.round(todayDelta)} NAV</span> : null}
              {today.avail?.state === "on" ? <span style={{ fontSize: 11.5, color: "var(--sub)" }}><span className="availdot on" /> {today.avail.provider ?? STR.row.streaming}</span> : null}
            </div>
            <div className="tact">
              <button type="button" className="actbtn pri" onClick={() => keep(today)}>{todayKept ? `✓ ${STR.row.kept}` : STR.row.keep}</button>
              <button type="button" className="actbtn" onClick={() => seen(today)}>{STR.row.seen}</button>
              <button type="button" className="actbtn" onClick={another}>Another</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="emptyins">
          Tonight&apos;s pool is cleared — <Link href={HREF.screener} style={{ color: "var(--mut)" }}>the Screener has more →</Link>
        </div>
      )}

      {/* ② more for your journey — the next 9 pool picks, browsable below tonight */}
      {journey9.length ? (
        <div className="dk-journey">
          <div className="dk-journey-hd">More for your journey <span className="sub">— from your pool, minus what you&apos;ve seen</span></div>
          <div className="dk-journey-grid">
            {journey9.map((f) => (
              <button key={f.slug} type="button" className="dk-jcard"
                title={`${f.title}${f.year ? ` (${f.year})` : ""}`}
                onClick={() => openRec(f, f.in_watchlist === true || session.kept.has(f.slug))}>
                <span className="dk-jpo" style={f.poster_path ? { backgroundImage: `url(${IMG185}${f.poster_path})` } : {}} />
                <span className="dk-jtt">{f.title}</span>
                {f.director ? <span className="dk-jdir">{f.director}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      </div>{/* /dk-2col-main */}

      {/* up next — the pool made visible (rotation minus tonight's pick) */}
      <aside className="dk-2col-side">
        <div className="dk-card">
          <div className="dk-cardhd">Up next in your pool</div>
          <div className="dk-cardsub">Your pool = films scored for your taste and playable on your services — minus what you&apos;ve already seen.</div>
          {upNext.length ? (
            <div className="dk-upnext">
              {upNext.slice(0, 4).map((f) => (
                <button key={f.slug} type="button" className="dk-up" title={`${f.title}${f.year ? ` (${f.year})` : ""}`}
                  onClick={() => openRec(f, f.in_watchlist === true || session.kept.has(f.slug))}>
                  <span className="dk-uppo" style={f.poster_path ? { backgroundImage: `url(${IMG185}${f.poster_path})` } : {}} />
                  <span className="dk-uptt">{f.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="emptyins">Rate a few films and the pool fills.</div>
          )}
          <div className="dk-poolft">
            <span className="sub">{alive.length} picks · from your ratings &amp; services</span>
            <Link className="dk-btn dk-btn--wtw" href="/what-to-watch">Every filter → What to Watch</Link>
          </div>
        </div>
      </aside>
      </div>{/* /dk-2col */}
      </section>

      {/* ═ MY MAP — who am I as a viewer? (previews, not doors) ═ */}
      <section id="mymap" className="dk-sec">
      <div className="dk-sechd">
        <h2>My Map</h2><span className="sub">who am I as a viewer?</span>
        <Link className="go" href={HREF.coverage}>Full coverage →</Link>
      </div>
      <div className="dk-3col">
        {/* canon coverage — real bars */}
        <div className="dk-card">
          <div className="dk-cardhd">Canon coverage</div>
          {data.covRows?.length ? (
            <div className="dk-bars">
              {data.covRows.map((c) => (
                <Link className="dk-bar" key={c.label} href={HREF.coverage} title={`${c.label} — ${c.seen}/${c.total}`}>
                  <span className="dk-barlbl">{c.label}</span>
                  <span className="dk-bartrack"><span className="dk-barfill" style={{ width: `${Math.min(100, c.pct)}%` }} /></span>
                  <span className="dk-barnum">{c.seen}/{c.total}</span>
                </Link>
              ))}
              {data.blind ? <div className="dk-blind"><i className="ti ti-alert-triangle" /> Blind spot: {data.blind.label}</div> : null}
            </div>
          ) : (
            <div className="emptyins">Mark films seen and the canon lights up.</div>
          )}
        </div>
        {/* the world, actually shown */}
        <div className="dk-card dk-card--map">
          <div className="dk-cardhd">Where your films took you</div>
          {data.geoDots?.length ? <MiniWorld dots={data.geoDots} /> : <div className="emptyins">Seen films pin the world.</div>}
          <div className="dk-cardft"><span className="sub">{data.geoDots?.length ?? 0} pins · your films</span><Link className="dk-btn" href="/room/locations">Open the world map →</Link></div>
        </div>
        {/* directors — faces, not labels */}
        <div className="dk-card">
          <div className="dk-cardhd">Director conquest</div>
          {data.auteurs?.length ? (
            <div className="dk-auteurs">
              {data.auteurs.map((a) => (
                <Link className="dk-au" key={a.slug} href="/room/auteurs" title={`${a.name} — ${a.seen}/${a.total} (${a.pct}%)`}>
                  <span className="dk-aupo" style={a.profile_path ? { backgroundImage: `url(${IMG185}${a.profile_path})` } : {}} />
                  <span className="dk-aunm">{a.name}</span>
                  <span className="dk-aupct">{a.pct}%</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="emptyins">Directors appear as you watch.</div>
          )}
          <div className="dk-cardft"><span className="sub">by films seen per director</span><Link className="dk-btn" href="/room/auteurs">All directors</Link></div>
        </div>
      </div>
      <div className="dk-linkrow">
        <Link href="/room/signature"><i className="ti ti-fingerprint" /> Your taste, fingerprinted → Signature</Link>
        <Link href={HREF.masquerade}><i className="ti ti-masks-theater" /> {pairLine(data)} → Masquerade</Link>
      </div>
      </section>

      {/* ═ RECORDS — what have I seen? ═ */}
      <section id="records" className="dk-sec">
      <div className="dk-sechd">
        <h2>Records</h2><span className="sub">what have I seen &amp; kept?</span>
        <Link className="go" href={HREF.ledger}>Full ledger →</Link>
      </div>

      {/* ③ Session tape */}
      <div>
        <div className="v2h"><h3>Session tape</h3><Link className="all" href={HREF.ledger}>Full ledger →</Link></div>
        {data.recent == null ? (
          <div className="errcard"><i className="ti ti-alert-triangle" />{STR.common.errorLoad}</div>
        ) : tape.length ? (
          <div className="postrip">
            {tape.map((f) => {
              const shown = session.reRated[f.slug] ?? f.rating;
              const isLoved = shown != null && shown >= 4.5;
              return (
                <button type="button" className="pcard" key={f.slug} onClick={() => openTape(f)}
                  aria-label={f.date ? `${f.title} · ${f.date}` : f.title}
                  title={f.date ? `${f.title} · ${f.date}` : f.title}>
                  <span className="ppo" style={{ display: "block", ...(f.poster_path ? { backgroundImage: `url(${IMG185}${f.poster_path})` } : {}) }} />
                  <span className="pst">★{shown ?? "—"}{isLoved ? <i className="ti ti-flame" style={{ color: "var(--red)", marginLeft: 3 }} /> : null}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="emptyins">Nothing on the tape yet — a star above starts it.</div>
        )}
      </div>

      {/* ④ NAV card + doors — dense two-column close (no full-width gap rows) */}
      <div className="dk-2col dk-2col--even" style={{ marginTop: 12 }}>
        {data.navErr ? (
          <div className="errcard"><i className="ti ti-alert-triangle" />{STR.common.errorLoad}</div>
        ) : (
          <div className="dk-card dk-card--nav" role="button" tabIndex={0} title={STR.shell.navChipTitle} onClick={openNav}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openNav(); } }}>
            <div className="dk-cardhd">Portfolio</div>
            <div className="dk-navrow">
              <span className="dk-navbig">NAV <b>{navV ?? "—"}</b> <span className="dk-tier">{tier}</span></span>
              <span className="dk-navkv"><b>{num(data.nav?.n_watched) ?? 0}</b> watched</span>
              {data.stats ? <span className="dk-navkv"><b>{loved}</b> loved</span> : null}
            </div>
            {data.hist ? <div style={{ marginTop: 8 }}><Spark rows={data.hist} /></div> : null}
          </div>
        )}
        <div className="dk-card">
          <div className="dk-cardhd">Keep going</div>
          <div className="dk-chips">
            <Link className="dk-chip" href="/room/slate"><i className="ti ti-stack-2" /> Watchlist → Slate</Link>
            <Link className="dk-chip" href="/room/shelf"><i className="ti ti-books" /> Pins → Shelf</Link>
            <Link className="dk-chip" href="/room/takes"><i className="ti ti-feather" /> Write → Takes</Link>
            <Link className="dk-chip" href="/me/import"><i className="ti ti-download" /> Import history</Link>
            <Link className="dk-chip" href="/room/performance"><i className="ti ti-chart-line" /> Performance</Link>
            <Link className="dk-chip" href="/room/holdings"><i className="ti ti-list-details" /> Holdings</Link>
          </div>
        </div>
      </div>
      </section>
    </div>
  );
}
