"use client";

import { useState, useEffect, Suspense } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useSearchParams } from "next/navigation";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface FilmResult {
  tmdb_id: number;
  title: string;
  year: number | null;
  poster_path: string | null;
}

function AskForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedFilm, setSelectedFilm] = useState<{
    id: string;
    title: string;
    year: number | null;
    slug: string;
  } | null>(null);

  const [filmQuery, setFilmQuery] = useState("");
  const [filmResults, setFilmResults] = useState<FilmResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [firstReading, setFirstReading] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const filmParam = searchParams.get("film");
    if (filmParam) {
      setFilmQuery(filmParam);
      searchFilms(filmParam);
    }
  }, [searchParams]);

  async function searchFilms(query: string) {
    if (query.length < 2) {
      setFilmResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/films/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setFilmResults(data.results ?? []);
    } catch {
      setFilmResults([]);
    }
    setSearching(false);
  }

  async function selectFilm(tmdbId: number) {
    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from("films")
      .select("id, title, year, slug")
      .eq("tmdb_id", tmdbId)
      .single();

    if (existing) {
      setSelectedFilm(existing);
    } else {
      const res = await fetch("/api/films/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdb_id: tmdbId }),
      });
      if (res.ok) {
        const { data: newFilm } = await supabase
          .from("films")
          .select("id, title, year, slug")
          .eq("tmdb_id", tmdbId)
          .single();
        if (newFilm) setSelectedFilm(newFilm);
      }
    }

    setStep(2);
    setFilmResults([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFilm || !title.trim()) return;

    setSubmitting(true);
    setError(null);

    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be signed in to post.");
      setSubmitting(false);
      return;
    }

    const slug = `${selectedFilm.slug}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}-${Date.now().toString(36)}`;

    const { data: question, error: qErr } = await supabase
      .from("questions")
      .insert({
        film_id: selectedFilm.id,
        author_id: user.id,
        title: title.trim(),
        body: body.trim() || null,
        slug,
        status: "published",
        source: "human",
        published_at: new Date().toISOString(),
      })
      .select("id, slug")
      .single();

    if (qErr) {
      setError(qErr.message);
      setSubmitting(false);
      return;
    }

    if (firstReading.trim() && question) {
      await supabase.from("contributions").insert({
        question_id: question.id,
        author_id: user.id,
        body: firstReading.trim(),
        status: "published",
        source: "human",
        published_at: new Date().toISOString(),
      });
    }

    router.push(`/film/${selectedFilm.slug}/q/${question.slug}`);
  }

  return (
    <main className="shell">
      <h1 className="disp" style={{ fontSize: 25, margin: 0 }}>Ask a question</h1>

      {error && (
        <div style={{ padding: "10px 13px", marginTop: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 4, color: "#991b1b", fontSize: 13, fontFamily: "var(--font-ui)" }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <div className="step">01 — Pick the film</div>

        {selectedFilm ? (
          <div className="field" style={{ marginTop: 9, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>
              {selectedFilm.title}{" "}
              <span className="muted" style={{ fontSize: 13 }}>({selectedFilm.year})</span>
            </span>
            <button
              onClick={() => { setSelectedFilm(null); setStep(1); }}
              className="ui accent"
              style={{ fontSize: 12, textDecoration: "none", background: "none", border: "none", cursor: "pointer" }}
            >
              change
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 9 }}>
            <input
              type="text"
              value={filmQuery}
              onChange={(e) => {
                setFilmQuery(e.target.value);
                searchFilms(e.target.value);
              }}
              placeholder="Search a film…"
              className="field search"
              style={{ width: "100%", boxSizing: "border-box", outline: "none" }}
              autoFocus
            />
            {filmResults.length > 0 && (
              <div style={{ border: "1px solid var(--hairline)", borderRadius: 4, marginTop: 4, background: "var(--surface)", maxHeight: 300, overflow: "auto" }}>
                {filmResults.map((f) => (
                  <button
                    key={f.tmdb_id}
                    onClick={() => selectFilm(f.tmdb_id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 13px",
                      border: "none",
                      borderBottom: "1px solid var(--hairline)",
                      background: "none",
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                      fontSize: 15,
                      color: "var(--ink)",
                    }}
                  >
                    {f.title} <span className="muted" style={{ fontSize: 13 }}>({f.year})</span>
                  </button>
                ))}
              </div>
            )}
            {searching && <div className="ui muted" style={{ fontSize: 12, marginTop: 6 }}>Searching…</div>}
          </div>
        )}
      </div>

      {step >= 2 && (
        <>
          <hr className="rule" />
          <div>
            <div className="step">02 — Write the question</div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What does the blue box actually mean?"
              className="field"
              style={{ width: "100%", boxSizing: "border-box", marginTop: 9, outline: "none" }}
            />
            <div className="ui muted" style={{ fontSize: 12, marginTop: 8 }}>
              Ask about meaning, symbolism, or intent — not trivia or plot recaps.
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add context (optional)…"
              className="field"
              rows={2}
              style={{ width: "100%", boxSizing: "border-box", marginTop: 9, resize: "vertical", outline: "none", minHeight: 54 }}
            />
          </div>

          <hr className="rule" />

          <div>
            <div className="step">
              03 — Add your first reading{" "}
              <span className="ui muted" style={{ fontSize: 12, letterSpacing: 0 }}>
                · optional, but no question should sit empty
              </span>
            </div>
            <textarea
              value={firstReading}
              onChange={(e) => setFirstReading(e.target.value)}
              placeholder="Share how you read it…"
              className="field"
              rows={3}
              style={{ width: "100%", boxSizing: "border-box", marginTop: 9, resize: "vertical", outline: "none", minHeight: 72 }}
            />
          </div>

          <hr className="rule" />

          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <button
              onClick={handleSubmit}
              disabled={submitting || !title.trim()}
              className="btn"
              style={{ opacity: submitting || !title.trim() ? 0.5 : 1 }}
            >
              {submitting ? "Posting…" : "Post question"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default function AskNewPage() {
  return (
    <Suspense>
      <AskForm />
    </Suspense>
  );
}
