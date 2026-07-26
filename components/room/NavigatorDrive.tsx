"use client";
/**
 * NavigatorDrive — the web drive view (P3). Renders a real DriveLoad from
 * lib/navigator/load in the familiar Google-Maps driving shape: green turn card
 * (next film) · receding road with standing poster signposts · bottom sheet
 * (남은 소요시간 · 지나온 길 meter). The route preference is switched by a
 * plain link (?pref=), so the server re-sorts deterministically — no client math.
 */
import Link from "next/link";
import type { DriveLoad } from "@/lib/navigator/load";
import type { RoutePref, RouteStop } from "@/lib/navigator/route";
import { turnReason, fmtRuntimeK, fmtHM } from "@/lib/navigator/route";

const POSTER = "https://image.tmdb.org/t/p/w185";
const po = (p: string | null) => (p ? `${POSTER}${p}` : "");

/* preset signpost slots along the road: near (bottom, large) → far (top, small) */
const SLOTS = [
  { top: 74, left: 71, w: 88 },
  { top: 60, left: 29, w: 64 },
  { top: 49, left: 70, w: 50 },
  { top: 40, left: 28, w: 40 },
];

export default function NavigatorDrive({ load, pref }: { load: DriveLoad; pref: RoutePref }) {
  const { destination: dest, stats } = load;
  const route = load.routes[pref];
  const next = route.next;

  if (!next) {
    return (
      <div className="navd">
        <div className="arrived">
          <div style={{ fontSize: 34 }}>🏁</div>
          <div className="big">도착했습니다 — {dest.label}</div>
          <div style={{ color: "var(--sub)", fontSize: 13 }}>
            {stats.total}편 완주 · 총 {fmtRuntimeK(stats.runtimeTraveled)}
          </div>
          <Link href="/room/navigator" className="prefs" style={{ display: "inline-block", marginTop: 16 }}>다른 목적지 →</Link>
        </div>
      </div>
    );
  }

  const then = route.stops[1]?.film ?? null;
  const near = route.stops.slice(0, 4);
  const finalStop = route.stops[route.stops.length - 1];
  const destIsNear = near.some((s) => s.film.slug === finalStop.film.slug);
  const progressPct = stats.total ? Math.round((stats.seenCount / stats.total) * 100) : 0;
  const travMin = stats.runtimeTraveled ?? 0;
  const remMin = stats.runtimeRemaining ?? 0;
  const donePct = travMin + remMin > 0 ? Math.round((travMin / (travMin + remMin)) * 100) : 0;
  const laneRent = next.availability === "rent";

  const sp = (stop: RouteStop, slot: { top: number; left: number; w: number }, isNow: boolean) => (
    <div key={stop.film.slug} className={`sp${isNow ? " now" : ""}`} style={{ left: `${slot.left}%`, top: `${slot.top}%` }}>
      <img src={po(stop.film.poster_path)} alt="" style={{ width: slot.w, height: slot.w * 1.5 }} loading="lazy" />
      <span className="pole" /><span className="shadow" />
      {isNow ? <span className="cap">지금 · {stop.film.title}</span> : slot.w >= 60 ? <span className="cap">{stop.film.title}</span> : null}
    </div>
  );

  return (
    <div className="navd">
      {/* turn card — the next film */}
      <div className="turn">
        <div className="row">
          <div className="mnv"><div className="ar">↰</div><div className="k">다음</div></div>
          <span className="po" style={{ backgroundImage: `url(${po(next.poster_path)})` }} />
          <div className="tx">
            <div className="tt">{next.title}</div>
            <div className="mt">{next.year ?? "?"} · {next.runtime ? `${next.runtime}분` : "—"} · {turnReason(next, dest, stats)}</div>
            {next.availability !== "none" ? (
              <span className={`lane${laneRent ? " rent" : ""}`}><span className="d" />{laneRent ? "대여 가능" : "지금 재생 가능"}</span>
            ) : null}
          </div>
        </div>
        {then ? <div className="then"><span className="a">그다음 ↑</span> <b>{then.title}</b>{then.runtime ? ` · ${then.runtime}분` : ""}</div> : null}
      </div>

      {/* map */}
      <div className="map">
        <div className="haze" />
        <svg className="roadsvg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M-4,70 L104,63" stroke="#CDC4AC" strokeWidth="7" fill="none" vectorEffect="non-scaling-stroke" opacity=".9" />
          <path d="M-4,48 L104,44" stroke="#CFC6AE" strokeWidth="5" fill="none" vectorEffect="non-scaling-stroke" opacity=".8" />
          <path d="M30,101 L41,60 C43,50 45,44 49,40 L49.4,20 L50.6,20 L51,40 C55,44 57,50 59,60 L70,101 Z" fill="var(--road)" stroke="#C7BEA6" strokeWidth=".5" />
          <path d="M30,101 L37,80 L63,80 L70,101 Z" fill="#CFC6AD" opacity=".55" />
          <path d="M50,101 L50,60 C50,50 49.6,44 49.6,40 L50,20" fill="none" stroke="#fff" strokeWidth="9" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          <path d="M50,101 L50,60 C50,50 49.6,44 49.6,40 L50,20" fill="none" stroke="var(--blue)" strokeWidth="6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          <path d="M50,96 L50,60 C50,50 49.6,44 49.6,40 L50,24" fill="none" stroke="#ffffffbb" strokeWidth="1.2" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        </svg>

        <div className="street cur" style={{ left: "34%", top: "88%" }}>{dest.family === "director" ? `${dest.label} 필모길` : dest.label}</div>
        <div className="street" style={{ left: "20%", top: "68%" }}>느와르 계보 →</div>
        <div className="street" style={{ left: "80%", top: "44%" }}>형식주의 대로</div>

        {near.map((stop, i) => sp(stop, SLOTS[i], i === 0))}
        {!destIsNear ? (
          <div className="sp dest" style={{ left: "50%", top: "28%" }}>
            <span className="flag">🏁</span>
            <img src={po(finalStop.film.poster_path)} alt="" style={{ width: 30, height: 45 }} loading="lazy" />
            <span className="shadow" /><span className="cap">{finalStop.film.title}</span>
          </div>
        ) : null}

        <div className="me"><div className="chev" /><div className="dot" /><div className="back">↓ 지나온 {stats.seenCount}편</div></div>
      </div>

      {/* sheet */}
      <div className="sheet">
        <div className="grip" />
        <div className="headline">
          <span className="dur">{fmtRuntimeK(stats.runtimeRemaining)}</span>
          <span className="films">영화 {stats.remaining}편</span>
          <span className="soft">남은 소요시간{stats.etaWeeks ? ` · 내 페이스로 약 ${stats.etaWeeks}주` : ""}</span>
        </div>
        <div className="meter">
          <div className="track"><span className="done" style={{ width: `${donePct}%` }} /><span className="knob" style={{ left: `${donePct}%` }} /></div>
          <div className="ends">
            <span className="l"><span className="cap">지나온 길</span><b>{stats.seenCount}편 · {fmtHM(stats.runtimeTraveled)}</b></span>
            <span className="r"><span className="cap">남은 길</span><b>{stats.remaining}편 · {fmtHM(stats.runtimeRemaining)}</b></span>
          </div>
        </div>
        <div className="prefs">
          {(["fewest", "fastest", "no_tolls"] as RoutePref[]).map((p) => (
            <Link key={p} className={p === pref ? "on" : ""} href={`?pref=${p}`} scroll={false}>
              {p === "fewest" ? "최단" : p === "fastest" ? "최속" : `무료도로${route.tollCount && p === "no_tolls" ? "" : ""}`}
            </Link>
          ))}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--sub)", textAlign: "center", marginTop: 10 }}>
          진행률 {progressPct}% · {dest.label} · 위치는 내 기록에서 자동 계산됩니다
        </div>
      </div>
    </div>
  );
}
