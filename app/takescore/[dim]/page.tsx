import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import PosterActions from "@/components/PosterActions";
import ShareDock from "@/components/ShareDock";
import { CODEX_DIMS, dimBySlug, takescoreDimUrl, type CodexDim } from "@/lib/cinecodex_dims";
import { CODEX_ANCHORS, type AnchorGold } from "@/lib/cinecodex_anchors";
import { filmUrl } from "@/lib/urls";

export const revalidate = 3600;
export function generateStaticParams() {
  return CODEX_DIMS.map((d) => ({ dim: d.slug }));
}

const SITE = "https://metatake.net";
const SCORED = "6,701";
const IMG = "https://image.tmdb.org/t/p";

// E-E-A-T byline constants — bump DATE_MODIFIED only on substantive edits.
const DATE_PUBLISHED = "2026-07-04";
const DATE_MODIFIED = "2026-07-04";
const DATE_PUBLISHED_HUMAN = "July 4, 2026";

interface Props {
  params: Promise<{ dim: string }>;
}

type TopRow = {
  slug: string;
  title: string;
  original_title: string | null;
  year: number | null;
  poster_path: string | null;
  score: number;
  takescore: number | null;
  v: number | null;
  c: number | null;
  r: number | null;
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/**
 * Hand-crafted editorial copy per dimension. `title` is the search-shaped
 * page title (≤60 chars; the root layout appends " · Metatake"). The essay
 * bodies work in the frozen rubric's hard rules: difficulty is a cost, never
 * a virtue; ambition ≠ achievement (spectacle caps FORM ~55); divisive ≠
 * bankrupt; legibility/accessibility are never penalized on the Value axes.
 */
type DimCopy = {
  title: string;
  measures: string;
  notReward: string;
  bands: string;
  listTitle: string;
};

const COPY: Record<string, DimCopy> = {
  cognitive: {
    title: "Films That Change How You Think — the Cognitive Ranking",
    measures:
      "Cognitive yield is what a film leaves in your head after the images fade: a concept, a distinction, a way of seeing you did not have before. The middle of the scale is real ideas, conventionally delivered — a smart film that argues something and lands it. The upper bands are rarer: 75 means the film reorganizes how you see something specific; 100 is a lasting conceptual or perceptual shift — the handful of films you think with for the rest of your life.",
    notReward:
      "Obscurity. Legibility is never penalized here — a perfectly clear film can post an elite Cognitive score, and an opaque one can post a zero. In this system difficulty is a cost, never a virtue: a hard film that yields nothing is scored as exactly that, low value at a high price. Density only counts when something arrives on the other side.",
    bands:
      "50 is the respectability line — real ideas, conventionally delivered. Everything above 75 claims a permanent change in how you see, and has to earn it against Stalker's calibrated 95.",
    listTitle: "The 25 highest Cognitive scores in the catalog",
  },
  affective: {
    title: "The Films That Stay With You — Ranked by Affective Yield",
    measures:
      "Affective yield measures the durable emotional imprint — not the jolt in the theater, but what is still there days and weeks later. Momentary thrill is deliberately excluded: 25 is pleasant-then-gone, 50 is a few lingering moments, 75 keeps returning for weeks, and 100 is an imprint you carry permanently.",
    notReward:
      "Intensity mistaken for durability. A film can wring you out for two hours and evaporate; a quiet one can lodge a single image in you for a decade. And accessibility is not a cap — a wide-open, crowd-embraced film can own the top of this scale, which is why Tokyo Story's 96 outranks nearly everything difficult.",
    bands:
      "The test at every band is time: 25 dies in the lobby, 75 is still with you weeks later, and Tokyo Story's 96 is the calibrated ceiling — an imprint that never leaves.",
    listTitle: "The 25 highest Affective scores in the catalog",
  },
  formal: {
    title: "The Most Formally Achieved Films — Ranked by Form",
    measures:
      "Formal yield rewards disciplined authorial form: composition, cutting, staging and sound organized into a signature inseparable from the film's subject. 50 is distinct craft; 75 is distinctive and disciplined authorial form; 100 is formal innovation that enlarges what the medium can do.",
    notReward:
      "Spectacle. Ostentatious display, maximalist excess, style detached from subject — all of it caps around 55 no matter how dazzling, because ambition is not achievement. Scale and expense add nothing by themselves; a film earns the upper bands only when the form is achieved, integrated and controlled. This is the axis that separates looking expensive from being composed.",
    bands:
      "50 is distinct craft; 75 requires discipline, not just signature. The 90s are reserved for films that enlarge the medium itself — the Ozu/Tarkovsky zone of the ruler.",
    listTitle: "The 25 highest Formal scores in the catalog",
  },
  moral: {
    title: "Films That Stage a Real Moral Reckoning — Ranked",
    measures:
      "Moral yield asks whether the film stages a genuine moral or existential reckoning — whether it puts something real at stake and refuses to settle it cheaply. 25 gestures at a theme; 50 is sincere but safe; 75 sustains real moral complexity; 100 is a profound ethical or existential reckoning.",
    notReward:
      "Having a message. A film that flatters convictions you already hold is safe, and safe is the middle of this scale, not the top. Importance of subject matter counts for nothing on its own — what scores is the film's willingness to hold a genuine dilemma open, at its own expense, rather than resolve it for applause.",
    bands:
      "50 — sincere but safe — is where most prestige drama lives. 75 requires real moral complexity; the top band is a reckoning that costs the film, and you, something. Tokyo Story's 95 is the calibrated ceiling.",
    listTitle: "The 25 highest Moral scores in the catalog",
  },
  durability: {
    title: "The Most Rewatchable Films — Ranked by Durability",
    measures:
      "Durability is the rewatch test: does the film deepen on the second and fifth viewing, or does it evaporate on the drive home? 25 means one viewing genuinely suffices; 50 holds up; 75 deepens on rewatch; 100 is an inexhaustible lifetime object — a film you never finish.",
    notReward:
      "It refuses the snobbery shortcut: crowd-pleasing is not low durability, and Seven Samurai's 92 is the standing proof. What actually fails here are films that spend their entire payload on first contact — twist-delivery mechanisms, pure sensation, novelty that cannot survive being known. Familiarity is this dimension's acid test.",
    bands:
      "50 holds up; 75 deepens on rewatch; the mid-90s — Tokyo Story, Stalker — are inexhaustible lifetime objects.",
    listTitle: "The 25 most durable films in the catalog",
  },
  intertextual: {
    title: "The Films That Demand the Most Film History — Ranked",
    measures:
      "Intertextual cost prices the film-history literacy a film assumes: the genres it inverts, the canon it quotes, the theory it argues with. At 0 no preparation is needed; at 100 the film is encyclopedic and meta-cinematic — it barely exists except in conversation with other films.",
    notReward:
      "A high score is not a badge of honor. This is one of the four Cost dimensions, and the system's first hard rule is that difficulty is a cost, never a virtue: erudition buys a film nothing here, it just raises the price of admission. Whether the price is worth paying is decided elsewhere — by the five Value dimensions. Hard-but-empty means low value at high cost: the worst deal in the catalog.",
    bands:
      "Tokyo Story sits at 50 — classical, but embedded in a tradition. Above 70 the film is partly about cinema itself; below 25, you can walk in cold.",
    listTitle: "The steepest climbs — the 25 most intertextual films",
  },
  "formal-radicalism": {
    title: "The Most Formally Radical Films — Ranked",
    measures:
      "Formal radicalism measures the distance from mainstream film grammar — how far from conventional continuity, pacing and narrative shape the film asks you to travel. 0 is fully classical and accessible; 100 is avant-garde and endurance-testing: extreme duration, abstraction, the deliberate refusal of story.",
    notReward:
      "Radicalism itself. Breaking grammar earns nothing on this axis or any other — it just prices the ticket. A radical form that delivers (Stalker) posts its worth on the Value dimensions; a radical form that delivers nothing is the dearest kind of failure. The score is a warning label about the climb, not a medal for it.",
    bands:
      "Seven Samurai's 35 shows classical mastery is cheap to enter. Stalker's 92 is the calibrated deep end: long-take, elliptical, endurance-testing.",
    listTitle: "The steepest climbs — the 25 most formally radical films",
  },
  extratextual: {
    title: "Films That Assume the Most Outside Knowledge — Ranked",
    measures:
      "Extratextual cost prices the outside knowledge a film assumes — history, politics, philosophy, religion, the texture of a particular culture. At 0 the film is effectively universal; at 100, specialized field knowledge is mandatory before the film will open at all.",
    notReward:
      "Worldliness mistaken for depth. A film steeped in references can still be hollow, and a film any human being can enter — Seven Samurai at 35 — can be a masterpiece. The score does not grade the film's intelligence; it grades your required reading list. As everywhere in the system: cost is what you pay, value is what you get, and the two never blur.",
    bands:
      "45 (Tokyo Story, Parasite) means a broad sense of history or class helps. Above 70 — Stalker's 78 — the film assumes reading you may not have done.",
    listTitle: "The steepest climbs — the 25 most knowledge-hungry films",
  },
  "auteur-oeuvre": {
    title: "Films You Need the Director's Oeuvre to Unlock — Ranked",
    measures:
      "Auteur-oeuvre cost measures how much of the director's own filmography a film presumes: motifs that only rhyme if you know the earlier work, a late style that reads as noise without the early one. 0 stands completely alone; 100 demands sequential mastery of the whole oeuvre.",
    notReward:
      "Auteurism as a virtue. Being a director's film raises no score anywhere in this system — this axis simply flags when a film is a chapter rather than a book. High here plus high value (Stalker: 75) means worth it, but start earlier on the shelf. High here plus low value means the completists are welcome to it.",
    bands:
      "Most films sit under 40: they stand alone. Above 60 the film is a chapter — Stalker at 75 repays knowing Tarkovsky's whole arc first.",
    listTitle: "The steepest climbs — the 25 most oeuvre-dependent films",
  },
  hollowness: {
    title: "The Hollowest Films — Ranked by Intellectual Bankruptcy",
    measures:
      "Hollowness is the first Risk dimension: intellectual bankruptcy, whether as flat banality or as pretension with nothing behind the curtain. 0 is sound and substantive; 100 is insultingly hollow or incoherent — a film that wastes the attention it demands.",
    notReward:
      "It refuses to be an insult for films people argue about. Divisive is not bankrupt: when a film has a serious critical-defense camp — mother!, Babylon — the disagreement is scored as Polarization, not emptiness. Hollowness is reserved for films with genuinely nothing to defend; difficulty cannot launder emptiness into depth, and prestige cannot either.",
    bands:
      "Single digits — the Ozu/Kurosawa zone — mean substance beyond dispute. The far end is calibrated to Transformers: Revenge of the Fallen at 70: insulting emptiness.",
    listTitle: "The 25 hollowest films in the catalog",
  },
  insincerity: {
    title: "Style Over Substance — Films Ranked by Insincerity",
    measures:
      "Insincerity detects style detaching from substance: pastiche without a point, maximalism without control, borrowed aesthetics worn as costume. 0 means every choice is intentional and integrated; 100 is vulgar, derivative and incoherent — pure surface pretending otherwise.",
    notReward:
      "Strong style is not the crime — Ozu's severity and Tarkovsky's opulence both score in single digits, because there the style is the substance. The score rises only when the machinery shows: effects chasing applause, homage substituting for invention. And a controversial stylist with real defenders is polarizing, not insincere — that split is scored on its own axis.",
    bands:
      "Below 10, style and subject are one thing (Tokyo Story: 4). Babylon's 45 marks the middle trouble — dazzle outrunning control; 80 is the calibrated wreck.",
    listTitle: "The 25 most insincere films in the catalog",
  },
  cowardice: {
    title: "The Most Pandering Films — Ranked by Artistic Cowardice",
    measures:
      "Cowardice measures pandering: commercial compromise, emotional exploitation, the safe choice taken at every fork. 0 is bold and uncompromised; 100 is cynical, manipulative and soulless — filmmaking that treats the audience as a market segment to be milked.",
    notReward:
      "Popularity. Being loved is not evidence of pandering — Seven Samurai thrills a crowd and scores 5, because every thrill is honestly earned. The dimension distinguishes moving an audience from manipulating one: sentiment built from truth versus sentiment extracted by formula.",
    bands:
      "Single digits are uncompromised (Stalker: 5). Skyfall's 45 is professional risk-management; 88 — Transformers — is cynicism as a business model.",
    listTitle: "The 25 most pandering films in the catalog",
  },
  polarization: {
    title: "The Most Divisive Films — Ranked by Polarization",
    measures:
      "Polarization measures how sharply informed, engaged viewers split — not whether casual audiences liked it. The calibration is precise: strong consensus with a vocal-minority backlash reads moderate, around 35–45; a genuine half-acclaim, half-dismissal war among serious viewers reads 70 and above.",
    notReward:
      "It is the one Risk dimension that is not an accusation. Divisive is not bankrupt: mother! carries a 92 here while staying far from hollow, because a strong critical-defense camp is exactly what separates a gamble from a failure. Divisive is not niche, either — obscurity is no achievement. A high score means one thing: know which camp you are likely in before you press play.",
    bands:
      "12 (Tokyo Story) is near-consensus. A loud minority backlash reads around 35–45; a true half-acclaim, half-dismissal split like mother!'s 92 defines the top.",
    listTitle: "The 25 most polarizing films in the catalog",
  },
};

const GROUP_LABEL: Record<CodexDim["group"], string> = { value: "Value", cost: "Cost", risk: "Risk" };
const GROUP_PHRASE: Record<CodexDim["group"], string> = {
  value: "a Value dimension — what a film gives back",
  cost: "a Cost dimension — what it takes to unlock, priced as cost, never as merit",
  risk: "a Risk dimension — how a film can go wrong",
};
const GROUP_LIST_SUB: Record<CodexDim["group"], string> = {
  value: `Of the ${SCORED} films scored, these post the highest marks on this axis. Each links to the film page, where all thirteen sub-scores live.`,
  cost: `Higher means steeper, not better: of the ${SCORED} films scored, these ask the most preparation on this axis. Each links to the film page, where all thirteen sub-scores live.`,
  risk: `Read as a caution ranking, not a recommendation: of the ${SCORED} films scored, these carry the highest readings on this axis. Each links to the film page, where all thirteen sub-scores live.`,
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { dim: slug } = await params;
  const dim = dimBySlug.get(slug);
  const copy = COPY[slug];
  if (!dim || !copy) return {};
  return {
    alternates: { canonical: takescoreDimUrl(dim.slug) },
    title: copy.title,
    description: `${dim.question} The ${dim.label} dimension of the TakeScore — scale: ${dim.scale}. ${SCORED} films scored against eight fixed anchor films.`,
  };
}

export default async function DimensionPage({ params }: Props) {
  const { dim: slug } = await params;
  const dim = dimBySlug.get(slug);
  const copy = COPY[slug];
  if (!dim || !copy) notFound();

  const { data } = await db().rpc("cinecodex_dimension_top", { p_dim: dim.key, p_limit: 25, p_asc: false });
  const rows = ((data ?? []) as TopRow[]).slice(0, 25);

  const goldKey = dim.key as keyof AnchorGold;
  const anchors = [...CODEX_ANCHORS].sort((a, b) => b.gold[goldKey] - a.gold[goldKey]);

  const canonical = `${SITE}${takescoreDimUrl(dim.slug)}`;
  const groups: CodexDim["group"][] = ["value", "cost", "risk"];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTerm",
        "@id": canonical,
        url: canonical,
        name: `${dim.label} (TakeScore dimension)`,
        description: `${dim.question} Scale: ${dim.scale}.`,
        inDefinedTermSet: { "@type": "DefinedTermSet", name: "The thirteen TakeScore dimensions", url: `${SITE}/takescore` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE },
          { "@type": "ListItem", position: 2, name: "TakeScore", item: `${SITE}/takescore` },
          { "@type": "ListItem", position: 3, name: dim.label, item: canonical },
        ],
      },
      {
        "@type": "Article",
        "@id": `${canonical}#article`,
        headline: copy.title,
        mainEntityOfPage: canonical,
        about: { "@id": canonical },
        author: { "@type": "Person", name: "Wonwoo Yoon", url: `${SITE}/editor` },
        publisher: { "@type": "Organization", name: "Metatake", url: SITE },
        datePublished: DATE_PUBLISHED,
        dateModified: DATE_MODIFIED,
        isPartOf: { "@type": "CollectionPage", "@id": `${SITE}/takescore`, name: "TakeScore", url: `${SITE}/takescore` },
      },
      {
        "@type": "ItemList",
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        numberOfItems: rows.length,
        itemListElement: rows.map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: r.year ? `${r.title} (${r.year})` : r.title,
          url: `${SITE}${filmUrl(r.slug)}`,
        })),
      },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mt-wrap lh ab">
        <div className="lh-crumb">
          <Link href="/takescore">TakeScore</Link> · {GROUP_LABEL[dim.group]}
        </div>
        <h1 className="lh-h1">{copy.title}</h1>
        <div className="rd-share" style={{ marginTop: 12 }}>
          <ShareDock variant="bar" path={`/takescore/${slug}`} title={copy.title} hook={dim.question} />
          <ShareDock variant="fab" path={`/takescore/${slug}`} title={copy.title} hook={dim.question} />
        </div>
        <p className="lh-def">
          {dim.question} This page answers it with <span className="term">{dim.label}</span> — {GROUP_PHRASE[dim.group]} —
          one of the thirteen axes behind the TakeScore, scored 0–100 for all {SCORED} films in the catalog
          against a fixed, version-locked rubric. <Link href="/takescore/about">How the system works →</Link>
        </p>

        <h2 className="ab-h2">What {dim.label} measures</h2>
        <p className="ab-p">{copy.measures}</p>

        <h2 className="ab-h2">What it refuses to reward</h2>
        <p className="ab-p">{copy.notReward}</p>

        <h2 className="ab-h2">How to read the 0–100 band</h2>
        <p className="ab-p">
          Scores are integers anchored to eight reference films and to band descriptors whose midpoints — 0, 25, 50,
          75, 100 — act as gravity wells. The ruler for {dim.label}:
        </p>
        <p className="ab-p" style={{ fontFamily: "var(--font-ui)", fontWeight: 600 }}>{dim.scale}</p>
        <p className="ab-p">{copy.bands}</p>

        <section
          aria-labelledby="dim-method"
          style={{ margin: "40px 0 4px", padding: "14px 18px", border: "1px solid var(--hairline)", borderRadius: 10 }}
        >
          <h2 className="ab-h2" id="dim-method" style={{ marginTop: 0, fontSize: 15 }}>About this methodology</h2>
          <p className="ab-p" style={{ marginBottom: 0, fontSize: 14 }}>
            TakeScore™ is Metatake&apos;s own scoring system — designed and calibrated by{" "}
            <Link href="/editor">Wonwoo Yoon</Link>, founder &amp; editor of Metatake. Every score on this page comes
            from a frozen rubric (cinecodex-prod-v2) calibrated against eight fixed anchor films; {SCORED} films scored
            to date. Published {DATE_PUBLISHED_HUMAN}.
          </p>
        </section>

        <h2 className="ab-h2">The eight anchors</h2>
        <p className="ab-p">
          TakeScore&apos;s numbers are not free-floating opinions: every film in the catalog is measured against the same
          fixed calibration ruler — eight reference films with hand-set gold scores frozen into the scoring rubric.
          Here is that ruler on the {dim.label} axis, highest to lowest.
        </p>
        <div style={{ borderTop: "1px solid var(--hairline)", marginBottom: 8 }}>
          {anchors.map((a) => (
            <div
              key={a.title}
              style={{ display: "flex", gap: 14, alignItems: "baseline", padding: "10px 0", borderBottom: "1px solid var(--hairline)" }}
            >
              <span className="th-n" style={{ marginLeft: 0, fontSize: 16, minWidth: 30, textAlign: "right" }}>
                {a.gold[goldKey]}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="th-name">
                  {a.filmSlug ? <Link href={filmUrl(a.filmSlug)}>{a.title}</Link> : a.title}
                  {` (${a.year})`}
                </span>{" "}
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--muted)" }}>{a.director}</span>
                <br />
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--muted)" }}>{a.role}</span>
              </span>
            </div>
          ))}
        </div>

        <section aria-labelledby="dim-top" style={{ marginTop: 44 }}>
          <h2 className="df-h2" id="dim-top">{copy.listTitle}</h2>
          <p className="df-sub">{GROUP_LIST_SUB[dim.group]}</p>
          <div className="mvh-films" style={{ marginTop: 14 }}>
            {rows.map((r, i) => {
              const secondary: Array<[string, number | null]> = [
                ["TS", r.takescore],
                ["V", r.v],
                ["C", r.c],
                ["R", r.r],
              ];
              const secondaryTxt = secondary
                .filter(([, n]) => n != null)
                .map(([k, n]) => `${k} ${n}`)
                .join(" · ");
              return (
                <a className="mvh-film" key={r.slug} href={filmUrl(r.slug)}>
                  <div style={{ position: "relative" }}>
                    {r.poster_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="mvh-poster"
                        src={`${IMG}/w185${r.poster_path}`}
                        alt={`${r.title} poster`}
                        width={185}
                        height={278}
                        loading="lazy"
                      />
                    ) : (
                      <div className="mvh-poster mvh-poster--empty" aria-hidden="true" />
                    )}
                    <PosterActions slug={r.slug} compact rating={false} />
                  </div>
                  <div className="mvh-fmeta">
                    <div className="mvh-ftitle">
                      <span style={{ fontFamily: "var(--font-ui)", fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>
                        {i + 1}
                      </span>{" "}
                      {r.title}
                      {r.year ? <span className="mvh-yr"> ({r.year})</span> : null}
                    </div>
                    {r.original_title && r.original_title !== r.title ? (
                      <div className="mvh-fdir">{r.original_title}</div>
                    ) : null}
                    <div style={{ marginTop: 5, fontFamily: "var(--font-ui)", lineHeight: 1 }}>
                      <span style={{ fontSize: 19, fontWeight: 700, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
                        {r.score}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 6 }}>{dim.label}</span>
                    </div>
                    {secondaryTxt ? (
                      <div className="mvh-fdir" style={{ fontVariantNumeric: "tabular-nums" }}>{secondaryTxt}</div>
                    ) : null}
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="dim-nav" style={{ marginTop: 48 }}>
          <h2 className="df-h2" id="dim-nav">The thirteen dimensions</h2>
          <p className="df-sub">
            Every film&apos;s TakeScore is built from thirteen axes in three groups. Read the others:
          </p>
          {groups.map((g) => (
            <div key={g} style={{ marginBottom: 14 }}>
              <h3 className="ab-h2" style={{ fontSize: 16, margin: "12px 0 4px" }}>{GROUP_LABEL[g]}</h3>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {CODEX_DIMS.filter((d) => d.group === g).map((d) =>
                  d.slug === dim.slug ? (
                    <li key={d.slug} className="ab-p" style={{ margin: "3px 0" }}>
                      <strong>{d.label}</strong> — this page
                    </li>
                  ) : (
                    <li key={d.slug} className="ab-p" style={{ margin: "3px 0" }}>
                      <Link href={takescoreDimUrl(d.slug)}>{d.question}</Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
          <p style={{ marginTop: 18 }}>
            <Link className="ab-back" href="/takescore">← The full TakeScore ranking</Link>
            {"  ·  "}
            <Link className="ab-back" href="/takescore/about">How the TakeScore works</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
