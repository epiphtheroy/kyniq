"use client";

/**
 * AccessEnrichment — MetaTake-verified access layer (Phase A-lite), rendered under the
 * JustWatch/TMDB WatchProviders band. Ports film_access_page_v3.html sections:
 *   answer banner (factual EN copy) · free/archive row (scope + reachability badges) ·
 *   MUBI-by-country strip · on-disc (edition metadata) · subtitle search links · checked_at freshness.
 * Data: data/access_enrichment.json (verified records only — no synthetic values).
 * Returns null when the film has no enrichment record. When the free sector WAS checked
 * and came back empty, renders the honest "no free source" verdict instead.
 */
import { useState } from "react";
import { useAccessCountry } from "@/components/AccessCountryProvider";
import {
  amazonDiscSearchUrl, criterionSearchUrl,
  openSubtitlesSearchUrl, podnapisiSearchUrl, subdlSearchUrl,
} from "@/lib/access-links";

const STALE_DAYS = 30;

export type AxFreeSource = {
  country?: string | null; platform: string; kind: string; url: string;
  scope: string; note?: string | null; answer_note?: string | null;
};
export type AxElsewhere = { name: string; scope: string; url: string; paid?: boolean };
export type AxKrOverride = { platform: string; tier: string; url?: string | null; note?: string | null };
export type AxDiscEdition = { label: string; format?: string | null; region?: string | null; spine?: number | null; url?: string | null; note?: string | null };
export type AxRotation = { service: string; country: string; status: string; leaving_at?: string | null };
export type AccessRecord = {
  title: string; year: number | null; imdb_id?: string | null;
  free_sources: AxFreeSource[];
  free_checked?: boolean;
  sources_checked?: string[];
  kr_overrides: AxKrOverride[];
  mubi_by_country: Record<string, string>;
  rotation: AxRotation[];
  elsewhere_stream?: AxElsewhere[];
  disc?: { criterion_spine?: number | null; editions?: AxDiscEdition[] } | null;
  verdict_note?: string | null;
  confidence?: string | null;
  checked_at: string;
};

const KIND_LABEL: Record<string, string> = { archive: "Archive", pd: "Public domain", national: "Cultural archive" };
const MUBI_ORDER = ["IN", "BR", "US", "GB", "FR", "DE", "JP", "KR", "CA", "AU"];
const MUBI_MARK: Record<string, [string, string]> = { yes: ["✓", "On MUBI"], rot: ["~", "Rotates in and out"], no: ["✗", "Not on MUBI"] };

let regionNames: Intl.DisplayNames | null = null;
function countryName(code: string): string {
  try {
    regionNames = regionNames || new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) || code;
  } catch { return code; }
}
function flagOf(cc: string): string {
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return cc.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}
/** Prose form — English needs "the" before some country names. */
function proseName(code: string): string {
  const n = countryName(code);
  return /^United |^Netherlands$|^Philippines$/.test(n) ? `the ${n}` : n;
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

export default function AccessEnrichment({ record, tmdbId }: { record: AccessRecord | null; tmdbId?: number | null }) {
  const ctx = useAccessCountry();
  const [localCountry, setLocalCountry] = useState("US");
  const country = ctx ? ctx.country : localCountry;
  const setCountry = ctx ? ctx.setCountry : setLocalCountry;
  void tmdbId; void setCountry;

  if (!record) return null;
  const r = record;
  const stale = daysOld(r.checked_at) > STALE_DAYS;
  const freeWw = r.free_sources.filter((s) => s.scope === "worldwide");
  const freeChecked = r.free_checked !== false;
  const hasFree = r.free_sources.length > 0;
  const elsewhere = (r.elsewhere_stream ?? []).filter((e) => !covers(e.scope, country));
  const localElsewhere = (r.elsewhere_stream ?? []).filter((e) => covers(e.scope, country));
  const mubiKeys = MUBI_ORDER.filter((cc) => r.mubi_by_country[cc]);
  const spine = r.disc?.criterion_spine ?? null;
  const editions = r.disc?.editions ?? [];
  const krLocal = country === "KR" ? r.kr_overrides : [];

  // ---- answer banner (factual EN copy; no VPN-nudging) ----
  let cls = "neutral"; let headline = ""; const parts: string[] = [];
  if (freeWw.length) {
    cls = "free";
    const o = freeWw[0];
    headline = `Free on ${o.platform} — available worldwide${o.answer_note ? `, ${o.answer_note}` : ""}.`;
    if (localElsewhere.length) parts.push(`Also streaming here on ${joinAnd(localElsewhere.map((e) => e.name))}.`);
    if (elsewhere.length) parts.push(`Elsewhere: ${elsewhere.map((e) => `${e.name} (${scopeNames(e.scope)} only)`).join(" · ")}.`);
  } else if (hasFree) {
    cls = "free";
    const local = r.free_sources.filter((s) => covers(s.scope, country));
    headline = local.length
      ? `In ${proseName(country)}: free on ${joinAnd(local.map((s) => s.platform))}.`
      : `Free on ${joinAnd(r.free_sources.map((s) => s.platform))} — ${r.free_sources.map((s) => scopeNames(s.scope)).join(", ")} only.`;
  } else if (freeChecked) {
    cls = "rent";
    headline = "No free or archive source anywhere we've checked.";
    parts.push(spine ? `Available on disc (Criterion #${spine}).` : "No boutique disc edition verified.");
    if (r.verdict_note) parts.push(r.verdict_note);
  }
  if (r.confidence === "low") parts.push("Low-confidence record — treat as a lead, not a confirmation.");

  return (
    <section className="ax">
      <h2 className="ax-h2">Where to watch — verified beyond streaming</h2>
      <div className="ax-h2s">Free &amp; archive sources, MUBI country differences, disc editions and subtitles — checked by MetaTake, not scraped.</div>

      {headline ? (
        <div className={`ax-answer ax-answer--${cls}${stale ? " ax-answer--stale" : ""}`}>
          <div className="ax-akick">Where to watch — verified</div>
          <div className="ax-ak">{flagOf(country)} {countryName(country)}{stale ? ` · last checked ${r.checked_at} · needs re-check` : ""}</div>
          <div className="ax-am">{headline}</div>
          {parts.length ? <div className="ax-at">{parts.join(" ")}</div> : null}
        </div>
      ) : null}

      {stale ? (
        <div className="ax-stale-note">Last checked {r.checked_at} — more than {STALE_DAYS} days ago. Needs re-check; listings below may have changed.</div>
      ) : null}

      {/* Free / archive row */}
      <div className={`ax-row${stale ? " ax-row--stale" : ""}`}>
        <span className="ax-row-k">Free &amp; archive</span>
        <div className="ax-row-items">
          {hasFree ? r.free_sources.map((o, i) => {
            const b = coverBadge(o.scope, country);
            return (
              <a key={i} className="ax-offer ax-offer--free" href={o.url} target="_blank" rel="noopener noreferrer">
                <span className="ax-offer-n">{o.platform}<span className="ax-kind">{KIND_LABEL[o.kind] ?? o.kind}</span></span>
                {o.note ? <span className="ax-offer-note">{o.note}</span> : null}
                <span className={`ax-badge ax-badge--${b.k}`}>{b.t}</span>
              </a>
            );
          }) : freeChecked ? (
            <div className="ax-none">
              No free or archive source found{r.sources_checked?.length ? ` — we checked ${r.sources_checked.length} sources (${r.sources_checked.slice(0, 4).join(", ")}${r.sources_checked.length > 4 ? "…" : ""})` : ""}.
            </div>
          ) : (
            <div className="ax-none">Free &amp; archive sources are added as we verify them.</div>
          )}
        </div>
      </div>

      {/* Verified streaming elsewhere (reachability badges) */}
      {(r.elsewhere_stream ?? []).length ? (
        <div className={`ax-row${stale ? " ax-row--stale" : ""}`}>
          <span className="ax-row-k">Streaming</span>
          <div className="ax-row-items">
            {(r.elsewhere_stream ?? []).map((e, i) => {
              const b = coverBadge(e.scope, country, e.paid);
              return (
                <a key={i} className={`ax-offer${b.k === "ok" ? "" : " ax-offer--dim"}`} href={e.url} target="_blank" rel="noopener noreferrer">
                  <span className="ax-offer-n">{e.name}</span>
                  <span className={`ax-badge ax-badge--${b.k}`}>{b.t}</span>
                </a>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Korea overrides — JustWatch KR gap corrections, shown for KR only */}
      {krLocal.length ? (
        <div className={`ax-row${stale ? " ax-row--stale" : ""}`}>
          <span className="ax-row-k">Korea — verified</span>
          <div className="ax-row-items">
            {krLocal.map((o, i) => (
              o.url ? (
                <a key={i} className="ax-offer" href={o.url} target="_blank" rel="noopener noreferrer">
                  <span className="ax-offer-n">{o.platform}</span>
                  <span className="ax-offer-p">{o.tier}</span>
                  {o.note ? <span className="ax-offer-note">{o.note}</span> : null}
                </a>
              ) : (
                <span key={i} className="ax-offer">
                  <span className="ax-offer-n">{o.platform}</span>
                  <span className="ax-offer-p">{o.tier}</span>
                  {o.note ? <span className="ax-offer-note">{o.note}</span> : null}
                </span>
              )
            ))}
          </div>
        </div>
      ) : null}

      {/* MUBI by country */}
      {mubiKeys.length ? (
        <div className="ax-mubi">
          <div className="ax-mubi-line">Subscribed to MUBI? Its catalogue differs by country — here&apos;s where this film is:</div>
          <div className="ax-mubistrip">
            {mubiKeys.map((cc) => {
              const v = r.mubi_by_country[cc];
              const m = MUBI_MARK[v] ?? ["·", v];
              return (
                <span key={cc} className={`ax-mtag${stale ? " ax-mtag--stale" : ""}`}>
                  <span className="ax-mflag" aria-hidden="true">{flagOf(cc)}</span>
                  {countryName(cc)} <span className={v === "yes" ? "ax-y" : "ax-n"}>{m[0]} {m[1]}</span>
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* On disc — edition metadata + plain search links (no affiliate tags, no prices) */}
      <div className="ax-sub">
        <h3 className="ax-h3">On disc</h3>
        {spine ? (
          <div className="ax-disc-hero">
            <div className="ax-disc-label">Boutique edition</div>
            <div className="ax-disc-title">Criterion Collection · Spine #{spine}</div>
            <div className="ax-disc-sub">A label edition, not just a listing — restoration source, transfer and extras are documented per release.</div>
            <div className="ax-linkrow">
              <a className="ax-lbtn" href={criterionSearchUrl(r.title)} target="_blank" rel="noopener noreferrer">Find it on criterion.com <span className="ax-lbtn-s">search</span></a>
            </div>
          </div>
        ) : null}
        {editions.map((e, i) => (
          <div key={i} className="ax-disc-hero">
            <div className="ax-disc-label">{e.format ?? "Disc"}{e.region ? ` · Region ${e.region}` : ""}</div>
            <div className="ax-disc-title">{e.label}{e.spine ? ` · Spine #${e.spine}` : ""}</div>
            {e.note ? <div className="ax-disc-sub">{e.note}</div> : null}
            {e.url ? <div className="ax-linkrow"><a className="ax-lbtn" href={e.url} target="_blank" rel="noopener noreferrer">Label page</a></div> : null}
          </div>
        ))}
        <div className="ax-linkrow">
          {(["blu-ray", "dvd"] as const).map((fmt) => {
            const u = amazonDiscSearchUrl(country, r.title, r.year, fmt);
            return u ? <a key={fmt} className="ax-lbtn" href={u} target="_blank" rel="noopener noreferrer">Amazon — {fmt === "dvd" ? "DVD" : "Blu-ray"} <span className="ax-lbtn-s">search</span></a> : null;
          })}
          {!spine && !editions.length ? (
            <a className="ax-lbtn" href={criterionSearchUrl(r.title)} target="_blank" rel="noopener noreferrer">criterion.com <span className="ax-lbtn-s">search</span></a>
          ) : null}
        </div>
        <div className="ax-tinynote">Imported discs may be region-locked. Check for &quot;Region Free&quot; or use a region-free player. 4K UHD discs have no region codes.</div>
      </div>

      {/* Subtitles — search-result pages only */}
      <div className="ax-sub">
        <h3 className="ax-h3">Subtitles</h3>
        <div className="ax-h2s">Official subtitles on the streaming service are always best. These are third-party community sites.</div>
        <div className="ax-linkrow">
          <a className="ax-lbtn" href={openSubtitlesSearchUrl({ imdbId: r.imdb_id, title: r.title })} target="_blank" rel="noopener noreferrer">OpenSubtitles <span className="ax-lbtn-s">English</span></a>
          <a className="ax-lbtn" href={openSubtitlesSearchUrl({ imdbId: r.imdb_id, title: r.title, lang: "all" })} target="_blank" rel="noopener noreferrer">OpenSubtitles <span className="ax-lbtn-s">all languages</span></a>
          <a className="ax-lbtn" href={subdlSearchUrl(r.title)} target="_blank" rel="noopener noreferrer">SUBDL <span className="ax-lbtn-s">title search</span></a>
          <a className="ax-lbtn" href={podnapisiSearchUrl(r.title, r.year)} target="_blank" rel="noopener noreferrer">Podnapisi <span className="ax-lbtn-s">title search</span></a>
        </div>
        <div className="ax-tinynote">Links open search results only — pick the file that matches your copy&apos;s runtime and language.</div>
      </div>

      <div className="ax-attr">
        Free &amp; archive sources verified by MetaTake. Streaming availability:{" "}
        <a href="https://www.justwatch.com/" target="_blank" rel="noopener noreferrer">JustWatch</a>, via TMDB.
        {" "}Checked {r.checked_at}.{stale ? " Needs re-check." : ""} Some services are region-locked; accessing them from abroad may violate their terms of service.
      </div>
    </section>
  );
}
