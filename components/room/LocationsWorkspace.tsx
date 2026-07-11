"use client";
/** Atlas — /room/atlas (v3: a real map).
 *  A personal world map of where the user's SEEN films are set / were filmed,
 *  + per-country coverage + geographic blind spots (continents with 0 seen films).
 *
 *  Land = low-poly world outline from lib/room/world_paths.ts (static inline SVG
 *  paths, imported ONLY by this route — bundle isolation; NO MapLibre, no external
 *  tiles). The paths are pre-projected with the SAME equirectangular constants as
 *  projX/projY below (x=(lng+180)/360·760, y=(90−lat)/180·380) so film dots land
 *  on the right landmass — verified against reference cities at generation time.
 *
 *  Data: one page RPC — me_geo_coverage() → { points[], by_country[], totals }
 *  (single json, auth.uid()-scoped, seen films only, cap-safe). by_country carries
 *  a `continent` per SEEN country only, so the page additionally passes the full
 *  public country_continents reference (for blind-continent territory lists) and
 *  the public national lineage index (for /lineage/* deep links). The blind-
 *  continent inspector additionally client-fetches me_geo_gap_candidates (§8-R7,
 *  0045) on open — lazily, one continent at a time, never eagerly for all.
 *
 *  Flags are COMPUTED: country name → ISO2 via an inverted Intl.DisplayNames
 *  region table (+ a small alias patch for CLDR naming variants) → regional-
 *  indicator emoji. The old 45-entry hardcoded map is gone.
 *  PostgREST numerics (incl. lat/lng) may arrive as strings → coerce with num(). */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useInspector } from "./InspectorContext";
import CinecodexCard from "./CinecodexCard";
import ICard from "./insp/ICard";
import KV from "./insp/KV";
import ActBar from "./insp/ActBar";
import { useRoomActions } from "./useRoomActions";
import { num, IMG } from "@/lib/room/format";
import { STR } from "./strings";
import { WORLD_LAND_PATHS, WORLD_VIEW_W, WORLD_VIEW_H } from "@/lib/room/world_paths";

/* ── typed RPC shapes (numerics may arrive as strings from PostgREST) ── */
export type GeoPoint = {
  slug: string; title: string;
  lat: number | string | null; lng: number | string | null;
  country: string | null; name: string | null; narrative_setting: string | null;
  layer: string | null; kind: string | null;
};
export type CountryRow = { country: string; films: number | string | null; pins: number | string | null; continent?: string | null };
export type GeoTotals = {
  located_films: number | string | null; total_watched: number | string | null;
  countries: number | string | null; total_pins: number | string | null;
  countries_total?: number | string | null;
} | null;
export type GeoData = { points: GeoPoint[]; by_country: CountryRow[]; totals: GeoTotals };

/** Full country_continents reference row (public read-all table, fetched by the page). */
export type CountryRefRow = { country: string; continent: string };
/** Public national lineage (from the lineage_index RPC, facet="national"); country = lowercase ISO2. */
export type NatLineage = { slug: string; label: string; country: string | null };

const n0 = (x: number | string | null | undefined) => num(x) ?? 0;

/* The RPC coalesces a NULL country to a fixed Korean literal meaning "unknown"
   (me_geo_coverage is unchanged in v3). Match it via escaped codepoints so this
   file greps clean of Korean, and render it in English. */
const UNKNOWN_COUNTRY = "\uBBF8\uC0C1";
const displayCountry = (c: string | null | undefined): string =>
  !c || c === UNKNOWN_COUNTRY ? "Unknown" : c;

/* ── continents (DB reference-table vocabulary: country_continents.continent) ── */
const CONTINENTS = ["Asia", "Europe", "Africa", "N.America", "S.America", "Oceania"] as const;
type Continent = (typeof CONTINENTS)[number] | "Other";
const CONT_LABEL: Record<Continent, string> = {
  Asia: "Asia", Europe: "Europe", Africa: "Africa",
  "N.America": "North America", "S.America": "South America", Oceania: "Oceania", Other: "Other · polar",
};
const CONT_ICON: Record<Continent, string> = {
  Asia: "ti-torii", Europe: "ti-building-castle", Africa: "ti-tree",
  "N.America": "ti-building-skyscraper", "S.America": "ti-mountain", Oceania: "ti-beach", Other: "ti-snowflake",
};
function normCont(c: string | null | undefined): Continent | null {
  if (!c) return null;
  return (CONTINENTS as readonly string[]).includes(c) ? (c as Continent) : "Other";
}

/* ── flags: computed name → ISO2 → regional-indicator emoji (no hardcoded country map).
   The ISO table is built once by inverting Intl.DisplayNames("en", region) over all
   AA–ZZ codes; a small alias patch covers CLDR naming variants present in our data. ── */
const ISO_ALIASES: Record<string, string> = {
  "Korea": "KR", "Hong Kong": "HK", "Macau": "MO", "Macao": "MO",
  "Palestine": "PS", "Palestinian Territory": "PS", "Czech Republic": "CZ",
  "Turkey": "TR", "Myanmar": "MM", "Democratic Republic of the Congo": "CD",
  "Republic of the Congo": "CG", "Cabo Verde": "CV",
  "United States Minor Outlying Islands": "UM",
};
function normName(s: string): string {
  return s.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bst\./g, "saint ")
    .replace(/[^a-z]+/g, " ")
    .split(/\s+/).filter((w) => w && w !== "the").join(" ");
}
let isoMap: Map<string, string> | null = null;
function getIsoMap(): Map<string, string> {
  if (isoMap) return isoMap;
  const m = new Map<string, string>();
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a) + String.fromCharCode(b);
      let name: string | undefined;
      try { name = dn.of(code); } catch { continue; }
      if (!name || name === code) continue;
      const k = normName(name);
      if (k && !m.has(k)) m.set(k, code);
    }
  } catch { /* Intl.DisplayNames unavailable → no flags (honest fallback, no fake glyphs) */ }
  for (const [alias, code] of Object.entries(ISO_ALIASES)) m.set(normName(alias), code);
  isoMap = m;
  return m;
}
function isoOf(country: string | null | undefined): string | null {
  if (!country || country === UNKNOWN_COUNTRY) return null;
  return getIsoMap().get(normName(country)) ?? null;
}
function flagOf(country: string | null | undefined): string {
  const iso = isoOf(country);
  if (!iso) return "";
  return String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65)));
}

/* ── equirectangular projection into the SVG viewBox — MUST stay in lockstep with
      lib/room/world_paths.ts (the land is pre-projected with these constants). ── */
const MAP_W = WORLD_VIEW_W; // 760
const MAP_H = WORLD_VIEW_H; // 380
const projX = (lng: number) => ((lng + 180) / 360) * MAP_W;
const projY = (lat: number) => ((90 - lat) / 180) * MAP_H;

/* ── derived point (numeric-coerced) ── */
type Pt = {
  slug: string; title: string; lat: number; lng: number;
  country: string | null; name: string | null; narrative_setting: string | null;
  layer: "filmed" | "setting"; kind: string | null; x: number; y: number;
};
type Cluster = { key: string; x: number; y: number; layer: "filmed" | "setting"; films: Pt[] };

/* ═══════════ inspector nodes ═══════════ */

/** A plotted location → the film (title + place + role) + Cinecodex slug (→ content hub). */
function PointInsp({ p }: { p: Pt }) {
  const filmed = p.layer === "filmed";
  return (
    <div>
      <div className="selhead">
        <span className="po" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="ti ti-map-pin" style={{ fontSize: 22, color: filmed ? "var(--at-filmed, #0F6E56)" : "var(--frontier)" }} />
        </span>
        <div>
          <div className="seltitle ser">{p.title}</div>
          <div className="selsub">{displayCountry(p.country)}{p.kind ? ` · ${p.kind}` : ""} · {filmed ? "Filmed here" : "Setting"}</div>
        </div>
      </div>
      <ICard icon="ti-map-pin" title="This point">
        <div className="seltitle ser" style={{ fontSize: 15 }}>{p.name ?? "—"}</div>
        {p.narrative_setting ? (
          <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.5, marginTop: 6 }}>{p.narrative_setting}</div>
        ) : null}
        <div style={{ marginTop: 8 }}>
          <KV k="Country" v={displayCountry(p.country)} />
          <KV k="Coordinates (lat, lng)" v={`${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}`} />
          <KV k="Layer" v={<span style={{ color: filmed ? "var(--safe)" : "var(--frontier)" }}>{filmed ? "Filmed" : "Setting"}</span>} />
        </div>
      </ICard>
      <CinecodexCard d={{ v: null, c: null, r: null }} slug={p.slug} />
    </div>
  );
}

/** Several films sharing one coordinate. */
function ClusterInsp({ c }: { c: Cluster }) {
  const uniq = [...new Map(c.films.map((p) => [p.slug, p])).values()];
  const first = c.films[0];
  return (
    <div>
      <ICard icon="ti-map-pin" title={`Shared coordinate · ${uniq.length} films`}>
        <div className="seltitle ser" style={{ fontSize: 15 }}>{first.name ?? displayCountry(first.country)}</div>
        <div className="selsub">{displayCountry(first.country)} · {c.layer === "filmed" ? "Filmed" : "Setting"} · ({first.lat.toFixed(2)}, {first.lng.toFixed(2)})</div>
      </ICard>
      <ICard icon="ti-movie" title="Films sharing this point">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {uniq.map((p) => (
            <Link key={p.slug} href={`/room/film/${p.slug}`} className="fh-loc" style={{ textDecoration: "none" }}>
              <span className={`fh-locdot ${p.layer}`} />
              <span className="fh-locn">{p.title}</span>
            </Link>
          ))}
        </div>
      </ICard>
    </div>
  );
}

/** A country row → its pins + film list + doors (national lineages, Coverage facet). */
function CountryInsp({ c, cont, pts, lineages }: {
  c: { country: string; films: number; pins: number };
  cont: Continent | null; pts: Pt[]; lineages: NatLineage[];
}) {
  const mine = pts.filter((p) => p.country === c.country);
  const filmedN = mine.filter((p) => p.layer === "filmed").length;
  const settingN = mine.length - filmedN;
  const flag = flagOf(c.country);
  return (
    <div>
      <ICard icon="ti-flag" title="Country coverage">
        <div className="seltitle ser" style={{ fontSize: 18 }}>{flag ? `${flag} ` : ""}{displayCountry(c.country)}</div>
        <div className="selsub">{cont ? CONT_LABEL[cont] : "Continent unknown"}</div>
        <div className="bigscore" style={{ marginTop: 10, color: "var(--frontier)" }}>
          {c.films}<span style={{ fontSize: 12, color: "var(--sub)", marginLeft: 8 }}>films · {c.pins} pins</span>
        </div>
        <div style={{ marginTop: 8 }}>
          <KV k="Filmed" v={<span style={{ color: "var(--safe)" }}>{filmedN}</span>} />
          <KV k="Setting" v={<span style={{ color: "var(--frontier)" }}>{settingN}</span>} />
        </div>
      </ICard>
      <ICard icon="ti-movie" title="Seen films set or shot here">
        {mine.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...new Map(mine.map((p) => [p.slug, p])).values()].map((p) => (
              <Link key={p.slug} href={`/room/film/${p.slug}`} className="fh-loc" style={{ textDecoration: "none" }}>
                <span className={`fh-locdot ${p.layer}`} />
                <span className="fh-locn">{p.title}</span>
              </Link>
            ))}
          </div>
        ) : <div className="emptyins" style={{ padding: "8px 0" }}>No pins.</div>}
      </ICard>
      {lineages.length ? (
        <ICard icon="ti-timeline" title="National lineages" right="public">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {lineages.map((l) => (
              <Link key={l.slug} href={`/lineage/${l.slug}`} className="fh-loc" style={{ textDecoration: "none" }}>
                <i className="ti ti-arrow-right" style={{ fontSize: 11, color: "var(--sub)" }} />
                <span className="fh-locn">{l.label}</span>
              </Link>
            ))}
          </div>
        </ICard>
      ) : null}
      <ActBar acts={[{ label: "Coverage · National →", href: "/room/coverage?facet=national" }]} />
    </div>
  );
}

/* ── §8-R7 me_geo_gap_candidates row (0045) — PostgREST numerics may arrive as strings ── */
type GapCandRow = {
  slug: string; title: string; year: number | string | null; poster_path: string | null;
  director: string | null; prestige: number | string | null; country: string | null;
};

/** "Best films from this territory" — client-fetched on inspector open ONLY
 *  (§8-R7 me_geo_gap_candidates: unseen visible films located in the continent,
 *  Standing desc). p_continent takes the DB reference vocabulary — exactly the
 *  CONTINENTS constants above (verified: blind cards are derived from CONTINENTS,
 *  so `cont` is always one of the six DB labels; no mapping needed).
 *  Keep/Seen are optimistic with rollback on RPC error (house pattern). */
function GapCandidates({ cont }: { cont: Continent }) {
  const { supabase, session, doKeep, doSeen } = useRoomActions();
  const [rows, setRows] = useState<GapCandRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [retryN, setRetryN] = useState(0);
  /* optimistic overlays (rolled back if the RPC fails) */
  const [localKept, setLocalKept] = useState<ReadonlySet<string>>(new Set());
  const [localSeen, setLocalSeen] = useState<ReadonlySet<string>>(new Set());

  /* React reuses the instance across consecutive select() calls — refetch and
     reset overlays when the continent changes. Lazy by construction: this only
     runs when the inspector renders this card. */
  useEffect(() => {
    let cancelled = false;
    setRows(null); setErr(null);
    setLocalKept(new Set()); setLocalSeen(new Set());
    supabase.rpc("me_geo_gap_candidates", { p_continent: cont, p_limit: 8 })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setErr(error.message); return; }
        setRows((data as GapCandRow[] | null) ?? []);
      });
    return () => { cancelled = true; };
  }, [supabase, cont, retryN]);

  const keep = (r: GapCandRow) => {
    setLocalKept((p) => new Set(p).add(r.slug));
    void doKeep(r.slug, r.title).then((ok) => {
      if (!ok) setLocalKept((p) => { const n = new Set(p); n.delete(r.slug); return n; });
    });
  };
  const markSeen = (r: GapCandRow) => {
    setLocalSeen((p) => new Set(p).add(r.slug));
    void doSeen(r.slug, r.title).then((ok) => {
      if (!ok) setLocalSeen((p) => { const n = new Set(p); n.delete(r.slug); return n; });
    });
  };

  return (
    <ICard icon="ti-compass" title="Best films from this territory" right="me_geo_gap_candidates">
      {err != null ? (
        <div className="emptyins" style={{ padding: "8px 0", textAlign: "left" }}>
          {STR.common.errorLoad}
          <button type="button" className="at-gretry" onClick={() => setRetryN((n) => n + 1)}>{STR.common.retry}</button>
        </div>
      ) : rows == null ? (
        <div>
          <div className="ghline w80" />
          <div className="ghline w60" />
          <div className="ghline w80" />
        </div>
      ) : rows.length === 0 ? (
        <div className="emptyins" style={{ padding: "8px 0", textAlign: "left" }}>
          No unseen films located in this continent are in the catalog yet — the territory below is still the door.
        </div>
      ) : (
        <>
          <div className="at-gaps">
            {rows.map((r) => {
              const kept = localKept.has(r.slug) || session.kept.has(r.slug);
              const seen = localSeen.has(r.slug) || session.gone.has(r.slug);
              const p = num(r.prestige);
              const flag = flagOf(r.country);
              return (
                <div key={r.slug} className={`at-gap${seen ? " seen" : ""}`}>
                  <span className="at-gpo" style={r.poster_path ? { backgroundImage: `url(${IMG}${r.poster_path})` } : {}} />
                  <div style={{ minWidth: 0 }}>
                    <div className="at-gtt">
                      <Link href={`/room/film/${r.slug}`}>{r.title}</Link>
                      <small>{r.year ?? "?"}{r.director ? ` · ${r.director}` : ""}</small>
                    </div>
                    <div className="at-gsub">
                      <span>{STR.cc.standing} <b>{p != null ? Math.round(p) : "—"}</b></span>
                      <span>·</span>
                      <span className="at-gc">{flag ? `${flag} ` : ""}{displayCountry(r.country)}</span>
                    </div>
                  </div>
                  <div className="at-gact">
                    <button type="button" className={`at-gb${kept ? " done" : ""}`} title={kept ? STR.row.kept : STR.row.keep}
                      disabled={kept} onClick={() => keep(r)}>
                      <i className={`ti ${kept ? "ti-bookmark-filled" : "ti-bookmark-plus"}`} />
                    </button>
                    <button type="button" className={`at-gb${seen ? " done" : ""}`} title={STR.row.seen}
                      disabled={seen} onClick={() => markSeen(r)}>
                      <i className="ti ti-check" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8, lineHeight: 1.5 }}>
            Unseen films with a measured location in this continent, ranked by {STR.cc.standing}. Keep → slate · Seen → the continent stops being blind.
          </div>
        </>
      )}
    </ICard>
  );
}

/** A blind continent → best unseen films located there (§8-R7, fetched on open)
 *  + the territory: every country of that continent (from the country_continents
 *  reference), with doors to public national lineages and the Coverage national
 *  facet. */
function BlindInsp({ cont, countries, natByIso }: {
  cont: Continent; countries: string[]; natByIso: Map<string, NatLineage[]>;
}) {
  return (
    <div>
      <ICard icon="ti-eye-off" title="Geographic blind spot">
        <div className="seltitle ser" style={{ fontSize: 18, color: "var(--at-blindtx, #edc873)" }}>
          <i className={`ti ${CONT_ICON[cont]}`} style={{ marginRight: 7 }} />{CONT_LABEL[cont]}
        </div>
        <div className="selsub">A continent none of your seen films touch</div>
        <div className="bigscore" style={{ marginTop: 10, color: "var(--at-blindtx, #edc873)" }}>
          0<span style={{ fontSize: 12, color: "var(--sub)", marginLeft: 8 }}>films · unexplored</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.55, marginTop: 8 }}>
          The best unseen films from this territory are below — and every country is a door.
        </div>
      </ICard>
      <GapCandidates cont={cont} />
      <ICard icon="ti-world" title={`The territory · ${countries.length} countries`} right="country_continents">
        <div className="at-terr">
          {countries.map((name) => {
            const flag = flagOf(name);
            const iso = isoOf(name);
            const lineages = iso ? (natByIso.get(iso.toLowerCase()) ?? []) : [];
            return (
              <div key={name} className="at-terrow">
                <span className="at-terrn">{flag ? `${flag} ` : ""}{name}</span>
                {lineages.length ? (
                  <Link className="at-terrlink" href={`/lineage/${lineages[0].slug}`} title={lineages[0].label}>
                    Lineage →
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      </ICard>
      <ActBar acts={[
        { label: "Coverage · National →", href: "/room/coverage?facet=national" },
        { label: "Browse lineages →", href: "/lineage" },
      ]} />
    </div>
  );
}

/* ═══════════ main ═══════════ */
export default function AtlasWorkspace({ data, countryRef, nationalLineages }: {
  data: GeoData; countryRef: CountryRefRow[]; nationalLineages: NatLineage[];
}) {
  const insp = useInspector();
  const { setDefault } = insp;

  /* Layer toggles (spec §3.9.2) — both on by default. */
  const [showFilmed, setShowFilmed] = useState(true);
  const [showSetting, setShowSetting] = useState(true);

  /* normalized points (lat/lng coerced from possible strings) */
  const pts = useMemo<Pt[]>(() => {
    return (data.points ?? [])
      .map((p) => {
        const lat = num(p.lat), lng = num(p.lng);
        if (lat == null || lng == null) return null;
        const layer: "filmed" | "setting" = p.layer === "filmed" ? "filmed" : "setting";
        return {
          slug: p.slug, title: p.title, lat, lng, country: p.country, name: p.name,
          narrative_setting: p.narrative_setting, layer, kind: p.kind,
          x: projX(lng), y: projY(lat),
        } as Pt;
      })
      .filter((p): p is Pt => p !== null);
  }, [data.points]);

  const countries = useMemo(() =>
    (data.by_country ?? []).map((c) => ({ country: c.country, films: n0(c.films), pins: n0(c.pins), cont: normCont(c.continent) })),
    [data.by_country]);

  /* country → continent for SEEN countries (payload-borne, from the DB reference table) */
  const contByCountry = useMemo(() => {
    const m = new Map<string, Continent | null>();
    for (const c of countries) m.set(c.country, c.cont);
    return m;
  }, [countries]);
  const contOf = useMemo(() => (country: string | null): Continent | null =>
    country ? (contByCountry.get(country) ?? null) : null, [contByCountry]);

  /* full territory per continent — the public reference table (page-fetched) */
  const refByCont = useMemo(() => {
    const m = new Map<Continent, string[]>();
    for (const r of countryRef ?? []) {
      const cont = normCont(r.continent);
      if (!cont) continue;
      if (!m.has(cont)) m.set(cont, []);
      m.get(cont)!.push(r.country);
    }
    for (const list of m.values()) list.sort((a, b) => a.localeCompare(b));
    return m;
  }, [countryRef]);

  /* national lineages by lowercase ISO2 */
  const natByIso = useMemo(() => {
    const m = new Map<string, NatLineage[]>();
    for (const l of nationalLineages ?? []) {
      if (!l.country) continue;
      const k = l.country.toLowerCase();
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(l);
    }
    return m;
  }, [nationalLineages]);
  const lineagesOf = useMemo(() => (country: string): NatLineage[] => {
    const iso = isoOf(country);
    return iso ? (natByIso.get(iso.toLowerCase()) ?? []) : [];
  }, [natByIso]);

  const t = data.totals;
  const locatedFilms = n0(t?.located_films);
  const totalWatched = n0(t?.total_watched);
  const countryCount = n0(t?.countries);
  const totalPins = n0(t?.total_pins);

  const filmedN = useMemo(() => pts.filter((p) => p.layer === "filmed").length, [pts]);
  const settingN = pts.length - filmedN;

  /* geographic reach % — denominator = every country that actually appears in
     film_locations (measured, no magic number) */
  const refNations = n0(t?.countries_total) || 50;
  const coveragePct = Math.round((countryCount / refNations) * 100);

  /* continents: seen counts + blind — continent mapping is DB-reference-derived */
  const contFilms = useMemo(() => {
    const m = new Map<Continent, Set<string>>();
    for (const p of pts) {
      const cont = contOf(p.country);
      if (!cont) continue;
      if (!m.has(cont)) m.set(cont, new Set());
      m.get(cont)!.add(p.slug);
    }
    return m;
  }, [pts, contOf]);

  const contStats = useMemo(() =>
    CONTINENTS.map((cont) => ({ cont: cont as Continent, films: contFilms.get(cont)?.size ?? 0 })), [contFilms]);
  const seenConts = useMemo(() => contStats.filter((c) => c.films > 0), [contStats]);
  const blindConts = useMemo(() => contStats.filter((c) => c.films === 0).map((c) => c.cont), [contStats]);
  const maxContFilms = Math.max(1, ...contStats.map((c) => c.films));

  /* graticule lines every 30° */
  const lngLines = useMemo(() => { const a: number[] = []; for (let l = -150; l <= 150; l += 30) a.push(l); return a; }, []);
  const latLines = useMemo(() => { const a: number[] = []; for (let l = -60; l <= 60; l += 30) a.push(l); return a; }, []);

  /* same-coordinate dedup: pins sharing (lat,lng,layer) render as one dot with an n-film badge */
  const clusters = useMemo<Cluster[]>(() => {
    const m = new Map<string, Cluster>();
    for (const p of pts) {
      const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)},${p.layer}`;
      const c = m.get(key);
      if (c) c.films.push(p);
      else m.set(key, { key, x: p.x, y: p.y, layer: p.layer, films: [p] });
    }
    return [...m.values()];
  }, [pts]);
  const visibleClusters = useMemo(
    () => clusters.filter((c) => (c.layer === "filmed" ? showFilmed : showSetting)),
    [clusters, showFilmed, showSetting]);

  const topCountry = countries[0] ?? null;
  const maxCountryFilms = Math.max(1, ...countries.map((c) => c.films));

  /* inspector openers */
  const openPoint = (p: Pt) => insp.select(<PointInsp p={p} />, `${p.title} · Point`);
  const openCountry = (c: { country: string; films: number; pins: number }) =>
    insp.select(<CountryInsp c={c} cont={contOf(c.country)} pts={pts} lineages={lineagesOf(c.country)} />, `${displayCountry(c.country)} · Coverage`);
  const openBlind = (cont: Continent) =>
    insp.select(<BlindInsp cont={cont} countries={refByCont.get(cont) ?? []} natByIso={natByIso} />, `${CONT_LABEL[cont]} · Blind spot`);
  const openCluster = (c: Cluster) => {
    const uniq = [...new Map(c.films.map((p) => [p.slug, p])).values()];
    insp.select(<ClusterInsp c={c} />, `${c.films[0].name ?? "Point"} · ${uniq.length} films`);
  };

  /* ── page brief (opened by the app-bar Brief button) ── */
  useEffect(() => {
    setDefault(
      <div>
        <ICard icon="ti-world" title="Atlas — summary">
          <KV k="Films on the map" v={locatedFilms} />
          <KV k="Seen films" v={totalWatched} />
          <KV k="Countries" v={countryCount} />
          <KV k="Pins" v={totalPins} />
          <KV k="Filmed · Setting" v={`${filmedN} · ${settingN}`} />
        </ICard>
        <ICard icon="ti-eye-off" title="Geographic blind spots">
          <KV k="Continents reached" v={<span style={{ color: "var(--safe)" }}>{seenConts.length} / 6</span>} />
          <KV k={<span className="gloss" title="Blind = a continent no seen film is set in or was shot on. A true blank on your map.">Blind continents</span>}
            v={<span style={{ color: "var(--blind)" }}>{blindConts.length}</span>} />
          {blindConts.length ? (
            <div style={{ fontSize: 11, color: "var(--at-blindtx, #edc873)", marginTop: 6, lineHeight: 1.5 }}>
              Untouched: {blindConts.map((c) => CONT_LABEL[c]).join(" · ")}
            </div>
          ) : <div style={{ fontSize: 11, color: "var(--safe)", marginTop: 6 }}>All six continents reached.</div>}
        </ICard>
        <div className="at-empty" style={{ textAlign: "left", padding: "0 2px" }}>
          Click a dot, a country row or a blind continent — details open here. Every dot is a measured coordinate.
        </div>
      </div>
    );
  }, [locatedFilms, totalWatched, countryCount, totalPins, filmedN, settingN, seenConts.length, blindConts, setDefault]);

  const empty = pts.length === 0;

  return (
    <div className="mainpad">
      <h1 className="secttl">Atlas</h1>
      <p className="secsub">
        Your seen films on a world map — where they are <span className="gloss" title="Filmed = actual shooting location · Setting = where the narrative takes place">set and shot</span>,
        the countries you&apos;ve covered, and the <span className="gloss" title="Blind = a continent no seen film touches (a true blank on the map)">blind continents</span> you haven&apos;t.
        Every dot is a measured coordinate.
      </p>

      {empty ? (
        <div className="mod"><div className="modbody">
          <div className="emptyins" style={{ padding: "32px 12px 16px" }}>{STR.empty.atlas}</div>
          <ActBar acts={[
            { label: STR.forming.defaultCta, href: "/room/ledger" },
            { label: STR.forming.importCta, href: "/me/import" },
          ]} style={{ marginBottom: 10 }} />
        </div></div>
      ) : (
        <>
          {/* ═══ HERO · geographic reach ═══ */}
          <div className="at-hero">
            <div className="at-navbig">
              <div className="at-ring">
                <svg width="92" height="92" viewBox="0 0 92 92">
                  <circle cx="46" cy="46" r="38" fill="none" stroke="#24242a" strokeWidth="7" />
                  {(() => { const C = 2 * Math.PI * 38; const frac = Math.min(1, countryCount / refNations); return (
                    <circle cx="46" cy="46" r="38" fill="none" stroke="var(--frontier)" strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={C.toFixed(1)} strokeDashoffset={(C * (1 - frac)).toFixed(1)} transform="rotate(-90 46 46)" />
                  ); })()}
                  <text x="46" y="43" textAnchor="middle" fontSize="16" fill="#ECEAE5" fontFamily="ui-monospace,monospace" fontWeight="600">{countryCount}</text>
                  <text x="46" y="57" textAnchor="middle" fontSize="8" fill="#6C6960" letterSpacing="1">COUNTRIES</text>
                </svg>
              </div>
              <div className="at-navmeta">
                <div className="eb">Geographic reach</div>
                <div className="at-lvl">● {seenConts.length}/6 continents · {countryCount} countries</div>
                <div className="at-pctl"><b>{locatedFilms}</b> films on the map · <b>{totalPins}</b> pins · <b>{coveragePct}%</b> of the {refNations} countries with location data</div>
              </div>
            </div>
            <div className="at-components">
              {contStats.map((c) => {
                const isBlind = c.films === 0;
                const pct = Math.round((c.films / maxContFilms) * 100);
                return (
                  <div className={`at-comp${isBlind ? " blind" : ""}`} key={c.cont}>
                    <span className="cl" title={CONT_LABEL[c.cont]}>{CONT_LABEL[c.cont]}</span>
                    <div className="ct"><i style={{ width: isBlind ? "3%" : `${pct}%`, background: isBlind ? "var(--blind)" : "var(--frontier)" }} /></div>
                    <span className="cv">{isBlind ? "blind" : `${c.films}`}</span>
                  </div>
                );
              })}
            </div>
            <div className="at-sig-prose">
              {topCountry ? (
                <>Your films are set most often in <span className="em">{displayCountry(topCountry.country)}</span> ({topCountry.films} films).
                  You&apos;ve reached <b>{seenConts.length}</b> of 6 continents{blindConts.length
                    ? <>; <b style={{ color: "var(--at-blindtx, #edc873)" }}>{blindConts.map((c) => CONT_LABEL[c]).join(" · ")}</b> {blindConts.length === 1 ? "is" : "are"} still blank on your map.</>
                    : <> — all six are on your map.</>}</>
              ) : <>No countries on the map yet.</>}
            </div>
            <div className="at-foot">
              <i className="ti ti-map-pin" style={{ color: "var(--frontier)" }} /> Dots = <b>film_locations</b> (measured lat/lng) of your seen films.{" "}
              <b style={{ color: "var(--at-filmed, #0F6E56)" }}>Filmed</b> and <b style={{ color: "var(--frontier)" }}>setting</b> are separate layers.
              Continent mapping = DB reference table (country_continents) · shared coordinates merge into one dot (n-film badge).
            </div>
          </div>

          {/* ═══ KPI STRIP ═══ */}
          <div className="at-kpis">
            <div className="at-kpi"><div className="eb">Films on the map</div><div className="v">{locatedFilms}<small>/{totalWatched}</small></div><div className="d">seen films with coordinates</div></div>
            <div className="at-kpi"><div className="eb">Countries</div><div className="v">{countryCount}</div><div className="d">distinct countries</div></div>
            <div className="at-kpi"><div className="eb">Pins</div><div className="v">{totalPins}</div><div className="d">filmed {filmedN} · setting {settingN}</div></div>
            <div className={`at-kpi${blindConts.length ? " blindkpi" : ""}`}><div className="eb">Blind continents</div><div className="v">{blindConts.length}<small>/6</small></div><div className="d">not yet reached</div></div>
          </div>

          {/* ═══ WORLD MAP (static low-poly land + measured dots) ═══ */}
          <div className="mod" id="at-map">
            <div className="modh">
              <h3><i className="ti ti-world" /> World map · where your films are set &amp; shot</h3>
              <div className="at-lyrs">
                <button className={`at-lyr filmed${showFilmed ? " on" : ""}`} onClick={() => setShowFilmed((v) => !v)}
                  title="Toggle the filmed-location layer" aria-pressed={showFilmed}>
                  <i /> Filmed ({filmedN})
                </button>
                <button className={`at-lyr setting${showSetting ? " on" : ""}`} onClick={() => setShowSetting((v) => !v)}
                  title="Toggle the narrative-setting layer" aria-pressed={showSetting}>
                  <i /> Setting ({settingN})
                </button>
              </div>
            </div>
            <div className="modbody">
              <div className="at-mapwrap">
                <div className="at-plane">
                  <svg className="at-map" viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label="World map of the filming locations and settings of your seen films">
                    {/* ocean */}
                    <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="var(--at-ocean, #0d0d10)" />
                    {/* land — pre-projected static outline (world_paths.ts, this route only) */}
                    <g className="at-land">
                      {WORLD_LAND_PATHS.map((d, i) => <path key={i} d={d} fillRule="evenodd" />)}
                    </g>
                    {/* graticule every 30° */}
                    {lngLines.map((l) => {
                      const x = projX(l);
                      return <line key={`gl${l}`} x1={x} y1={0} x2={x} y2={MAP_H} stroke="rgba(255,255,255,.05)" strokeWidth={1} />;
                    })}
                    {latLines.map((l) => {
                      const y = projY(l);
                      return <line key={`ga${l}`} x1={0} y1={y} x2={MAP_W} y2={y} stroke="rgba(255,255,255,.05)" strokeWidth={1} />;
                    })}
                    {/* equator + prime meridian slightly brighter */}
                    <line x1={0} y1={projY(0)} x2={MAP_W} y2={projY(0)} stroke="rgba(255,255,255,.10)" strokeWidth={1} />
                    <line x1={projX(0)} y1={0} x2={projX(0)} y2={MAP_H} stroke="rgba(255,255,255,.10)" strokeWidth={1} />
                    <rect x={0.5} y={0.5} width={MAP_W - 1} height={MAP_H - 1} fill="none" stroke="#2c2c30" />
                    {/* dots — same-coordinate pins dedup into one dot (n-film badge) */}
                    {visibleClusters.map((c) => {
                      const uniq = [...new Map(c.films.map((p) => [p.slug, p])).values()];
                      const first = c.films[0];
                      const rr = 3.2 + Math.min(3, Math.log2(uniq.length + 1));
                      const fill = c.layer === "filmed" ? "var(--at-filmed, #0F6E56)" : "var(--frontier)";
                      return (
                        <g key={c.key} className="at-dot" onClick={() => (uniq.length === 1 ? openPoint(first) : openCluster(c))}>
                          <title>{uniq.length === 1
                            ? `${first.title} · ${first.name ?? displayCountry(first.country)}`
                            : `${first.name ?? displayCountry(first.country)} · ${uniq.length} films`}</title>
                          <circle className="hit" cx={c.x} cy={c.y} r={11} fill="transparent" />
                          <circle cx={c.x} cy={c.y} r={rr} fill={fill} fillOpacity={0.85} stroke="#0a0a0b" strokeWidth={0.8} />
                          {uniq.length > 1 ? (
                            <text x={c.x} y={c.y - rr - 2.5} textAnchor="middle" fontSize="7.5" fill="#9A968D">{uniq.length}</text>
                          ) : null}
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div className="at-side">
                  <div className="at-lead2"><i className="ti ti-info-circle" /><div>Each dot is a <b>measured coordinate</b> from a film you&apos;ve seen. <b>Filmed</b> = where it was shot; <b>setting</b> = where the story takes place. Click a dot to open the film.</div></div>
                  <div className="at-grp">Map stats</div>
                  <div className="at-stat"><span className="k">Films on the map</span><span className="v">{locatedFilms}</span></div>
                  <div className="at-stat"><span className="k">Pins</span><span className="v">{totalPins}</span></div>
                  <div className="at-stat"><span className="k">Countries</span><span className="v">{countryCount}</span></div>
                  <div className="at-legend">
                    <div className={`lg${showFilmed ? "" : " off"}`}><i className="filmed" />Filmed ({filmedN}){showFilmed ? "" : " · hidden"}</div>
                    <div className={`lg${showSetting ? "" : " off"}`}><i className="setting" />Setting ({settingN}){showSetting ? "" : " · hidden"}</div>
                    <div className="lg" style={{ color: "var(--sub)" }}>dot size &amp; number = films sharing the coordinate</div>
                  </div>
                  <div className="at-note">Dots = measured (lat, lng) · equirectangular projection · land = Natural Earth 1:110m outline (static, no tiles).</div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ COVERAGE BY COUNTRY ═══ */}
          <div className="mod" id="at-country">
            <div className="modh"><h3><i className="ti ti-flag" /> Coverage by country</h3>
              <span className="meta">by film count · click a row for details</span></div>
            <div className="modbody">
              {countries.length ? (
                <>
                  {countries.map((c, i) => {
                    const pct = Math.round((c.films / maxCountryFilms) * 100);
                    const flag = flagOf(c.country);
                    return (
                      <div key={c.country} className={`at-cov${i === 0 ? " top" : ""}`} onClick={() => openCountry(c)} title={`${displayCountry(c.country)} — ${c.films} films · ${c.pins} pins`}>
                        <div className="cn">{flag ? <span className="flag">{flag}</span> : <i className="ti ti-map-pin" style={{ fontSize: 12, color: "var(--sub)" }} />}{displayCountry(c.country)}</div>
                        <div className="track"><i style={{ width: `${Math.max(pct, 3)}%` }} /></div>
                        <div className="frac">{c.films} films · {c.pins} pins</div>
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8, fontStyle: "italic" }}>
                    Your densest territory is <b style={{ color: "var(--ink)", fontStyle: "normal" }}>{displayCountry(topCountry?.country)}</b> ({topCountry?.films ?? 0} films). Click a country for its pins, films and national lineages.
                  </div>
                </>
              ) : <div className="at-empty">No per-country data yet.</div>}
            </div>
          </div>

          {/* ═══ GEOGRAPHIC BLIND SPOTS ═══ */}
          <div className="mod" id="at-blind">
            <div className="modh"><h3><i className="ti ti-eye-off" style={{ color: "var(--blind)" }} /> Blind continents · zero seen films</h3>
              <span className="meta">continent mapping = country_continents reference table</span></div>
            <div className="modbody">
              {blindConts.length ? (
                <div className="at-blindwrap">
                  {blindConts.map((cont) => (
                    <div key={cont} className="at-blindchip" onClick={() => openBlind(cont)} title={`${CONT_LABEL[cont]} — no seen film touches it`}>
                      <div className="bc-c"><i className={`ti ${CONT_ICON[cont]}`} />{CONT_LABEL[cont]}</div>
                      <div className="bc-d">No seen film is set here or was shot here — a blank on your map.</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="at-empty" style={{ padding: "14px" }}>No blind continents — all six are already on your map.</div>
              )}
              {seenConts.length ? (
                <div className="at-seenwrap">
                  {seenConts.map((c) => (
                    <span key={c.cont} className="at-seenchip"><i className="ti ti-check" />{CONT_LABEL[c.cont]} <b>{c.films}</b></span>
                  ))}
                </div>
              ) : null}
              <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 9, fontStyle: "italic" }}>
                Blind = no seen film is set in or was shot on that continent. Click one for the best unseen
                films from that territory and its full country list — every country there is a door.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
