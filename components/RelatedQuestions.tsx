import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const POSTER_BASE = "https://image.tmdb.org/t/p";

interface Props {
  currentQuestionId: string;
  filmId: string;
  filmTitle: string;
  filmSlug: string;
  director: string;
  directorSlug: string | null;
}

export default async function RelatedQuestions({
  currentQuestionId,
  filmId,
  filmTitle,
  filmSlug,
  director,
  directorSlug,
}: Props) {
  const supabase = supabaseAnon();

  // 1. More questions about this film
  const { data: sameFilmQuestions } = await supabase
    .from("questions")
    .select("id, title, slug, view_count")
    .eq("film_id", filmId)
    .eq("status", "published")
    .neq("id", currentQuestionId)
    .order("view_count", { ascending: false })
    .limit(5);

  // 2. More from this director (questions on other films by same director)
  const { data: directorFilms } = await supabase
    .from("films")
    .select("id, title, slug, poster_path")
    .eq("director", director)
    .neq("id", filmId)
    .limit(6);

  let directorQuestions: Array<{
    id: string; title: string; slug: string; view_count: number;
    film: { title: string; slug: string; poster_path: string | null };
  }> = [];

  if (directorFilms && directorFilms.length > 0) {
    const filmIds = directorFilms.map((f) => f.id);
    const { data: dqs } = await supabase
      .from("questions")
      .select("id, title, slug, view_count, film:films!inner(title, slug, poster_path)")
      .in("film_id", filmIds)
      .eq("status", "published")
      .order("view_count", { ascending: false })
      .limit(5);

    directorQuestions = (dqs ?? []).map((q: Record<string, unknown>) => ({
      id: q.id as string,
      title: q.title as string,
      slug: q.slug as string,
      view_count: q.view_count as number,
      film: q.film as { title: string; slug: string; poster_path: string | null },
    }));
  }

  // 3. Trending interpretations (across all films)
  const { data: trendingQuestions } = await supabase
    .from("questions")
    .select("id, title, slug, view_count, film:films!inner(title, slug, poster_path)")
    .eq("status", "published")
    .neq("id", currentQuestionId)
    .order("view_count", { ascending: false })
    .limit(8);

  const trending = (trendingQuestions ?? []).map((q: Record<string, unknown>) => ({
    id: q.id as string,
    title: q.title as string,
    slug: q.slug as string,
    view_count: q.view_count as number,
    film: q.film as { title: string; slug: string; poster_path: string | null },
  }));

  const hasContent =
    (sameFilmQuestions && sameFilmQuestions.length > 0) ||
    directorQuestions.length > 0 ||
    trending.length > 0;

  if (!hasContent) return null;

  return (
    <div>
      {/* More questions about this film */}
      {sameFilmQuestions && sameFilmQuestions.length > 0 && (
        <div className="related-box">
          <h3 className="related-box__title">More questions about {filmTitle}</h3>
          {sameFilmQuestions.map((q) => (
            <Link
              key={q.id}
              href={`/film/${filmSlug}/q/${q.slug}`}
              className="related-box__item"
            >
              <div>
                <div className="related-box__qtitle">{q.title}</div>
                <div className="related-box__qmeta">
                  {q.view_count > 0 ? `${q.view_count.toLocaleString()} reads` : "New"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* More from this director */}
      {directorQuestions.length > 0 && (
        <div className="related-box">
          <h3 className="related-box__title">
            More from {director}
            {directorSlug && (
              <>
                {" "}·{" "}
                <Link
                  href={`/director/${directorSlug}`}
                  style={{ color: "var(--accent)", textDecoration: "none", textTransform: "none", letterSpacing: "normal", fontSize: 12 }}
                >
                  View all →
                </Link>
              </>
            )}
          </h3>
          {directorQuestions.map((q) => (
            <Link
              key={q.id}
              href={`/film/${q.film.slug}/q/${q.slug}`}
              className="related-box__item"
            >
              {q.film.poster_path && (
                <img
                  src={`${POSTER_BASE}/w92${q.film.poster_path}`}
                  alt=""
                  className="related-box__still"
                  loading="lazy"
                />
              )}
              <div>
                <div className="related-box__qtitle">{q.title}</div>
                <div className="related-box__qmeta">
                  {q.film.title} · {q.view_count > 0 ? `${q.view_count.toLocaleString()} reads` : "New"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Trending interpretations */}
      {trending.length > 0 && (
        <div className="related-box">
          <h3 className="related-box__title">Trending interpretations</h3>
          {trending.map((q) => (
            <Link
              key={q.id}
              href={`/film/${q.film.slug}/q/${q.slug}`}
              className="related-box__item"
            >
              {q.film.poster_path && (
                <img
                  src={`${POSTER_BASE}/w92${q.film.poster_path}`}
                  alt=""
                  className="related-box__still"
                  loading="lazy"
                />
              )}
              <div>
                <div className="related-box__qtitle">{q.title}</div>
                <div className="related-box__qmeta">
                  {q.film.title} · {q.view_count > 0 ? `${q.view_count.toLocaleString()} reads` : "New"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
