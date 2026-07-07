"use client";

/**
 * WatchPageClient — full-page Where-to-Watch experience (/film/[slug]/watch).
 * Ports film_access_page_v3.html section-for-section: compact hero · country/library
 * control bar · tiered answer banner (FREE > LIBRARY > SUBSCRIPTION > RENT > BUY) ·
 * merged L0 (MetaTake-verified free/archive) + L1 (TMDB/JustWatch commercial) rows ·
 * around-the-world best-tier grid · MUBI strip · cinemas stub · disc · subtitles · footer.
 * Factual EN copy only — no VPN-nudging, no invented availability.
 * CSS: axw- block in globals.css.
 */
import { useState } from "react";
import Link from "next/link";
import { useAccessCountry } from "@/components/AccessCountryProvider";
import type { AccessRecord } from "@/components/AccessEnrichment";
import {
  justwatchUrl, amazonDiscSearchUrl, criterionSearchUrl,
  openSubtitlesSearchUrl, podnapisiSearchUrl, subdlSearchUrl,
} from "@/lib/access-links";

const IMG = "https://image.tmdb.org/t/p";
const LOGO = "https://image.tmdb.org/t/p/w45";
const STALE_DAYS = 30;
const CORE10 = ["KR", "US", "GB", "FR", "DE", "JP", "CA", "AU", "IN", "BR"];
const MUBI_ORDER = ["IN", "BR", "US", "GB", "FR", "DE", "JP", "KR", "CA", "AU"];
const KIND_LABEL: Record<string, string> = { archive: "Archive", pd: "Public domain", national: "Cultural archive", avod: "Free with ads", library: "Library" };
const MUBI_MARK: Record<string, [string, string]> = { yes: ["✓", "On MUBI"], rot: ["~", "Rotates in and out"], no: ["✗", "Not on MUBI"] };
const TIER_LABEL: Record<string, string> = { FREE: "Free", LIBRARY: "Library", SUBSCRIPTION: "Streaming", RENT: "Rent", BUY: "Buy" };

export type WatchFilm = {
  slug: string; title: string; year: number | null; director: string | null;
  runtime: number | null; poster_path: string | null; imdb_id: string | null; tmdb_id: number | null;
};
type Prov = { provider_id: number; provider_name: string; logo_path: string | null };
type CountryOffers = { link?: string; flatrate?: Prov[]; rent?: Prov[]; buy?: Prov[]; free?: Prov[]; ads?: Prov[] };
export type WatchData = { results: Record<string, CountryOffers>; countries: string[] } | null;
export type WatchRatings = { imdb_rating: number | null; imdb_votes: number | null; metascore: number | null; rt_tomatometer: number | null } | null;

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

let regionNames: Intl.DisplayNames | null = null;
function countryName(code: string): string {
  try {
    regionNames = regionNames || new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) || code;
  } catch { return code; }
}
function proseName(code: string): string {
  const n = countryName(code);
  return /^United |^Netherlands$|^Philippines$/.test(n) ? `the ${n}` : n;
}
function flagOf(cc: string): string {
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return cc.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}
function daysOld(iso: string): number {
  return (Date.now() - new Date(`${iso}T00:00:00Z`).getTime()) / 86400000;
}
function scopeList(scope: string): string[] { return scope.replace("geo:", "").split("+"); }
function covers(scope: string, cc: string): boolean { return scope === "worldwide" || scopeList(scope).includes(cc); }
function scopeNames(scope: string): string { return scopeList(scope).map(countryName).join(" & "); }
function coverBadge(scope: string, cc: string, paid?: boolean): { k: string; t: string } {
  if (scope === "worldwide") return { k: "ok", t: "Available here — worldwide" };
  if (scopeList(scope).includes(cc)) return { k: "ok", t: "Available here" };
  const geo = `Geo-locked to ${scopeNames(scope)}`;
  return paid ? { k: "pay", t: `${geo} · local payment` } : { k: "geo", t: geo };
}
function joinAnd(a: string[]): string {
  if (a.length <= 1) return a.join("");
  return `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
}
function isLibraryProv(name: string): boolean { return /kanopy|hoopla/i.test(name); }

function splitOffers(o: CountryOffers | undefined) {
  const all = (xs?: Prov[]) => xs ?? [];
  const freeAds = [...all(o?.free), ...all(o?.ads)];
  return {
    library: [...all(o?.flatrate), ...freeAds].filter((p) => isLibraryProv(p.provider_name)),
    stream: all(o?.flatrate).filter((p) => !isLibraryProv(p.provider_name)),
    freeAds: freeAds.filter((p) => !isLibraryProv(p.provider_name)),
    rent: all(o?.rent),
    buy: all(o?.buy),
    link: o?.link,
  };
}

export default function WatchPageClient({ film, watch, record, ratings, takeScore }: {
  film: WatchFilm; watch: WatchData; record: AccessRecord | null;
  ratings?: WatchRatings; takeScore?: number | null;
}) {
  const ctx = useAccessCountry();
  const [localCountry, setLocalCountry] = useState("US");
  const [lib, setLib] = useState(false);
  const [worldOpen, setWorldOpen] = useState(false);
  const country = ctx ? ctx.country : localCountry;
  const setCountry = ctx ? ctx.setCountry : setLocalCountry;

  const provCountries = watch?.countries ?? [];
  const countries = [
    ...CORE10,
    ...provCountries.filter((c) => !CORE10.includes(c)).sort((a, b) => countryName(a).localeCompare(countryName(b))),
  ];
  const cc = countries.includes(country) ? country : "US";

  const r = record;
  const stale = !!(r && daysOld(r.checked_at) > STALE_DAYS);
  const freeWw = (r?.free_sources ?? []).filter((s) => s.scope === "worldwide");
  const freeLocal = (r?.free_sources ?? []).filter((s) => covers(s.scope, cc));
  const freeChecked = !!r && r.free_checked !== false;
  const offers = splitOffers(watch?.results?.[cc]);
  const jw = offers.link || justwatchUrl(cc, null);
  const elsewhereAll = r?.elsewhere_stream ?? [];
  const elsewhere = elsewhereAll.filter((e) => !covers(e.scope, cc));
  const localElsewhere = elsewhereAll.filter((e) => covers(e.scope, cc));
  const krLocal = cc === "KR" && r ? r.kr_overrides : [];
  const mubiKeys = r ? MUBI_ORDER.filter((k) => r.mubi_by_country[k]) : [];
  const spine = r?.disc?.criterion_spine ?? null;
  const editions = r?.disc?.editions ?? [];

  // ---- best tier per country (flatrate > free/ads > rent > buy; verified free overrides all) ----
  function tierFor(k: string): string | null {
    if (freeWw.length) return "FREE";
    if ((r?.free_sources ?? []).some((s) => covers(s.scope, k))) return "FREE";
    const o = splitOffers(watch?.results?.[k]);
    if (o.freeAds.length) return "FREE";
    if (o.library.length) return "LIBRARY";
    if (o.stream.length) return "SUBSCRIPTION";
    if (o.rent.length) return "RENT";
    if (o.buy.length) return "BUY";
    if (k === "KR" && (r?.kr_overrides ?? []).length) {
      const t = r!.kr_overrides[0].tier;
      return t === "stream" ? "SUBSCRIPTION" : t === "rent" ? "RENT" : t === "buy" ? "BUY" : "SUBSCRIPTION";
    }
    return null;
  }

  // ---- answer banner: FREE > LIBRARY > SUBSCRIPTION > RENT > BUY, factual copy ----
  const pn = proseName(cc);
  let cls = "neutral"; let headline = ""; const parts: string[] = [];
  const names = (xs: Prov[]) => xs.map((p) => p.provider_name);
  if (freeWw.length) {
    cls = "free";
    const o = freeWw[0];
    headline = `Free on ${o.platform} — available worldwide${o.answer_note ? `, ${o.answer_note}` : ""}.`;
    const alsoHere = Array.from(new Set([...names(offers.stream), ...localElsewhere.map((e) => e.name)]));
    if (alsoHere.length) parts.push(`Also streaming here on ${joinAnd(alsoHere)}.`);
    if (elsewhere.length) parts.push(`Elsewhere: ${elsewhere.map((e) => `${e.name} (${scopeNames(e.scope)} only)`).join(" · ")}.`);
  } else if (freeLocal.length) {
    cls = "free";
    headline = `In ${pn}: free on ${joinAnd(freeLocal.map((s) => s.platform))}.`;
  } else if (offers.freeAds.length) {
    cls = "free";
    headline = `In ${pn}: free on ${joinAnd(names(offers.freeAds))}${(watch?.results?.[cc]?.ads ?? []).length && !(watch?.results?.[cc]?.free ?? []).length ? " (with ads)" : ""}.`;
  } else if (lib && offers.library.length) {
    cls = "free";
    headline = `In ${pn}: free with your library card on ${joinAnd(names(offers.library))}.`;
  } else if (offers.library.length) {
    cls = "sub";
    headline = `In ${pn}: free on ${joinAnd(names(offers.library))} with a library card.`;
    if (offers.stream.length) parts.push(`Also streaming on ${joinAnd(names(offers.stream))}.`);
  } else if (offers.stream.length) {
    cls = "sub";
    headline = `In ${pn}: streaming on ${joinAnd(names(offers.stream).slice(0, 3))}${offers.stream.length > 3 ? " and more" : ""}.`;
    if (offers.rent.length) parts.push(`Also available to rent (${names(offers.rent).slice(0, 2).join(", ")}${offers.rent.length > 2 ? " and more" : ""}).`);
  } else if (cc === "KR" && krLocal.length) {
    cls = "sub";
    headline = `In ${pn}: ${krLocal[0].tier === "rent" ? "available to rent on" : "streaming on"} ${joinAnd(krLocal.map((o) => o.platform))} — verified by MetaTake.`;
  } else if (offers.rent.length) {
    cls = "rent";
    headline = `In ${pn}: available to rent (${names(offers.rent).slice(0, 3).join(", ")}${offers.rent.length > 3 ? " and more" : ""}).`;
  } else if (offers.buy.length) {
    cls = "rent";
    headline = `In ${pn}: available to buy only (${names(offers.buy).slice(0, 3).join(", ")}).`;
  } else {
    cls = "neutral";
    headline = `In ${pn}: not on any streaming service we can see.`;
    const streamedCCs = countries.filter((k) => { const o = splitOffers(watch?.results?.[k]); return o.stream.length || o.freeAds.length; });
    if (streamedCCs.length) parts.push(`It is streaming in ${streamedCCs.length} ${streamedCCs.length === 1 ? "country" : "countries"} — see the map below.`);
    parts.push(spine ? `Available on disc (Criterion #${spine}).` : "Disc search links below.");
  }
  if (!freeWw.length && !freeLocal.length && freeChecked && !(r?.free_sources ?? []).length) {
    if (offers.freeAds.length) {
      // JustWatch/TMDB lists a free tier here but our verified layer found none —
      // frame it as a verified caution instead of contradicting the headline.
      if (r?.verdict_note) parts.push(`Verified note: ${r.verdict_note}`);
    } else {
      parts.push("No free or archive source anywhere we've checked.");
      if (r?.verdict_note) parts.push(r.verdict_note);
    }
  }
  if (r?.confidence === "low") parts.push("Low-confidence record — treat as a lead, not a confirmation.");

  const rows: { label: string; items: Prov[] }[] = [
    { label: "Free", items: offers.freeAds },
    { label: "Streaming", items: offers.stream },
    { label: "Rent", items: offers.rent },
    { label: "Buy", items: offers.buy },
  ].filter((x) => x.items.length);

  return (
    <div className="axw-wrap">
      {/* 1 · compact hero */}
      <div className="axw-eyebrow">MetaTake · Where to Watch</div>
      <div className="axw-hero">
        <div className="axw-poster">
          {film.poster_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${IMG}/w185${film.poster_path}`} alt={`${film.title} poster`} loading="lazy" />
          ) : (
            <div className="axw-poster-fallback"><div className="axw-pf-t">{film.title}</div><div className="axw-pf-y">{film.year ?? ""}</div></div>
          )}
        </div>
        <div className="axw-hmeta">
          <div className="axw-h1">{film.title}</div>
          <div className="axw-credits">{[film.year, film.director, film.runtime ? `${film.runtime} min` : null].filter(Boolean).join(" · ")}</div>
          {(ratings && (ratings.imdb_rating || ratings.rt_tomatometer != null || ratings.metascore != null)) || takeScore != null ? (
            <div className="axw-ratings">
              {ratings?.imdb_rating ? (
                film.imdb_id
                  ? <a className="axw-rt" href={`https://www.imdb.com/title/${film.imdb_id}/`} target="_blank" rel="noopener noreferrer"><b>IMDb</b> {ratings.imdb_rating}{ratings.imdb_votes ? ` (${fmtVotes(ratings.imdb_votes)})` : ""}</a>
                  : <span className="axw-rt"><b>IMDb</b> {ratings.imdb_rating}{ratings.imdb_votes ? ` (${fmtVotes(ratings.imdb_votes)})` : ""}</span>
              ) : null}
              {ratings?.rt_tomatometer != null ? <span className="axw-rt"><b>RT</b> {ratings.rt_tomatometer}%</span> : null}
              {ratings?.metascore != null ? <span className="axw-rt"><b>Metascore</b> {ratings.metascore}</span> : null}
              {takeScore != null ? <Link className="axw-rt axw-rt--mt" href={`/film/${film.slug}#df-codex`}><b>MetaTake</b> TakeScore {takeScore}</Link> : null}
            </div>
          ) : null}
          <div className="axw-lede">Pick your country — we show every legal way to watch, free sources first.</div>
          <Link className="axw-back" href={`/film/${film.slug}`}>← Back to the film</Link>
        </div>
      </div>

      {/* 2 · control bar */}
      <div className="axw-bar">
        <div className="axw-fld">
          <span className="axw-k">Country</span>
          <select className="axw-select" aria-label="Select your country" value={cc} onChange={(e) => setCountry(e.target.value)}>
            {countries.map((k) => <option key={k} value={k}>{flagOf(k)} {countryName(k)}</option>)}
          </select>
        </div>
        <div className="axw-fld">
          <label className="axw-switch">
            <input type="checkbox" checked={lib} onChange={(e) => setLib(e.target.checked)} />
            <span className="axw-track"><span className="axw-knob" /></span>
            I have a library card (Kanopy/Hoopla — US·CA·AU only)
          </label>
        </div>
      </div>

      {/* 3 · answer banner */}
      <div className={`axw-answer axw-answer--${cls}${stale ? " axw-answer--stale" : ""}`}>
        <div className="axw-ak">{flagOf(cc)} {countryName(cc)}{stale && r ? ` · last checked ${r.checked_at} · needs re-check` : ""}</div>
        <div className="axw-am">{headline}</div>
        {parts.length ? <div className="axw-at">{parts.join(" ")}</div> : null}
      </div>

      {/* 4 · where to watch rows: L0 verified free/archive + L1 TMDB commercial */}
      <section className="axw-section">
        <h2 className="axw-h2">Where to watch — {flagOf(cc)} {countryName(cc)}</h2>
        <div className="axw-h2s">Free &amp; archive sources verified by MetaTake; streaming, rent and buy via JustWatch · TMDB.</div>

        {stale && r ? (
          <div className="axw-stale-note">Verified records last checked {r.checked_at} — more than {STALE_DAYS} days ago. Needs re-check; listings may have changed.</div>
        ) : null}

        <div className="axw-row">
          <span className="axw-row-k">Free &amp; archive</span>
          <div className="axw-row-items">
            {(r?.free_sources ?? []).length ? (r?.free_sources ?? []).map((o, i) => {
              const b = coverBadge(o.scope, cc);
              return (
                <a key={i} className="axw-offer axw-offer--free" href={o.url} target="_blank" rel="noopener noreferrer">
                  <span className="axw-offer-n">{o.platform}<span className="axw-kind">{KIND_LABEL[o.kind] ?? o.kind}</span></span>
                  {o.note ? <span className="axw-offer-note">{o.note}</span> : null}
                  <span className={`axw-badge axw-badge--${b.k}`}>{b.t}</span>
                </a>
              );
            }) : freeChecked ? (
              <div className="axw-none">No free or archive source found{r?.sources_checked?.length ? ` — we checked ${r.sources_checked.length} sources (${r.sources_checked.slice(0, 4).join(", ")}${r.sources_checked.length > 4 ? "…" : ""})` : ""}.</div>
            ) : (
              <div className="axw-none">Free &amp; archive sources are added as we verify them.</div>
            )}
          </div>
        </div>

        {offers.library.length ? (
          <div className="axw-row">
            <span className="axw-row-k">Library</span>
            <div className="axw-row-items">
              {offers.library.map((p) => (
                <a key={p.provider_id} className="axw-offer" href={jw} target="_blank" rel="noopener noreferrer">
                  <span className="axw-offer-n">
                    {p.logo_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="axw-plogo" src={`${LOGO}${p.logo_path}`} alt="" loading="lazy" />
                    ) : null}
                    {p.provider_name}
                  </span>
                  <span className="axw-badge axw-badge--ok">Available here</span>
                </a>
              ))}
              {!lib ? <div className="axw-rownote">Free to stream with a library card — Kanopy/Hoopla work in the US, Canada and Australia only.</div> : null}
            </div>
          </div>
        ) : null}

        {rows.map((row) => (
          <div key={row.label} className="axw-row">
            <span className="axw-row-k">{row.label}</span>
            <div className="axw-row-items">
              {row.items.map((p) => (
                <a key={`${row.label}-${p.provider_id}`} className="axw-offer" href={jw} target="_blank" rel="noopener noreferrer">
                  <span className="axw-offer-n">
                    {p.logo_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="axw-plogo" src={`${LOGO}${p.logo_path}`} alt="" loading="lazy" />
                    ) : null}
                    {p.provider_name}
                  </span>
                  <span className="axw-badge axw-badge--ok">Available here</span>
                </a>
              ))}
            </div>
          </div>
        ))}

        {krLocal.length ? (
          <div className="axw-row">
            <span className="axw-row-k">Korea — verified</span>
            <div className="axw-row-items">
              {krLocal.map((o, i) => o.url ? (
                <a key={i} className="axw-offer" href={o.url} target="_blank" rel="noopener noreferrer">
                  <span className="axw-offer-n">{o.platform}</span>
                  <span className="axw-offer-p">{o.tier}</span>
                  {o.note ? <span className="axw-offer-note">{o.note}</span> : null}
                </a>
              ) : (
                <span key={i} className="axw-offer">
                  <span className="axw-offer-n">{o.platform}</span>
                  <span className="axw-offer-p">{o.tier}</span>
                  {o.note ? <span className="axw-offer-note">{o.note}</span> : null}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {elsewhereAll.length ? (
          <div className="axw-row">
            <span className="axw-row-k">Elsewhere</span>
            <div className="axw-row-items">
              {elsewhereAll.map((e, i) => {
                const b = coverBadge(e.scope, cc, e.paid);
                return (
                  <a key={i} className={`axw-offer${b.k === "ok" ? "" : " axw-offer--dim"}`} href={e.url} target="_blank" rel="noopener noreferrer">
                    <span className="axw-offer-n">{e.name}</span>
                    <span className={`axw-badge axw-badge--${b.k}`}>{b.t}</span>
                  </a>
                );
              })}
            </div>
          </div>
        ) : null}

        {!rows.length && !offers.library.length && !(r?.free_sources ?? []).length && !krLocal.length ? (
          <div className="axw-unverified">No listed channels in {pn}. Streaming and rental data (JustWatch · TMDB) fills in automatically as availability changes; free &amp; archive sources are added as we verify them.</div>
        ) : null}

        <div className="axw-attr">
          Streaming availability: <a href={jw} target="_blank" rel="noopener noreferrer">JustWatch</a>, via TMDB.
          {" "}Free &amp; archive sources verified by MetaTake.{r ? ` Checked ${r.checked_at}.` : ""}
        </div>
      </section>

      {/* 5 · around the world */}
      <section className="axw-section">
        <h2 className="axw-h2">Around the world</h2>
        <div className="axw-h2s">Tap a country to see the page from there. Free sources are highlighted.</div>
        <div className="axw-world">
          {(worldOpen ? countries : (() => {
            const head = countries.slice(0, 9);
            if (!head.includes(cc) && countries.includes(cc)) head[head.length - 1] = cc;
            return head;
          })()).map((k) => {
            const t = tierFor(k);
            const o = splitOffers(watch?.results?.[k]);
            let note = "";
            if (freeWw.length) {
              note = `${freeWw[0].platform} — free`;
              const st = names(o.stream).slice(0, 2);
              if (st.length) note += ` · ${st.join(", ")}`;
            } else if (t === "FREE") note = names(o.freeAds).slice(0, 2).join(" · ") || (r?.free_sources ?? []).filter((s) => covers(s.scope, k)).map((s) => s.platform).join(" · ");
            else if (t === "LIBRARY") note = `${names(o.library).join(" / ")} — library card`;
            else if (t === "SUBSCRIPTION") note = names(o.stream).slice(0, 2).join(" · ") || (k === "KR" ? (r?.kr_overrides ?? []).map((x) => x.platform).join(" · ") : "");
            else if (t === "RENT") note = `rent — ${names(o.rent).slice(0, 2).join(", ")}`;
            else if (t === "BUY") note = "buy only";
            else note = "no service found";
            return (
              <div key={k} className={`axw-cell${k === cc ? " axw-cell--on" : ""}`} role="button" tabIndex={0}
                onClick={() => setCountry(k)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCountry(k); } }}>
                <div className="axw-cc">{flagOf(k)} {countryName(k)}</div>
                <span className={`axw-cb axw-b-${t ?? "NONE"}`}>{t ? TIER_LABEL[t] : "—"}</span>
                <div className="axw-cn">{note}</div>
                {t === "FREE" ? <div className="axw-freetip">free to stream</div> : null}
              </div>
            );
          })}
        </div>
        {countries.length > 9 ? (
          <button type="button" className="axw-worldtoggle" onClick={() => setWorldOpen((v) => !v)}>
            {worldOpen ? "Show fewer countries ▴" : `Show all ${countries.length} countries ▾`}
          </button>
        ) : null}
        {mubiKeys.length ? (
          <>
            <div className="axw-mubi-line">Subscribed to MUBI? Its catalogue differs by country — here&apos;s where this film is:</div>
            <div className="axw-mubistrip">
              {mubiKeys.map((k) => {
                const v = r!.mubi_by_country[k];
                const m = MUBI_MARK[v] ?? ["·", v];
                return (
                  <span key={k} className={`axw-mtag${stale ? " axw-mtag--stale" : ""}`}>
                    {flagOf(k)} {countryName(k)} <span className={v === "yes" ? "axw-y" : "axw-n"}>{m[0]} {m[1]}</span>
                  </span>
                );
              })}
            </div>
          </>
        ) : null}
      </section>

      {/* 6 · in cinemas stub */}
      <section className="axw-section axw-cinemas">
        <h2 className="axw-h2 axw-h2--dim">In cinemas</h2>
        <p className="axw-cinemas-line">Repertory screenings — coming soon. Starting with Seoul (Korean Film Archive, Seoul Cinematheque).</p>
      </section>

      {/* 7 · on disc */}
      <section className="axw-section">
        <h2 className="axw-h2">On disc — {film.title}{film.year ? ` (${film.year})` : ""}</h2>
        <div className="axw-h2s">The edition matters: restoration source, transfer and extras differ by label — not just by store.</div>
        {spine ? (
          <div className="axw-disc-hero">
            <div className="axw-disc-label">Boutique edition</div>
            <div className="axw-disc-title">Criterion Collection · Spine #{spine}</div>
            <div className="axw-disc-sub">A label edition, not just a listing — restoration source, transfer and extras are documented per release.</div>
            <div className="axw-linkrow">
              <a className="axw-lbtn" href={criterionSearchUrl(film.title)} target="_blank" rel="noopener noreferrer">Find it on criterion.com <span className="axw-lbtn-s">search</span></a>
            </div>
          </div>
        ) : null}
        {editions.map((e, i) => (
          <div key={i} className="axw-disc-hero">
            <div className="axw-disc-label">{e.format ?? "Disc"}{e.region ? ` · Region ${e.region}` : ""}</div>
            <div className="axw-disc-title">{e.label}{e.spine ? ` · Spine #${e.spine}` : ""}</div>
            {e.note ? <div className="axw-disc-sub">{e.note}</div> : null}
            {e.url ? <div className="axw-linkrow"><a className="axw-lbtn" href={e.url} target="_blank" rel="noopener noreferrer">Label page</a></div> : null}
          </div>
        ))}
        {!spine && !editions.length ? (
          <div className="axw-tinynote" style={{ margin: "0 0 10px" }}>No boutique edition verified for this film yet. General searches below:</div>
        ) : null}
        <div className="axw-linkrow">
          {(["blu-ray", "dvd"] as const).map((fmt) => {
            const u = amazonDiscSearchUrl(cc, film.title, film.year, fmt);
            return u ? <a key={fmt} className="axw-lbtn" href={u} target="_blank" rel="noopener noreferrer">Amazon — &lsquo;{film.title}&rsquo; {fmt === "dvd" ? "DVD" : "Blu-ray"} <span className="axw-lbtn-s">search</span></a> : null;
          })}
          {!spine && !editions.length ? (
            <a className="axw-lbtn" href={criterionSearchUrl(film.title)} target="_blank" rel="noopener noreferrer">criterion.com <span className="axw-lbtn-s">search</span></a>
          ) : null}
        </div>
        <div className="axw-tinynote">Imported discs may be region-locked. Check for &quot;Region Free&quot; or use a region-free player. 4K UHD discs have no region codes.</div>
      </section>

      {/* 8 · subtitles */}
      <section className="axw-section">
        <h2 className="axw-h2">Subtitles — {film.title}{film.year ? ` (${film.year})` : ""}</h2>
        <div className="axw-h2s">Official subtitles on the streaming service are always best. These are third-party community sites.</div>
        <div className="axw-linkrow">
          <a className="axw-lbtn" href={openSubtitlesSearchUrl({ imdbId: film.imdb_id, title: film.title })} target="_blank" rel="noopener noreferrer">OpenSubtitles — {film.title} <span className="axw-lbtn-s">English</span></a>
          <a className="axw-lbtn" href={openSubtitlesSearchUrl({ imdbId: film.imdb_id, title: film.title, lang: "all" })} target="_blank" rel="noopener noreferrer">OpenSubtitles — {film.title} <span className="axw-lbtn-s">all languages</span></a>
          <a className="axw-lbtn" href={subdlSearchUrl(film.title)} target="_blank" rel="noopener noreferrer">SUBDL — {film.title} <span className="axw-lbtn-s">title search</span></a>
          <a className="axw-lbtn" href={podnapisiSearchUrl(film.title, film.year)} target="_blank" rel="noopener noreferrer">Podnapisi — {film.title} <span className="axw-lbtn-s">title search</span></a>
        </div>
        <div className="axw-tinynote">Links open search results only — pick the file that matches your copy&apos;s runtime and language.</div>
      </section>

      {/* film-page button */}
      <div className="axw-filmlink">
        <Link className="axw-filmbtn" href={`/film/${film.slug}`}>Read the film page — figures &amp; misreadings →</Link>
      </div>

      {/* 9 · footer disclosures — v3 copy */}
      <footer className="axw-footer">
        <p>Some services are region-locked. Accessing them from abroad may violate their terms of service — check before you subscribe.</p>
        <p>Availability changes frequently. Every listing shows when it was last checked; anything older than {STALE_DAYS} days is flagged &quot;needs re-check&quot;. Prices are indicative.</p>
        <p>Imported discs may be region-locked. Check for &quot;Region Free&quot; or use a region-free player. 4K UHD discs have no region codes.</p>
        <p>Streaming availability data: <a href="https://www.justwatch.com/" target="_blank" rel="noopener noreferrer">JustWatch</a>, via TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB. Poster images: TMDB.</p>
      </footer>
    </div>
  );
}
