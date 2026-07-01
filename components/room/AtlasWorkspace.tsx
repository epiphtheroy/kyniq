"use client";
/** 지리 Atlas 포트폴리오 (The Room · /room/atlas).
 *  A personal world map of where the user's WATCHED films take place / were filmed,
 *  + geographic coverage (국가별) + geographic blind spots (④ = continents with 0 seen films).
 *  REAL data via one RPC:
 *    - me_geo_coverage → { points[], by_country[], totals } (auth.uid()-scoped, seen films only)
 *  Map is HAND-ROLLED inline SVG (equirectangular) — no maplibre — mirroring the SVG pattern
 *  in AnalysisWorkspace (ScatterSVG) / CommandCenterWorkspace (constellation). Every dot →
 *  inspector-swap with that film (CinecodexCard slug → film content hub). PostgREST numerics
 *  (incl. lat/lng) arrive as strings → coerced with num() before any math. */
import { useMemo, useEffect, type ReactNode } from "react";
import { useInspector } from "./InspectorContext";
import CinecodexCard from "./CinecodexCard";

/* ── typed RPC shapes (numerics may arrive as strings from PostgREST) ── */
export type GeoPoint = {
  slug: string; title: string;
  lat: number | string | null; lng: number | string | null;
  country: string | null; name: string | null; narrative_setting: string | null;
  layer: string | null; kind: string | null;
};
export type CountryRow = { country: string; films: number | string | null; pins: number | string | null };
export type GeoTotals = {
  located_films: number | string | null; total_watched: number | string | null;
  countries: number | string | null; total_pins: number | string | null;
} | null;
export type GeoData = { points: GeoPoint[]; by_country: CountryRow[]; totals: GeoTotals };

const num = (x: number | string | null | undefined): number | null =>
  x == null ? null : typeof x === "number" ? x : Number.isNaN(Number(x)) ? null : Number(x);
const n0 = (x: number | string | null | undefined) => num(x) ?? 0;

/* ── country → continent map (compact; covers every country that can appear in film_locations).
   6 continents (Asia · Europe · Africa · N.America · S.America · Oceania). Antarctica folded
   into a 7th "특수/기타" bucket so it never counts as a blind continent by itself. ── */
const CONTINENTS = ["Asia", "Europe", "Africa", "N.America", "S.America", "Oceania"] as const;
type Continent = (typeof CONTINENTS)[number] | "기타";
const CONT_KO: Record<Continent, string> = {
  Asia: "아시아", Europe: "유럽", Africa: "아프리카",
  "N.America": "북아메리카", "S.America": "남아메리카", Oceania: "오세아니아", 기타: "기타 · 극지",
};
const CONT_ICON: Record<Continent, string> = {
  Asia: "ti-building-pagoda", Europe: "ti-building-castle", Africa: "ti-tree",
  "N.America": "ti-building-skyscraper", "S.America": "ti-mountain", Oceania: "ti-beach", 기타: "ti-snowflake",
};
const COUNTRY_CONT: Record<string, Continent> = {
  // Asia
  "Afghanistan": "Asia", "Armenia": "Asia", "Cambodia": "Asia", "China": "Asia", "Georgia": "Asia",
  "Hong Kong": "Asia", "India": "Asia", "Indonesia": "Asia", "Iran": "Asia", "Iraq": "Asia",
  "Israel": "Asia", "Japan": "Asia", "Jordan": "Asia", "Korea": "Asia", "Kuwait": "Asia",
  "Laos": "Asia", "Lebanon": "Asia", "Macau": "Asia", "Malaysia": "Asia", "Maldives": "Asia",
  "Myanmar": "Asia", "Nepal": "Asia", "Oman": "Asia", "Pakistan": "Asia", "Palestine": "Asia",
  "Palestinian Territory": "Asia", "Philippines": "Asia", "Saudi Arabia": "Asia", "Singapore": "Asia",
  "South Korea": "Asia", "Southeast Asia": "Asia", "Sri Lanka": "Asia", "Syria": "Asia",
  "Taiwan": "Asia", "Thailand": "Asia", "Turkey": "Asia", "Türkiye": "Asia",
  "United Arab Emirates": "Asia", "Vietnam": "Asia",
  // Europe
  "Albania": "Europe", "Austria": "Europe", "Belarus": "Europe", "Belgium": "Europe",
  "Bosnia and Herzegovina": "Europe", "Bulgaria": "Europe", "Croatia": "Europe", "Czech Republic": "Europe",
  "Denmark": "Europe", "Estonia": "Europe", "Finland": "Europe", "France": "Europe", "Germany": "Europe",
  "Greece": "Europe", "Hungary": "Europe", "Iceland": "Europe", "Ireland": "Europe", "Italy": "Europe",
  "Latvia": "Europe", "Malta": "Europe", "Monaco": "Europe", "Montenegro": "Europe", "Netherlands": "Europe",
  "Norway": "Europe", "Poland": "Europe", "Portugal": "Europe", "Romania": "Europe", "Russia": "Europe",
  "Serbia": "Europe", "Slovakia": "Europe", "Spain": "Europe", "Sweden": "Europe", "Switzerland": "Europe",
  "Ukraine": "Europe", "United Kingdom": "Europe", "Vatican City": "Europe",
  // Africa
  "Algeria": "Africa", "Benin": "Africa", "Burkina Faso": "Africa", "Cameroon": "Africa",
  "Cape Verde": "Africa", "Democratic Republic of the Congo": "Africa", "Djibouti": "Africa",
  "Egypt": "Africa", "Ghana": "Africa", "Guinea-Bissau": "Africa", "Kenya": "Africa", "Mali": "Africa",
  "Mauritania": "Africa", "Morocco": "Africa", "Namibia": "Africa", "Senegal": "Africa",
  "South Africa": "Africa", "Tunisia": "Africa", "Zambia": "Africa",
  // North & Central America + Caribbean
  "Bahamas": "N.America", "Canada": "N.America", "Central America": "N.America", "Cuba": "N.America",
  "Dominican Republic": "N.America", "Guatemala": "N.America", "Jamaica": "N.America", "Mexico": "N.America",
  "Panama": "N.America", "Saint Vincent and the Grenadines": "N.America", "United States": "N.America",
  // South America
  "Argentina": "S.America", "Brazil": "S.America", "Chile": "S.America", "Colombia": "S.America",
  "Peru": "S.America", "Venezuela": "S.America",
  // Oceania
  "Australia": "Oceania", "Cook Islands": "Oceania", "Fiji": "Oceania", "New Zealand": "Oceania",
  "Solomon Islands": "Oceania",
  // Other / polar
  "Antarctica": "기타",
};
function contOf(country: string | null): Continent | null {
  if (!country) return null;
  return COUNTRY_CONT[country] ?? null;
}

/* Regional-indicator flag emoji from a small country→ISO2 map (best-effort; falls back to a pin). */
const ISO2: Record<string, string> = {
  "United States": "US", "China": "CN", "Japan": "JP", "Italy": "IT", "Canada": "CA",
  "Iceland": "IS", "Namibia": "NA", "Hungary": "HU", "South Korea": "KR", "Korea": "KR",
  "United Kingdom": "GB", "Spain": "ES", "Thailand": "TH", "Hong Kong": "HK", "Cambodia": "KH",
  "France": "FR", "Germany": "DE", "India": "IN", "Australia": "AU", "New Zealand": "NZ",
  "Brazil": "BR", "Mexico": "MX", "Russia": "RU", "Morocco": "MA", "Egypt": "EG",
  "Taiwan": "TW", "Vietnam": "VN", "Macau": "MO", "Ireland": "IE", "Norway": "NO",
  "Sweden": "SE", "Denmark": "DK", "Netherlands": "NL", "Switzerland": "CH", "Austria": "AT",
  "Greece": "GR", "Portugal": "PT", "Turkey": "TR", "Türkiye": "TR", "Poland": "PL",
  "South Africa": "ZA", "Kenya": "KE", "Argentina": "AR", "Chile": "CL", "Peru": "PE",
};
function flagOf(country: string): string {
  const iso = ISO2[country];
  if (!iso) return "";
  return iso.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

/* ── equirectangular projection into an SVG viewBox (W×H). x=(lng+180)/360·W · y=(90-lat)/180·H ── */
const MAP_W = 760, MAP_H = 380;
const projX = (lng: number) => ((lng + 180) / 360) * MAP_W;
const projY = (lat: number) => ((90 - lat) / 180) * MAP_H;

/* ── derived point (numeric-coerced) ── */
type Pt = {
  slug: string; title: string; lat: number; lng: number;
  country: string | null; name: string | null; narrative_setting: string | null;
  layer: "filmed" | "setting"; kind: string | null; x: number; y: number;
};

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
          <div className="selsub">{p.country ?? "미상"}{p.kind ? ` · ${p.kind}` : ""} · {filmed ? "촬영지 (filmed)" : "무대 (setting)"}</div>
        </div>
      </div>
      <div className="icard"><h4><i className="ti ti-map-pin" /> 이 지점</h4>
        <div className="seltitle ser" style={{ fontSize: 15 }}>{p.name ?? "—"}</div>
        {p.narrative_setting ? (
          <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.5, marginTop: 6 }}>{p.narrative_setting}</div>
        ) : null}
        <div className="kv" style={{ marginTop: 8 }}><span>국가</span><b>{p.country ?? "미상"}</b></div>
        <div className="kv"><span>좌표 (lat, lng)</span><b>{p.lat.toFixed(2)}, {p.lng.toFixed(2)}</b></div>
        <div className="kv"><span>레이어</span><b style={{ color: filmed ? "var(--safe)" : "var(--frontier)" }}>{filmed ? "촬영지" : "무대"}</b></div>
      </div>
      <CinecodexCard d={{ v: null, c: null, r: null }} slug={p.slug} />
    </div>
  );
}

/** A country row → its pins + films count. */
function CountryInsp({ c, cont, pts }: { c: { country: string; films: number; pins: number }; cont: Continent | null; pts: Pt[] }) {
  const mine = pts.filter((p) => p.country === c.country);
  const filmedN = mine.filter((p) => p.layer === "filmed").length;
  const settingN = mine.length - filmedN;
  const flag = flagOf(c.country);
  return (
    <div>
      <div className="icard"><h4><i className="ti ti-flag" /> 국가별 커버리지</h4>
        <div className="seltitle ser" style={{ fontSize: 18 }}>{flag ? `${flag} ` : ""}{c.country}</div>
        <div className="selsub">{cont ? CONT_KO[cont] : "대륙 미상"}</div>
        <div className="bigscore" style={{ marginTop: 10, color: "var(--frontier)" }}>{c.films}<span style={{ fontSize: 12, color: "var(--sub)", marginLeft: 8 }}>편 · {c.pins} 지점</span></div>
        <div className="kv" style={{ marginTop: 8 }}><span>촬영지 (filmed)</span><b style={{ color: "var(--safe)" }}>{filmedN}</b></div>
        <div className="kv"><span>무대 (setting)</span><b style={{ color: "var(--frontier)" }}>{settingN}</b></div>
      </div>
      <div className="icard"><h4><i className="ti ti-movie" /> 이 나라를 무대로 본 영화</h4>
        {mine.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...new Map(mine.map((p) => [p.slug, p])).values()].map((p) => (
              <a key={p.slug} href={`/room/film/${p.slug}`} className="fh-loc" style={{ textDecoration: "none" }}>
                <span className={`fh-locdot ${p.layer}`} />
                <span className="fh-locn">{p.title}</span>
              </a>
            ))}
          </div>
        ) : <div className="fh-dim">지점 없음</div>}
      </div>
    </div>
  );
}

/** A blind continent (④) → honest "아직 한 편도 안 본". */
function BlindInsp({ cont }: { cont: Continent }) {
  return (
    <div>
      <div className="icard"><h4><i className="ti ti-eye-off" style={{ color: "var(--blind)" }} /> 지리적 블라인드 · ④</h4>
        <div className="seltitle ser" style={{ fontSize: 18, color: "var(--at-blindtx, #edc873)" }}>
          <i className={`ti ${CONT_ICON[cont]}`} style={{ marginRight: 7 }} />{CONT_KO[cont]}
        </div>
        <div className="selsub">아직 한 편도 안 본 대륙</div>
        <div className="bigscore" style={{ marginTop: 10, color: "var(--at-blindtx, #edc873)" }}>0<span style={{ fontSize: 12, color: "var(--sub)", marginLeft: 8 }}>편 · 미개척</span></div>
      </div>
      <div className="icard"><h4><i className="ti ti-target" /> 왜 이 대륙인가</h4>
        <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.55 }}>
          당신이 본 영화의 무대·촬영지 어디에도 <b style={{ color: "var(--at-blindtx, #edc873)" }}>{CONT_KO[cont]}</b>가 등장하지 않았습니다 — 지도 위 완전한 공백(④). 이 대륙을 배경으로 한 첫 한 편이 지리 커버리지를 가장 크게 넓힙니다.
        </div>
      </div>
    </div>
  );
}

/* ═══════════ main ═══════════ */
export default function AtlasWorkspace({ data }: { data: GeoData }) {
  const insp = useInspector();
  const { setDefault } = insp;

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
    (data.by_country ?? []).map((c) => ({ country: c.country, films: n0(c.films), pins: n0(c.pins) })),
    [data.by_country]);

  const t = data.totals;
  const locatedFilms = n0(t?.located_films);
  const totalWatched = n0(t?.total_watched);
  const countryCount = n0(t?.countries);
  const totalPins = n0(t?.total_pins);

  const filmedN = useMemo(() => pts.filter((p) => p.layer === "filmed").length, [pts]);
  const settingN = pts.length - filmedN;

  /* 지리 커버리지 % — countries seen vs a reference of ~50 major film nations (honest denominator). */
  const REF_NATIONS = 50;
  const coveragePct = Math.round((countryCount / REF_NATIONS) * 100);

  /* ── continents: seen counts + blind (④) ── */
  const contFilms = useMemo(() => {
    const m = new Map<Continent, Set<string>>();
    for (const p of pts) {
      const cont = contOf(p.country);
      if (!cont) continue;
      if (!m.has(cont)) m.set(cont, new Set());
      m.get(cont)!.add(p.slug);
    }
    return m;
  }, [pts]);

  const contStats = useMemo(() =>
    CONTINENTS.map((cont) => ({ cont, films: contFilms.get(cont)?.size ?? 0 })), [contFilms]);
  const seenConts = useMemo(() => contStats.filter((c) => c.films > 0), [contStats]);
  const blindConts = useMemo(() => contStats.filter((c) => c.films === 0).map((c) => c.cont), [contStats]);
  const maxContFilms = Math.max(1, ...contStats.map((c) => c.films));

  /* graticule lines every 30° */
  const lngLines = useMemo(() => { const a: number[] = []; for (let l = -150; l <= 150; l += 30) a.push(l); return a; }, []);
  const latLines = useMemo(() => { const a: number[] = []; for (let l = -60; l <= 60; l += 30) a.push(l); return a; }, []);

  /* size dots by how many pins share that country (bigger = more) */
  const countryPinCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pts) { const k = p.country ?? "미상"; m.set(k, (m.get(k) ?? 0) + 1); }
    return m;
  }, [pts]);

  const topCountry = countries[0] ?? null;
  const maxCountryFilms = Math.max(1, ...countries.map((c) => c.films));

  /* inspector openers */
  const openPoint = (p: Pt) => insp.select(<PointInsp p={p} />, `${p.title} · 지점`);
  const openCountry = (c: { country: string; films: number; pins: number }) =>
    insp.select(<CountryInsp c={c} cont={contOf(c.country)} pts={pts} />, `${c.country} · 커버리지`);
  const openBlind = (cont: Continent) => insp.select(<BlindInsp cont={cont} />, `${CONT_KO[cont]} · 블라인드 ④`);

  /* ── default inspector = atlas summary (mirrors Analysis/CommandCenter setDefault) ── */
  useEffect(() => {
    setDefault(
      <div>
        <div className="icard"><h4><i className="ti ti-world" /> 지리 Atlas 요약</h4>
          <div className="kv"><span>지도에 오른 영화</span><b>{locatedFilms}</b></div>
          <div className="kv"><span>관람 자산</span><b>{totalWatched}</b></div>
          <div className="kv"><span>국가</span><b>{countryCount}</b></div>
          <div className="kv"><span>총 지점 (pins)</span><b>{totalPins}</b></div>
          <div className="kv"><span>촬영지 · 무대</span><b>{filmedN} · {settingN}</b></div>
        </div>
        <div className="icard"><h4><i className="ti ti-eye-off" /> 지리적 블라인드 · ④</h4>
          <div className="kv"><span>본 대륙</span><b style={{ color: "var(--safe)" }}>{seenConts.length} / 6</b></div>
          <div className="kv"><span><span className="gloss" title="블라인드 = 본 영화 어디에도 등장하지 않은 대륙. 지도 위 완전한 공백.">블라인드</span> 대륙</span><b style={{ color: "var(--blind)" }}>{blindConts.length}</b></div>
          {blindConts.length ? (
            <div style={{ fontSize: 11, color: "var(--at-blindtx, #edc873)", marginTop: 6, lineHeight: 1.5 }}>
              아직 한 편도 안 본: {blindConts.map((c) => CONT_KO[c]).join(" · ")}
            </div>
          ) : <div style={{ fontSize: 11, color: "var(--safe)", marginTop: 6 }}>6개 대륙 모두 밟았습니다.</div>}
        </div>
        <div className="at-empty" style={{ textAlign: "left", padding: "0 2px" }}>지도의 지점 · 국가 · 블라인드 대륙을 클릭하면 여기에 상세가 열립니다.</div>
      </div>
    );
  }, [data, locatedFilms, totalWatched, countryCount, totalPins, filmedN, settingN, seenConts.length, blindConts, setDefault]);

  const empty = pts.length === 0;

  return (
    <div className="mainpad">
      <h1 className="secttl">지리 Atlas · 포트폴리오</h1>
      <p className="secsub">
        내가 <b style={{ fontStyle: "normal", color: "var(--mut)" }}>본 영화</b>들이 벌어지는 · 찍힌 곳을 세계 지도에 얹은 개인 지도 — <span className="gloss" title="filmed = 실제 촬영지 · setting = 서사의 무대">촬영지·무대</span>의 지리적 커버리지와, 아직 한 편도 안 본 <span className="gloss" title="블라인드 = 본 영화 어디에도 등장하지 않은 대륙 (④ 공백)">지리적 블라인드(④)</span>를 정직하게 표시합니다. 모든 점은 실측 좌표입니다.
      </p>

      {empty ? (
        <div className="mod"><div className="modbody">
          <div className="at-empty">
            아직 지도에 올릴 위치 데이터가 있는 관람작이 없습니다.<br />
            촬영지·무대 좌표가 붙은 영화를 관람하면 여기 세계 지도에 점으로 떠오릅니다.
          </div>
        </div></div>
      ) : (
        <>
          {/* ═══ HERO · 지리 커버리지 ═══ */}
          <div className="at-hero">
            <div className="at-navbig">
              <div className="at-ring">
                <svg width="92" height="92" viewBox="0 0 92 92">
                  <circle cx="46" cy="46" r="38" fill="none" stroke="#24242a" strokeWidth="7" />
                  {(() => { const C = 2 * Math.PI * 38; const frac = Math.min(1, countryCount / REF_NATIONS); return (
                    <circle cx="46" cy="46" r="38" fill="none" stroke="var(--frontier)" strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={C.toFixed(1)} strokeDashoffset={(C * (1 - frac)).toFixed(1)} transform="rotate(-90 46 46)" />
                  ); })()}
                  <text x="46" y="43" textAnchor="middle" fontSize="16" fill="#ECEAE5" fontFamily="ui-monospace,monospace" fontWeight="600">{countryCount}</text>
                  <text x="46" y="57" textAnchor="middle" fontSize="8" fill="#6C6960" letterSpacing="1">개국</text>
                </svg>
              </div>
              <div className="at-navmeta">
                <div className="eb">지리 커버리지 · Geographic Reach</div>
                <div className="at-lvl">● {seenConts.length}/6 대륙 · {countryCount}개국</div>
                <div className="at-pctl">지도 위 <b>{locatedFilms}</b>편 · <b>{totalPins}</b> 지점 · 참조 {REF_NATIONS}개국 대비 <b>{coveragePct}%</b></div>
              </div>
            </div>
            <div className="at-components">
              {contStats.map((c) => {
                const isBlind = c.films === 0;
                const pct = Math.round((c.films / maxContFilms) * 100);
                return (
                  <div className={`at-comp${isBlind ? " blind" : ""}`} key={c.cont}>
                    <span className="cl" title={CONT_KO[c.cont]}>{CONT_KO[c.cont]}</span>
                    <div className="ct"><i style={{ width: isBlind ? "3%" : `${pct}%`, background: isBlind ? "var(--blind)" : "var(--frontier)" }} /></div>
                    <span className="cv">{isBlind ? "블라인드" : `${c.films}편`}</span>
                  </div>
                );
              })}
            </div>
            <div className="at-sig-prose">
              {topCountry ? (
                <>당신의 영화가 가장 많이 벌어지는 무대는 <span className="em">{topCountry.country}</span>({topCountry.films}편). 6개 대륙 중 <b>{seenConts.length}개</b>를 밟았고, {blindConts.length ? <>아직 <b style={{ color: "var(--at-blindtx, #edc873)" }}>{blindConts.map((c) => CONT_KO[c]).join(" · ")}</b>는 지도 위 공백입니다.</> : <>6개 대륙 모두 지도에 올랐습니다.</>}</>
              ) : <>지도에 오른 국가가 아직 없습니다.</>}
            </div>
            <div className="at-foot"><i className="ti ti-map-pin" style={{ color: "var(--frontier)" }} /> 점 = <b>film_locations</b>(lat/lng 실측) ∼ 내 관람작(seen). <b style={{ color: "var(--at-filmed, #0F6E56)" }}>촬영지</b>(filmed)·<b style={{ color: "var(--frontier)" }}>무대</b>(setting)를 색으로 구분. 대륙 매핑은 등장 국가 기준.</div>
          </div>

          {/* ═══ KPI STRIP ═══ */}
          <div className="at-kpis">
            <div className="at-kpi"><div className="eb">지도 위 영화</div><div className="v">{locatedFilms}<small>/{totalWatched}</small></div><div className="d">좌표 있는 관람작</div></div>
            <div className="at-kpi"><div className="eb">국가</div><div className="v">{countryCount}</div><div className="d">서로 다른 나라</div></div>
            <div className="at-kpi"><div className="eb">총 지점</div><div className="v">{totalPins}</div><div className="d">촬영지 {filmedN} · 무대 {settingN}</div></div>
            <div className={`at-kpi${blindConts.length ? " blindkpi" : ""}`}><div className="eb">블라인드 대륙 ④</div><div className="v">{blindConts.length}<small>/6</small></div><div className="d">아직 안 간 땅</div></div>
          </div>

          {/* ═══ 세계 지도 (hand-rolled equirectangular SVG) ═══ */}
          <div className="mod" id="at-map">
            <div className="modh"><h3><i className="ti ti-world" /> 세계 지도 · 내 영화의 무대·촬영지 <span style={{ color: "var(--faint)", fontWeight: 400 }}>지리 자산</span></h3>
              <span className="meta">equirectangular · 점 클릭=영화</span></div>
            <div className="modbody">
              <div className="at-mapwrap">
                <div className="at-plane">
                  <svg className="at-map" viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label="내 관람작의 촬영지·무대 세계 지도">
                    {/* ocean */}
                    <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="#0d0d10" />
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
                    {/* dots */}
                    {pts.map((p, i) => {
                      const cnt = countryPinCount.get(p.country ?? "미상") ?? 1;
                      const rr = 3.2 + Math.min(3, Math.log2(cnt + 1));
                      const fill = p.layer === "filmed" ? "#0F6E56" : "var(--frontier)";
                      return (
                        <g key={`${p.slug}-${i}`} className="at-dot" onClick={() => openPoint(p)}>
                          <title>{p.title} · {p.name ?? p.country ?? ""}</title>
                          <circle className="hit" cx={p.x} cy={p.y} r={11} fill="transparent" />
                          <circle cx={p.x} cy={p.y} r={rr} fill={fill} fillOpacity={0.82} stroke="#0a0a0b" strokeWidth={0.8} />
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div className="at-side">
                  <div className="at-lead2"><i className="ti ti-info-circle" /><div>각 점은 내가 본 영화의 <b>실측 좌표</b>. <b>촬영지</b>는 실제로 찍은 곳, <b>무대</b>는 서사가 벌어지는 곳. 점을 누르면 그 영화가 인스펙터에 열립니다.</div></div>
                  <div className="at-grp">지도 통계</div>
                  <div className="at-stat"><span className="k">지도 위 영화</span><span className="v">{locatedFilms}</span></div>
                  <div className="at-stat"><span className="k">총 지점</span><span className="v">{totalPins}</span></div>
                  <div className="at-stat"><span className="k">촬영지 (filmed)</span><span className="v">{filmedN}</span></div>
                  <div className="at-stat"><span className="k">무대 (setting)</span><span className="v">{settingN}</span></div>
                  <div className="at-stat"><span className="k">국가</span><span className="v">{countryCount}</span></div>
                  <div className="at-legend">
                    <div className="lg"><i className="filmed" />촬영지 (filmed)</div>
                    <div className="lg"><i className="setting" />무대 (setting)</div>
                    <div className="lg" style={{ color: "var(--sub)" }}>점 크기 = 그 나라의 지점 수</div>
                  </div>
                  <div className="at-note">점 = 실측 (lat, lng) · 등거리 원통도법. 클릭 → 영화 · Cinecodex.</div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ 국가별 커버리지 ═══ */}
          <div className="mod" id="at-country">
            <div className="modh"><h3><i className="ti ti-flag" /> 국가별 커버리지 · 제일 많이 본 무대 <span style={{ color: "var(--faint)", fontWeight: 400 }}>지리 분포</span></h3>
              <span className="meta">film 수 내림차순 · 행 클릭=상세</span></div>
            <div className="modbody">
              {countries.length ? (
                <>
                  {countries.map((c, i) => {
                    const pct = Math.round((c.films / maxCountryFilms) * 100);
                    const flag = flagOf(c.country);
                    return (
                      <div key={c.country} className={`at-cov${i === 0 ? " top" : ""}`} onClick={() => openCountry(c)} title={`${c.country} — ${c.films}편 · ${c.pins} 지점`}>
                        <div className="cn">{flag ? <span className="flag">{flag}</span> : <i className="ti ti-map-pin" style={{ fontSize: 12, color: "var(--sub)" }} />}{c.country}</div>
                        <div className="track"><i style={{ width: `${Math.max(pct, 3)}%` }} /></div>
                        <div className="frac">{c.films}편 · {c.pins}📍</div>
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8, fontStyle: "italic" }}>
                    가장 두꺼운 무대는 <b style={{ color: "var(--ink)", fontStyle: "normal" }}>{topCountry?.country ?? "—"}</b>({topCountry?.films ?? 0}편). 국가를 클릭하면 그 나라의 촬영지·무대와 영화 목록이 열립니다.
                  </div>
                </>
              ) : <div className="at-empty">국가별 데이터가 아직 없습니다.</div>}
            </div>
          </div>

          {/* ═══ 지리적 블라인드 (④) ═══ */}
          <div className="mod" id="at-blind">
            <div className="modh"><h3><i className="ti ti-eye-off" style={{ color: "var(--blind)" }} /> 지리적 블라인드 · 아직 한 편도 안 본 대륙 <span style={{ color: "var(--faint)", fontWeight: 400 }}>④</span></h3>
              <span className="meta">seen 0 · 대륙 매핑 = 등장 국가 기준</span></div>
            <div className="modbody">
              {blindConts.length ? (
                <div className="at-blindwrap">
                  {blindConts.map((cont) => (
                    <div key={cont} className="at-blindchip" onClick={() => openBlind(cont)} title={`${CONT_KO[cont]} — 아직 한 편도 안 봄`}>
                      <div className="bc-c"><i className={`ti ${CONT_ICON[cont]}`} />{CONT_KO[cont]}</div>
                      <div className="bc-d">아직 한 편도 안 본 대륙 · 지도 위 공백</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="at-empty" style={{ padding: "14px" }}>블라인드 대륙이 없습니다 — 6개 대륙 모두 이미 지도에 올랐습니다.</div>
              )}
              {seenConts.length ? (
                <div className="at-seenwrap">
                  {seenConts.map((c) => (
                    <span key={c.cont} className="at-seenchip"><i className="ti ti-check" />{CONT_KO[c.cont]} <b>{c.films}</b></span>
                  ))}
                </div>
              ) : null}
              <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 9, fontStyle: "italic" }}>
                블라인드 = 본 영화의 무대·촬영지 어디에도 등장하지 않은 대륙(<b style={{ color: "var(--at-blindtx, #edc873)", fontStyle: "normal" }}>④ 공백</b>). 그 대륙을 배경으로 한 첫 한 편이 지리 커버리지를 가장 크게 넓힙니다.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
