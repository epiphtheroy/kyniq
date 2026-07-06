"use client";
/** 퀵 기록 바 — 검색→반별점 원스트로크(평점⟹봤어요). 홈 최상단 · 기록 페이지 공용.
 *  film_search(공개 RPC) 디바운스 → 히트 행에서 별을 누르는 순간 기록 끝. */
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Stars from "./Stars";

export type QuickHit = { slug: string; title: string; year: number | null; poster_path: string | null; director: string | null };
const IMG = "https://image.tmdb.org/t/p/w92";

export default function QuickRate({ onRate, placeholder }: {
  onRate: (f: QuickHit, v: number) => void;
  placeholder?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<QuickHit[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits([]); setBusy(false); return; }
    let alive = true;
    setBusy(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("film_search", { p_q: term, p_limit: 6 });
      if (!alive) return;
      // room = Tier-1 only: catalog films have no cinecodex scores and their
      // /room/film pages 404 (film_search v2 now returns them, flagged)
      setHits(((data as (QuickHit & { is_catalog?: boolean })[] | null) ?? []).filter((h) => h.is_catalog !== true));
      setBusy(false);
    }, 220);
    return () => { alive = false; clearTimeout(t); };
  }, [q, supabase]);

  return (
    <div className="qrate">
      <div className="qin">
        <i className="ti ti-search" style={{ color: "var(--sub)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder ?? "방금 본 영화 검색 — 별을 누르면 기록 끝"} />
      </div>
      {q.trim() ? (
        <div className="qdrop">
          {busy ? <div className="qhit"><span className="qt" style={{ color: "var(--sub)" }}>검색 중…</span></div>
            : hits.length ? hits.map((h) => (
              <div className="qhit" key={h.slug}>
                <span className="qpo" style={h.poster_path ? { backgroundImage: `url(${IMG}${h.poster_path})` } : {}} />
                <span className="qt">{h.title}<small>{h.director ?? ""}{h.year ? ` · ${h.year}` : ""}</small></span>
                <Stars value={0} onPick={(v) => { onRate(h, v); setQ(""); }} />
              </div>
            )) : <div className="qhit"><span className="qt" style={{ color: "var(--sub)" }}>결과 없음</span></div>}
        </div>
      ) : null}
    </div>
  );
}
