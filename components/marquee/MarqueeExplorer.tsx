"use client";

/**
 * MarqueeExplorer — the client heart of What to Watch ("The Marquee").
 *
 * Inverted Screener: the country + services SETUP BAR dominates the top; quality
 * (TakeScore) is the ranking axis, not a filter. You say "I'm in this country and
 * pay for these services" and it ranks the best you can actually watch right now,
 * with an access badge on every row (Streaming / Free / Rent).
 *
 * Invariants (handoff §9): SSR is global (no personalization) — the client reads
 * localStorage prefs on mount and re-fetches. Country/services persist to the
 * shared `mt-watch-prefs` key (same as the Screener). Rent/buy are badge-only.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useUserFilms } from "@/components/UserFilmsProvider";
import PosterActions from "@/components/PosterActions";
import ProviderPicker from "@/components/screener/ProviderPicker";
import AccessBadges, { type AvailRow } from "@/components/marquee/AccessBadges";
import type { ScrRow, Country } from "@/components/screener/ScreenerExplorer";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const POSTER = "https://image.tmdb.org/t/p/w154";
const PAGE = 60;
const AX = { v: "#0F6E56", c: "#6b7280", r: "#C8102E" };

type Sort = "u" | "newest" | "alpha";
const flag = (cc: string) =>
  cc && cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : "";

function shortVerdict(v: number, c: number, r: number, u: number) {
  if (u >= 78) return "A durable high — worth the climb.";
  if (u >= 68) return "Strong value that holds up.";
  if (r >= 60) return "High ceiling, real risk.";
  if (c >= 60) return "Demands something of you.";
  if (v >= 60) return "Gives back more than it asks.";
  return "A solid watch.";
}

export default function MarqueeExplorer({
  initialRows, initialTotal, countries, heroBackdrop, heroFilm,
}: {
  initialRows: ScrRow[];
  initialTotal: number;
  countries: Country[];
  heroBackdrop: string | null;
  heroFilm: string | null;
}) {
  const uf = useUserFilms();
  const uid = uf?.uid ?? null;
  const seenSlugs = uf?.seenSlugs;

  // Setup (shared mt-watch-prefs) + Marquee-only prefs (mt-marquee-prefs).
  const [country, setCountry] = useState<string>("KR");
  const [providers, setProviders] = useState<number[]>([]);
  const [vpn, setVpn] = useState(false);
  const [vpnCountries, setVpnCountries] = useState<string[]>([]);
  const [usLib, setUsLib] = useState(false);
  const [hideSeen, setHideSeen] = useState(false);
  const [sort, setSort] = useState<Sort>("u");

  const [rows, setRows] = useState<ScrRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [avail, setAvail] = useState<Record<string, AvailRow[]>>({});

  const hydrated = useRef(false);
  const abort = useRef<AbortController | null>(null);

  const provActive = providers.length > 0 || usLib;
  const watchCountries = vpn ? Array.from(new Set([country, ...vpnCountries])) : [country];

  // ── read prefs on mount ────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const wp = JSON.parse(localStorage.getItem("mt-watch-prefs") || "{}");
      if (wp.country) setCountry(String(wp.country).toUpperCase());
      else {
        const loc = (new Intl.DateTimeFormat().resolvedOptions().locale.split("-")[1] || "").toUpperCase();
        if (loc) setCountry(loc);
      }
      if (Array.isArray(wp.providers)) setProviders(wp.providers.filter((x: unknown) => typeof x === "number"));
    } catch { /* ignore */ }
    try {
      const mp = JSON.parse(localStorage.getItem("mt-marquee-prefs") || "{}");
      if (typeof mp.vpn === "boolean") setVpn(mp.vpn);
      if (Array.isArray(mp.vpnCountries)) setVpnCountries(mp.vpnCountries.map((s: string) => String(s).toUpperCase()));
      if (typeof mp.usLib === "boolean") setUsLib(mp.usLib);
    } catch { /* ignore */ }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── persist prefs ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem("mt-watch-prefs", JSON.stringify({ country, providers })); } catch { /* ignore */ }
  }, [country, providers]);
  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem("mt-marquee-prefs", JSON.stringify({ vpn, vpnCountries, usLib })); } catch { /* ignore */ }
  }, [vpn, vpnCountries, usLib]);

  // ── decorate visible rows with access badges ───────────────────────────────
  // Callers pass disjoint slug sets (a fresh page on reset, the new page on
  // load-more), so we fetch exactly what's asked rather than dedup against a
  // closure of `avail` (which is stale right after a reset clears it).
  const decorate = useCallback(async (slugs: string[]) => {
    if (slugs.length === 0) return;
    const { data } = await sb.rpc("film_availability", {
      p_slugs: slugs,
      p_countries: watchCountries,
      p_providers: providers.length ? providers : null,
      p_include_us_library: usLib,
    });
    const rowsA = (data as { slug: string; tiers: AvailRow[] }[] | null) ?? [];
    setAvail((prev) => {
      const next = { ...prev };
      for (const s of slugs) next[s] = [];
      for (const a of rowsA) next[a.slug] = a.tiers ?? [];
      return next;
    });
  }, [watchCountries, providers, usLib]);

  // ── fetch a page of ranked films ───────────────────────────────────────────
  const fetchPage = useCallback(async (reset: boolean) => {
    const off = reset ? 0 : offset + PAGE;
    setLoading(true);
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setAvail((prev) => (reset ? {} : prev));

    let res: { total: number; rows: ScrRow[] } = { total: 0, rows: [] };
    try {
      if (hideSeen && uid) {
        const sp = new URLSearchParams({
          sort, limit: String(PAGE), offset: String(off), mode: "exclude",
          watch: country, watch_countries: watchCountries.join(","),
          us_lib: usLib ? "1" : "0",
        });
        if (providers.length) sp.set("prov", providers.join(","));
        const d = await fetch(`/api/lens/marquee?${sp.toString()}`, { signal: ac.signal }).then((r) => (r.ok ? r.json() : null));
        res = (d as typeof res) ?? { total: 0, rows: [] };
      } else {
        const { data } = await sb.rpc("cinecodex_ranked", {
          p_sort: sort,
          p_providers: providers.length ? providers : null,
          p_watch_country: country,
          p_watch_countries: watchCountries,
          p_include_us_library: usLib,
          p_limit: PAGE, p_offset: off,
        });
        res = (data as typeof res) ?? { total: 0, rows: [] };
      }
    } catch { if (!ac.signal.aborted) setLoading(false); return; } // aborted or network error
    if (ac.signal.aborted) return;

    setTotal(res.total);
    setOffset(off);
    setRows((prev) => (reset ? res.rows : [...prev, ...res.rows]));
    setLoading(false);
    void decorate(res.rows.map((r) => r.slug));
  }, [offset, sort, providers, country, watchCountries, usLib, hideSeen, uid, decorate]);

  // Re-run whenever the setup changes (after hydration). Debounced a touch so
  // multi-select toggling doesn't fire a burst.
  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => void fetchPage(true), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, providers, country, vpn, vpnCountries, usLib, hideSeen, uid]);

  const countryOpts = countries.map((c) => ({ code: c.code, label: c.label }));
  const countryLabel = countries.find((c) => c.code === country)?.label || `${flag(country)} ${country}`;
  const empty = !loading && rows.length === 0;

  return (
    <div className="mq">
      {/* A. hero */}
      <header className="mq-hero" style={heroBackdrop ? { ["--bd" as string]: `url(https://image.tmdb.org/t/p/w1280${heroBackdrop})` } : undefined}>
        <div className="mq-hero-in">
          <nav className="mq-crumb"><Link href="/">Home</Link> <span>›</span> What to Watch</nav>
          <h1 className="mq-h1">What to Watch <span className="mq-alias">The Marquee</span></h1>
          <p className="mq-sub">Pick your country and the services you pay for. We rank the best you can actually watch right now — by TakeScore, not by what’s trending.</p>
          {heroFilm ? <p className="mq-hero-cap">Top today: {heroFilm}</p> : null}
        </div>
      </header>

      {/* B. setup bar — the identity of the page */}
      <div className="mq-setup">
        <div className="mq-setup-in">
          <label className="mq-country">
            <span className="mq-country-lab">Country</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Watch country">
              {countryOpts.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </label>

          <ProviderPicker
            country={country}
            countries={countryOpts}
            selected={providers}
            onChange={setProviders}
            onCountry={setCountry}
          />

          <button type="button" className={`mq-toggle${vpn ? " on" : ""}`} onClick={() => setVpn((v) => !v)} aria-pressed={vpn} title="Include other countries' catalogues (reference only — check each service's terms)">
            ✈ VPN
          </button>
          <button type="button" className={`mq-toggle${usLib ? " on" : ""}`} onClick={() => setUsLib((v) => !v)} aria-pressed={usLib} title="Fold in Kanopy & Hoopla (free with a participating US library card)">
            🏛 US library
          </button>
          <button
            type="button"
            className={`mq-toggle${hideSeen ? " on" : ""}`}
            onClick={() => { if (!uid) { window.location.href = `/login?next=${encodeURIComponent("/what-to-watch")}`; return; } setHideSeen((v) => !v); }}
            aria-pressed={hideSeen}
            title={uid ? "Hide films you've marked as seen" : "Sign in to hide what you've seen"}
          >
            ● Hide seen
          </button>

          <div className="mq-sort">
            <label>Sort
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="u">TakeScore</option>
                <option value="newest">Newest</option>
                <option value="alpha">A–Z</option>
              </select>
            </label>
          </div>
        </div>

        {vpn ? (
          <div className="mq-vpn-row">
            <span className="mq-vpn-lab">Also show catalogues in:</span>
            {["US", "GB", "CA", "AU", "JP", "FR", "DE", "IN"].filter((c) => c !== country).map((c) => (
              <button key={c} type="button"
                className={`mq-cc${vpnCountries.includes(c) ? " on" : ""}`}
                onClick={() => setVpnCountries((s) => s.includes(c) ? s.filter((x) => x !== c) : [...s, c])}>
                {flag(c)} {c}
              </button>
            ))}
            <span className="mq-vpn-note">Shown for reference — check each service’s terms.</span>
          </div>
        ) : null}
      </div>

      {/* C. summary */}
      <div className="mq-wrap">
        <div className="mq-summary">
          <span>
            {provActive
              ? <><b>{total.toLocaleString("en-US")}</b> {total === 1 ? "film" : "films"} you can watch{providers.length ? " on your services" : ""} in {countryLabel}</>
              : <>Showing the top TakeScore films — <b>pick your services</b> to narrow to what you can stream now</>}
          </span>
        </div>

        {/* D. results */}
        {empty ? (
          <div className="mq-empty">
            <p><b>Nothing matched your services yet.</b></p>
            <p>Try turning on <button className="mq-inline" onClick={() => setUsLib(true)}>🏛 US library</button> (free Kanopy/Hoopla), enabling <button className="mq-inline" onClick={() => setVpn(true)}>✈ other countries</button>, or picking more services above.</p>
          </div>
        ) : (
          <div className="mq-grid" aria-busy={loading}>
            {rows.map((f) => {
              const seen = seenSlugs?.has?.(f.slug);
              return (
                <div className={`mq-row${seen && !hideSeen ? " mq-row--seen" : ""}`} key={`${f.slug}-${f.rank}`}>
                  <span className="mq-rank">{f.rank}</span>
                  <Link href={`/film/${f.slug}`} className="mq-poster" aria-label={f.title}>
                    {f.poster_path
                      ? // eslint-disable-next-line @next/next/no-img-element
                        <img src={`${POSTER}${f.poster_path}`} alt="" loading="lazy" width={54} height={81} />
                      : <span className="mq-poster--e" />}
                  </Link>
                  <div className="mq-mid">
                    <div className="mq-title">
                      <Link href={`/film/${f.slug}`}>{f.title}</Link>{" "}
                      <span className="mq-y">({f.year ?? "?"}{f.director ? `, ${f.director}` : ""})</span>
                      {seen ? <span className="mq-seen-chip">✓ Seen</span> : null}
                    </div>
                    <div className="mq-band">
                      <b style={{ color: AX.v }}>V {Math.round(f.v)}</b>
                      <b style={{ color: AX.c }}>C {Math.round(f.c)}</b>
                      <b style={{ color: AX.r }}>R {Math.round(f.r)}</b>
                      {f.imdb_rating != null ? <span>IMDb {Number(f.imdb_rating).toFixed(1)}</span> : null}
                      {f.rt != null ? <span>RT {f.rt}%</span> : null}
                    </div>
                    <AccessBadges rows={avail[f.slug]} providers={providers} showFlags={vpn} />
                    <div className="mq-verdict">{shortVerdict(f.v, f.c, f.r, f.u)}</div>
                  </div>
                  <span className="mq-ts"><b>{Math.round(f.u)}</b><i>TS</i></span>
                  <span className="mq-save"><PosterActions slug={f.slug} rating={false} compact /></span>
                </div>
              );
            })}
          </div>
        )}

        {!empty && rows.length < total ? (
          <div className="mq-more">
            <button type="button" onClick={() => void fetchPage(false)} disabled={loading}>
              {loading ? "Loading…" : `Load more (${rows.length.toLocaleString("en-US")} of ${total.toLocaleString("en-US")})`}
            </button>
          </div>
        ) : null}

        <p className="mq-attr">
          Availability via TMDB (data licensed through JustWatch). VPN and library results are shown for reference — check each service’s terms; Kanopy/Hoopla require a participating US library card. External ratings via IMDb, Rotten Tomatoes and Metacritic.
        </p>
      </div>
    </div>
  );
}
