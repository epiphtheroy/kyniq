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

  return (
    <div className="ax-sum">
      <div className="ax-sum-k">Where to watch — {title}</div>
      {headline ? (
        <>
          <div className={`ax-sum-v${free ? " ax-sum-v--free" : ""}`}>{headline}</div>
          {chips.length ? (
            <div className="ax-sum-chips">
              {chips.map((c) => <span key={c} className="ax-sum-chip">{c}</span>)}
            </div>
          ) : null}
        </>
      ) : (
        <div className="ax-sum-v ax-sum-v--none">No streaming data yet for your country — check the full guide.</div>
      )}
      <Link className="ax-sum-btn" href={`/whereto/${slug}`}>See the full where-to-watch guide →</Link>
    </div>
  );
}
