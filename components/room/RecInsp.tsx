"use client";
/** v2 공용 인스펙터 — 연계 3원칙의 "같은 인스펙터": 어디서 클릭해도 이 3카드가 열린다.
 *  카드 계약(3개 고정): ① 왜 이 영화(칩 + 자연어 1줄 — 설명가능성 불변식)
 *                      ② Cinecodex 카드(우리/외부/정전 분리 표기 — never-blend 정본 위치)
 *                      ③ 바로 하기(담기·봤어요·관심없음 + 반별점 = 평점⟹봤어요). */
import { useEffect, useState } from "react";
import CinecodexCard from "./CinecodexCard";
import Stars from "./Stars";

const IMG = "https://image.tmdb.org/t/p/w92";

const REASONS: Record<string, { cls: string; label: string; mid: string; last: string }> = {
  safe: { cls: "safe", label: "안전자산", mid: "실망 위험이 낮고", last: "실망 위험이 낮은" },
  reading: { cls: "reading", label: "취향 적중", mid: "당신의 취향에 가깝고", last: "당신의 취향에 가까운" },
  canon: { cls: "canon", label: "정전 위상", mid: "영화사적 위상이 높고", last: "영화사적 위상이 높은" },
  gap: { cls: "gap", label: "공백 충족", mid: "안 밟은 계보를 열고", last: "아직 안 밟은 계보를 여는" },
  frontier: { cls: "frontier", label: "안전한 모험", mid: "낯설지만 하방이 받쳐져 있고", last: "낯설지만 하방이 받쳐진" },
  conquer: { cls: "conquer", label: "도장깨기", mid: "계보 완파를 진척시키고", last: "계보 완파를 진척시키는" },
};

export type RecFilm = {
  slug: string; title: string;
  year?: number | null; director?: string | null; poster_path?: string | null;
  reasons?: string[] | null;
  v?: number | null; c?: number | null; r?: number | null; u?: number | null;
  prestige?: number | null; discovery?: number | null; conf?: number | null; tier?: string | null;
  rating?: number | null; kept?: boolean;
};

export default function RecInsp({ f, onKeep, onSeen, onDismiss, onRate }: {
  f: RecFilm;
  onKeep?: (f: RecFilm) => void;
  onSeen?: (f: RecFilm) => void;
  onDismiss?: (f: RecFilm) => void;
  onRate?: (f: RecFilm, v: number) => void;
}) {
  const [localRating, setLocalRating] = useState<number | null>(null);
  const [localKept, setLocalKept] = useState(false);
  // 키 없이 연속 select되면 React가 같은 인스턴스를 재사용 — 영화가 바뀌면 로컬 상태 초기화
  useEffect(() => { setLocalRating(null); setLocalKept(false); }, [f.slug]);
  const chips = (f.reasons ?? []).map((c) => REASONS[c]).filter(Boolean);
  const why = chips.length
    ? [...chips.slice(0, -1).map((c) => c.mid), chips[chips.length - 1].last].join(", ") + " 작품입니다."
    : "이 후보의 추천 이유 데이터가 아직 없습니다 — 아래 펀더멘털을 직접 확인하세요.";

  return (
    <div>
      <div className="selhead">
        <span className="po" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}} />
        <div>
          <div className="seltitle ser">{f.title}</div>
          <div className="selsub">{f.year ?? "?"}{f.director ? ` · ${f.director}` : ""}</div>
        </div>
      </div>

      <div className="icard"><h4><i className="ti ti-bulb" /> 왜 이 영화</h4>
        {chips.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            {chips.map((c, i) => <span key={i} className={`rsn ${c.cls}`}>{c.label}</span>)}
          </div>
        ) : null}
        <div style={{ fontSize: 12.5, fontFamily: "var(--ser)", lineHeight: 1.6, color: "var(--ink)" }}>{why}</div>
      </div>

      <CinecodexCard d={{
        v: f.v ?? null, c: f.c ?? null, r: f.r ?? null, u: f.u,
        prestige: f.prestige, discovery: f.discovery, conf: f.conf, tier: f.tier,
      }} slug={f.slug} />

      <div className="icard"><h4><i className="ti ti-player-play" /> 바로 하기</h4>
        <div className="actbar" style={{ marginBottom: onRate ? 10 : 0 }}>
          {onKeep ? <span className="actbtn pri" onClick={() => { setLocalKept(true); onKeep(f); }}>{(f.kept || localKept) ? "✓ 담김" : "담기"}</span> : null}
          {onSeen ? <span className="actbtn" onClick={() => onSeen(f)}>봤어요</span> : null}
          {onDismiss ? <span className="actbtn" onClick={() => onDismiss(f)}>관심없음</span> : null}
        </div>
        {onRate ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Stars value={localRating ?? f.rating ?? 0} onPick={(v) => { setLocalRating(v); onRate(f, v); }} />
            <span style={{ fontSize: 10.5, color: "var(--sub)" }}>0.5–5 · 평점 ⟹ 봤어요</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
