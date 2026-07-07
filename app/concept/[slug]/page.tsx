import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import EntityMap from "@/components/EntityMap";
import ReadingsExplorer from "@/components/ReadingsExplorer";
import { pageRobots } from "@/lib/seo";
import { listicle } from "@/lib/listicle";

/** Display convention: concept names lead with a capital; no quotes in headings. */
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Concept — the canonical page for a single named theoretical concept.
 * Unified 2026-07-07 (terminology charter): the SM registry (sm_concepts,
 * formerly served noindex at /idea) is the primary source; the readings-corpus
 * vocabulary (takes.concept, the previous /concept) renders as a fallback for
 * slugs that only exist there, and its trope list is absorbed as a section
 * when both exist. Old /idea/* URLs 308 here.
 */
export const revalidate = 1800;
export async function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ slug: string }> }

type Reading = {
  take_id: string; take_title: string | null; framework: string | null; thesis: string | null; leap: string | null;
  theorist_name: string | null; theorist_slug: string | null; fig_label: string; fig_slug: string;
  film_title: string; film_slug: string; film_year: number | null; backdrop_path: string | null;
};

type DeskLink = {
  film_slug: string; film_title: string; film_year: number | null; backdrop_path: string | null;
  desk_key: string; essay_title: string; excerpt: string | null; mode: string | null;
};

const DESK_META: Record<string, { label: string; color: string }> = {
  decoder: { label: "Decoder", color: "#8A5A2B" },
  theories: { label: "Fan Theories", color: "#5B4DAF" },
  debates: { label: "Debates", color: "#B03A48" },
  contested: { label: "Contested", color: "#8C3B6E" },
  "reception-story": { label: "Reception", color: "#2E7D6B" },
  "parallel-lives": { label: "Parallel Lives", color: "#3E6DB5" },
  "field-test": { label: "Field Test", color: "#71701F" },
  exegesis: { label: "Exegesis", color: "#4A4A8F" },
};
const deskMeta = (k: string) => DESK_META[k] ?? { label: "Essay", color: "#666" };
const mdStrip = (s: string) => s.replace(/\*\*?|__|`/g, "").trim();

async function fetchDeskEssays(supabase: ReturnType<typeof db>, slugs: string[]): Promise<DeskLink[]> {
  const seen = new Set<string>();
  const out: DeskLink[] = [];
  for (const s of [...new Set(slugs)]) {
    try {
      const { data } = await supabase.rpc("concept_desk_essays", { p_slug: s, p_limit: 24 });
      for (const d of ((data ?? []) as DeskLink[])) {
        const key = `${d.film_slug}/${d.desk_key}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(d);
        if (out.length >= 12) return out;
      }
    } catch { /* enhancement only */ }
  }
  return out;
}

type TropeRow = { concept: string; slug: string; title: string; laconic: string | null; films: number; bd: string | null };

type TakesDetail = {
  stats?: { films: number; readings: number; tropes: number };
  native?: string | null;
  theorist?: { name: string; slug: string } | null;
} | null;

function load(slug: string) {
  return unstable_cache(
    async () => {
      const supabase = db();
      // Primary: SM concept registry (security-definer RPC resolves variant slugs).
      const { data: head } = await supabase.rpc("sm_concept_head", { p_slug: slug });
      const h = (head as { resolved_slug: string; name: string; native: string | null }[] | null)?.[0];

      // Readings-corpus vocabulary (the pre-unification /concept data) — used as
      // the absorbed tropes section on SM pages, or as the whole page as fallback.
      const [{ data: tr }, { data: td }] = await Promise.all([
        supabase.rpc("concept_readings", { p_slug: slug }),
        supabase.rpc("concept_detail", { p_slug: slug }),
      ]);
      const tropes = (tr ?? []) as TropeRow[];
      const takesDetail = (td ?? null) as TakesDetail;

      // Strong Misreadings absorbed from the retired per-canon tradition pages
      // (theory_canon rows crosswalked to this concept via theory_canon_map).
      let canonReadings: Reading[] = [];
      try {
        const { data: cr } = await supabase.rpc("concept_canon_readings", { p_slug: slug });
        canonReadings = (cr as Reading[] | null) ?? [];
      } catch { canonReadings = []; }

      if (!h) {
        if (tropes.length > 0) {
          return { kind: "takes" as const, concept: tropes[0].concept, tropes, takesDetail };
        }
        // Theory-DB branch: concepts from the cross-disciplinary registry
        // (theory_concepts) that have no SM registry entry yet — the concepts
        // the Decoder desk actually deploys (e.g. amae, hamartia).
        const { data: tcRows } = await supabase
          .from("theory_concepts")
          .select("id, concept, concept_slug, native, one_liner, part, major, sub")
          .eq("concept_slug", slug)
          .limit(1);
        const tc = (tcRows ?? [])[0] as
          | { id: number; concept: string; concept_slug: string; native: string | null; one_liner: string | null; part: string | null; major: string | null; sub: string | null }
          | undefined;
        if (!tc) return null;
        const [{ data: thRows }, desks] = await Promise.all([
          supabase
            .from("theorist_concepts")
            .select("theorist_id, theorist_name, role, theorists(slug, name)")
            .eq("concept_id", tc.id)
            .limit(12),
          fetchDeskEssays(supabase, [slug]),
        ]);
        const theorists: { name: string; slug: string | null }[] = [];
        const seenTh = new Set<string>();
        for (const r of (thRows ?? []) as { theorist_name: string | null; theorists: { slug: string; name: string } | null }[]) {
          const nm = r.theorists?.name ?? r.theorist_name;
          if (!nm || seenTh.has(nm)) continue;
          seenTh.add(nm);
          theorists.push({ name: nm, slug: r.theorists?.slug ?? null });
        }
        return { kind: "theory" as const, tc, theorists, desks, canonReadings };
      }

      const { data: rd } = await supabase.rpc("sm_concept_readings", { p_slug: h.resolved_slug });
      const smReadings = (rd as Reading[] | null) ?? [];
      const seenTakes = new Set(smReadings.map((r) => r.take_id));
      const mergedReadings = [...smReadings, ...canonReadings.filter((r) => !seenTakes.has(r.take_id))];
      let intro: string | null = null;
      const { data: it } = await supabase.rpc("sm_concept_intro", { p_slug: h.resolved_slug });
      if (typeof it === "string" && it.trim()) intro = it.trim();
      const desks = await fetchDeskEssays(supabase, [slug, h.resolved_slug]);
      return {
        kind: "sm" as const,
        name: h.name,
        resolved: h.resolved_slug,
        intro,
        readings: mergedReadings,
        desks,
        tropes,
      };
    },
    ["concept-unified-2", slug],
    { revalidate: 1800, tags: [`idea:${slug}`, `concept:${slug}`] },
  )();
}

function introDescription(intro: string): string {
  const plain = intro.replace(/\s+/g, " ").trim();
  const sentences = plain.match(/[^.!?]+[.!?]+(\s+|$)/g);
  let out = sentences ? sentences.slice(0, 2).join("").trim() : plain;
  if (out.length > 155) {
    const cut = out.slice(0, 155);
    const sp = cut.lastIndexOf(" ");
    out = (sp > 0 ? cut.slice(0, sp) : cut).trimEnd() + "…";
  }
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Concept — Metatake" };
  if (data.kind === "takes") {
    const title = `${data.concept} in film — meaning & examples`;
    const description = `${data.concept} in cinema: ${data.tropes.length} recurring patterns across films, each tracing how the idea plays on screen.`;
    return {
      title, description,
      openGraph: { title, description },
      alternates: { canonical: `/concept/${slug}` },
      robots: pageRobots(data.tropes.length >= 3),
    };
  }
  if (data.kind === "theory") {
    const { tc, theorists, desks, canonReadings } = data;
    const L = listicle(tc.concept, theorists[0]?.name ?? null, [...desks, ...canonReadings]);
    const title = L.n >= 3
      ? `${L.n} Films That Can Be Read Through ${L.poss}`
      : `${tc.concept} — meaning, origin & the films that stage it`;
    const description = tc.one_liner
      ? `${tc.one_liner} How ${tc.concept} shows up on screen, with the essays that put it to work.`
      : L.n >= 3 && L.f1 && L.f2
        ? `From ${L.f1} to ${L.f2}: ${L.n} films whose essays put ${tc.concept} to work — every reading in one place.`
        : `${tc.concept} in cinema — definition, the thinkers behind it, and the film essays that use it.`;
    return {
      title, description,
      openGraph: { title, description },
      alternates: { canonical: `/concept/${slug}` },
      robots: pageRobots(desks.length + canonReadings.length >= 1),
    };
  }
  const Lsm = listicle(data.name, data.readings[0]?.theorist_name ?? null, [...data.readings, ...data.desks]);
  const title = Lsm.n >= 3
    ? `${Lsm.n} Films That Can Be Read Through ${Lsm.poss}`
    : `${data.name} in film — readings that stage it`;
  const description = data.intro
    ? introDescription(data.intro)
    : Lsm.n >= 3 && Lsm.f1 && Lsm.f2
      ? `From ${Lsm.f1} to ${Lsm.f2}: ${Lsm.n} films read through ${data.name} — every Strong Misreading that turns on it.`
      : `${data.name} in cinema: ${data.readings.length} readings that turn on ${data.name}, plus the desk essays that put it to work.`;
  return {
    title, description,
    alternates: { canonical: `/concept/${data.resolved}` },
    openGraph: { title, description },
    robots: pageRobots(data.readings.length + data.desks.length >= 3),
  };
}

export default async function ConceptPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();

  if (data.kind === "takes") {
    const { concept, tropes, takesDetail } = data;
    const stats = takesDetail?.stats ?? null;
    const native = takesDetail?.native ?? null;
    const theorist = takesDetail?.theorist ?? null;
    const jsonld = [
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Concepts", item: "https://metatake.net/concept" },
        { "@type": "ListItem", position: 2, name: concept, item: `https://metatake.net/concept/${slug}` },
      ] },
      { "@context": "https://schema.org", "@type": "DefinedTerm", "@id": `https://metatake.net/concept/${slug}#term`,
        name: concept, ...(native ? { alternateName: native } : {}), url: `https://metatake.net/concept/${slug}` },
    ];
    return (
      <div className="mt">
        <SiteNav />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
        <div className="mt-wrap">
          <div className="mt-crumb"><Link href="/concept">Theory</Link> › <Link href="/concept">Concepts</Link></div>
          <h1 className="mt-h1">{concept} in film{native ? <span style={{ fontWeight: 400, opacity: .55, fontSize: "0.62em" }}> · {native}</span> : null}</h1>
          <p className="mt-laconic">
            {tropes.length} ways {concept.toLowerCase()} shows up across cinema — each a recurring pattern that gathers the films sharing it.
            {theorist ? <> Most read through <Link href={`/theorist/${theorist.slug}`}>{theorist.name}</Link>.</> : null}
          </p>
          {stats ? (
            <p style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 0" }}>
              {[[stats.films, `film${stats.films === 1 ? "" : "s"}`], [stats.readings, `close reading${stats.readings === 1 ? "" : "s"}`], [stats.tropes, `trope${stats.tropes === 1 ? "" : "s"}`]].map(([n, label]) => (
                <span key={String(label)} style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(0,0,0,.055)" }}>
                  {n} <span style={{ fontWeight: 500, opacity: .7 }}>{label}</span>
                </span>
              ))}
            </p>
          ) : null}
          <div className="cat-mlist">
            {tropes.map((r) => {
              const src = r.bd ? `${IMG}/w300${r.bd}` : null;
              return (
                <Link key={r.slug} href={`/trope/${r.slug}`} className="cat-mrow">
                  <div className="cat-mrthumb">{src ? <img src={src} alt="" loading="lazy" /> : <i className="ti ti-movie" aria-hidden="true" />}</div>
                  <div className="cat-mrtext">
                    <div className="cat-mrfig">{r.title}</div>
                    <div className="cat-mrfilm">{r.films} film{r.films === 1 ? "" : "s"}{r.laconic ? ` · ${r.laconic}` : ""}</div>
                  </div>
                </Link>
              );
            })}
          </div>
          <p className="mt-see" style={{ marginTop: "1.25rem" }}>← All <Link href="/concept">concepts</Link></p>
        </div>
      </div>
    );
  }

  if (data.kind === "theory") {
    const { tc, theorists, desks, canonReadings } = data;
    const jsonld = [
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Concepts", item: "https://metatake.net/concept" },
        { "@type": "ListItem", position: 2, name: tc.concept, item: `https://metatake.net/concept/${tc.concept_slug}` },
      ] },
      { "@context": "https://schema.org", "@type": "DefinedTerm", "@id": `https://metatake.net/concept/${tc.concept_slug}#term`,
        name: tc.concept, ...(tc.native ? { alternateName: tc.native } : {}),
        ...(tc.one_liner ? { description: tc.one_liner } : {}),
        url: `https://metatake.net/concept/${tc.concept_slug}` },
    ];
    return (
      <div className="mt">
        <SiteNav />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
        <div className="mt-wrap">
          <div className="mt-crumb"><Link href="/theorist">Theory</Link> › <Link href="/concept">Concepts</Link></div>
          <div className="ccard">
            <div className="ccard__kicker">Concept</div>
            <h1 className="th-h1">{cap(tc.concept)}{tc.native ? <span style={{ fontWeight: 400, opacity: .55, fontSize: "0.6em" }}> · {tc.native}</span> : null}</h1>
            {tc.one_liner && <p className="ccard__tag">{tc.one_liner}</p>}
            <div className="ccard__meta">
              {theorists.map((t) => (
                <span className="ccard__chip" key={t.name}>
                  {t.slug ? <Link href={`/theorist/${t.slug}`}>{t.name}</Link> : t.name}
                </span>
              ))}
              {[tc.part, tc.major, tc.sub].filter(Boolean).map((x) => (
                <span key={x as string} className="ccard__chip" style={{ opacity: .75 }}>{x}</span>
              ))}
            </div>
            {(() => { const n = listicle(tc.concept, null, [...desks, ...canonReadings]).n; return n > 0 ? (
              <div className="ccard__stat"><b>{n}</b><span>film{n !== 1 ? "s" : ""}</span></div>
            ) : null; })()}
          </div>
          {desks.length + canonReadings.length >= 3 && (
            <p className="th-sub">{listicle(tc.concept, theorists[0]?.name ?? null, [...desks, ...canonReadings]).n} films that can be read through <em>{tc.concept}</em> — the readings and essays below put it to work.</p>
          )}
          {canonReadings.length > 0 && (
            <section style={{ margin: "30px 0 0" }} id="concept-readings">
              <h2 className="cmap-h2">Strong Misreadings that lean on {tc.concept}</h2>
              <ReadingsExplorer readings={canonReadings} about={tc.concept} />
            </section>
          )}
          {desks.length > 0 && (
            <section style={{ margin: "30px 0 0" }} id="concept-desks">
              <h2 className="cmap-h2">From the desks — essays that put {tc.concept} to work</h2>
              <ul className="essay-desklist" style={{ marginTop: 10 }}>
                {desks.map((d) => (
                  <li key={`${d.film_slug}/${d.desk_key}`}>
                    <Link href={`/film/${d.film_slug}/${d.desk_key}`}>
                      {d.film_title}{d.film_year ? ` (${d.film_year})` : ""} — {d.essay_title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="th-foot"><Link href="/concept">← All concepts</Link></p>
        </div>
      </div>
    );
  }

  const { name, intro, readings, desks, tropes } = data;
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/theorist">Theory</Link> › <Link href="/concept">Concepts</Link></div>
        {(() => {
          const n = listicle(name, null, [...readings, ...desks]).n;
          const freq = new Map<string, { t: Reading; c: number }>();
          for (const r of readings) {
            if (!r.theorist_name) continue;
            const e = freq.get(r.theorist_name) ?? { t: r, c: 0 };
            e.c += 1; freq.set(r.theorist_name, e);
          }
          const top = [...freq.entries()].sort((a, b) => b[1].c - a[1].c).slice(0, 2);
          return (
            <div className="ccard">
              <div className="ccard__kicker">Concept</div>
              <h1 className="th-h1">{name.charAt(0).toUpperCase() + name.slice(1)}</h1>
              {intro ? <p className="ccard__tag">{intro}</p> : null}
              <div className="ccard__meta">
                {top.map(([nm, e]) => (
                  <span className="ccard__chip" key={nm}>
                    {e.t.theorist_slug ? <Link href={`/theorist/${e.t.theorist_slug}`}>{nm}</Link> : nm}
                  </span>
                ))}
                <span className="ccard__chip" style={{ opacity: .75 }}>{readings.length} reading{readings.length !== 1 ? "s" : ""}</span>
              </div>
              {n > 0 ? <div className="ccard__stat"><b>{n}</b><span>film{n !== 1 ? "s" : ""}</span></div> : null}
            </div>
          );
        })()}
        <p className="th-sub">{listicle(name, null, [...readings, ...desks]).n} film{readings.length !== 1 ? "s" : ""} that can be read through <em>{name}</em> — each a Strong Misreading that turns on this idea.</p>

        <ReadingsExplorer readings={readings} about={name} />

        {tropes.length > 0 && (
          <section style={{ margin: "34px 0 0" }} id="concept-tropes">
            <h2 className="cmap-h2">Recurring patterns — {name} as a trope</h2>
            <div className="cat-mlist">
              {tropes.map((r) => {
                const src = r.bd ? `${IMG}/w300${r.bd}` : null;
                return (
                  <Link key={r.slug} href={`/trope/${r.slug}`} className="cat-mrow">
                    <div className="cat-mrthumb">{src ? <img src={src} alt="" loading="lazy" /> : <i className="ti ti-movie" aria-hidden="true" />}</div>
                    <div className="cat-mrtext">
                      <div className="cat-mrfig">{r.title}</div>
                      <div className="cat-mrfilm">{r.films} film{r.films === 1 ? "" : "s"}{r.laconic ? ` · ${r.laconic}` : ""}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {desks.length > 0 && (
          <section style={{ margin: "34px 0 0" }} id="concept-desks">
            <h2 className="cmap-h2">From the desks — essays that put {name} to work</h2>
            <ul className="essay-desklist" style={{ marginTop: 10 }}>
              {desks.map((d) => (
                <li key={`${d.film_slug}/${d.desk_key}`}>
                  <Link href={`/film/${d.film_slug}/${d.desk_key}`}>
                    {d.film_title}{d.film_year ? ` (${d.film_year})` : ""} — {d.essay_title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="cmap-sec" id="concept-map">
          <h2 className="cmap-h2">{name} — connection map</h2>
          <p className="cmap-stat"><b>{readings.length}</b> readings · <b>{new Set(readings.map((r) => r.film_slug)).size}</b> films</p>
          <p className="cmap-intro">The figures and films that stage <em>{name}</em>, and the theorists behind it, across Metatake&rsquo;s critical web. Click a node to open it.</p>
          <EntityMap api={`/api/map?type=idea&key=${slug}`} full={`/map?m=critical&t=idea&k=${slug}`} />
        </section>
        <p className="th-foot"><Link href="/concept">← All concepts</Link></p>
      </div>
    </div>
  );
}
