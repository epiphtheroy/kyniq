import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import SearchBox from "@/components/SearchBox";
import { pageRobots } from "@/lib/seo";
import { runSearch, type SearchHit, type SearchKind } from "@/lib/search";

export const revalidate = 60;
export const metadata: Metadata = {
  alternates: { canonical: "/search" },
  title: "Search — Metatake",
  description:
    "Search 6,900 films, 27,000 close readings, 4,700 tropes, ideas, people and places — by keyword or by meaning, in any language.",
  robots: pageRobots(false), // search results — never index
};

const IMG = "https://image.tmdb.org/t/p";

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
  { id: "readings", label: "Readings", kinds: ["reading", "figure"], render: "readings" },
  { id: "ideas", label: "Ideas & Lenses", kinds: ["trope", "idea", "tradition", "archetype", "genre"], render: "chips" },
  { id: "places", label: "Places", kinds: ["country", "city"], render: "places" },
  { id: "lists", label: "Lists & Movements", kinds: ["lineage", "movement"], render: "lists" },
];

const KIND_LABEL: Record<SearchKind, string> = {
  film: "Film", director: "Director", trope: "Trope", reading: "Reading",
  figure: "Figure", theorist: "Theorist", idea: "Idea", tradition: "Tradition",
  lineage: "List", movement: "Movement", archetype: "Archetype",
  country: "Place", city: "Place", genre: "Genre",
};

const keyOf = (h: SearchHit) => `${h.kind}:${h.slug}:${h.film_slug ?? ""}`;

function Meaning({ hit }: { hit: SearchHit }) {
  if (hit.match !== "meaning") return null;
  return (
    <span className="srp-sem" title="Found by meaning, not keywords">≈ meaning</span>
  );
}

function FilmCards({ items }: { items: SearchHit[] }) {
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
            {h.title}
            {h.is_catalog === true ? <span className="t2-chip">catalog</span> : null}
          </span>
          {h.sub ? <span className="srp-card__sub">{h.sub}</span> : null}
          <Meaning hit={h} />
        </Link>
      ))}
    </div>
  );
}

function PeopleRows({ items }: { items: SearchHit[] }) {
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
            <span className="srp-row__t">{h.title}<Meaning hit={h} /></span>
            {h.sub ? <span className="srp-row__sub">{h.sub}</span> : null}
          </span>
          <span className={`srp-row__kind sb-k-${h.kind}`}>{KIND_LABEL[h.kind]}</span>
        </Link>
      ))}
    </div>
  );
}

function ReadingRows({ items }: { items: SearchHit[] }) {
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
            <span className="srp-row__t">{h.title}<Meaning hit={h} /></span>
            {h.sub ? <span className="srp-row__sub">{h.sub}{h.year ? ` · ${h.year}` : ""}</span> : null}
          </span>
          <span className={`srp-row__kind sb-k-${h.kind}`}>{KIND_LABEL[h.kind]}</span>
        </Link>
      ))}
    </div>
  );
}

function IdeaChips({ items }: { items: SearchHit[] }) {
  return (
    <div className="srp-chips">
      {items.map((h) => (
        <Link key={keyOf(h)} href={h.href} className="srp-chip">
          <span className={`k sb-k-${h.kind}`}>{KIND_LABEL[h.kind]}</span>
          <span className="t">{h.title}</span>
          <Meaning hit={h} />
        </Link>
      ))}
    </div>
  );
}

function PlaceRows({ items }: { items: SearchHit[] }) {
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
            <span className="srp-row__t">{h.title}<Meaning hit={h} /></span>
            {h.sub ? <span className="srp-row__sub">{h.sub}</span> : null}
          </span>
          <span className={`srp-row__kind sb-k-${h.kind}`}>{KIND_LABEL[h.kind]}</span>
        </Link>
      ))}
    </div>
  );
}

function ListRows({ items }: { items: SearchHit[] }) {
  return (
    <div className="srp-rows">
      {items.map((h) => (
        <Link key={keyOf(h)} href={h.href} className="srp-row">
          <span className="srp-row__main">
            <span className="srp-row__t">{h.title}<Meaning hit={h} /></span>
            {h.sub ? <span className="srp-row__sub">{h.sub}</span> : null}
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
  const hits = result?.hits ?? [];
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
                  {g.render === "films" ? <FilmCards items={items} /> :
                   g.render === "people" ? <PeopleRows items={items} /> :
                   g.render === "readings" ? <ReadingRows items={items} /> :
                   g.render === "chips" ? <IdeaChips items={items} /> :
                   g.render === "places" ? <PlaceRows items={items} /> :
                   <ListRows items={items} />}
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
