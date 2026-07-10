import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { runSearch } from "@/lib/search";
import { attachKwic, kwic } from "@/lib/kwic";
import TermHighlight from "@/components/TermHighlight";
import SiteNav from "@/components/home2/SiteNav";
import { KIND_LABEL, TMDB_IMG, type SearchHit, type SearchKind } from "@/lib/search-shared";
import "./omni.css";

/**
 * Metatake Omni (/omni) — the search-first face of the site, benchmarked on
 * Yandex: one box, an entity "object card", an image strip, mixed results with
 * breadcrumbs + keyword-in-context snippets, verticals, related searches.
 * Server-rendered, no client JS required (plain GET form) — mobile-first.
 *
 * Engine: the unified hybrid runSearch (lexical v6 + essays-by-entity +
 * pgvector semantic, RRF-fused) — this page is presentation on top of it.
 */

const IMG = TMDB_IMG;

const VERTICALS: { key: string; label: string; kinds?: SearchKind[] }[] = [
  { key: "all", label: "All" },
  { key: "films", label: "Films", kinds: ["film"] },
  { key: "people", label: "People", kinds: ["director", "theorist"] },
  { key: "writing", label: "Writing", kinds: ["essay", "reading", "figure"] },
  { key: "ideas", label: "Ideas", kinds: ["trope", "idea", "tradition", "archetype", "genre", "movement", "lineage"] },
  { key: "places", label: "Places", kinds: ["country", "city"] },
  { key: "news", label: "News", kinds: ["now"] },
];

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/* ------------------------------------------------------------- entity card */

type FilmCard = {
  type: "film"; slug: string; title: string; year: number | null; director: string | null;
  director_slug: string | null; overview: string | null; poster_path: string | null;
  backdrop_path: string | null; runtime: number | null; genres: string[] | null;
  takescore: number | null; rank: number | null; rank_total: number | null;
  imdb: number | null; rt: number | null; metascore: number | null;
  honors: number; lineage: number; stills: { url: string; thumb: string }[];
};
type DirectorCard = {
  type: "director"; slug: string; name: string; profile_path: string | null;
  place_of_birth: string | null; birthday: string | null; bio: string | null;
  films: { slug: string; title: string; year: number | null; poster_path: string | null }[];
};
type TheoristCard = {
  type: "theorist"; slug: string; name: string; blurb: string | null;
  essays: { film_slug: string; desk_key: string; essay_title: string; poster_path: string | null }[];
};
type EntityCard = FilmCard | DirectorCard | TheoristCard | null;

async function loadEntityCard(hit: SearchHit | undefined): Promise<EntityCard> {
  if (!hit) return null;
  const sb = db();
  try {
    if (hit.kind === "film") {
      const { data: f } = await sb.from("films")
        .select("id, slug, title, year, director, director_slug, overview, poster_path, backdrop_path, runtime, genres")
        .eq("slug", hit.slug).maybeSingle();
      if (!f) return null;
      const [codexRes, ratRes, honRes, stillRes, linRes] = await Promise.all([
        sb.rpc("cinecodex_for", { p_slug: f.slug }),
        sb.from("film_ratings").select("imdb_rating, rt_tomatometer, metascore").eq("film_id", f.id).maybeSingle(),
        sb.from("film_wd_honors").select("id", { count: "exact", head: true }).eq("film_id", f.id),
        sb.from("media").select("url, thumbnail_url").eq("entity_type", "film").eq("entity_id", f.id)
          .eq("kind", "image").eq("status", "published").order("position").limit(10),
        sb.from("film_lineage").select("id", { count: "exact", head: true }).eq("film_id", f.id),
      ]);
      const cx = (codexRes.data ?? null) as { u?: number; rank?: number; rank_total?: number } | null;
      const rat = ratRes.data as { imdb_rating: number | null; rt_tomatometer: number | null; metascore: number | null } | null;
      return {
        type: "film", slug: f.slug, title: f.title, year: f.year, director: f.director,
        director_slug: f.director_slug, overview: f.overview, poster_path: f.poster_path,
        backdrop_path: f.backdrop_path, runtime: f.runtime, genres: f.genres,
        takescore: cx?.u != null ? Math.round(cx.u) : null,
        rank: cx?.rank ?? null, rank_total: cx?.rank_total ?? null,
        imdb: rat?.imdb_rating ?? null, rt: rat?.rt_tomatometer ?? null, metascore: rat?.metascore ?? null,
        honors: honRes.count ?? 0,
        lineage: linRes.count ?? 0,
        stills: ((stillRes.data ?? []) as { url: string; thumbnail_url: string }[])
          .map((s) => ({ url: s.url, thumb: s.thumbnail_url })),
      };
    }
    if (hit.kind === "director") {
      const { data: d } = await sb.from("directors")
        .select("slug, name, profile_path, place_of_birth, birthday, bio").eq("slug", hit.slug).maybeSingle();
      if (!d) return null;
      const { data: films } = await sb.from("films")
        .select("slug, title, year, poster_path").eq("director_slug", d.slug)
        .not("poster_path", "is", null).order("year", { ascending: false }).limit(12);
      return { type: "director", ...d, films: (films ?? []) as DirectorCard["films"] };
    }
    if (hit.kind === "theorist") {
      const { data: t } = await sb.from("theorists").select("slug, name, blurb").eq("slug", hit.slug).maybeSingle();
      if (!t) return null;
      const { data: eel } = await sb.from("essay_entity_links")
        .select("film_slug, desk_key, essay_title").eq("entity_type", "theorist").eq("entity_slug", t.slug).limit(6);
      const links = (eel ?? []) as { film_slug: string; desk_key: string; essay_title: string }[];
      const slugs = [...new Set(links.map((l) => l.film_slug))];
      const posters = new Map<string, string | null>();
      if (slugs.length) {
        const { data: fs } = await sb.from("films").select("slug, poster_path").in("slug", slugs);
        for (const f of (fs ?? []) as { slug: string; poster_path: string | null }[]) posters.set(f.slug, f.poster_path);
      }
      const seen = new Set<string>();
      const essays = links.filter((l) => {
        const k = `${l.film_slug}/${l.desk_key}`;
        if (seen.has(k)) return false;
        seen.add(k); return true;
      }).map((l) => ({ ...l, poster_path: posters.get(l.film_slug) ?? null }));
      return { type: "theorist", ...t, essays };
    }
  } catch { /* the card is garnish — results still render */ }
  return null;
}

/* ------------------------------------------------------------------ pieces */

const HL = ({ s, term }: { s: string | null | undefined; term: string }) => (
  <TermHighlight text={s} terms={[term]} />
);

function crumbOf(href: string): string {
  return "metatake.net" + href.split("?")[0].split("/").filter(Boolean).map((p) => ` › ${decodeURIComponent(p)}`).join("");
}

// What mediated a meaning-match: the embedding space the hit was found in.
// Named so the reader knows WHICH text/profile carried the semantic link.
const SEM_VIA: Partial<Record<SearchHit["kind"], string>> = {
  reading: "the reading's text", essay: "the essay's text", trope: "the trope's description",
  film: "the film's taste profile", director: "the director's style profile",
  tradition: "the theory canon", archetype: "the archetype's definition",
};

function SemBadge({ h }: { h: SearchHit }) {
  if (h.match === "text" || h.sem == null) return null;
  const pct = Math.round(h.sem * 100);
  const via = SEM_VIA[h.kind] ?? `this ${KIND_LABEL[h.kind].toLowerCase()}`;
  return (
    <span className="ox-sem" title={`Semantic match — cosine similarity ${pct}% via ${via}`}>
      ≈ {pct}% by meaning · via {via}
    </span>
  );
}

// Yandex-style sitelinks under a film row — only the always-resolvable surfaces
// (Afterlife/Lineage are publish-gated per film; they live on the entity card
// where the counts are checked first).
function FilmSitelinks({ slug }: { slug: string }) {
  return (
    <div className="ox-r__links">
      <Link href={`/film/${slug}/credits`}>Credits</Link>
      <Link href={`/takescore/film/${slug}`}>TakeScore</Link>
      <Link href={`/film/${slug}/gallery`}>Gallery</Link>
    </div>
  );
}

function ResultRow({ h, term, sitelinks }: { h: SearchHit; term: string; sitelinks?: boolean }) {
  return (
    <article className="ox-r">
      <div className="ox-r__main">
        <div className="ox-r__crumb">{crumbOf(h.href)}<span className={`ox-k ox-k--${h.kind}`}>{KIND_LABEL[h.kind]}</span></div>
        <Link href={h.href} className="ox-r__t"><HL s={h.title} term={term} />{h.year ? <span className="ox-r__y"> ({h.year})</span> : null}</Link>
        {h.sub ? <p className="ox-r__s"><HL s={h.sub} term={term} /></p> : null}
        <SemBadge h={h} />
        {sitelinks && h.kind === "film" ? <FilmSitelinks slug={h.slug} /> : null}
      </div>
      {h.poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <Link href={h.href} className="ox-r__img"><img src={`${IMG}/w185${h.poster}`} alt="" loading="lazy" /></Link>
      ) : null}
    </article>
  );
}

function Card({ card, term }: { card: EntityCard; term: string }) {
  if (!card) return null;
  if (card.type === "film") {
    return (
      <aside className="ox-card">
        {card.backdrop_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="ox-card__bd" src={`${IMG}/w780${card.backdrop_path}`} alt="" />
        ) : null}
        <div className="ox-card__head">
          {card.poster_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="ox-card__poster" src={`${IMG}/w185${card.poster_path}`} alt={card.title} />
          ) : null}
          <div>
            <div className="ox-card__kind">Film</div>
            <h2 className="ox-card__t"><Link href={`/film/${card.slug}`}>{card.title}{card.year ? ` (${card.year})` : ""}</Link></h2>
            <div className="ox-card__meta">
              {card.director ? (card.director_slug
                ? <Link href={`/director/${card.director_slug}`}>{card.director}</Link>
                : <span>{card.director}</span>) : null}
              {card.runtime ? <span> · {card.runtime} min</span> : null}
              {card.genres?.length ? <span> · {card.genres.slice(0, 3).join(", ")}</span> : null}
            </div>
            <div className="ox-card__scores">
              {card.takescore != null ? (
                <Link href={`/takescore/film/${card.slug}`} className="ox-score" title="TakeScore">
                  <b>{card.takescore}</b> TakeScore{card.rank && card.rank_total ? ` · #${card.rank.toLocaleString()} of ${card.rank_total.toLocaleString()}` : ""}
                </Link>
              ) : null}
              {card.imdb != null ? <span className="ox-ext">IMDb {card.imdb}</span> : null}
              {card.rt != null ? <span className="ox-ext">RT {card.rt}%</span> : null}
              {card.metascore != null ? <span className="ox-ext">Meta {card.metascore}</span> : null}
            </div>
          </div>
        </div>
        {card.overview ? <p className="ox-card__ov"><HL s={card.overview} term={term} /></p> : null}
        <div className="ox-card__links">
          <Link href={`/film/${card.slug}`}>Overview</Link>
          <Link href={`/takescore/film/${card.slug}`}>TakeScore</Link>
          {card.honors > 0 ? <Link href={`/film/${card.slug}/reception`}>Afterlife · {card.honors} honors</Link> : null}
          {card.lineage >= 3 ? <Link href={`/film/lineage/${card.slug}`}>Lineage · {card.lineage} listings</Link> : null}
          <Link href={`/film/${card.slug}/credits`}>Credits</Link>
          <Link href={`/film/${card.slug}/gallery`}>Gallery</Link>
        </div>
      </aside>
    );
  }
  if (card.type === "director") {
    return (
      <aside className="ox-card">
        <div className="ox-card__head">
          {card.profile_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="ox-card__poster ox-card__poster--person" src={`${IMG}/w185${card.profile_path}`} alt={card.name} />
          ) : null}
          <div>
            <div className="ox-card__kind">Director</div>
            <h2 className="ox-card__t"><Link href={`/director/${card.slug}`}>{card.name}</Link></h2>
            <div className="ox-card__meta">
              {card.place_of_birth ? <span>{card.place_of_birth}</span> : null}
              {card.birthday ? <span> · b. {card.birthday.slice(0, 4)}</span> : null}
            </div>
          </div>
        </div>
        {card.bio ? <p className="ox-card__ov">{card.bio.slice(0, 260)}{card.bio.length > 260 ? "…" : ""}</p> : null}
        {card.films.length ? (
          <div className="ox-strip ox-strip--inCard">
            {card.films.map((f) => (
              <Link key={f.slug} href={`/film/${f.slug}`} className="ox-strip__it" title={`${f.title}${f.year ? ` (${f.year})` : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}/w185${f.poster_path}`} alt={f.title} loading="lazy" />
              </Link>
            ))}
          </div>
        ) : null}
        <div className="ox-card__links">
          <Link href={`/director/${card.slug}`}>Profile</Link>
          <Link href={`/director/${card.slug}/takescore`}>Films by TakeScore</Link>
          <Link href={`/director/${card.slug}/honors`}>Honors</Link>
          <Link href={`/director/${card.slug}/start`}>Where to start</Link>
        </div>
      </aside>
    );
  }
  return (
    <aside className="ox-card">
      <div className="ox-card__head">
        <div>
          <div className="ox-card__kind">Theorist</div>
          <h2 className="ox-card__t"><Link href={`/theorist/${card.slug}`}>{card.name}</Link></h2>
        </div>
      </div>
      {card.blurb ? <p className="ox-card__ov"><HL s={card.blurb} term={term} /></p> : null}
      {card.essays.length ? (
        <div className="ox-card__essays">
          {card.essays.slice(0, 4).map((e) => (
            <Link key={`${e.film_slug}/${e.desk_key}`} href={`/film/${e.film_slug}/${e.desk_key}`} className="ox-card__essay">
              {e.poster_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${IMG}/w92${e.poster_path}`} alt="" loading="lazy" />
              ) : null}
              <span>{e.essay_title}</span>
            </Link>
          ))}
        </div>
      ) : null}
      <div className="ox-card__links">
        <Link href={`/theorist/${card.slug}`}>Full profile & readings</Link>
        <Link href="/theorist">All theorists</Link>
      </div>
    </aside>
  );
}

/* --------------------------------------------------------------- the page */

interface Props { searchParams: Promise<{ q?: string; v?: string }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  return {
    title: term ? `${term} — Metatake Omni` : "Metatake Omni — search everything in film",
    description: "One box over all of Metatake: 6,900 films, 27,000 readings, directors, theorists, ideas, places and the news — text or meaning, any language.",
    alternates: { canonical: "/omni" },
    robots: term ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function OmniPage({ searchParams }: Props) {
  const { q, v } = await searchParams;
  const term = (q ?? "").trim().slice(0, 100);
  const vertical = VERTICALS.find((x) => x.key === (v ?? "all")) ?? VERTICALS[0];

  /* ---------- empty state: the Yandex-style home ---------- */
  if (term.length < 2) {
    let trending: string[] = [];
    try {
      const { data } = await db().from("now_articles").select("keyword").eq("status", "published")
        .order("published_at", { ascending: false }).limit(6);
      trending = [...new Set(((data ?? []) as { keyword: string | null }[]).map((r) => r.keyword).filter(Boolean) as string[])];
    } catch { /* chips are garnish */ }
    const examples = ["기생충", "hyperreality", "Tarkovsky", "a marriage dissolving in silence", "film noir", "Jean Baudrillard"];
    return (
      <div className="mt ox-home">
        <SiteNav />
        <main className="ox-home__main">
          <h1 className="ox-logo">Metatake <span>Omni</span></h1>
          <p className="ox-tag">Every film, reading, person, idea and place on Metatake — one box. Text or meaning, any language.</p>
          <form action="/omni" method="get" role="search" className="ox-box ox-box--big">
            <input name="q" type="search" placeholder="Search everything…" aria-label="Search everything on Metatake" autoComplete="off" />
            <button type="submit" aria-label="Search">⌕</button>
          </form>
          <div className="ox-chips">
            {trending.map((t) => <Link key={t} href={`/omni?q=${encodeURIComponent(t)}`} className="ox-chip ox-chip--hot">↗ {t}</Link>)}
            {examples.map((t) => <Link key={t} href={`/omni?q=${encodeURIComponent(t)}`} className="ox-chip">{t}</Link>)}
          </div>
          <p className="ox-foot">6,900 films · 27,000 readings · 4,700 tropes · 3,700 theorists · the Atlas · the news<br />
            <Link href="/ask">Prefer an answer, not results? Ask Metatake AI →</Link></p>
        </main>
      </div>
    );
  }

  /* ---------- results ---------- */
  const result = await runSearch(term, { limit: 80 });
  let hits = result.hits;

  // KWIC snippets for essays: quote the passage where the term (or the entity it
  // names) appears, not the film title.
  const essayHits = hits.filter((h) => h.kind === "essay" && h.film_slug);
  if (essayHits.length) {
    try {
      const kw = await attachKwic(db(), essayHits.map((h) => ({ film_slug: h.film_slug as string, desk_key: h.slug, excerpt: h.sub })), [term]);
      const byKey = new Map(kw.map((k) => [`${k.film_slug}/${k.desk_key}`, k.excerpt]));
      hits = hits.map((h) => (h.kind === "essay" && h.film_slug ? { ...h, sub: byKey.get(`${h.film_slug}/${h.slug}`) || h.sub } : h));
    } catch { /* keep subs */ }
  }

  // Reading snippets: replace the bare film-title sub with the take's own "leap"
  // line (its argumentative core), keyword-centered — the reader sees WHY the
  // reading matched, not just where it lives.
  const readingHits = hits.filter((h) => h.kind === "reading").slice(0, 12);
  if (readingHits.length) {
    try {
      const { data } = await db().from("takes")
        .select("leap, figure:figures!inner(slug)")
        .in("figure.slug", readingHits.map((h) => h.slug))
        .eq("status", "published").limit(40);
      const bySlug = new Map<string, string>();
      for (const r of (data ?? []) as unknown as { leap: string | null; figure: { slug: string } }[]) {
        if (r.figure?.slug && r.leap && !bySlug.has(r.figure.slug)) bySlug.set(r.figure.slug, r.leap);
      }
      hits = hits.map((h) => (h.kind === "reading" && bySlug.has(h.slug)
        ? { ...h, sub: kwic(bySlug.get(h.slug)!, [term], 150) } : h));
    } catch { /* keep film-title subs */ }
  }

  // Object card = the first ENTITY near the top (Yandex shows the object card even
  // when a list item edges it in fused rank — e.g. "parasite" can rank the trope
  // "The Title Names The Parasite…" #1, but the card should still be the film).
  const cardHit = hits.slice(0, 6).find((h) => ["film", "director", "theorist"].includes(h.kind));
  const card = await loadEntityCard(cardHit);

  const shown = vertical.kinds ? hits.filter((h) => vertical.kinds!.includes(h.kind)) : hits;
  // The entity card already owns its hit — don't repeat it as a row on "All".
  const rows = (!vertical.kinds && card ? shown.filter((h) => h !== cardHit) : shown).slice(0, 30);

  // Image strip: entity stills first, then poster'd hits (films/readings), deduped.
  const strip: { href: string; src: string; label: string }[] = [];
  if (card?.type === "film") for (const s of card.stills.slice(0, 8)) strip.push({ href: `/film/${card.slug}/gallery`, src: s.thumb, label: card.title });
  const seenPoster = new Set<string>();
  for (const h of hits) {
    if (!h.poster || seenPoster.has(h.poster)) continue;
    if (card?.type === "film" && h === cardHit) continue;
    seenPoster.add(h.poster);
    strip.push({ href: h.href, src: `${IMG}/w185${h.poster}`, label: h.title });
    if (strip.length >= 14) break;
  }

  // Related searches: other entity names in the result set = what people mean next.
  const related = [...new Set(hits
    .filter((h) => ["director", "theorist", "idea", "trope", "tradition", "movement"].includes(h.kind))
    .map((h) => h.title)
    .filter((t) => t.toLowerCase() !== term.toLowerCase()))].slice(0, 8);

  const counts = new Map<string, number>();
  for (const vt of VERTICALS) {
    counts.set(vt.key, vt.kinds ? hits.filter((h) => vt.kinds!.includes(h.kind)).length : hits.length);
  }

  return (
    <div className="mt ox">
      <SiteNav />
      <div className="ox-wrap">
        <header className="ox-head">
          <Link href="/omni" className="ox-logo ox-logo--sm">Metatake <span>Omni</span></Link>
          <form action="/omni" method="get" role="search" className="ox-box">
            <input name="q" type="search" defaultValue={term} aria-label="Search everything on Metatake" autoComplete="off" />
            <button type="submit" aria-label="Search">⌕</button>
          </form>
        </header>

        <nav className="ox-tabs" aria-label="Result types">
          {VERTICALS.map((vt) => {
            const n = counts.get(vt.key) ?? 0;
            if (vt.key !== "all" && n === 0) return null;
            return (
              <Link key={vt.key} href={`/omni?q=${encodeURIComponent(term)}${vt.key === "all" ? "" : `&v=${vt.key}`}`}
                className={`ox-tab${vertical.key === vt.key ? " ox-tab--on" : ""}`}>
                {vt.label}{vt.key !== "all" ? <span className="ox-tab__n">{n}</span> : null}
              </Link>
            );
          })}
          <Link className="ox-tab ox-tab--ask" href={`/ask?q=${encodeURIComponent(term)}`}>Ask AI →</Link>
        </nav>

        <p className="ox-count">{hits.length} results{result.semantic ? " · text + meaning" : ""} · {result.took} ms</p>

        {strip.length >= 3 && vertical.key === "all" ? (
          <div className="ox-strip" aria-label="Images">
            {strip.map((s, i) => (
              <Link key={i} href={s.href} className="ox-strip__it" title={s.label}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt={s.label} loading={i > 4 ? "lazy" : undefined} />
              </Link>
            ))}
          </div>
        ) : null}

        <div className="ox-cols">
          <div className="ox-results">
            {rows.length === 0 ? (
              <p className="ox-empty">Nothing in this tab for “{term}” — try <Link href={`/omni?q=${encodeURIComponent(term)}`}>All</Link> or <Link href={`/ask?q=${encodeURIComponent(term)}`}>ask the AI</Link>.</p>
            ) : rows.map((h) => <ResultRow key={`${h.kind}:${h.slug}:${h.film_slug ?? ""}`} h={h} term={term} sitelinks />)}

            {related.length ? (
              <div className="ox-related">
                <div className="ox-related__h">Related searches</div>
                <div className="ox-chips">
                  {related.map((r) => <Link key={r} href={`/omni?q=${encodeURIComponent(r)}`} className="ox-chip">⌕ {r}</Link>)}
                </div>
              </div>
            ) : null}
          </div>

          {vertical.key === "all" ? <Card card={card} term={term} /> : null}
        </div>
      </div>
    </div>
  );
}
