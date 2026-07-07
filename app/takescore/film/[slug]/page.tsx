import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import SiteNav from "@/components/home2/SiteNav";
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

type Card = {
  slug: string; title: string; year: number | null; director: string | null; poster_path: string | null;
  v: number; c: number; r: number; u: number; s: number;
  subs: Record<string, number | null>;
  comps: Record<string, string[] | null> | null;
  reliability: {
    n_samples: number | null; sd_v: number | null; sd_r: number | null;
    panel: string | null; prompt_version: string | null; flagged: boolean | null; scored_at: string | null;
  } | null;
  conf: number | null; tier: string | null; n_takes: number | null;
  ext: { imdb: number | null; rt: number | null; meta: number | null } | null;
  standing: { prestige: number | null; labels: string[] | null } | null;
  basket: { title: string; slug: string; u: number; r: number; self: boolean }[] | null;
};

async function loadUncached(slug: string): Promise<Card | null> {
  const { data } = await db().rpc("cinecodex_card", { p_slug: slug });
  const card = data as Card | null;
  // The RPC returns null/empty json for unscored films — treat both as a miss.
  if (!card || !card.slug || card.v == null || card.u == null) return null;
  return card;
}

// Per-slug Data Cache entry so the route edge-caches instead of hitting the
// RPC per request (same pattern and reasoning as the film page's load()).
function load(slug: string) {
  return unstable_cache(() => loadUncached(slug), ["takescore-film-card1", slug], {
    revalidate: 300,
    tags: [`takescore-film:${slug}`],
  })();
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
  const verdict = verdictSentence(card.v, card.c, card.r, card.u);
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
      ...(card.poster_path ? { images: [{ url: `${IMG}/w500${card.poster_path}` }] } : {}),
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

export default async function TakeScoreFilmPage({ params }: Props) {
  const { slug } = await params;
  const card = await load(slug);
  if (!card) notFound();

  const ts = Math.round(card.u);
  const v = Math.round(card.v), c = Math.round(card.c), r = Math.round(card.r);
  const verdict = verdictSentence(card.v, card.c, card.r, card.u);
  const rel = card.reliability;
  const confLine = confidenceSentence(card.conf, card.tier, rel?.n_samples ?? null, rel?.sd_v ?? null, rel?.flagged ?? null);
  const standLine = standingSentence(card.standing?.prestige ?? null, card.standing?.labels ?? null);
  const ext = card.ext;
  const hasExt = !!ext && (ext.imdb != null || ext.rt != null || ext.meta != null);
  const extLine = hasExt ? extSentence(ext!.imdb, ext!.rt, ext!.meta, card.v) : null;
  const basket = card.basket ?? [];
  const date = scoredDate(card);
  const dateHuman = scoredDateHuman(card);
  const canonical = `${SITE}/takescore/film/${card.slug}`;
  const nameYear = card.year ? `${card.title} (${card.year})` : card.title;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
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
      },
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
        <h1 className="lh-h1">{nameYear} — TakeScore {ts}</h1>

        {/* ── Film hero — poster · title/director · the big mono net-value box ── */}
        <div className="tsf-hero">
          {card.poster_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="tsf-poster" src={`${IMG}/w342${card.poster_path}`} alt={`${card.title} poster`} width={110} height={165} />
          ) : (
            <div className="tsf-poster--e" aria-hidden="true" />
          )}
          <div className="tsf-hmeta">
            <div className="tsf-ftitle">{card.title}{card.year ? <small>{card.year}</small> : null}</div>
            {card.director ? <p className="tsf-dir">Directed by {card.director}{card.year ? ` · ${card.year}` : ""}</p> : null}
            <p style={{ margin: 0 }}>
              <Link className="tsf-openfilm" href={filmUrl(card.slug)}>Open the film page →</Link>
            </p>
          </div>
          <div className="tsf-ubox">
            <span className="n">{ts}</span>
            <span className="lab">
              <span className="k">TS · Net value</span>
              <span className="d">= V {v} − λ·R (λ = 1)</span>
            </span>
          </div>
        </div>

        {/* ── Verdict — quadrant sentence + formula line ── */}
        <section aria-labelledby="tsf-verdict-h" className="tsf-verdict">
          <h2 className="tsf-h2" id="tsf-verdict-h">The verdict</h2>
          <p className="tsf-verdict-p">{verdict}</p>
          <p className="tsf-formula">
            TakeScore = Value − λ·Risk at λ = 1 → <b>{ts}</b>. Cost is a difficulty, not a value.
          </p>
        </section>

        {/* ── Side by side · three pillars — V / C / R with their sub-scores ── */}
        <section aria-labelledby="tsf-dims-h">
          <h2 className="tsf-h2" id="tsf-dims-h">How we scored it</h2>
          <p className="tsf-sub">
            Thirteen sub-scores in three groups, each 0–100 against the fixed CineCodex rubric. Every dimension links
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
                    <span className="tsf-pil-score">{axisScore}</span>
                  </div>
                  <div className="tsf-pil-band">{bandWord(g, axisScore)}</div>
                  <span className="tsf-bar"><i className={`tsf-${g[0]}`} style={{ width: `${Math.min(100, axisScore)}%` }} /></span>
                  <p className="tsf-pil-sub">{sub}</p>
                  {CODEX_DIMS.filter((d) => d.group === g).map((d) => {
                    const score = card.subs?.[d.key];
                    if (score == null) return null;
                    const comps = card.comps?.[d.key] ?? [];
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
                          <details className="tsf-dim-comps">
                            <summary>Scored alongside</summary>
                            <div className="tsf-dim-comps-list">{comps.join(" · ")}</div>
                          </details>
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

        {/* ── Reference basket — U-ranked ladder, this film highlighted ── */}
        {basket.length ? (
          <section aria-labelledby="tsf-basket-h">
            <h2 className="tsf-h2" id="tsf-basket-h">The reference basket</h2>
            <table className="tsf-basket">
              <caption>U rank among the reference basket — U = Value − Risk at λ = 1; lower Risk is safer.</caption>
              <thead>
                <tr><th scope="col">Film</th><th scope="col">U</th><th scope="col">Risk</th></tr>
              </thead>
              <tbody>
                {basket.map((b) => (
                  <tr className={b.self ? "tsf-self" : undefined} key={b.slug}>
                    <td>
                      {b.self ? (
                        <>{b.title} — this film</>
                      ) : (
                        <Link href={`/takescore/film/${b.slug}`}>{b.title}</Link>
                      )}
                    </td>
                    <td className="tsf-num"><b>{Math.round(b.u)}</b></td>
                    <td className="tsf-num tsf-rk">{Math.round(b.r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
