"use client";

/**
 * OmniResults — the /search result body, rendered in the browser.
 *
 * WHY THIS IS NOT SERVER-RENDERED (owner's call, 2026-08-04)
 * ----------------------------------------------------------
 * Measured over one production day: /search took 15,139 function invocations
 * while mt_events logged 24 searches by an actual person. The other 99.8% is a
 * sweep that ignores robots.txt (`/search?*` has been Disallow'd for months) and
 * arrives over rotating residential proxies, so there is no IP or UA to block —
 * the owner's own note in lib: "nothing can be blocked, only made cheap".
 *
 * Server-rendering the results meant every one of those requests paid the full
 * engine: search_all (2,152 ms average) plus search_semantic (988 ms) plus the
 * essay leg. Search alone was 36% of all database time, and the resulting
 * contention is what pushed unrelated content pages into 504.
 *
 * So the server now returns the shell — nav, header, search box — and the
 * browser fetches the payload. A sweeper that does not run JavaScript gets an
 * empty shell for ~no database work. A person gets the same results one fetch
 * later, and /api/search/omni is CDN-cached, so the second visitor to a term
 * pays nothing either.
 *
 * There is no SEO cost: /search?q= is BOTH robots-Disallow'd and noindex, so no
 * crawler is supposed to be reading these results in the first place.
 *
 * Trade-off accepted with the decision: a reader with JavaScript off sees the
 * search box and no results. The <noscript> below tells them so rather than
 * leaving a blank column.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import TermHighlight from "@/components/TermHighlight";
import { KIND_LABEL, TMDB_IMG, type SearchHit, type SearchKind } from "@/lib/search-shared";
import type { EntityCard, OmniPayload } from "./payload";

const IMG = TMDB_IMG;

export const VERTICALS: { key: string; label: string; kinds?: SearchKind[] }[] = [
  { key: "all", label: "All" },
  { key: "films", label: "Films", kinds: ["film"] },
  { key: "people", label: "People", kinds: ["director", "theorist"] },
  { key: "writing", label: "Writing", kinds: ["essay", "reading", "figure"] },
  { key: "ideas", label: "Ideas", kinds: ["trope", "idea", "tradition", "archetype", "genre", "movement", "lineage"] },
  { key: "places", label: "Places", kinds: ["country", "city"] },
  { key: "news", label: "News", kinds: ["now"] },
  { key: "watch", label: "Watch", kinds: ["tv", "tv_list"] },
];

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

/* Loading state — the shell paints instantly, this holds the shape until the
   payload lands. Same markup the server used to stream as a Suspense fallback. */
export function OmniSkeleton() {
  return (
    <div className="ox-skel" aria-hidden="true">
      <div className="ox-skel__tabs">{[64, 48, 56, 60, 44].map((w, i) => <span key={i} style={{ width: w }} />)}</div>
      <div className="ox-skel__strip">{Array.from({ length: 7 }, (_, i) => <span key={i} />)}</div>
      <div className="ox-cols">
        <div>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="ox-skel__row">
              <div className="ox-skel__main"><span className="w40" /><span className="w90" /><span className="w75" /></div>
              <span className="ox-skel__thumb" />
            </div>
          ))}
        </div>
        <div className="ox-skel__card" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- body */

type State =
  | { s: "loading" }
  | { s: "ok"; p: OmniPayload }
  | { s: "error" };

export default function OmniResults({ term, verticalKey }: { term: string; verticalKey: string }) {
  const [state, setState] = useState<State>({ s: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ s: "loading" });
    fetch(`/api/search/omni?q=${encodeURIComponent(term)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((p: OmniPayload) => { if (alive) setState({ s: "ok", p }); })
      .catch(() => { if (alive) setState({ s: "error" }); });
    return () => { alive = false; };
  }, [term]);

  if (state.s === "loading") {
    return (
      <>
        <OmniSkeleton />
        <noscript>
          <p className="ox-empty">
            Metatake Search needs JavaScript to load results.{" "}
            <Link href="/film">Browse the film index</Link> or <Link href="/director">the directors</Link> instead.
          </p>
        </noscript>
      </>
    );
  }

  if (state.s === "error") {
    return (
      <p className="ox-empty">
        Search is having trouble right now. <Link href={`/search?q=${encodeURIComponent(term)}`}>Try again</Link>
        {" "}or <Link href={`/ask-ai?q=${encodeURIComponent(term)}`}>ask the AI</Link>.
      </p>
    );
  }

  const p = state.p;
  const vertical = VERTICALS.find((x) => x.key === verticalKey) ?? VERTICALS[0];
  const hitKey = (h: SearchHit) => `${h.kind}:${h.slug}:${h.film_slug ?? ""}`;

  const shown = vertical.kinds ? p.hits.filter((h) => vertical.kinds!.includes(h.kind)) : p.hits;
  const rows = (!vertical.kinds && p.card ? shown.filter((h) => hitKey(h) !== p.cardKey) : shown).slice(0, 30);

  return (
    <>
      <nav className="ox-tabs" aria-label="Result types">
        {VERTICALS.map((vt) => {
          const n = vt.kinds ? p.hits.filter((h) => vt.kinds!.includes(h.kind)).length : p.hits.length;
          if (vt.key !== "all" && n === 0) return null;
          return (
            <Link key={vt.key} href={`/search?q=${encodeURIComponent(term)}${vt.key === "all" ? "" : `&v=${vt.key}`}`}
              className={`ox-tab${vertical.key === vt.key ? " ox-tab--on" : ""}`}>
              {vt.label}{vt.key !== "all" ? <span className="ox-tab__n">{n}</span> : null}
            </Link>
          );
        })}
        <Link className="ox-tab ox-tab--ask" href={`/ask-ai?q=${encodeURIComponent(term)}`}>Ask AI →</Link>
      </nav>

      <p className="ox-count">{p.hits.length} results{p.semantic ? " · text + meaning" : ""}</p>

      {p.strip.length >= 3 && vertical.key === "all" ? (
        <div className="ox-strip" aria-label="Images">
          {p.strip.map((s, i) => (
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
            <p className="ox-empty">Nothing in this tab for “{term}” — try <Link href={`/search?q=${encodeURIComponent(term)}`}>All</Link> or <Link href={`/ask-ai?q=${encodeURIComponent(term)}`}>ask the AI</Link>.</p>
          ) : rows.map((h) => <ResultRow key={hitKey(h)} h={h} term={term} sitelinks />)}

          {vertical.key === "watch" ? (
            <p className="ox-empty" style={{ borderTop: "1px solid var(--hairline, #eee)", paddingTop: 14 }}>
              Every broadcast and playlist lives on <Link href="/tv/lists">METATAKE TV — browse all →</Link>
            </p>
          ) : null}

          {p.related.length ? (
            <div className="ox-related">
              <div className="ox-related__h">Related searches</div>
              <div className="ox-chips">
                {p.related.map((r) => <Link key={r} href={`/search?q=${encodeURIComponent(r)}`} className="ox-chip">⌕ {r}</Link>)}
              </div>
            </div>
          ) : null}
        </div>

        {vertical.key === "all" ? <Card card={p.card} term={term} /> : null}
      </div>
    </>
  );
}
