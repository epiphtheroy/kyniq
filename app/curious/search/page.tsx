import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import { DESKS, DESK_KEYS, deskByMode, mdToPlain } from "@/lib/desks";
import { ResultRow, type FilmArt } from "@/components/curious/ui";

/**
 * Curious search — ScreenRant-style results page ("SEARCHED" eyebrow, the
 * query as the headline, thumb-left result rows). Plain GET (?q=) so the
 * masthead form works without JS. Searches question titles, desk-essay titles,
 * film titles, AND the theorists/concepts each essay discusses (essay_entity_links)
 * — so a thinker's name ("Jean Baudrillard") finds the essays about them, not just
 * titles. Results link to the canonical reading pages.
 * Always noindex: infinite query space, no canonical content of its own.
 */

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type QRow = {
  slug: string; title: string; display_title: string | null; title_spoiler: boolean | null;
  spoiler_level: string | null; question_type: string | null; published_at: string | null;
  safe_hook: string | null;
  film: FilmArt;
};
type ERow = {
  mode: string; title: string; dek: string | null; spoiler_level: number | null;
  published_at: string | null; created_at: string;
  film: FilmArt;
};
type Hit = {
  key: string; href: string; title: string; tag: string; date: string | null;
  excerpt: string | null; spoilerNote: boolean; film: FilmArt;
};

const FILM_ART = "film:films!inner(slug, title, year, poster_path, backdrop_path, visible)";
const Q_COLS = `slug, title, display_title, title_spoiler, spoiler_level, question_type, published_at, safe_hook, ${FILM_ART}`;
const E_COLS = `mode, title, dek, spoiler_level, published_at, created_at, ${FILM_ART}`;

// PostgREST ilike pattern: escape its wildcards so the user's text is literal.
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

async function search(q: string): Promise<Hit[]> {
  const supabase = db();
  const pat = likePattern(q);
  const base = () =>
    supabase.from("questions").select(Q_COLS).eq("status", "published").eq("film.visible", true)
      .order("published_at", { ascending: false }).limit(24).abortSignal(AbortSignal.timeout(4500));
  const essBase = () =>
    supabase.from("essays").select(E_COLS).eq("lang", "en").eq("status", "verified").eq("film.visible", true)
      .order("published_at", { ascending: false, nullsFirst: false }).limit(24).abortSignal(AbortSignal.timeout(4500));
  // Entity leg — essays found by the theorist/concept they discuss (essay_entity_links,
  // pre-filtered to verified/en/visible). This is what makes "Jean Baudrillard" or
  // "hyperreality" surface the essays about them, not just title matches.
  const eelBase = () =>
    supabase.from("essay_entity_links")
      .select(`entity_name, essay:essays!inner(${E_COLS})`)
      .eq("essay.status", "verified").eq("essay.lang", "en").eq("essay.film.visible", true)
      .limit(30).abortSignal(AbortSignal.timeout(4500));

  const [qByTitle, qByFilm, eByTitle, eByFilm, eByEntity] = await Promise.all([
    base().ilike("title", pat),
    base().ilike("film.title", pat),
    essBase().ilike("title", pat),
    essBase().ilike("film.title", pat),
    eelBase().ilike("entity_name", pat),
  ]);

  const hits: Hit[] = [];
  const seen = new Set<string>();
  const pushQ = (r: QRow) => {
    const key = `q:${r.slug}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({
      key,
      href: `/film/${r.film.slug}/q/${r.slug}`,
      title: (r.title_spoiler && r.display_title) ? r.display_title : r.title,
      tag: r.question_type ?? "question",
      date: r.published_at,
      excerpt: r.safe_hook,
      spoilerNote: r.spoiler_level === "major",
      film: r.film,
    });
  };
  // `via` is set for entity matches (an essay found because it discusses that
  // theorist/concept, not because the query is in its title) — shown as context.
  const pushE = (r: ERow, via?: string) => {
    const desk = deskByMode(r.mode);
    if (!desk) return;
    const key = `e:${r.film.slug}:${r.mode}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({
      key,
      href: `/film/${r.film.slug}/${desk.key}`,
      title: mdToPlain(r.title),
      tag: via ? `${desk.label} · discusses ${via}` : desk.label,
      date: r.published_at ?? r.created_at,
      excerpt: r.dek ? mdToPlain(r.dek) : desk.blurb,
      spoilerNote: (r.spoiler_level ?? 0) >= 2,
      film: r.film,
    });
  };
  // Title matches first (strongest signal), then entity/discusses matches.
  ((qByTitle.data ?? []) as unknown as QRow[]).forEach((r) => pushQ(r));
  ((eByTitle.data ?? []) as unknown as ERow[]).forEach((r) => pushE(r));
  ((qByFilm.data ?? []) as unknown as QRow[]).forEach((r) => pushQ(r));
  ((eByFilm.data ?? []) as unknown as ERow[]).forEach((r) => pushE(r));
  ((eByEntity.data ?? []) as unknown as { entity_name: string; essay: ERow }[])
    .forEach((r) => pushE(r.essay, r.entity_name));

  hits.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return hits.slice(0, 40);
}

type Props = { searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  return {
    title: query ? `${query} — search · Curious` : "Search Curious",
    robots: { index: false, follow: true },
  };
}

export default async function CuriousSearch({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().slice(0, 100);
  let hits: Hit[] = [];
  if (query.length >= 2) {
    try {
      hits = await search(query);
    } catch {
      hits = [];
    }
  }

  return (
    <div className="cur-wrap">
      <div className="cur-searched">
        <div className="eyebrow"><span className="mag">⌕</span> Searched</div>
        <h1>
          {query
            ? <><span className="qm">&ldquo;</span>{query}<span className="qm">&rdquo;</span></>
            : <>Search Curious<span className="qm">.</span></>}
        </h1>
        <hr className="rule" />
        {query.length >= 2 ? (
          <p className="n">{hits.length === 40 ? "40+" : hits.length} result{hits.length === 1 ? "" : "s"} across questions and desk essays</p>
        ) : null}
      </div>

      <div className="cur-results">
        {query.length < 2 ? (
          <div className="cur-empty">
            Type a film, a question, or a desk into the search bar above — e.g.{" "}
            <Link href="/curious/search?q=ending">ending</Link>,{" "}
            <Link href="/curious/search?q=spirited%20away">Spirited Away</Link>,{" "}
            <Link href="/curious/search?q=theories">theories</Link>.
          </div>
        ) : hits.length === 0 ? (
          <div className="cur-empty">
            No questions or desk essays match &ldquo;{query}&rdquo;. Try a film title, or browse{" "}
            <Link href="/curious">all questions</Link> and the desks:{" "}
            {DESK_KEYS.map((k, i) => (
              <span key={k}>
                {i > 0 ? " · " : ""}
                <Link href={`/curious/${k}`}>{DESKS[k].label}</Link>
              </span>
            ))}
            . For the whole site — films, directors, ideas — use <Link href="/search">Metatake search</Link>.
          </div>
        ) : (
          hits.map((h) => (
            <ResultRow
              key={h.key}
              href={h.href}
              film={h.film}
              title={h.title}
              tag={h.tag}
              date={h.date}
              excerpt={h.excerpt}
              spoilerNote={h.spoilerNote}
            />
          ))
        )}
      </div>
    </div>
  );
}
