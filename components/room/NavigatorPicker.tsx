"use client";
/**
 * NavigatorPicker — the "Where to?" screen (P5). Lists the destinations the
 * viewer is mid-journey on: director conquests + canon/list lineages, each with
 * progress, linking into the drive (?dir= / ?lineage=). Assembled from the
 * me_auteur_conquest + me_coverage rows the room already computes.
 */
import Link from "next/link";

export type PickDest = {
  kind: "dir" | "lineage";
  key: string;
  label: string;
  facet?: string;
  seen: number;
  total: number;
  pct: number;
};

const FACET_KO: Record<string, string> = {
  canon: "정전", critics: "비평가 선정", festival: "영화제", award: "수상", national: "국가 정전", other: "목록",
};

function card(d: PickDest) {
  const href = d.kind === "dir"
    ? `/room/navigator?dir=${encodeURIComponent(d.key)}`
    : `/room/navigator?lineage=${encodeURIComponent(d.key)}&label=${encodeURIComponent(d.label)}`;
  const sub = d.kind === "dir" ? "감독 정복" : (FACET_KO[d.facet ?? "other"] ?? d.facet ?? "목록");
  return (
    <Link key={`${d.kind}:${d.key}`} className="np-card" href={href}>
      <span className="np-ring" style={{ ["--p" as string]: `${Math.min(360, d.pct * 3.6)}deg` }}><span>{d.pct}%</span></span>
      <span className="np-l">
        <span className="np-n">{d.label}</span>
        <span className="np-m">{sub} · {d.seen}/{d.total}편 · {d.total - d.seen}편 남음</span>
      </span>
      <span className="np-go">주행 →</span>
    </Link>
  );
}

export default function NavigatorPicker({ directors, canon }: { directors: PickDest[]; canon: PickDest[] }) {
  const empty = directors.length === 0 && canon.length === 0;
  return (
    <div className="navd np">
      <div className="np-head">
        <div className="np-k">The Navigator</div>
        <h1 className="np-h">어디로 갈까요?</h1>
        <p className="np-p">목적지를 정하면 볼 영화들이 경로가 되어, 다음 한 편을 안내합니다.</p>
      </div>
      <div className="np-body">
        {empty ? (
          <div className="np-emptycard">
            아직 진행 중인 여정이 없어요. 영화를 몇 편 <Link href="/room/ledger" className="np-lnk">기록</Link>하거나{" "}
            <Link href="/me/import" className="np-lnk">가져오면</Link> 정전·감독 목적지가 나타납니다.{" "}
            <Link href="/room/navigator?dir=stanley-kubrick" className="np-lnk">큐브릭으로 체험 →</Link>
          </div>
        ) : null}
        {directors.length ? (
          <>
            <div className="np-sect">감독 정복 — 이어가기 좋은</div>
            {directors.map(card)}
          </>
        ) : null}
        {canon.length ? (
          <>
            <div className="np-sect">정전 · 목록</div>
            {canon.map(card)}
          </>
        ) : null}
      </div>
    </div>
  );
}
