"use client";
/** ⌘K palette — instant jump to films / pages. Uses public film_search RPC. */
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Hit = { kind: "film" | "page"; label: string; sub?: string; href: string };
const PAGES: Hit[] = [
  { kind: "page", label: "현황 · 커맨드센터", href: "/room" },
  { kind: "page", label: "보유 영화", href: "/room/collection" },
  { kind: "page", label: "볼 영화 · 추천", href: "/room/watchlist" },
  { kind: "page", label: "운용 데스크", href: "/room/desk" },
  { kind: "page", label: "자산 분석", href: "/room/analysis" },
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
      const films: Hit[] = ((data as Array<{ slug: string; title: string; year: number | null }> | null) ?? [])
        .map((f) => ({ kind: "film" as const, label: f.title, sub: f.year ? String(f.year) : undefined, href: `/film/${f.slug}` }));
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
