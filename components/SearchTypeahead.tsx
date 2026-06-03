"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const POSTER_BASE = "https://image.tmdb.org/t/p";

type FilmResult = { id: string; title: string; year: number; slug: string; poster_path: string | null; director: string };
type QuestionResult = { id: string; title: string; slug: string; film_title: string; film_slug: string };
type DirectorResult = { director: string; director_slug: string; film_count: number };

export default function SearchTypeahead() {
  const [query, setQuery] = useState("");
  const [films, setFilms] = useState<FilmResult[]>([]);
  const [questions, setQuestions] = useState<QuestionResult[]>([]);
  const [directors, setDirectors] = useState<DirectorResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setFilms([]);
      setQuestions([]);
      setDirectors([]);
      setOpen(false);
      return;
    }

    const pattern = `%${q}%`;

    const [filmRes, questionRes, directorRes] = await Promise.all([
      supabase
        .from("films")
        .select("id, title, year, slug, poster_path, director")
        .ilike("title", pattern)
        .limit(4),
      supabase
        .from("questions")
        .select("id, title, slug, film:films!inner(title, slug)")
        .ilike("title", pattern)
        .eq("status", "published")
        .limit(4),
      supabase
        .from("films")
        .select("director, director_slug")
        .ilike("director", pattern)
        .limit(10),
    ]);

    setFilms((filmRes.data ?? []) as FilmResult[]);

    const qResults = (questionRes.data ?? []).map((q: Record<string, unknown>) => {
      const film = q.film as { title: string; slug: string };
      return {
        id: q.id as string,
        title: q.title as string,
        slug: q.slug as string,
        film_title: film.title,
        film_slug: film.slug,
      };
    });
    setQuestions(qResults);

    // Dedupe directors
    const dirMap = new Map<string, DirectorResult>();
    for (const row of directorRes.data ?? []) {
      const d = row as { director: string; director_slug: string };
      if (!dirMap.has(d.director_slug)) {
        dirMap.set(d.director_slug, { director: d.director, director_slug: d.director_slug, film_count: 1 });
      } else {
        dirMap.get(d.director_slug)!.film_count++;
      }
    }
    setDirectors(Array.from(dirMap.values()).slice(0, 3));

    setOpen(true);
    setActiveIdx(-1);
  }, []);

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 300);
  };

  // Build flat list for keyboard nav
  const allItems: { href: string; label: string }[] = [];
  films.forEach((f) => allItems.push({ href: `/film/${f.slug}`, label: f.title }));
  directors.forEach((d) => allItems.push({ href: `/director/${d.director_slug}`, label: d.director }));
  questions.forEach((q) => allItems.push({ href: `/film/${q.film_slug}/q/${q.slug}`, label: q.title }));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((prev) => Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      router.push(allItems[activeIdx].href);
      setOpen(false);
      setQuery("");
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  let flatIdx = -1;

  return (
    <div ref={containerRef} className="search-container">
      <div className="field search" style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={onInput}
          onKeyDown={onKeyDown}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Search films, directors, questions…"
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            flex: 1,
            fontFamily: "var(--font-ui)",
            fontSize: 14,
            color: "var(--ink)",
          }}
          aria-label="Search"
          id="search-typeahead"
        />
      </div>

      {open && (films.length > 0 || directors.length > 0 || questions.length > 0) && (
        <div className="search-dropdown">
          {films.length > 0 && (
            <div className="search-group">
              <div className="search-group__label">Films</div>
              {films.map((f) => {
                flatIdx++;
                const idx = flatIdx;
                return (
                  <a
                    key={f.id}
                    href={`/film/${f.slug}`}
                    className="search-result"
                    data-active={activeIdx === idx ? "true" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(`/film/${f.slug}`);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    {f.poster_path ? (
                      <img src={`${POSTER_BASE}/w92${f.poster_path}`} alt="" className="search-result__poster" />
                    ) : (
                      <div className="poster" style={{ width: 28, height: 42 }} />
                    )}
                    <div>
                      <div className="search-result__title">{f.title}</div>
                      <div className="search-result__sub">{f.year} · {f.director}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          {directors.length > 0 && (
            <div className="search-group">
              <div className="search-group__label">Directors</div>
              {directors.map((d) => {
                flatIdx++;
                const idx = flatIdx;
                return (
                  <a
                    key={d.director_slug}
                    href={`/director/${d.director_slug}`}
                    className="search-result"
                    data-active={activeIdx === idx ? "true" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(`/director/${d.director_slug}`);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <div>
                      <div className="search-result__title">{d.director}</div>
                      <div className="search-result__sub">{d.film_count} film{d.film_count > 1 ? "s" : ""}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          {questions.length > 0 && (
            <div className="search-group">
              <div className="search-group__label">Questions</div>
              {questions.map((q) => {
                flatIdx++;
                const idx = flatIdx;
                return (
                  <a
                    key={q.id}
                    href={`/film/${q.film_slug}/q/${q.slug}`}
                    className="search-result"
                    data-active={activeIdx === idx ? "true" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(`/film/${q.film_slug}/q/${q.slug}`);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <div>
                      <div className="search-result__title">{q.title}</div>
                      <div className="search-result__sub">{q.film_title}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
