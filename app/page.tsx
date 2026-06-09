import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

export const dynamic = 'force-dynamic';

function supabaseAnon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const POSTER_BASE = "https://image.tmdb.org/t/p";

export default async function HomePage() {
  const supabase = supabaseAnon();

  // ── Data fetches ────────────────────────────────────────────────

  // C2: Featured question (most-viewed published question with a canonical answer)
  const { data: featured } = await supabase
    .from("questions")
    .select(`
      id, title, slug, view_count,
      film:films!inner(id, title, year, director, slug, poster_path),
      canonical_answers!inner(body, status)
    `)
    .eq("status", "published")
    .eq("canonical_answers.status", "published")
    .order("view_count", { ascending: false })
    .limit(1)
    .single();

  // Featured backdrop
  let featuredBackdrop: string | null = null;
  if (featured) {
    const film = featured.film as unknown as { id: string };
    const { data: media } = await supabase
      .from("media")
      .select("url")
      .eq("entity_type", "film")
      .eq("entity_id", film.id)
      .eq("kind", "image")
      .eq("status", "published")
      .order("position")
      .limit(1)
      .single();
    featuredBackdrop = media?.url ?? null;
  }

  // C5: Latest interpretations (recently published with canonical answers)
  const { data: latestRaw } = await supabase
    .from("questions")
    .select(`
      id, title, slug, view_count, published_at,
      film:films!inner(id, title, year, director, slug, poster_path),
      canonical_answers!inner(body, status),
      author:profiles!questions_author_id_fkey(username, display_name)
    `)
    .eq("status", "published")
    .eq("canonical_answers.status", "published")
    .order("published_at", { ascending: false })
    .limit(8);

  type LatestItem = {
    id: string; title: string; slug: string; view_count: number; published_at: string;
    film: { id: string; title: string; year: number; director: string; slug: string; poster_path: string | null };
    teaser: string | null;
    author: { username: string; display_name: string | null } | null;
  };

  const latest: LatestItem[] = (latestRaw ?? [])
    .filter((q) => featured ? q.id !== featured.id : true)
    .slice(0, 6)
    .map((q: Record<string, unknown>) => {
      // PostgREST returns object (not array) for 1:1 UNIQUE FK
      const rawCA = q.canonical_answers as unknown;
      const caBody = Array.isArray(rawCA) ? (rawCA[0] as { body: string })?.body : (rawCA as { body: string } | null)?.body;
      const body = caBody ?? "";
      const teaser = body ? body.split(/\n\n+/)[0]?.slice(0, 140) + "…" : null;
      return {
        id: q.id as string,
        title: q.title as string,
        slug: q.slug as string,
        view_count: q.view_count as number,
        published_at: q.published_at as string,
        film: q.film as LatestItem["film"],
        teaser,
        author: q.author as LatestItem["author"],
      };
    });

  // Fetch backdrop images for latest items
  const latestFilmIds = [...new Set(latest.map((q) => q.film.id))];
  let filmBackdrops = new Map<string, string>();
  if (latestFilmIds.length > 0) {
    const { data: backdrops } = await supabase
      .from("media")
      .select("entity_id, url")
      .eq("entity_type", "film")
      .eq("kind", "image")
      .eq("status", "published")
      .in("entity_id", latestFilmIds)
      .order("position")
      .limit(20);
    const seen = new Set<string>();
    for (const row of backdrops ?? []) {
      if (!seen.has(row.entity_id)) {
        seen.add(row.entity_id);
        filmBackdrops.set(row.entity_id, row.url);
      }
    }
  }

  // C6: Rankings (most-read this week)
  const { data: rankingsRaw } = await supabase
    .from("questions")
    .select(`
      id, title, slug, view_count,
      film:films!inner(title, slug, poster_path)
    `)
    .eq("status", "published")
    .order("view_count", { ascending: false })
    .limit(5);

  const rankings = (rankingsRaw ?? []).map((q: Record<string, unknown>) => ({
    id: q.id as string,
    title: q.title as string,
    slug: q.slug as string,
    view_count: q.view_count as number,
    film: q.film as { title: string; slug: string; poster_path: string | null },
  }));

  // C4: Browse by director
  const { data: filmsForDirectors } = await supabase
    .from("films")
    .select("director, director_slug, poster_path")
    .not("director_slug", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  type DirectorCard = { director: string; director_slug: string; film_count: number; poster_path: string | null };
  const directorMap = new Map<string, DirectorCard>();
  for (const f of filmsForDirectors ?? []) {
    const row = f as { director: string; director_slug: string; poster_path: string | null };
    if (!directorMap.has(row.director_slug)) {
      directorMap.set(row.director_slug, {
        director: row.director,
        director_slug: row.director_slug,
        film_count: 1,
        poster_path: row.poster_path,
      });
    } else {
      directorMap.get(row.director_slug)!.film_count++;
    }
  }
  const directors = Array.from(directorMap.values()).slice(0, 10);

  // C7: Films to decode (curated poster grid — in-pipeline films)
  const { data: filmsToDecode } = await supabase
    .from("films")
    .select("id, title, year, slug, poster_path, director")
    .order("created_at", { ascending: false })
    .limit(8);

  // Questions needing a reading
  const { data: needingReadings } = await supabase
    .from("questions")
    .select("id, title, slug, film:films!inner(title, year, slug, poster_path)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(20);

  const questionIds = (needingReadings ?? []).map((q) => q.id);
  const { data: contribCounts } = questionIds.length > 0
    ? await supabase.from("contributions").select("question_id").in("question_id", questionIds).eq("status", "published")
    : { data: [] };
  const contribSet = new Set((contribCounts ?? []).map((c) => c.question_id));
  const unanswered = (needingReadings ?? []).filter((q) => !contribSet.has(q.id)).slice(0, 5);

  // Stats
  const { count: totalQuestions } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  const { count: totalFilms } = await supabase
    .from("films")
    .select("id", { count: "exact", head: true });

  const timeAgo = (d: string) => {
    if (!d) return "";
    const diff = Date.now() - new Date(d).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(diff / 86400000);
    if (days === 1) return "1d ago";
    return `${days}d ago`;
  };

  const featuredFilm = featured?.film as unknown as {
    id: string; title: string; year: number; director: string; slug: string; poster_path: string | null;
  } | null;
  // PostgREST returns object (not array) for 1:1 UNIQUE FK
  const rawFeaturedCA = featured?.canonical_answers as unknown;
  const featuredBody = Array.isArray(rawFeaturedCA) ? (rawFeaturedCA[0] as { body: string })?.body : (rawFeaturedCA as { body: string } | null)?.body;
  const featuredTeaser = featuredBody
    ? featuredBody.split(/\n\n+/)[0]?.slice(0, 180) + "…"
    : null;

  return (
    <main className="shell">
      {/* ── C2: Hero — featured interpretation ── */}
      {featured && featuredFilm && (
        <Link
          href={`/film/${featuredFilm.slug}/q/${featured.slug}`}
          className="hero-card"
        >
          {featuredBackdrop ? (
            <img src={featuredBackdrop} alt={featuredFilm.title} className="hero-card__bg" loading="eager" fetchPriority="high" />
          ) : (
            <div className="hero-card__bg" style={{ background: "var(--ink)" }} />
          )}
          <div className="hero-card__overlay" />
          <div className="hero-card__body">
            <div className="hero-card__label">Featured reading</div>
            <h2 className="hero-card__title">{featured.title}</h2>
            <div className="hero-card__film">
              {featuredFilm.poster_path && (
                <img src={`${POSTER_BASE}/w92${featuredFilm.poster_path}`} alt="" />
              )}
              <span>{featuredFilm.title} ({featuredFilm.year}) · dir. {featuredFilm.director}</span>
            </div>
            {featuredTeaser && (
              <p className="hero-card__teaser">{featuredTeaser}</p>
            )}
            <span className="hero-card__cta">Read the interpretation →</span>
          </div>
        </Link>
      )}

      {/* ── Stats strip ── */}
      <div style={{ display: "flex", gap: 24, marginBottom: 20, fontSize: 12.5, color: "var(--muted)" }}>
        <span><strong style={{ color: "var(--ink)", fontSize: 16 }}>{totalQuestions ?? 0}</strong> questions</span>
        <span><strong style={{ color: "var(--ink)", fontSize: 16 }}>{totalFilms ?? 0}</strong> films</span>
      </div>

      <hr className="rule" />

      {/* ── C4: Browse by director ── */}
      {directors.length > 0 && (
        <>
          <div className="seclbl">Browse by director</div>
          <div className="scroll-row">
            {directors.map((d) => (
              <Link key={d.director_slug} href={`/director/${d.director_slug}`} className="scroll-row__card">
                {d.poster_path ? (
                  <img src={`${POSTER_BASE}/w342${d.poster_path}`} alt={d.director} loading="lazy" />
                ) : (
                  <div style={{ width: "100%", height: "100%", background: "var(--ink)" }} />
                )}
                <div className="scroll-row__card-overlay">
                  <div>
                    <div className="scroll-row__card-label">{d.director}</div>
                    <div className="scroll-row__card-sub">{d.film_count} film{d.film_count > 1 ? "s" : ""}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <hr className="rule" style={{ marginTop: 20 }} />
        </>
      )}

      {/* ── C5: Latest interpretations ── */}
      {latest.length > 0 && (
        <>
          <div className="seclbl">Latest interpretations</div>
          <div className="tick" />
          {latest.map((q) => {
            const backdrop = filmBackdrops.get(q.film.id);
            return (
              <Link key={q.id} href={`/film/${q.film.slug}/q/${q.slug}`} className="feed-card">
                {backdrop ? (
                  <img src={backdrop} alt="" className="feed-card__still" loading="lazy" />
                ) : q.film.poster_path ? (
                  <img src={`${POSTER_BASE}/w185${q.film.poster_path}`} alt="" className="feed-card__still" loading="lazy" />
                ) : null}
                <div className="feed-card__body">
                  <div className="feed-card__title">{q.title}</div>
                  <div className="feed-card__meta">
                    {q.film.title} ({q.film.year}) · {q.view_count > 0 ? `${q.view_count.toLocaleString()} reads` : "New"}
                    {q.published_at ? ` · ${timeAgo(q.published_at)}` : ""}
                  </div>
                  {q.teaser && <div className="feed-card__teaser">{q.teaser}</div>}
                </div>
              </Link>
            );
          })}
          <hr className="rule" />
        </>
      )}

      {/* ── Questions needing a reading ── */}
      {unanswered.length > 0 && (
        <>
          <div className="seclbl">Questions needing a reading</div>
          <div className="tick" />
          {unanswered.map((q: { id: string; title: string; slug: string; film: unknown }) => {
            const film = q.film as { title: string; year: number; slug: string; poster_path: string | null };
            return (
              <div key={q.id} className="qrow" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                {film.poster_path && (
                  <img
                    src={`${POSTER_BASE}/w92${film.poster_path}`}
                    alt=""
                    loading="lazy"
                    style={{ width: 32, height: 45, borderRadius: 3, objectFit: "cover", flexShrink: 0, marginTop: 2 }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <Link href={`/film/${film.slug}/q/${q.slug}`} className="disp" style={{ fontSize: 17, textDecoration: "none", color: "var(--ink)" }}>
                    {q.title}
                  </Link>
                  <div className="ui muted" style={{ fontSize: 12, marginTop: 3 }}>
                    {film.title} ({film.year}) · no reading yet
                  </div>
                </div>
                <Link href={`/film/${film.slug}/q/${q.slug}`} className="ui accent" style={{ fontSize: 12, whiteSpace: "nowrap", textDecoration: "none" }}>
                  Be the first ▸
                </Link>
              </div>
            );
          })}
          <hr className="rule" />
        </>
      )}

      {/* ── C6: Rankings ── */}
      {rankings.length > 0 && (
        <>
          <div className="seclbl">Most read</div>
          <div className="tick" />
          {rankings.map((q, i) => (
            <Link key={q.id} href={`/film/${q.film.slug}/q/${q.slug}`} className="ranking-item">
              <div className="ranking-item__rank">{i + 1}</div>
              {q.film.poster_path && (
                <img src={`${POSTER_BASE}/w92${q.film.poster_path}`} alt="" className="ranking-item__still" loading="lazy" />
              )}
              <div className="ranking-item__text">
                <div className="ranking-item__qtitle">{q.title}</div>
                <div className="ranking-item__meta">
                  {q.film.title} · {q.view_count.toLocaleString()} reads
                </div>
              </div>
            </Link>
          ))}
          <hr className="rule" />
        </>
      )}

      {/* ── C7: Films to decode ── */}
      {filmsToDecode && filmsToDecode.length > 0 && (
        <>
          <div className="seclbl">Films to decode</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: 12,
              marginTop: 12,
            }}
          >
            {(filmsToDecode ?? []).map((f: { id: string; title: string; year: number; slug: string; poster_path: string | null }) => (
              <Link
                key={f.id}
                href={`/film/${f.slug}`}
                style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 6 }}
              >
                <div style={{ width: "100%", aspectRatio: "2/3", borderRadius: 6, overflow: "hidden", background: "var(--hairline)" }}>
                  {f.poster_path && (
                    <img
                      src={`${POSTER_BASE}/w342${f.poster_path}`}
                      alt={f.title}
                      loading="lazy"
                      width={342}
                      height={513}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
                </div>
                <div>
                  <div className="ui" style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.3, color: "var(--ink)" }}>
                    {f.title}
                  </div>
                  <div className="ui muted" style={{ fontSize: 11 }}>{f.year}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
