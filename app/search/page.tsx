import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import SearchBox from "@/components/SearchBox";
import { pageRobots } from "@/lib/seo";
import { createClient } from "@supabase/supabase-js";
import { runSearch } from "@/lib/search";
import { attachKwic } from "@/lib/kwic";
import TermHighlight from "@/components/TermHighlight";
import { KIND_LABEL, TMDB_IMG, type SearchHit, type SearchKind } from "@/lib/search-shared";

export const revalidate = 60;
export const metadata: Metadata = {
  alternates: { canonical: "/search" },
  title: "Search — Metatake",
  description:
    "Search 6,900 films, 27,000 close readings, 4,700 tropes, ideas, people and places — by keyword or by meaning, in any language.",
  robots: pageRobots(false), // search results — never index
};

const IMG = TMDB_IMG;

const PITCH =
  "6,900 films · 27,000 close readings · 4,700 tropes · ideas, people, places — searched by meaning, not just titles, in any language.";

const EXAMPLES: { q: string; label?: string }[] = [
  { q: "grief that refuses closure" },
  { q: "the ethics of watching" },
  { q: "cities at night" },
  { q: "time loops" },
  { q: "몸의 공포", label: "몸의 공포 (any language works)" },
  { q: "films that feel like a memory" },
  { q: "endings that re-read the whole film" },
];

interface Group {
  id: string;
  label: string;
  kinds: SearchKind[];
  render: "films" | "people" | "readings" | "chips" | "places" | "lists";
}
const GROUPS: Group[] = [
  { id: "films", label: "Films", kinds: ["film"], render: "films" },
  { id: "people", label: "People", kinds: ["director", "theorist"], render: "people" },
  { id: "readings", label: "Readings & Essays", kinds: ["essay", "reading", "figure"], render: "readings" },
  { id: "now", label: "Now Playing", kinds: ["now"], render: "readings" },
  { id: "ideas", label: "Ideas & Lenses", kinds: ["trope", "idea", "tradition", "archetype", "genre"], render: "chips" },
  { id: "places", label: "Places", kinds: ["country", "city"], render: "places" },
  { id: "lists", label: "Lists & Movements", kinds: ["lineage", "movement"], render: "lists" },
];

const keyOf = (h: SearchHit) => `${h.kind}:${h.slug}:${h.film_slug ?? ""}`;

function Meaning({ hit }: { hit: SearchHit }) {
  if (hit.match !== "meaning") return null;
  return (
    <span className="srp-sem" title="Found by meaning, not keywords">≈ meaning</span>
  );
}

// Highlights the searched term (underline via mark.term-hl in read.css) inside a
// result's title/sub, so the reader sees what matched.
const HL = ({ s, term }: { s: string | null | undefined; term: string }) => <TermHighlight text={s} terms={[term]} />;

function FilmCards({ items, term }: { items: SearchHit[]; term: string }) {
  return (
    <div className="srp-films">
      {items.map((h) => (
        <Link key={keyOf(h)} href={h.href} className="srp-card">
          {h.poster ? (
            <img className="srp-card__img" src={`${IMG}/w185${h.poster}`} alt="" loading="lazy" />
          ) : (
            <span className="srp-card__img srp-card__ph" aria-hidden="true">
              {(h.title || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="srp-card__t">
            <HL s={h.title} term={term} />
            {h.is_catalog === true ? <span className="t2-chip">catalog</span> : null}
          </span>
          {h.sub ? <span className="srp-card__sub"><HL s={h.sub} term={term} /></span> : null}
          <Meaning hit={h} />
        </Link>
      ))}
    </div>
  );
}

function PeopleRows({ items, term }: { items: SearchHit[]; term: string }) {
  return (
    <div className="srp-rows">
      {items.map((h) => (
        <Link key={keyOf(h)} href={h.href} className="srp-row">
          {h.poster ? (
            <img className="srp-ava" src={`${IMG}/w92${h.poster}`} alt="" loading="lazy" />
          ) : (
            <span className="srp-ava" aria-hidden="true">{(h.title || "?").slice(0, 1).toUpperCase()}</span>
          )}
          <span className="srp-row__main">
            <span className="srp-row__t"><HL s={h.title} term={term} /><Meaning hit={h} /></span>
            {h.sub ? <span className="srp-row__sub"><HL s={h.sub} term={term} /></span> : null}
          </span>
          <span className={`srp-row__kind sb-k-${h.kind}`}>{KIND_LABEL[h.kind]}</span>
        </Link>
      ))}
    </div>
  );
}

function ReadingRows({ items, term }: { items: SearchHit[]; term: string }) {
  return (
    <div className="srp-rows">
      {items.map((h) => (
        <Link key={keyOf(h)} href={h.href} className="srp-row">
          {h.poster ? (
            <img className="srp-thumb" src={`${IMG}/w92${h.poster}`} alt="" loading="lazy" />
          ) : (
            <span className="srp-thumb" aria-hidden="true">{(h.title || "?").slice(0, 1).toUpperCase()}</span>
          )}
          <span className="srp-row__main">
            <span className="srp-row__t"><HL s={h.title} term={term} /><Meaning hit={h} /></span>
            {h.sub ? <span className="srp-row__sub"><HL s={h.sub} term={term} />{h.year ? ` · ${h.year}` : ""}</span> : null}
          </span>
          <span className={`srp-row__kind sb-k-${h.kind}`}>{KIND_LABEL[h.kind]}</span>
        </Link>
      ))}
    </div>
  );
}

function IdeaChips({ items, term }: { items: SearchHit[]; term: string }) {
  return (
    <div className="srp-chips">
      {items.map((h) => (
        <Link key={keyOf(h)} href={h.href} className="srp-chip">
          <span className={`k sb-k-${h.kind}`}>{KIND_LABEL[h.kind]}</span>
          <span className="t"><HL s={h.title} term={term} /></span>
          <Meaning hit={h} />
        </Link>
      ))}
    </div>
  );
}

function PlaceRows({ items, term }: { items: SearchHit[]; term: string }) {
  return (
    <div className="srp-rows">
      {items.map((h) => (
        <Link key={keyOf(h)} href={h.href} className="srp-row">
          <span className="srp-pin" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.6" />
            </svg>
          </span>
          <span className="srp-row__main">
            <span className="srp-row__t"><HL s={h.title} term={term} /><Meaning hit={h} /></span>
            {h.sub ? <span className="srp-row__sub"><HL s={h.sub} term={term} /></span> : null}
          </span>
          <span className={`srp-row__kind sb-k-${h.kind}`}>{KIND_LABEL[h.kind]}</span>
        </Link>
      ))}
    </div>
  );
}

function ListRows({ items, term }: { items: SearchHit[]; term: string }) {
  return (
    <div className="srp-rows">
      {items.map((h) => (
        <Link key={keyOf(h)} href={h.href} className="srp-row">
          <span className="srp-row__main">
            <span className="srp-row__t"><HL s={h.title} term={term} /><Meaning hit={h} /></span>
            {h.sub ? <span className="srp-row__sub"><HL s={h.sub} term={term} /></span> : null}
          </span>
          <span className={`srp-row__kind sb-k-${h.kind}`}>{KIND_LABEL[h.kind]}</span>
        </Link>
      ))}
    </div>
  );
}

function ExampleChips({ withAsk, term }: { withAsk: boolean; term: string }) {
  return (
    <div className="srp-exq">
      {EXAMPLES.map((e) => (
        <Link key={e.q} href={`/search?q=${encodeURIComponent(e.q)}`}>{e.label ?? e.q}</Link>
      ))}
      {withAsk ? (
        <Link className="srp-ask" href={term ? `/ask?q=${encodeURIComponent(term)}` : "/ask"}>
          Ask metatake AI →
        </Link>
      ) : null}
    </div>
  );
}

interface Props { searchParams: Promise<{ q?: string }>; }

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();

  const result = term.length >= 2 ? await runSearch(term, { limit: 60 }) : null;
  let hits = result?.hits ?? [];

  // Keyword-in-context excerpts for essay hits: replace the "film · year" sub with
  // the passage of the essay body where the term (or the theorist/concept it names)
  // appears, so the quote actually contains what was searched. Reuses attachKwic.
  const essayHits = hits.filter((h) => h.kind === "essay" && h.film_slug);
  if (essayHits.length) {
    try {
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const kw = await attachKwic(sb, essayHits.map((h) => ({ film_slug: h.film_slug as string, desk_key: h.slug, excerpt: h.sub })), [term]);
      const byKey = new Map(kw.map((k) => [`${k.film_slug}/${k.desk_key}`, k.excerpt]));
      hits = hits.map((h) => (h.kind === "essay" && h.film_slug
        ? { ...h, sub: byKey.get(`${h.film_slug}/${h.slug}`) || h.sub } : h));
    } catch { /* keep the film · year subs */ }
  }
  const meaningCount = hits.filter((h) => h.match === "meaning").length;

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap" id="srp-top">
        <div className="srp-hero">
          <h1 className="mt-h1">Search</h1>
          <div style={{ margin: "12px 0 0" }}>
            <SearchBox variant="hero" />
          </div>
          <p className="srp-pitch">{PITCH}</p>
        </div>

        {term.length < 2 ? null : hits.length === 0 ? (
          <div className="srp-empty">
            <p className="srp-empty__t">Nothing surfaced for “{term}” — yet.</p>
            <p className="srp-empty__s">
              Try rephrasing it as a feeling, a scene, or a question — this search reads meaning, so
              “a marriage dissolving in silence” works better than a half-remembered title. Or hand it to the AI:{" "}
              <Link className="mt-link" href={`/ask?q=${encodeURIComponent(term)}`}>Ask metatake AI →</Link>
            </p>
          </div>
        ) : (
          <>
            <p className="srp-summary">
              <span className="n">{hits.length}</span> result{hits.length === 1 ? "" : "s"} for “{term}”
              {result?.semantic && meaningCount > 0 ? (
                <> — <span className="n">{meaningCount}</span> found by meaning</>
              ) : null}
            </p>
            {GROUPS.map((g) => {
              const items = hits.filter((h) => g.kinds.includes(h.kind));
              if (items.length === 0) return null;
              return (
                <section key={g.id} className="srp-group">
                  <h2 className="mt-h2">
                    {g.label} <span className="srp-count">{items.length}</span>
                  </h2>
                  {g.render === "films" ? <FilmCards items={items} term={term} /> :
                   g.render === "people" ? <PeopleRows items={items} term={term} /> :
                   g.render === "readings" ? <ReadingRows items={items} term={term} /> :
                   g.render === "chips" ? <IdeaChips items={items} term={term} /> :
                   g.render === "places" ? <PlaceRows items={items} term={term} /> :
                   <ListRows items={items} term={term} />}
                </section>
              );
            })}
          </>
        )}

        <section className="srp-band" aria-label="What this search can do">
          <h2 className="srp-band__h">Search deeper</h2>
          <p>
            This search reads meaning, not just keywords. It looks across 27,000 close readings, 6,900 films,
            4,700 tropes, plus ideas, people, places and lists — so you can search for a feeling, a question,
            or a half-remembered scene. Any language works: a Korean query will find English readings.
          </p>
          <ExampleChips withAsk term={term} />
        </section>

        <p className="srp-top">
          <a href="#srp-top">Back to top ↑ — new search</a>
        </p>
      </div>
    </div>
  );
}
