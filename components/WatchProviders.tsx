"use client";

/**
 * WatchProviders — country-aware "where to watch" for a film, from TMDB /watch/providers
 * (data licensed via JustWatch — attribution required). The user picks a country (remembered in
 * localStorage); we show that country's stream / rent / buy channels with their logos. Deep links
 * to Netflix/Amazon are not available under the license, so each block links to the TMDB watch page.
 */
import { useEffect, useMemo, useState } from "react";

const LOGO = "https://image.tmdb.org/t/p/w45";
type Prov = { provider_id: number; provider_name: string; logo_path: string | null };
type Country = { link?: string; flatrate?: Prov[]; rent?: Prov[]; buy?: Prov[]; free?: Prov[]; ads?: Prov[] };

const PREFERRED = ["KR", "US", "GB", "CA", "AU", "FR", "DE", "JP"];
let regionNames: Intl.DisplayNames | null = null;
function countryName(code: string): string {
  try {
    regionNames = regionNames || new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) || code;
  } catch { return code; }
}

function Row({ label, items }: { label: string; items?: Prov[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="wp-row">
      <span className="wp-row__k">{label}</span>
      <div className="wp-logos">
        {items.map((p) => (
          <span className="wp-prov" key={p.provider_id} title={p.provider_name}>
            {p.logo_path ? <img src={`${LOGO}${p.logo_path}`} alt={p.provider_name} loading="lazy" /> : <span className="wp-prov__txt">{p.provider_name}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function WatchProviders({ results, countries }: { results: Record<string, Country>; countries: string[] }) {
  const sorted = useMemo(() => {
    const pref = PREFERRED.filter((c) => countries.includes(c));
    const rest = countries.filter((c) => !PREFERRED.includes(c)).sort((a, b) => countryName(a).localeCompare(countryName(b)));
    return [...pref, ...rest];
  }, [countries]);

  const [country, setCountry] = useState<string>(sorted[0] || "US");

  useEffect(() => {
    let initial = "";
    try { initial = localStorage.getItem("mt_country") || ""; } catch {}
    if (!initial) {
      try { initial = (new Intl.DateTimeFormat().resolvedOptions().locale.split("-")[1] || "").toUpperCase(); } catch {}
    }
    if (initial && sorted.includes(initial)) setCountry(initial);
  }, [sorted]);

  function pick(c: string) {
    setCountry(c);
    try { localStorage.setItem("mt_country", c); } catch {}
  }

  const data = results[country];
  const has = data && (data.flatrate || data.rent || data.buy || data.free || data.ads);

  return (
    <div className="wp">
      <div className="wp-head">
        <label className="wp-clbl" htmlFor="wp-country">Country</label>
        <select id="wp-country" className="wp-select" value={country} onChange={(e) => pick(e.target.value)}>
          {sorted.map((c) => <option key={c} value={c}>{countryName(c)}</option>)}
        </select>
      </div>

      {has ? (
        <>
          <Row label="Stream" items={data!.flatrate} />
          <Row label="Free" items={data!.free} />
          <Row label="With ads" items={data!.ads} />
          <Row label="Rent" items={data!.rent} />
          <Row label="Buy" items={data!.buy} />
        </>
      ) : (
        <p className="wp-empty">No listed channels in {countryName(country)}. Available in: {sorted.slice(0, 12).map(countryName).join(", ")}{sorted.length > 12 ? "…" : ""}.</p>
      )}

      <div className="wp-attr">
        Source:{" "}
        {data?.link
          ? <a href={data.link} target="_blank" rel="noopener noreferrer">JustWatch</a>
          : <span>JustWatch</span>}
        {" "}· via TMDB. Availability changes; not endorsed by the providers.
      </div>
    </div>
  );
}
