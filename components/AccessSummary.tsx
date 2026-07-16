"use client";

/**
 * AccessSummary — compact where-to-watch verdict card for the film page (df-watch section).
 * A condensed version of WatchPageClient's tier logic: one verdict line for the selected
 * country (free > library > streaming > rent > buy), up to 5 provider-name chips, and a
 * prominent button to the full guide at /whereto/{slug}. CSS: ax-sum- block in globals.css.
 */
import Link from "next/link";
import { useAccessCountry } from "@/components/AccessCountryProvider";
import type { AccessRecord } from "@/components/AccessEnrichment";

type Prov = { provider_id: number; provider_name: string; logo_path: string | null };
type CountryOffers = { link?: string; flatrate?: Prov[]; rent?: Prov[]; buy?: Prov[]; free?: Prov[]; ads?: Prov[] };
export type AccessSummaryWatch = { results: Record<string, CountryOffers>; countries: string[] } | null;

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
function covers(scope: string, cc: string): boolean {
  return scope === "worldwide" || scope.replace("geo:", "").split("+").includes(cc);
}
function isLibraryProv(name: string): boolean { return /kanopy|hoopla/i.test(name); }
function joinAnd(a: string[]): string {
  if (a.length <= 1) return a.join("");
  return `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
}
function flagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// All-region tier fingerprint: reuse the selected-country verdict order per region.
type RegionTier = "free" | "library" | "stream" | "rent" | "buy" | "none";
const TIER_ORDER: RegionTier[] = ["free", "library", "stream", "rent", "buy"];
const TIER_GLYPH: Record<RegionTier, string> = { free: "◉", library: "◈", stream: "▶", rent: "⇆", buy: "$", none: "·" };
const TIER_WORD: Record<RegionTier, string> = { free: "Free", library: "Library", stream: "Streaming", rent: "Rent", buy: "Buy", none: "Not yet" };

function regionTier(o: CountryOffers | undefined, freeVerifiedHere: boolean, krTier: "rent" | "stream" | null): RegionTier {
  const fr = [...(o?.free ?? []), ...(o?.ads ?? [])];
  const flat = o?.flatrate ?? [];
  const lib = [...flat, ...fr].filter((p) => isLibraryProv(p.provider_name));
  const streamNonLib = flat.filter((p) => !isLibraryProv(p.provider_name));
  const freeNonLib = fr.filter((p) => !isLibraryProv(p.provider_name));
  if (freeVerifiedHere || freeNonLib.length) return "free";
  if (lib.length) return "library";
  if (streamNonLib.length) return "stream";
  if ((o?.rent ?? []).length) return "rent";
  if ((o?.buy ?? []).length) return "buy";
  if (krTier) return krTier;
  return "none";
}

export default function AccessSummary({ watch, record, slug, title }: {
  watch: AccessSummaryWatch; record: AccessRecord | null; slug: string; title: string;
}) {
  const ctx = useAccessCountry();
  const country = ctx ? ctx.country : "US";
  const cc = /^[A-Z]{2}$/.test(country) ? country : "US";
  const pn = proseName(cc);

  const o = watch?.results?.[cc];
  const all = (xs?: Prov[]) => xs ?? [];
  const freeAdsAll = [...all(o?.free), ...all(o?.ads)];
  const library = [...all(o?.flatrate), ...freeAdsAll].filter((p) => isLibraryProv(p.provider_name));
  const stream = all(o?.flatrate).filter((p) => !isLibraryProv(p.provider_name));
  const freeAds = freeAdsAll.filter((p) => !isLibraryProv(p.provider_name));
  const rent = all(o?.rent);
  const buy = all(o?.buy);
  const names = (xs: Prov[]) => xs.map((p) => p.provider_name);

  const freeVerified = (record?.free_sources ?? []).filter((s) => covers(s.scope, cc));
  const krLocal = cc === "KR" ? (record?.kr_overrides ?? []) : [];

  // Condensed tier verdict: verified free > TMDB free/ads > library > streaming > KR verified > rent > buy.
  let free = false; let headline = ""; let chips: string[] = [];
  if (freeVerified.length) {
    free = true;
    const ww = freeVerified.find((s) => s.scope === "worldwide");
    headline = ww
      ? `Free on ${ww.platform} — available worldwide.`
      : `In ${pn}: free on ${joinAnd(freeVerified.map((s) => s.platform))}.`;
    chips = [...freeVerified.map((s) => s.platform), ...names(stream)];
  } else if (freeAds.length) {
    free = true;
    headline = `In ${pn}: free on ${joinAnd(names(freeAds).slice(0, 2))}${!all(o?.free).length ? " (with ads)" : ""}.`;
    chips = [...names(freeAds), ...names(stream)];
  } else if (library.length) {
    headline = `In ${pn}: free on ${joinAnd(names(library))} with a library card.`;
    chips = [...names(library), ...names(stream)];
  } else if (stream.length) {
    headline = `In ${pn}: streaming on ${joinAnd(names(stream).slice(0, 3))}${stream.length > 3 ? " and more" : ""}.`;
    chips = [...names(stream), ...names(rent)];
  } else if (krLocal.length) {
    headline = `In ${pn}: ${krLocal[0].tier === "rent" ? "available to rent on" : "streaming on"} ${joinAnd(krLocal.map((k) => k.platform))} — verified by MetaTake.`;
    chips = krLocal.map((k) => k.platform);
  } else if (rent.length) {
    headline = `In ${pn}: available to rent (${names(rent).slice(0, 3).join(", ")}${rent.length > 3 ? " and more" : ""}).`;
    chips = names(rent);
  } else if (buy.length) {
    headline = `In ${pn}: available to buy only (${names(buy).slice(0, 3).join(", ")}).`;
    chips = names(buy);
  }
  chips = Array.from(new Set(chips)).slice(0, 5);

  // --- All-region fingerprint (principle A: answer first) — every region already in memory. ---
  const countries = watch?.countries ?? [];
  const tierByCc: Record<string, RegionTier> = {};
  for (const rc of countries) {
    const ro = watch?.results?.[rc];
    const fv = (record?.free_sources ?? []).some((s) => covers(s.scope, rc));
    const kr = rc === "KR" ? (record?.kr_overrides ?? []) : [];
    const krTier: "rent" | "stream" | null = kr.length ? (kr[0].tier === "rent" ? "rent" : "stream") : null;
    tierByCc[rc] = regionTier(ro, fv, krTier);
  }
  const freeRegions = countries.filter((rc) => tierByCc[rc] === "free" || tierByCc[rc] === "library");
  const nStream = countries.filter((rc) => tierByCc[rc] === "stream").length;
  const nRent = countries.filter((rc) => tierByCc[rc] === "rent").length;
  const nBuy = countries.filter((rc) => tierByCc[rc] === "buy").length;
  const nNone = countries.filter((rc) => tierByCc[rc] === "none").length;
  const hasAny = freeRegions.length > 0 || nStream > 0 || nRent > 0 || nBuy > 0;

  // Representative free/library provider + its region, for the headline clause.
  let freeClause = "";
  const firstFree = freeRegions[0];
  if (firstFree) {
    const ro = watch?.results?.[firstFree];
    const pool = [...(ro?.free ?? []), ...(ro?.ads ?? []), ...(ro?.flatrate ?? [])];
    const provName =
      pool.find((p) => isLibraryProv(p.provider_name))?.provider_name ||
      pool[0]?.provider_name ||
      (record?.free_sources ?? []).find((s) => covers(s.scope, firstFree))?.platform ||
      "";
    freeClause = provName
      ? `free on ${provName} (${firstFree})${freeRegions.length > 1 ? ` +${freeRegions.length - 1}` : ""}`
      : `free in ${freeRegions.length}`;
  }
  const fpParts: string[] = [];
  if (freeClause) fpParts.push(freeClause);
  if (nStream) fpParts.push(`streaming in ${nStream}`);
  if (nRent) fpParts.push(`rent in ${nRent}`);
  if (nBuy) fpParts.push(`buy in ${nBuy}`);
  if (nNone) fpParts.push(`not yet in ${nNone}`);
  const fingerprint =
    countries.length > 0 && hasAny && fpParts.length
      ? `Tracked in ${countries.length} region${countries.length === 1 ? "" : "s"} — ${fpParts.join(", ")}.`
      : "";

  // Region chips: flag + tier glyph, availability-first, capped.
  const regionChips = countries
    .filter((rc) => tierByCc[rc] !== "none")
    .sort((a, b) => TIER_ORDER.indexOf(tierByCc[a]) - TIER_ORDER.indexOf(tierByCc[b]))
    .slice(0, 12);

  return (
    <div className="ax-sum">
      <div className="ax-sum-k">Where to watch — {title}</div>
      {fingerprint ? <div className="ax-sum-v ax-sum-v--free">{fingerprint}</div> : null}
      {headline ? (
        <>
          <div className={`ax-sum-v${free ? " ax-sum-v--free" : ""}`}>{headline}</div>
          {chips.length ? (
            <div className="ax-sum-chips">
              {chips.map((c) => <span key={c} className="ax-sum-chip">{c}</span>)}
            </div>
          ) : null}
        </>
      ) : null}
      {regionChips.length ? (
        <div className="ax-sum-chips">
          {regionChips.map((rc) => (
            <span key={rc} className="ax-sum-chip" title={`${TIER_WORD[tierByCc[rc]]} — ${countryName(rc)}`}>
              {flagEmoji(rc)} {TIER_GLYPH[tierByCc[rc]]} {rc}
            </span>
          ))}
        </div>
      ) : null}
      <Link className="ax-sum-btn" href={`/whereto/${slug}`}>See the full where-to-watch guide →</Link>
    </div>
  );
}
