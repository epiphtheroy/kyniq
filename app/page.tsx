import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

export const revalidate = 120; // ISR: 2 min

function supabaseAnon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default async function HomePage() {
  const supabase = supabaseAnon();

  // ── Data fetches ────────────────────────────────────────────────

  // Featured question (most-viewed published question with a canonical answer)
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

  // Trending films (films with most published questions)
  const { data: trendingFilms } = await supabase
    .from("films")
    .select("id, title, year, director, slug, poster_path")
    .order("created_at", { ascending: false })
    .limit(6);

  // Questions needing a reading (published, 0 contributions)
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

  // Recently improved
  const { data: recentlyImproved } = await supabase
    .from("canonical_answers")
    .select("updated_at, question:questions!inner(title, slug, film:films!inner(title, slug))")
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(4);

  // Active now
  const { data: recentContribs } = await supabase
    .from("contributions")
    .select("created_at, question:questions!inner(title, slug, film:films!inner(title, slug))")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(4);

  // Notable readers
  const { data: notableReaders } = await supabase
    .from("profiles")
    .select("username, display_name, reputation")
    .eq("is_public", true)
    .neq("role", "system")
    .not("username", "is", null)
    .order("reputation", { ascending: false })
    .limit(5);

  // Published question count for stat
  const { count: totalQuestions } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  const { count: totalFilms } = await supabase
    .from("films")
    .select("id", { count: "exact", head: true });

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(diff / 86400000);
    if (days === 1) return "1d ago";
    return `${days}d ago`;
  };

  const posterBase = "https://image.tmdb.org/t/p";
  const featuredFilm = featured?.film as unknown as {
    id: string; title: string; year: number; director: string; slug: string; poster_path: string | null;
  } | null;
  const featuredAnswer = featured?.canonical_answers as unknown as Array<{ body: string }>;
  const featuredTeaser = featuredAnswer?.[0]?.body
    ? featuredAnswer[0].body.split(/\n\n+/)[0]?.slice(0, 180) + "…"
    : null;

  return (
    <main className="shell">
      {/* ── Hero: featured question with backdrop ── */}
      {featured && featuredFilm && (
        <Link
          href={`/film/${featuredFilm.slug}/q/${featured.slug}`}
          style={{ textDecoration: "none", color: "inherit", display: "block" }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              minHeight: 240,
              borderRadius: 10,
              overflow: "hidden",
              marginBottom: 28,
              background: featuredBackdrop ? "none" : "var(--ink)",
            }}
          >
            {featuredBackdrop && (
              <img
                src={featuredBackdrop}
                alt={featuredFilm.title}
                loading="eager"
                fetchPriority="high"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            )}
            {/* Gradient overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to top, rgba(26,39,64,0.95) 30%, rgba(26,39,64,0.3) 100%)",
              }}
            />
            {/* Content */}
            <div
              style={{
                position: "relative",
                padding: "48px 28px 28px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                minHeight: 240,
              }}
            >
              <div className="ui" style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Featured Question
              </div>
              <h2 className="disp" style={{ fontSize: 24, color: "#fff", margin: 0, lineHeight: 1.3 }}>
                {featured.title}
              </h2>
              <div className="ui" style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>
                {featuredFilm.title} ({featuredFilm.year}) · dir. {featuredFilm.director}
              </div>
              {featuredTeaser && (
                <p className="reading" style={{ fontSize: 13.5, color: "rgba(255,255,255,0.75)", marginTop: 10, lineHeight: 1.5, maxWidth: 520 }}>
                  {featuredTeaser}
                </p>
              )}
            </div>
          </div>
        </Link>
      )}

      {/* ── Search bar ── */}
      <Link href="/film" className="field search" style={{ marginBottom: 24, display: "flex", textDecoration: "none", color: "var(--muted)" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
        Search a film to begin…
      </Link>

      {/* ── Stats strip ── */}
      <div
        style={{
          display: "flex",
          gap: 24,
          marginBottom: 24,
          fontSize: 12.5,
          color: "var(--muted)",
        }}
      >
        <span><strong style={{ color: "var(--ink)", fontSize: 16 }}>{totalQuestions ?? 0}</strong> questions</span>
        <span><strong style={{ color: "var(--ink)", fontSize: 16 }}>{totalFilms ?? 0}</strong> films</span>
        <span><strong style={{ color: "var(--ink)", fontSize: 16 }}>{(notableReaders ?? []).length}</strong> readers</span>
      </div>

      <hr className="rule" />

      {/* ── Trending Films (with posters) ── */}
      <div className="seclbl">Trending Films</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 12,
          marginTop: 12,
          marginBottom: 8,
        }}
      >
        {(trendingFilms ?? []).map((f: { id: string; title: string; year: number; slug: string; poster_path: string | null }) => (
          <Link
            key={f.id}
            href={`/film/${f.slug}`}
            style={{
              textDecoration: "none",
              color: "inherit",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                width: "100%",
                aspectRatio: "2/3",
                borderRadius: 6,
                overflow: "hidden",
                background: "var(--hairline)",
              }}
            >
              {f.poster_path && (
                <img
                  src={`${posterBase}/w342${f.poster_path}`}
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
              <div className="ui muted" style={{ fontSize: 11 }}>
                {f.year}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <hr className="rule" />

      {/* ── Questions needing a reading ── */}
      <div className="seclbl">Questions needing a reading</div>
      <div className="tick" />

      {unanswered.map((q: { id: string; title: string; slug: string; film: unknown }) => {
        const film = q.film as { title: string; year: number; slug: string; poster_path: string | null };
        return (
          <div key={q.id} className="qrow" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            {film.poster_path && (
              <img
                src={`${posterBase}/w92${film.poster_path}`}
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

      {unanswered.length === 0 && (
        <p className="ui muted" style={{ fontSize: 14 }}>All questions have readings — <Link href="/ask" className="accent" style={{ textDecoration: "none" }}>ask a new one</Link>.</p>
      )}

      <hr className="rule" />

      {/* ── Two-column: Active + Recently improved ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
        <div>
          <div className="seclbl">Active now</div>
          {(recentContribs ?? []).map((rc: { created_at: string; question: unknown }, i: number) => {
            const q = rc.question as { title: string; slug: string; film: { title: string; slug: string } };
            return (
              <Link key={i} href={`/film/${q.film.slug}/q/${q.slug}`} style={{ display: "block", marginTop: i === 0 ? 11 : 12, textDecoration: "none", color: "inherit" }}>
                <div className="disp" style={{ fontSize: 15 }}>{q.title}</div>
                <div className="ui muted" style={{ fontSize: 11, marginTop: 2 }}>{q.film.title} · {timeAgo(rc.created_at)}</div>
              </Link>
            );
          })}
          {(recentContribs ?? []).length === 0 && (
            <p className="ui muted" style={{ fontSize: 13, marginTop: 10 }}>No activity yet.</p>
          )}
        </div>
        <div>
          <div className="seclbl">Recently improved</div>
          {(recentlyImproved ?? []).map((ri: { updated_at: string; question: unknown }, i: number) => {
            const q = ri.question as { title: string; slug: string; film: { title: string; slug: string } };
            return (
              <Link key={i} href={`/film/${q.film.slug}/q/${q.slug}`} style={{ display: "block", marginTop: i === 0 ? 11 : 12, textDecoration: "none", color: "inherit" }}>
                <div className="disp" style={{ fontSize: 15 }}>{q.title}</div>
                <div className="ui muted" style={{ fontSize: 11, marginTop: 2 }}>{q.film.title} · updated {timeAgo(ri.updated_at)}</div>
              </Link>
            );
          })}
          {(recentlyImproved ?? []).length === 0 && (
            <p className="ui muted" style={{ fontSize: 13, marginTop: 10 }}>No updates yet.</p>
          )}
        </div>
      </div>

      <hr className="rule" />

      {/* ── Notable readers ── */}
      <div className="ui muted" style={{ fontSize: 12.5 }}>
        <span className="seclbl" style={{ marginRight: 10 }}>Notable readers</span>
        {(notableReaders ?? []).map((r: { username: string; display_name: string | null; reputation: number }, i: number) => (
          <span key={r.username}>
            {i > 0 && " · "}
            <Link href={`/u/${r.username}`} style={{ color: "var(--muted)", textDecoration: "none" }}>
              {r.display_name || r.username}
            </Link>
          </span>
        ))}
      </div>
    </main>
  );
}
