"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { HomeV2 } from "@/lib/home2";
import { useSearchTypeahead, type SearchHit } from "@/lib/useSearch";
import { SearchHitRow } from "@/components/SearchBox";

export default function BigSearch({ data }: { data: HomeV2 }) {
  const { stats } = data;
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { hits, loading } = useSearchTypeahead(q);
  const term = q.trim();

  useEffect(() => {
    setActive(-1);
    setOpen(term.length >= 2);
  }, [term]);

  // Hybrid stage can replace/reorder the list — re-anchor the keyboard cursor.
  useEffect(() => { setActive(-1); }, [hits]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (h: SearchHit) => { setOpen(false); setQ(""); router.push(h.href); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (active >= 0 && hits[active]) { go(hits[active]); return; }
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // IME composition commits (Hangul/CJK) fire Enter/arrow keydowns that
    // belong to the IME, not to us — and Enter would also submit the form.
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      if (e.key === "Enter") e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <section className="band p2 bigsearch" style={{ padding: "56px 0" }}>
      <div className="wrap inner">
        <span className="kicker">However you arrived</span>
        <h2>
          Search the map — <em>or ask it anything.</em>
        </h2>
        <div ref={wrapRef} className="bs-wrap">
          <form className="sb" onSubmit={submit}>
            <span className="mag">⌕</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => { if (term.length >= 2) setOpen(true); }}
              placeholder="A film, a director, an idea, a feeling — in any language"
              aria-label="Search Metatake"
              autoComplete="off"
            />
            <button
              type="button"
              className="ask"
              onClick={() => router.push(q ? `/ask?q=${encodeURIComponent(q)}` : "/ask")}
            >
              <span className="dot" />
              Ask&nbsp;AI →
            </button>
          </form>
          {open && term.length >= 2 && (
            <div className="sb-drop">
              {hits.length === 0 ? (
                <div className="sb-empty">{loading ? "Searching by meaning…" : `No quick matches for “${term}”.`}</div>
              ) : (
                <>
                  {hits.map((h, i) => (
                    <SearchHitRow
                      key={`${h.kind}:${h.slug}:${h.film_slug ?? ""}`}
                      hit={h}
                      active={i === active}
                      onPick={() => go(h)}
                      onHover={() => setActive(i)}
                    />
                  ))}
                  <button
                    type="button"
                    className="sb-all"
                    onClick={() => { setOpen(false); router.push(`/search?q=${encodeURIComponent(term)}`); }}
                  >
                    See all results for “{term}” →
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <p className="bs-subline">
          This search reads meaning — 27,000 close readings, 6,900 films, ideas, people, places.
        </p>
        <div className="chips">
          <Link className="chip" href="/search?q=grief+that+refuses+closure">
            Grief that refuses closure
          </Link>
          <Link className="chip" href="/ask?q=What+recurs+across+films+about+grief%3F">
            What recurs across films about grief?
          </Link>
          <Link className="chip" href={`/search?q=${encodeURIComponent("몸의 공포")}`}>
            몸의 공포 — any language works
          </Link>
        </div>
        <div className="facets">
          Jump to · <Link href="/film">{stats.films.toLocaleString()} Films</Link> ·{" "}
          <Link href="/director">{stats.directors.toLocaleString()} Directors</Link> ·{" "}
          <Link href="/tropes">{stats.tropes.toLocaleString()} Tropes</Link> ·{" "}
          <Link href="/strong-misreadings">{stats.readings.toLocaleString()} Strong Misreadings</Link>
        </div>
      </div>
    </section>
  );
}
