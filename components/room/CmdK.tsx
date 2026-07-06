"use client";
/** ⌘K palette — instant jump to films / pages. Uses public film_search RPC. */
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Hit = { kind: "film" | "page"; label: string; sub?: string; href: string };
/* NAV(레일)와 동기화 + 레일에서 강등된 라우트(동행·공개 프로필)의 진입로 */
const PAGES: Hit[] = [
  { kind: "page", label: "오늘 · 홈", href: "/room" },
  { kind: "page", label: "볼 영화 · 추천", href: "/room/watchlist" },
  { kind: "page", label: "기록 · 평가", href: "/room/rate" },
  { kind: "page", label: "보유 영화", href: "/room/collection" },
  { kind: "page", label: "감독 정복", href: "/room/auteurs" },
  { kind: "page", label: "지리 Atlas", href: "/room/atlas" },
  { kind: "page", label: "자산 분석", href: "/room/analysis" },
  { kind: "page", label: "서재", href: "/room/library" },
  { kind: "page", label: "노트 · 글쓰기", href: "/room/write" },
  { kind: "page", label: "동행", href: "/room/pair" },
  { kind: "page", label: "공개 프로필", href: "/u/me" },
];

export default function CmdK({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>(PAGES);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); }, [open]);

  useEffect(() => {
    let alive = true;
    const term = q.trim();
    if (!term) { setHits(PAGES); return; }
    const pageHits = PAGES.filter((p) => p.label.toLowerCase().includes(term.toLowerCase()));
    (async () => {
      const { data } = await supabase.rpc("film_search", { p_q: term, p_limit: 8 });
      if (!alive) return;
      // room = Tier-1 only: unscored catalog films 404 at /room/film/{slug}
      const films: Hit[] = ((data as Array<{ slug: string; title: string; year: number | null; is_catalog?: boolean }> | null) ?? [])
        .filter((f) => f.is_catalog !== true)
        .map((f) => ({ kind: "film" as const, label: f.title, sub: f.year ? String(f.year) : undefined, href: `/room/film/${f.slug}` }));
      setHits([...pageHits, ...films]);
    })();
    return () => { alive = false; };
  }, [q, supabase]);

  const go = useCallback((h: Hit) => { onClose(); setQ(""); router.push(h.href); }, [onClose, router]);

  if (!open) return null;
  return (
    <div className="palette show" onClick={onClose}>
      <div className="palbox" onClick={(e) => e.stopPropagation()}>
        <input ref={inputRef} value={q} placeholder="영화 · 페이지 검색"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); if (e.key === "Enter" && hits[0]) go(hits[0]); }} />
        <div className="palres">
          {hits.map((h, i) => (
            <div className="palitem" key={i} onClick={() => go(h)}>
              <i className={`ti ${h.kind === "film" ? "ti-movie" : "ti-arrow-right"}`} />
              <span>{h.label}</span>
              {h.sub ? <span className="pk">{h.sub}</span> : null}
              <span className="pk">{h.kind === "film" ? "영화" : "페이지"}</span>
            </div>
          ))}
          {hits.length === 0 ? <div className="palitem">결과 없음</div> : null}
        </div>
      </div>
    </div>
  );
}
