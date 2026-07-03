"use client";
/** v2 공용 필름 행 — 연계 3원칙의 "같은 행": 홈·워치리스트가 같은 판단 단위를 공유.
 *  숫자 예산: 행당 1개(적합도). 가용 dot은 on일 때만(미확인 노이즈 제거). 칩은 1개만.
 *  키보드 접근: 행·액션 모두 포커스 가능(Enter/Space). */
import type { KeyboardEvent } from "react";

const IMG = "https://image.tmdb.org/t/p/w92";

export type FilmRowData = {
  slug: string; title: string;
  year?: number | null; director?: string | null; poster_path?: string | null;
  chip?: { cls: string; label: string } | null;          // 이유 칩 1개 (없으면 미표시 — 지어내지 않음)
  fit?: number | null;                                    // 적합도 (WWI)
  avail?: { state: string; provider?: string } | null;    // on일 때만 렌더
  risk?: number | null;                                   // R≥26일 때만 "실망 위험" 배지 (--risk ≠ conquer)
  kept?: boolean;
};

const onKey = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); fn(); }
};

export default function FilmRow({ f, onOpen, onKeep, onSeen, onDismiss }: {
  f: FilmRowData;
  onOpen: () => void;
  onKeep?: () => void; onSeen?: () => void; onDismiss?: () => void;
}) {
  return (
    <div className="frow" onClick={onOpen} role="button" tabIndex={0} onKeyDown={onKey(onOpen)}>
      <span className="fpo" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}} />
      <div style={{ minWidth: 0 }}>
        <div className="ft">{f.title}<small>{f.year ?? ""}{f.director ? ` · ${f.director}` : ""}</small></div>
        <div className="fm">
          {f.avail?.state === "on" ? <><span className="avdot" />{f.avail.provider ?? "지금 가능"}</> : null}
          {f.chip ? <span className={`rsn ${f.chip.cls}`}>{f.chip.label}</span> : null}
          {f.risk != null && f.risk >= 26 ? <span className="rsn" style={{ color: "var(--risk)" }}>실망 위험 {Math.round(f.risk)}</span> : null}
          {f.kept ? <span className="rsn safe">담김</span> : null}
        </div>
      </div>
      {f.fit != null ? <div className="fit">{Math.round(f.fit)}<small>적합도</small></div> : <span />}
      <div className="fact" onClick={(e) => e.stopPropagation()}>
        {onKeep ? <span className={`fb${f.kept ? " done" : ""}`} title="담기" role="button" tabIndex={0} onClick={onKeep} onKeyDown={onKey(onKeep)}><i className="ti ti-bookmark-plus" /></span> : null}
        {onSeen ? <span className="fb" title="봤어요" role="button" tabIndex={0} onClick={onSeen} onKeyDown={onKey(onSeen)}><i className="ti ti-check" /></span> : null}
        {onDismiss ? <span className="fb" title="관심없음" role="button" tabIndex={0} onClick={onDismiss} onKeyDown={onKey(onDismiss)}><i className="ti ti-x" /></span> : null}
      </div>
    </div>
  );
}
