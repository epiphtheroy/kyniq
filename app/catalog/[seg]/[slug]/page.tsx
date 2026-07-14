import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import EntityTVHero from "@/components/EntityTVHero";
import LensQuickBar from "@/components/LensQuickBar";
import ListFilter from "@/components/ListFilter";
import Provenance from "@/components/Provenance";
import Byline from "@/components/Byline";
import QuickAnswers, { type QuickAnswerItem } from "@/components/read/QuickAnswers";
import { pageRobots } from "@/lib/seo";
import { kindBySeg, sectionByKey, axisLabel, nodeHref, sectionHref } from "@/lib/catalog";
import FilmTabBar from "@/components/FilmTabBar";
import ShareDock from "@/components/ShareDock";
import "@/app/curious/curious.css";
import "@/app/film/[slug]/read.css";

export const revalidate = 300;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
const img = (p: string | null) => (p ? `https://image.tmdb.org/t/p/w185${p}` : null);
const SITE = "https://metatake.net";

interface Props { params: Promise<{ seg: string; slug: string }> }
type Detail = { id: string; slug: string; label: string; code: string | null; definition: string | null; kind: string;
  parent_slug: string | null; parent_label: string | null; parent_kind: string | null; member_count: number };
type Member = { figure_label: string; figure_slug: string | null; film_title: string; film_slug: string;
  yr: number | null; poster: string | null; backdrop: string | null; confidence: number | null };
type Kin = { slug: string; label: string; sim: number; n: number };
type Theme = { slug: string; label: string; n: number };
type Dates = { created_at: string | null; updated_at: string | null };
type PosItem = { label: string; slug: string; kind: string; n: number };
type UcnMeta = {
  facet?: string | null; facet_label?: string | null; cluster?: string | null; cluster_label?: string | null;
  aliases?: string | string[] | null;
  positions?: { as_object?: PosItem[]; as_place?: PosItem[]; as_complex?: PosItem[] } | null;
};

function maturity(n: number): [string, string] | null {
  if (n >= 26) return ["cliche", "Cliché"];
  if (n >= 9) return ["established", "Established"];
  if (n >= 4) return ["emerging", "Emerging"];
  if (n >= 2) return ["fresh", "Fresh"];
  if (n === 1) return ["noble", "Noble"];
  return null;
}

async function load(seg: string, slug: string) {
  const km = kindBySeg(seg);
  if (!km) return null;
  const supabase = db();
  const { data: d } = await supabase.rpc("catalog_node_detail", { p_kind: km.kind, p_slug: slug });
  const detail = ((d as Detail[]) ?? [])[0];
  if (!detail) return null;
  const [mem, kin, thm, nd] = await Promise.all([
    // catalog_node_members orders by ft.confidence desc — the list IS the ranking.
    supabase.rpc("catalog_node_members", { p_kind: km.kind, p_slug: slug, p_limit: 120, p_offset: 0 }),
    supabase.rpc("catalog_node_kindred", { p_kind: km.kind, p_slug: slug, p_n: 8 }),
    supabase.rpc("catalog_node_themes", { p_kind: km.kind, p_slug: slug, p_n: 10 }),
    // Node timestamps + UCN meta (facet/family/aliases) for the byline & theme layers.
    supabase.from("taxonomy_nodes").select("id, created_at, updated_at, meta").eq("kind", km.kind).eq("slug", slug).maybeSingle(),
  ]);
  const node = (nd.data ?? null) as (Dates & { id: number; meta: UcnMeta | null }) | null;

  // Theme-only layers (UCN surface, 2026-07-08): concepts that theorize this
  // theme (theory_concepts bridge) + structural kin (same Family cluster).
  let concepts: { name: string; slug: string }[] = [];
  let familyKin: { label: string; slug: string }[] = [];
  if (km.kind === "theme" && node) {
    const cluster = node.meta?.cluster ?? null;
    const [cc, fk] = await Promise.all([
      supabase
        .from("theory_concepts")
        .select("concept, concept_slug")
        .eq("taxonomy_node_id", node.id)
        .limit(12),
      cluster
        ? supabase
            .from("taxonomy_nodes")
            .select("label, slug, meta")
            .eq("kind", "theme")
            .eq("meta->>cluster", cluster)
            .neq("slug", slug)
            .limit(14)
        : Promise.resolve({ data: [] as { label: string; slug: string }[] }),
    ]);
    concepts = ((cc.data ?? []) as { concept: string; concept_slug: string }[]).map((c) => ({ name: c.concept, slug: c.concept_slug }));
    familyKin = ((fk.data ?? []) as { label: string; slug: string }[]).map((k) => ({ label: k.label, slug: k.slug }));
  }

  return {
    km, detail,
    members: (mem.data as Member[]) ?? [],
    kindred: (kin.data as Kin[]) ?? [],
    themes: ((thm.data as Theme[]) ?? []).filter((t) => !(km.kind === "theme" && t.slug === slug)),
    dates: node,
    meta: node?.meta ?? null,
    concepts,
    familyKin,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seg, slug } = await params;
  const data = await load(seg, slug);
  if (!data) return { title: "Catalog", robots: { index: false } };
  const { km, detail } = data;
  const n = detail.member_count;
  // Listicle-shaped title with the live count; the root layout appends "· Metatake".
  const title = `${detail.label} — ${km.label.toLowerCase()}: ${n} film ${n === 1 ? "example" : "examples"}${n >= 4 ? ", ranked" : ""}`;
  const description = detail.definition
    ?? `${n} figures across cinema classified as ${detail.label}, each tied to the exact film and close reading that carries it — ranked by classification confidence.`;
  return { title, description, openGraph: { title, description }, alternates: { canonical: `/catalog/${seg}/${slug}` }, robots: pageRobots(detail.member_count >= 1) };
}

export default async function CatalogNode({ params }: Props) {
  const { seg, slug } = await params;
  const data = await load(seg, slug);
  if (!data) notFound();
  const { km, detail, members, kindred, themes, dates, meta, concepts, familyKin } = data;
  const section = sectionByKey(km.section);
  const mat = maturity(detail.member_count);
  const n = detail.member_count;
  const figLabel = n === 1 ? "figure" : "figures";

  // ── Deterministic aggregates for the hero + "spelled out" layer (2026-07-08,
  // concept-page grammar). Truth gate: span/decade/most claims only render when
  // the FULL member set is loaded (limit 120).
  const full = n <= members.length;
  const uniqFilms = Array.from(new Map(members.map((m) => [m.film_slug, m])).values());
  const datedA = uniqFilms.filter((m) => (m.yr ?? 0) > 1880).sort((a, b) => (a.yr! - b.yr!) || a.film_title.localeCompare(b.film_title));
  const filmFreqA = new Map<string, { title: string; year: number | null; c: number }>();
  for (const m of members) {
    const e = filmFreqA.get(m.film_slug) ?? { title: m.film_title, year: m.yr, c: 0 };
    e.c += 1; filmFreqA.set(m.film_slug, e);
  }
  const topFreqA = [...filmFreqA.entries()].map(([s, v]) => ({ slug: s, ...v }))
    .sort((a, b) => b.c - a.c || a.title.localeCompare(b.title))[0] ?? null;
  const decFreqA = new Map<number, number>();
  for (const m of datedA) { const d = Math.floor((m.yr as number) / 10) * 10; decFreqA.set(d, (decFreqA.get(d) ?? 0) + 1); }
  const decTopA = [...decFreqA.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0] ?? null;
  const heroM = members.find((m) => m.backdrop);
  const heroBd = heroM?.backdrop ?? null;

  // ── Quick answers (docs/PLAN-intent-coverage.md §0 charter + §5.7/§5.8) ─────
  // confidence = classification CERTAINTY, not quality — so "best {archetype}"
  // is NEVER emitted (§5.8). The "Which films feature {label}?" list is also
  // omitted: the members section below is a dedicated answer to that exact
  // question (its H2 is identical), so repeating it here would duplicate a body
  // answer section (charter §0.4). Counts are verbatim; the earliest claim only
  // renders on a fully-loaded member set (`full`). Variant weaving (§0.6,
  // authored text): "film(s)" carries Q_count + Q_earliest (2), "feature"
  // carries Q_count (1) — each ≤2. The verbatim definition is a quote.
  const catalogQA: QuickAnswerItem[] = [];
  const catDef = (detail.definition ?? "").trim();
  if (catDef) catalogQA.push({ q: `What is ${detail.label}?`, a: catDef });
  if (members.length > 0) {
    catalogQA.push({
      q: `How many films feature ${detail.label}?`,
      a: <>{n.toLocaleString()} {figLabel} across {uniqFilms.length}{full ? "" : "+"} title{uniqFilms.length === 1 ? "" : "s"}, each classified as {detail.label}.</>,
    });
  }
  if (full && datedA.length >= 2) {
    catalogQA.push({
      q: `What is the earliest film with ${detail.label}?`,
      a: (
        <>
          <Link href={`/film/${datedA[0].film_slug}`}>{datedA[0].film_title}</Link>
          {datedA[0].yr != null ? ` (${datedA[0].yr})` : ""} — the earliest of the {datedA.length} dated title{datedA.length === 1 ? "" : "s"}.
        </>
      ),
    });
  }

  // JSON-LD — built entirely from data already fetched above (no extra queries).
  const nodeUrl = `${SITE}${nodeHref(km.kind, detail.slug)}`;
  const def =
    detail.definition && detail.definition.length > 300
      ? `${detail.definition.slice(0, 297).trimEnd()}…`
      : detail.definition;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTerm",
        "@id": nodeUrl,
        name: detail.label,
        ...(def ? { description: def } : {}),
        inDefinedTermSet: { "@type": "DefinedTermSet", name: "Metatake Film Archetypes", url: `${SITE}/catalog` },
      },
      // The page as a dated, edited collection — carries E-E-A-T signals the
      // DefinedTerm (not a CreativeWork) cannot.
      {
        "@type": "CollectionPage",
        url: nodeUrl,
        name: `${detail.label} — ${km.label}`,
        about: { "@id": nodeUrl },
        ...(dates?.created_at ? { datePublished: dates.created_at } : {}),
        ...(dates?.updated_at ? { dateModified: dates.updated_at } : {}),
        author: { "@type": "Organization", name: "Metatake" },
        editor: { "@type": "Person", name: "Wonwoo Yoon", url: `${SITE}/editor` },
        publisher: { "@type": "Organization", name: "Metatake" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE },
          { "@type": "ListItem", position: 2, name: "Film Archetypes", item: `${SITE}/catalog` },
          ...(section
            ? [{ "@type": "ListItem", position: 3, name: section.label, item: `${SITE}${sectionHref(section.key)}` }]
            : []),
          { "@type": "ListItem", position: section ? 4 : 3, name: detail.label, item: nodeUrl },
        ],
      },
      {
        "@type": "ItemList",
        name: `Films that feature ${detail.label}, ranked`,
        numberOfItems: n,
        itemListElement: members.slice(0, 25).map((m, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `${m.figure_label} — ${m.film_title}${m.yr ? ` (${m.yr})` : ""}`,
          url: `${SITE}${m.figure_slug ? `/film/${m.film_slug}/figure/${m.figure_slug}` : `/film/${m.film_slug}`}`,
        })),
      },
    ],
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* ── Dark hero: the archetype as a counted classification ── */}
      <div className="cur rd-hero">
        <div className="rd-hero__in">
          <div className="rd-hero__txt">
            <div className="rd-crumb">
              <Link href="/catalog">Archetype</Link><span>›</span>
              {section ? <><Link href={sectionHref(section.key)}>{section.label}</Link><span>›</span></> : null}
              <span>{detail.label}</span>
            </div>
            <div className="rd-chiprow">
              <span className="rd-chip">{km.label}</span>
              {meta?.facet_label ? <span className="rd-chip" title="UCN facet">{meta.facet_label}</span> : null}
              {mat ? <span className="rd-chip">{mat[1]}</span> : null}
              <span className="rd-meta">{n.toLocaleString()} {figLabel} · {uniqFilms.length}{full ? "" : "+"} films</span>
            </div>
            <h1 className="rd-h1">{detail.label}</h1>
            <p className="rd-dek">
              {detail.definition ? <>{detail.definition}{" "}</> : null}
              Metatake classifies {n.toLocaleString()} {figLabel} as {detail.label}
              {full && datedA.length > 1 ? <> — from <i>{datedA[0].film_title}</i> ({datedA[0].yr}) to <i>{datedA[datedA.length - 1].film_title}</i> ({datedA[datedA.length - 1].yr})</> : null},
              {" "}each tied to the exact film and the close reading that carries it.
            </p>
            <div className="rd-share" style={{ marginTop: 12 }}>
              <ShareDock variant="bar" path={`/catalog/${seg}/${slug}`} title={detail.label}
                hook={`${detail.label} — ${n.toLocaleString()} ${figLabel} across film, each tied to its close reading on Metatake`}
                saveType={`catalog-${seg}`} saveRef={slug} />
              <ShareDock variant="fab" path={`/catalog/${seg}/${slug}`} title={detail.label} noSave />
            </div>
          </div>
          {heroBd ? (
            <div className="rd-hero__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="rd-hero__bd" src={`https://image.tmdb.org/t/p/w780${heroBd}`} alt="" width={780} height={439} />
              <EntityTVHero inline playlist={`arch-${km.kind.replace(/_/g, "-")}-${slug}`} reelSlugs={uniqFilms.map((m) => m.film_slug)} label={detail.label} listHref={`/tv/list/arch-${km.kind.replace(/_/g, "-")}-${slug}`} backdrop={null} />
              <div className="rd-hero__cap">From {heroM?.film_title} · via TMDB</div>
            </div>
          ) : null}
        </div>
      </div>

      <FilmTabBar
        center
        search={members.length > 8 ? { event: "theory:q", targetId: "members", placeholder: `Search ${members.length} ${figLabel}…` } : undefined}
        tabs={[
          { id: "spelled-out", label: "Spelled out", color: "#D64534" },
          { id: "members", label: "The ranked slate", badge: n, color: "#12897A" },
          ...(km.kind === "theme" && meta?.positions && (meta.positions.as_object?.length || meta.positions.as_place?.length || meta.positions.as_complex?.length)
            ? [{ id: "cat-positions", label: "Where it lives", color: "#2F6FAD" }] : []),
          ...(concepts.length ? [{ id: "cat-concepts", label: "The theory", badge: concepts.length, color: "#5B4B8A" }] : []),
          ...(kindred.length || themes.length || familyKin.length ? [{ id: "cat-rels", label: "Kindred & themes", badge: kindred.length + themes.length + familyKin.length, color: "#C87A2C" }] : []),
        ]}
      />

      <div className="cat-wrap cat-node">
        <Byline created={dates?.created_at} updated={dates?.updated_at} />
        {detail.parent_slug && detail.parent_kind ? (
          <div className="cat-parent">
            {axisLabel(detail.parent_kind)}:{" "}
            <Link href={nodeHref(detail.parent_kind, detail.parent_slug)}>{detail.parent_label}</Link>
          </div>
        ) : null}

        <LensQuickBar />

        <QuickAnswers items={catalogQA.slice(0, 5)} />

        {/* ── The archetype, spelled out — deterministic sentences ── */}
        <section className="cat-sec" id="spelled-out">
          <h2 className="cat-h2">{detail.label}, spelled out</h2>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.7, fontSize: 15, maxWidth: "78ch" }}>
            <li>
              {detail.label} names {n.toLocaleString()} {figLabel} in the archive
              {full && datedA.length > 1 ? <>, from <Link href={`/film/${datedA[0].film_slug}`}>{datedA[0].film_title}</Link> ({datedA[0].yr}) to <Link href={`/film/${datedA[datedA.length - 1].film_slug}`}>{datedA[datedA.length - 1].film_title}</Link> ({datedA[datedA.length - 1].yr})</> : null}.
            </li>
            {detail.parent_slug && detail.parent_kind ? (
              <li>
                On the {axisLabel(detail.parent_kind).toLowerCase()} axis, {detail.label} sits under <Link href={nodeHref(detail.parent_kind, detail.parent_slug)}>{detail.parent_label}</Link>.
              </li>
            ) : null}
            {full && topFreqA && topFreqA.c > 1 ? (
              <li>
                The film that returns to it most is <Link href={`/film/${topFreqA.slug}`}>{topFreqA.title}</Link>
                {topFreqA.year ? ` (${topFreqA.year})` : ""} — {topFreqA.c} {topFreqA.c === 1 ? "figure" : "figures"} there are classified as {detail.label}.
              </li>
            ) : null}
            {full && decTopA && datedA.length >= 4 ? (
              <li>
                The decade that stages {detail.label} most, by count, is the {decTopA[0]}s — {decTopA[1]} of the {datedA.length} dated films.
              </li>
            ) : null}
            {mat ? (
              <li>
                As a pattern, {detail.label} is <b>{mat[1]}</b>{n >= 26 ? " — fully conventional; cinema returns to it again and again" : n >= 9 ? " — a recurring pattern across many films" : n >= 4 ? " — a real recurring pattern, still rare" : n >= 2 ? " — a pattern just beginning to be shared" : " — documented in a single film so far"}.
              </li>
            ) : null}
          </ul>
        </section>

        <section className="cat-sec" id="members">
          <h2 className="cat-h2">
            Which films feature {detail.label}? <span className="cat-h2__n">— {n.toLocaleString()} {figLabel}, ranked</span>
          </h2>
          <p className="cat-gloss">
            Ranked by classification confidence — how surely each figure belongs here, recomputed as the archive grows
            (<Link href="/methodology#rankings">how ranking works</Link>).
          </p>
          {members.length === 0 ? (
            <p className="cat-empty">No figures yet.</p>
          ) : (
            <>
              {members.length > 8 ? (
                <ListFilter targetId="cat-members" placeholder={`Filter these ${figLabel}…`} total={members.length} listenEvent="theory:q" />
              ) : null}
              <div className="cat-mlist" id="cat-members">
              {members.map((m, i) => {
                const href = m.figure_slug
                  ? `/film/${m.film_slug}/figure/${m.figure_slug}`
                  : `/film/${m.film_slug}`;
                const src = img(m.backdrop) || img(m.poster);
                return (
                  <Link key={`${m.film_slug}-${i}`} href={href} className="cat-mrow"
                    data-filter-item data-filter-text={`${m.figure_label} ${m.film_title}`.toLowerCase()}>
                    <span className="cat-mrank" aria-hidden="true">{i + 1}</span>
                    <div className="cat-mrthumb">
                      {src ? <img src={src} alt="" loading="lazy" /> : <i className="ti ti-movie" aria-hidden="true" />}
                    </div>
                    <div className="cat-mrtext">
                      <div className="cat-mrfig">{m.figure_label}</div>
                      <div className="cat-mrfilm">
                        {m.film_title}{m.yr ? ` · ${m.yr}` : ""}
                        {m.confidence != null ? (
                          <span className="cat-mconf" title="classification confidence — how surely this figure belongs to this archetype (see /methodology#rankings)">
                            {" "}· {Math.round(m.confidence * 100)}%
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              })}
              {n > members.length ? (
                <div className="cat-mrow cat-mrow--more"><span>+{(n - members.length).toLocaleString()} more</span></div>
              ) : null}
              </div>
            </>
          )}
        </section>

        {km.kind === "theme" && meta?.positions && (meta.positions.as_object?.length || meta.positions.as_place?.length || meta.positions.as_complex?.length) ? (
          <section className="cat-sec" id="cat-positions">
            <h2 className="cat-h2">Where {detail.label} lives</h2>
            <p className="cat-gloss">
              One theme, three homes — the objects, places, and character-complexes it most often inhabits
              (co-occurrence across this theme&rsquo;s figures; counts shown).
            </p>
            {([["As an object", meta.positions.as_object], ["As a place", meta.positions.as_place], ["As a character-complex", meta.positions.as_complex]] as [string, PosItem[] | undefined][]).map(([label, items]) =>
              items && items.length > 0 ? (
                <div key={label} style={{ margin: "10px 0 0" }}>
                  <h3 className="cat-h3">{label}</h3>
                  <div className="cat-pills">
                    {items.map((p) => (
                      <Link key={p.slug} href={nodeHref(p.kind, p.slug)} className="cat-pill"
                        title={`${p.n} shared figures`}>
                        {p.label}<span className="cat-pill__n">{p.n}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </section>
        ) : null}

        {km.kind === "theme" && concepts.length > 0 ? (
          <section className="cat-sec" id="cat-concepts">
            <h2 className="cat-h2">The theory behind {detail.label} <span className="cat-h2__n">— {concepts.length} concept{concepts.length === 1 ? "" : "s"}</span></h2>
            <p className="cat-gloss">
              Named concepts from the theory registry that formalize this theme — each opens the concept page with its definition, thinkers, and the desk essays that use it.
            </p>
            <div className="cat-pills">
              {concepts.map((c) => (
                <Link key={c.slug} href={`/concept/${c.slug}`} className="cat-pill">{c.name}</Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="cat-rels" id="cat-rels">
          {km.kind === "theme" && familyKin.length > 0 ? (
            <section className="cat-relblock">
              <h2 className="cat-h3">
                Same family{meta?.cluster_label ? <>: {meta.cluster_label}</> : null} <span className="cat-h2__n">structural kin</span>
              </h2>
              <div className="cat-pills">
                {familyKin.map((k) => (
                  <Link key={k.slug} href={nodeHref("theme", k.slug)} className="cat-pill"
                    title="structural kinship — same UCN theme family">
                    {k.label}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {kindred.length > 0 ? (
            <section className="cat-relblock">
              <h2 className="cat-h3">Kindred {axisLabel(km.kind).toLowerCase()}s <span className="cat-h2__n">by embedding</span></h2>
              <div className="cat-pills">
                {kindred.map((k) => (
                  <Link key={k.slug} href={nodeHref(km.kind, k.slug)} className="cat-pill"
                    title="embedding kinship — cosine similarity of the two archetypes (see /methodology#rankings)">
                    {k.label}<span className="cat-pill__n">{k.n}</span>
                    {k.sim != null ? <span className="cat-pill__sim">{Math.round(k.sim * 100)}%</span> : null}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {themes.length > 0 ? (
            <section className="cat-relblock">
              <h2 className="cat-h3">Recurring themes</h2>
              <div className="cat-pills">
                {themes.map((t) => (
                  <Link key={t.slug} href={nodeHref("theme", t.slug)} className="cat-pill">
                    {t.label}<span className="cat-pill__n">{t.n}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <Provenance created={dates?.created_at} updated={dates?.updated_at} />
      </div>
    </div>
  );
}
