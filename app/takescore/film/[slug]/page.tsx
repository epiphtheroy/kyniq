import type { Metadata } from "next";
import ShareDock from "@/components/ShareDock";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import SiteNav from "@/components/home2/SiteNav";
import EntityTVHero from "@/components/EntityTVHero";
import ScoreDonut from "@/components/ScoreDonut";
import { CODEX_DIMS, takescoreDimUrl, type CodexDimGroup } from "@/lib/cinecodex_dims";
import { filmUrl } from "@/lib/urls";
import {
  verdictSentence,
  dimSentence,
  bandWord,
  confidenceSentence,
  standingSentence,
  extSentence,
} from "@/lib/takescore_prose";
import TowCard, { loadTow } from "@/components/read/TowCard";
import "./takescore-film.css";

// ISR (house pattern, see app/film/[slug]/page.tsx): nothing prebuilt, every
// slug rendered on demand and edge-cached via the Data Cache — never per-request.
export const revalidate = 300;
export const dynamicParams = true;
export async function generateStaticParams() { return []; }

const SITE = "https://metatake.net";
const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ slug: string }>; }

/** cinecodex_card v2 (migration 0046): comps entries are objects; the basket
 *  is a 20-row U-rank window with rank/year/poster, plus top-level rank fields. */
type CompFilm = { title: string; slug: string | null; poster_path: string | null };
type BasketRow = {
  title: string; slug: string; year: number | null; poster_path: string | null;
  rank: number | null; u: number; r: number; self: boolean;
};

type Card = {
  slug: string; title: string; year: number | null; director: string | null; poster_path: string | null;
  v: number; c: number; r: number; u: number; s: number;
  rank: number | null; rank_total: number | null;
  subs: Record<string, number | null>;
  comps: Record<string, (string | CompFilm)[] | null> | null;
  reliability: {
    n_samples: number | null; sd_v: number | null; sd_r: number | null;
    panel: string | null; prompt_version: string | null; flagged: boolean | null; scored_at: string | null;
  } | null;
  conf: number | null; tier: string | null; n_takes: number | null;
  ext: { imdb: number | null; rt: number | null; meta: number | null } | null;
  standing: { prestige: number | null; labels: string[] | null } | null;
  basket: BasketRow[] | null;
};

/** Normalize a comp to the v2 object shape (edge-cached v1 payloads may still
 *  carry bare title strings for one revalidate window). */
const compOf = (c: string | CompFilm): CompFilm =>
  typeof c === "string" ? { title: c, slug: null, poster_path: null } : c;

async function loadUncached(slug: string): Promise<Card | null> {
  const { data, error } = await db().rpc("cinecodex_card", { p_slug: slug });
  // THROW on transport/RPC errors — a thrown error is NOT stored by
  // unstable_cache, so a transient failure can never be cached as a
  // permanent "unscored" null (which 404s the page for a whole window).
  if (error) throw new Error(`cinecodex_card(${slug}): ${error.message}`);
  const card = data as Card | null;
  // The RPC returns null/empty json for unscored films — treat both as a miss.
  if (!card || !card.slug || card.v == null || card.u == null) return null;
  return card;
}

// Per-slug Data Cache entry so the route edge-caches instead of hitting the
// RPC per request (same pattern and reasoning as the film page's load()).
async function load(slug: string) {
  const cached = await unstable_cache(() => loadUncached(slug), ["takescore-film-card1", slug], {
    revalidate: 300,
    tags: [`takescore-film:${slug}`],
  })().catch(() => null);
  if (cached) return cached;
  // A cached null may be a poisoned entry from the pre-throw era (or the SWR
  // refresh aborted by notFound()). Double-check uncached before 404ing —
  // genuinely unscored films still miss, at one extra RPC on the rare 404 path.
  return loadUncached(slug).catch(() => null);
}

const trim155 = (s: string) => (s.length <= 155 ? s : `${s.slice(0, 152).replace(/\s+\S*$/, "")}…`);

function scoredDate(card: Card): string | null {
  const at = card.reliability?.scored_at;
  return at ? String(at).slice(0, 10) : null;
}

function scoredDateHuman(card: Card): string | null {
  const d = scoredDate(card);
  if (!d) return null;
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const card = await load(slug);
  if (!card) return {};
  const ts = Math.round(card.u);
  // Title-bearing verdict: the film's name in the first sentence makes a
  // stronger SERP snippet (entity mention in the meta description).
  const verdict = verdictSentence(card.v, card.c, card.r, card.u, card.title);
  const title = `${card.title}${card.year ? ` (${card.year})` : ""} TakeScore ${ts} — value, cost and risk, scored | Metatake`;
  return {
    // Absolute: the spec title already carries the brand; the root layout
    // template would otherwise append a second "· Metatake".
    title: { absolute: title },
    description: trim155(verdict),
    alternates: { canonical: `/takescore/film/${card.slug}` },
    openGraph: {
      title,
      description: trim155(verdict),
      url: `${SITE}/takescore/film/${card.slug}`,
      // images: omitted on purpose — the route's opengraph-image.tsx (branded
      // 1200×630 card with the TakeScore ring & rank badges) is auto-used and
      // shares far better than the bare TMDB poster.
    },
  };
}

// The three pillars, in the private Appraisal's naming (EvalCard's V Earned
// value / C Entry cost / R Risk). The sub lines are the public one-liners.
const GROUPS: { g: CodexDimGroup; ax: string; label: string; sub: string }[] = [
  { g: "value", ax: "V", label: "Earned value", sub: "what a serious viewer keeps — higher is better" },
  { g: "cost", ax: "C", label: "Entry cost", sub: "what it takes to unlock — a price, never a merit" },
  { g: "risk", ax: "R", label: "Risk", sub: "how it can go wrong — lower is safer" },
];

// Axis hexes = the shared cx-*/tsf-* light palette (value green / cost gray / risk red).
const AXIS_HEX: Record<CodexDimGroup, string> = {
  value: "#0F6E56",
  cost: "#8a8f98",
  risk: "#C8102E",
};

export default async function TakeScoreFilmPage({ params }: Props) {
  const { slug } = await params;
  const card = await load(slug);
  if (!card) notFound();
  const tow = await loadTow(slug);

  const ts = Math.round(card.u);
  const v = Math.round(card.v), c = Math.round(card.c), r = Math.round(card.r);
  const verdict = verdictSentence(card.v, card.c, card.r, card.u, card.title);
  const rel = card.reliability;
  const confLine = confidenceSentence(card.conf, card.tier, rel?.n_samples ?? null, rel?.sd_v ?? null, rel?.flagged ?? null);
  const standLine = standingSentence(card.standing?.prestige ?? null, card.standing?.labels ?? null);
  const ext = card.ext;
  const hasExt = !!ext && (ext.imdb != null || ext.rt != null || ext.meta != null);
  const extLine = hasExt ? extSentence(ext!.imdb, ext!.rt, ext!.meta, card.v) : null;
  const basket = card.basket ?? [];
  const rank = card.rank;
  const rankTotal = card.rank_total;
  const date = scoredDate(card);
  const dateHuman = scoredDateHuman(card);
  const canonical = `${SITE}/takescore/film/${card.slug}`;
  const nameYear = card.year ? `${card.title} (${card.year})` : card.title;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      // Review markup only when the score fits the declared 0–100 scale.
      // 339 films score negative (min −50): a negative ratingValue is "out of
      // range" to Google (GSC review-snippet error, 2026-07-11) and a negative
      // review snippet has no search value anyway — those pages ship no Review.
      ...(ts >= 0 ? [{
        "@type": "Review",
        "@id": `${canonical}#review`,
        url: canonical,
        name: `${nameYear} — TakeScore ${ts}`,
        itemReviewed: {
          "@type": "Movie",
          name: card.title,
          url: `${SITE}${filmUrl(card.slug)}`,
          ...(card.poster_path ? { image: `${IMG}/w500${card.poster_path}` } : {}),
          ...(card.director ? { director: { "@type": "Person", name: card.director } } : {}),
        },
        reviewRating: { "@type": "Rating", ratingValue: ts, worstRating: 0, bestRating: 100 },
        author: { "@type": "Person", name: "Wonwoo Yoon", url: `${SITE}/editor` },
        publisher: { "@type": "Organization", name: "Metatake", url: SITE },
        ...(date ? { datePublished: date } : {}),
        reviewBody: verdict,
      }] : []),
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE },
          { "@type": "ListItem", position: 2, name: "TakeScore", item: `${SITE}/takescore` },
          { "@type": "ListItem", position: 3, name: nameYear, item: canonical },
        ],
      },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mt-wrap lh tsf">
        <div className="lh-crumb">
          <Link href="/">Home</Link> › <Link href="/takescore">TakeScore</Link> › {card.title}
        </div>
        <EntityTVHero program={slug} reelSlugs={[slug]} label={nameYear} backdrop={null} />
        <h1 className="lh-h1">{nameYear} — TakeScore {ts}</h1>
        <div className="tsf-share">
          <ShareDock variant="bar" path={`/takescore/film/${card.slug}`} title={`${nameYear} — TakeScore ${ts}`}
            hook={`${nameYear} scores ${ts}/100 on TakeScore${card.rank && card.rank_total ? `, #${card.rank.toLocaleString()} of ${card.rank_total.toLocaleString()}` : ""} on Metatake — agree?`}
            saveType="film-takescore" saveRef={card.slug} />
          <ShareDock variant="fab" path={`/takescore/film/${card.slug}`} title={`${nameYear} — TakeScore ${ts}`} />
        </div>

        {/* ── Film hero — framed poster · title/director · the big TS ring ── */}
        <div className="tsf-hero">
          {card.poster_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="tsf-poster" src={`${IMG}/w342${card.poster_path}`} alt={`${card.title} poster`} width={110} height={165} />
          ) : (
            <div className="tsf-poster--e" aria-hidden="true" />
          )}
          <div className="tsf-hmeta">
            <div className="tsf-kicker tsf-kicker--tight">TakeScore™ appraisal</div>
            <div className="tsf-ftitle">{card.title}{card.year ? <small>{card.year}</small> : null}</div>
            {card.director ? <p className="tsf-dir">Directed by {card.director}{card.year ? ` · ${card.year}` : ""}</p> : null}
            <p style={{ margin: 0 }}>
              <Link className="tsf-openfilm" href={filmUrl(card.slug)}>Open the film page →</Link>
            </p>
          </div>
          <div className="tsf-tscell">
            <ScoreDonut val={card.u} color={AXIS_HEX.value} size={118} label="TakeScore · Net value" sub={`= V ${v} − λ·R (λ = 1)`} />
          </div>
        </div>

        {/* ── Verdict — quadrant sentence + formula line ── */}
        <section aria-labelledby="tsf-verdict-h" className="tsf-verdict">
          <div className="tsf-kicker">Verdict</div>
          <h2 className="tsf-h2" id="tsf-verdict-h">The verdict</h2>
          <p className="tsf-verdict-p">{verdict}</p>
          <p className="tsf-formula">
            TakeScore = Value − λ·Risk at λ = 1 → <b>{ts}</b>. Cost is a difficulty, not a value.
          </p>
        </section>

        {/* ── to.W — the curator's letter (addressed to. W. Heo, from. W. Yoon).
               Shared card; renders for every catalogued film, optional ones too. ── */}
        <TowCard tow={tow} filmTitle={card.title} />

        {/* ── Side by side · three pillars — V / C / R ring gauges + sub-scores ── */}
        <section aria-labelledby="tsf-dims-h">
          <div className="tsf-kicker">Scorecard</div>
          <h2 className="tsf-h2" id="tsf-dims-h">How {card.title} was scored</h2>
          <p className="tsf-sub">
            Thirteen sub-scores in three groups, each 0–100 against the fixed TakeScore rubric. Every dimension links
            to its own page — what it measures, the calibration ruler, the catalog&apos;s extremes. The comparison
            titles are this film&apos;s three measured nearest neighbors on that axis.
          </p>
          <div className="tsf-pillars">
            {GROUPS.map(({ g, ax, label, sub }) => {
              const axisScore = g === "value" ? v : g === "cost" ? c : r;
              return (
                <div className="tsf-pillar" key={g}>
                  <div className="tsf-pil-h">
                    <span className={`tsf-pil-ax tsf-${g[0]}`}>{ax}</span>
                    <span className="tsf-pil-name">{label}</span>
                  </div>
                  <div className="tsf-pil-gauge">
                    <ScoreDonut val={axisScore} color={AXIS_HEX[g]} size={96} sub={bandWord(g, axisScore)} />
                    <p className="tsf-pil-sub">{sub}</p>
                  </div>
                  {CODEX_DIMS.filter((d) => d.group === g).map((d) => {
                    const score = card.subs?.[d.key];
                    if (score == null) return null;
                    const comps = (card.comps?.[d.key] ?? []).map(compOf);
                    return (
                      <div className="tsf-dim" key={d.key}>
                        <div className="tsf-dim-t">
                          <Link className="tsf-dim-name" href={takescoreDimUrl(d.slug)}>{d.label}</Link>
                          <span className="tsf-dim-n">{Math.round(score)}</span>
                        </div>
                        <span className="tsf-bar"><i className={`tsf-${g[0]}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} /></span>
                        <div className="tsf-dim-band">{bandWord(g, score)}</div>
                        <p className="tsf-dim-s">{dimSentence(d.key, score)}</p>
                        {comps.length ? (
                          <div className="tsf-dim-comps">
                            <span className="tsf-comps-k">Scored alongside</span>
                            <span className="tsf-comps-row">
                              {comps.map((cf, i) => {
                                const thumb = cf.poster_path ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img className="tsf-thumb" src={`${IMG}/w92${cf.poster_path}`} alt="" width={28} height={42} loading="lazy" />
                                ) : (
                                  <span className="tsf-thumb tsf-thumb--e" aria-hidden="true" />
                                );
                                return cf.slug ? (
                                  <Link className="tsf-comp" href={`/takescore/film/${cf.slug}`} key={`${d.key}-${i}`} title={`Nearest measured neighbor on ${d.label} — ${cf.title}`}>
                                    {thumb}<span className="tsf-comp-t">{cf.title}</span>
                                  </Link>
                                ) : (
                                  <span className="tsf-comp tsf-comp--txt" key={`${d.key}-${i}`}>
                                    {thumb}<span className="tsf-comp-t">{cf.title}</span>
                                  </span>
                                );
                              })}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Confidence · Standing · External — separated cards, never blended ── */}
        <div className="tsf-kicker">Trust &amp; context</div>
        <div className="tsf-cards">
          <section aria-labelledby="tsf-conf-h" className="tsf-card">
            <h2 className="tsf-card-h" id="tsf-conf-h">Confidence &amp; reproducibility</h2>
            <p className="tsf-aside">Non-determinism, disclosed honestly</p>
            {card.conf != null ? (
              <div className="tsf-conf">
                <span className="tsf-conf-k">Measured confidence{card.tier ? ` · ${card.tier}` : ""}</span>
                <div className="tsf-conf-meter">
                  <span className="tsf-bar"><i className="tsf-v" style={{ width: `${Math.min(100, Math.max(0, card.conf))}%` }} /></span>
                  <span className="tsf-dim-n">{Math.round(card.conf)}</span>
                </div>
              </div>
            ) : null}
            <div className="tsf-kvs">
              {rel?.n_samples != null ? <div className="tsf-kv"><span className="k">n_samples</span><span className="v">{rel.n_samples}</span></div> : null}
              <div className="tsf-kv"><span className="k">sd_v</span><span className="v">{rel?.sd_v != null ? `±${rel.sd_v}` : "unmeasured (n=1)"}</span></div>
              {rel?.panel ? <div className="tsf-kv"><span className="k">panel</span><span className="v">{rel.panel}</span></div> : null}
              {rel?.prompt_version ? <div className="tsf-kv"><span className="k">rubric</span><span className="v">{rel.prompt_version}</span></div> : null}
              {rel?.flagged ? <div className="tsf-kv"><span className="k">flagged</span><span className="v">true</span></div> : null}
            </div>
            {confLine ? <p className="tsf-box-p">{confLine}</p> : null}
            <p className="tsf-note">
              AI-estimated (rubric {rel?.panel ?? "—"}{rel?.n_samples != null ? `, n=${rel.n_samples}` : ""}) — a
              judgment, not a fact.
            </p>
          </section>

          {standLine ? (
            <section aria-labelledby="tsf-stand-h" className="tsf-card">
              <h2 className="tsf-card-h" id="tsf-stand-h">Standing</h2>
              <p className="tsf-aside">A separate axis — never part of the TakeScore</p>
              <div className="tsf-chips">
                {card.standing?.prestige != null ? (
                  <span className="tsf-chip">Prestige <b>{Math.round(card.standing.prestige)}</b></span>
                ) : null}
                {(card.standing?.labels ?? []).map((l) => (
                  <span className="tsf-chip" key={l}>{l}</span>
                ))}
              </div>
              <p className="tsf-box-p">{standLine}</p>
            </section>
          ) : null}

          {hasExt ? (
            <section aria-labelledby="tsf-ext-h" className="tsf-card">
              <h2 className="tsf-card-h" id="tsf-ext-h">External signals</h2>
              <p className="tsf-aside">Alongside — not part of the score</p>
              <div className="tsf-mets">
                {ext!.imdb != null ? <div className="tsf-met"><span className="k">IMDb</span><span className="v">{ext!.imdb}<small>/10</small></span></div> : null}
                {ext!.rt != null ? <div className="tsf-met"><span className="k">Rotten Tomatoes</span><span className="v">{ext!.rt}<small>%</small></span></div> : null}
                {ext!.meta != null ? <div className="tsf-met"><span className="k">Metascore</span><span className="v">{ext!.meta}<small>/100</small></span></div> : null}
              </div>
              {extLine ? <p className="tsf-box-p">{extLine}</p> : null}
            </section>
          ) : null}
        </div>

        {/* ── Where it ranks — 20-row U-rank window with the film's position marked ── */}
        {basket.length ? (
          <section aria-labelledby="tsf-basket-h">
            <div className="tsf-kicker">Where it ranks</div>
            <h2 className="tsf-h2" id="tsf-basket-h">Where {card.title} ranks</h2>
            <p className="tsf-sub">
              {rank != null && rankTotal != null ? <><b>#{rank} of {rankTotal} by TakeScore.</b>{" "}</> : null}
              A 20-film window of the TakeScore ranking around this film — U = Value − λ·Risk at λ = 1; lower Risk is safer.
            </p>
            {rank != null && rankTotal != null && rankTotal > 1 ? (
              <div className="tsf-track" aria-hidden="true">
                <span>#1</span>
                <span className="tsf-track-bar"><i style={{ left: `${((rank - 1) / (rankTotal - 1)) * 100}%` }} /></span>
                <span>#{rankTotal}</span>
              </div>
            ) : null}
            <div className="tsf-ladder">
              <div className="tsf-lrow tsf-lhead" aria-hidden="true">
                <span className="tsf-lrank">#</span>
                <span />
                <span className="tsf-ltitle">Film</span>
                <span className="tsf-lu">U</span>
                <span className="tsf-lr">Risk</span>
              </div>
              {basket.map((b) => {
                const cells = (
                  <>
                    <span className="tsf-lrank">{b.rank ?? "—"}</span>
                    {b.poster_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="tsf-thumb" src={`${IMG}/w92${b.poster_path}`} alt="" width={28} height={42} loading="lazy" />
                    ) : (
                      <span className="tsf-thumb tsf-thumb--e" aria-hidden="true" />
                    )}
                    <span className="tsf-ltitle">
                      {b.title}{b.year ? <small> ({b.year})</small> : null}
                      {b.self ? <span className="tsf-lchip">This film</span> : null}
                    </span>
                    <span className="tsf-lu">{Math.round(b.u)}</span>
                    <span className="tsf-lr">{Math.round(b.r)}</span>
                  </>
                );
                return b.self ? (
                  <div className="tsf-lrow tsf-lself" key={b.slug}>{cells}</div>
                ) : (
                  <Link className="tsf-lrow" href={`/takescore/film/${b.slug}`} key={b.slug} title={`Open the appraisal for ${b.title}`}>
                    {cells}
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* ── Byline ── */}
        <footer className="tsf-byline">
          {dateHuman ? <>Published {dateHuman} · </> : null}
          {rel?.prompt_version ? <>Rubric {rel.prompt_version} · </> : null}
          By <Link href="/editor">Wonwoo Yoon</Link>, Editor — Metatake
          <br />
          <Link className="tsf-how" href="/takescore/about">How the TakeScore works →</Link>
        </footer>
      </div>
    </div>
  );
}
