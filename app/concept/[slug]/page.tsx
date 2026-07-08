import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import FilmTabBar from "@/components/FilmTabBar";
import EntityMap from "@/components/EntityMap";
import ReadingsExplorer from "@/components/ReadingsExplorer";
import DeskExplorer, { type DeskLink } from "@/components/DeskExplorer";
import { Card, SectionHead } from "@/components/curious/ui";
import { fw } from "@/lib/frameworks";
import { pageRobots } from "@/lib/seo";
import { listicle } from "@/lib/listicle";
import { attachKwic } from "@/lib/kwic";
import ReadingLedger from "@/components/read/ReadingLedger";
import "@/app/curious/curious.css";
import "@/app/film/[slug]/read.css";

/** Display convention: concept names lead with a capital; no quotes in headings. */
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const fmtDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

/** E-E-A-T provenance line: byline · revision date · methodology link. */
function Provenance({ updated }: { updated: string | null }) {
  const date = fmtDate(updated);
  return (
    <p style={{ margin: "10px 0 0", fontSize: 12.5, opacity: 0.62, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <span>By the Metatake concept desk</span>
      {date ? <><span aria-hidden>·</span><span>Revised {date}</span></> : null}
      <span aria-hidden>·</span>
      <Link href="/methodology" style={{ textDecoration: "underline" }}>How we read films →</Link>
    </p>
  );
}

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

async function fetchDeskEssays(supabase: ReturnType<typeof db>, slugs: string[]): Promise<DeskLink[]> {
  const seen = new Set<string>();
  const out: DeskLink[] = [];
  for (const s of [...new Set(slugs)]) {
    try {
      const { data } = await supabase.rpc("concept_desk_essays", { p_slug: s, p_limit: 48 });
      for (const d of ((data ?? []) as DeskLink[])) {
        const key = `${d.film_slug}/${d.desk_key}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(d);
        if (out.length >= 36) return out;
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

      // E-E-A-T: revision date = latest linked essay.
      let updated: string | null = null;
      try {
        const { data: lu } = await supabase.rpc("concept_last_updated", { p_slug: slug });
        if (typeof lu === "string") updated = lu;
      } catch { updated = null; }

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
        for (const r of (thRows ?? []) as unknown as { theorist_name: string | null; theorists: { slug: string; name: string } | null }[]) {
          const nm = r.theorists?.name ?? r.theorist_name;
          if (!nm || seenTh.has(nm)) continue;
          seenTh.add(nm);
          theorists.push({ name: nm, slug: r.theorists?.slug ?? null });
        }
        return { kind: "theory" as const, tc, theorists, desks: await attachKwic(supabase, desks, [tc.concept]), canonReadings, updated };
      }

      const { data: rd } = await supabase.rpc("sm_concept_readings", { p_slug: h.resolved_slug });
      const smReadings = (rd as Reading[] | null) ?? [];
      const seenTakes = new Set(smReadings.map((r) => r.take_id));
      const mergedReadings = [...smReadings, ...canonReadings.filter((r) => !seenTakes.has(r.take_id))];
      let intro: string | null = null;
      const { data: it } = await supabase.rpc("sm_concept_intro", { p_slug: h.resolved_slug });
      if (typeof it === "string" && it.trim()) intro = it.trim();
      const desksRaw = await fetchDeskEssays(supabase, [slug, h.resolved_slug]);
      const desks = await attachKwic(supabase, desksRaw, [h.name]);
      return {
        kind: "sm" as const,
        updated,
        name: h.name,
        resolved: h.resolved_slug,
        intro,
        readings: mergedReadings,
        desks,
        tropes,
      };
    },
    // v3: theory-branch desks carry KWIC excerpts (2026-07-08)
    ["concept-unified-3", slug],
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
    const { tc, theorists, desks, canonReadings, updated } = data;
    const jsonld = [
      { "@context": "https://schema.org", "@type": "WebPage",
        url: `https://metatake.net/concept/${tc.concept_slug}`,
        ...(updated ? { dateModified: updated } : {}),
        author: { "@type": "Organization", name: "Metatake", url: "https://metatake.net/methodology" },
        mainEntity: { "@id": `https://metatake.net/concept/${tc.concept_slug}#term` } },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Concepts", item: "https://metatake.net/concept" },
        { "@type": "ListItem", position: 2, name: tc.concept, item: `https://metatake.net/concept/${tc.concept_slug}` },
      ] },
      { "@context": "https://schema.org", "@type": "DefinedTerm", "@id": `https://metatake.net/concept/${tc.concept_slug}#term`,
        name: tc.concept, ...(tc.native ? { alternateName: tc.native } : {}),
        ...(tc.one_liner ? { description: tc.one_liner } : {}),
        url: `https://metatake.net/concept/${tc.concept_slug}` },
    ];
    // Deterministic aggregates over the absorbed readings — same grammar as the SM branch.
    const tName = tc.concept;
    const tCap = cap(tName);
    const tFilms = new Map<string, { title: string; year: number | null; n: number; backdrop: string | null }>();
    for (const r of canonReadings) {
      const cur = tFilms.get(r.film_slug) ?? { title: r.film_title, year: r.film_year, n: 0, backdrop: r.backdrop_path };
      cur.n += 1;
      if (!cur.backdrop && r.backdrop_path) cur.backdrop = r.backdrop_path;
      tFilms.set(r.film_slug, cur);
    }
    const tFilmArr = [...tFilms.entries()].map(([fslug, f]) => ({ slug: fslug, ...f }));
    const tDated = tFilmArr.filter((f) => (f.year ?? 0) > 1880).sort((a, b) => (a.year! - b.year!) || a.title.localeCompare(b.title));
    const tTop = [...tFilmArr].sort((a, b) => b.n - a.n || a.title.localeCompare(b.title));
    const tThFreq = new Map<string, { slug: string | null; c: number }>();
    for (const r of canonReadings) {
      if (!r.theorist_name) continue;
      const e = tThFreq.get(r.theorist_name) ?? { slug: r.theorist_slug, c: 0 };
      e.c += 1; tThFreq.set(r.theorist_name, e);
    }
    const tThTop = [...tThFreq.entries()].sort((a, b) => b[1].c - a[1].c).slice(0, 3);
    const tFwFreq = new Map<string, number>();
    for (const r of canonReadings) { const l = fw(r.framework).label; tFwFreq.set(l, (tFwFreq.get(l) ?? 0) + 1); }
    const tFwTop = [...tFwFreq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const tFig = new Map<string, { n: number; href: string; bd: string | null; film: string }>();
    for (const r of canonReadings) {
      const k = r.fig_label.toLowerCase();
      const cur = tFig.get(k) ?? { n: 0, href: `/film/${r.film_slug}/figure/${r.fig_slug}`, bd: r.backdrop_path, film: r.film_title };
      cur.n += 1;
      if (!cur.bd && r.backdrop_path) { cur.bd = r.backdrop_path; cur.film = r.film_title; }
      tFig.set(k, cur);
    }
    const tFigTop = [...tFig.entries()].map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).slice(0, 24);
    const tHeroBd = tTop.find((f) => f.backdrop)?.backdrop ?? desks.find((d) => d.backdrop_path)?.backdrop_path ?? null;
    const tHeroTitle = tTop.find((f) => f.backdrop)?.title ?? desks.find((d) => d.backdrop_path)?.film_title ?? null;

    return (
      <div className="mt">
        <SiteNav />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />

        {/* ── Dark hero: the concept as a working lens, counted ── */}
        <div className="cur rd-hero">
          <div className="rd-hero__in">
            <div className="rd-hero__txt">
              <div className="rd-crumb">
                <Link href="/theorist">Theory</Link><span>›</span>
                <Link href="/concept">Concepts</Link><span>›</span>
                <span>{tCap}</span>
              </div>
              <div className="rd-chiprow">
                <span className="rd-chip"><Link href="/concept" style={{ color: "inherit", textDecoration: "none" }}>Concepts on Screen</Link></span>
                <span className="rd-meta">
                  {canonReadings.length > 0 ? `${canonReadings.length} readings · ${tFilmArr.length} films` : `${desks.length} essays`}
                  {updated ? ` · revised ${fmtDate(updated) ?? ""}` : ""}
                </span>
              </div>
              <h1 className="rd-h1">{tCap}{tc.native ? <span style={{ fontSize: "0.45em", fontWeight: 500, opacity: 0.6, marginLeft: 12 }}>{tc.native}</span> : null}</h1>
              <p className="rd-dek">
                {canonReadings.length > 0 ? (
                  <>
                    {canonReadings.length} Strong Misreading{canonReadings.length === 1 ? "" : "s"} stage {tName} across{" "}
                    {tFilmArr.length} film{tFilmArr.length === 1 ? "" : "s"} of the Metatake corpus
                    {tDated.length > 1 ? <> — from <i>{tDated[0].title}</i> ({tDated[0].year}) to <i>{tDated[tDated.length - 1].title}</i> ({tDated[tDated.length - 1].year})</> : null}
                    {tThTop[0] ? <>, most often after {tThTop[0][0]}</> : null}.
                  </>
                ) : (
                  <>{desks.length} desk essay{desks.length === 1 ? "" : "s"} put {tName} to work across the Metatake corpus.</>
                )}
                {" "}Every entry below is a close reading of a scene, not a definition.
              </p>
            </div>
            {tHeroBd ? (
              <div className="rd-hero__media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="rd-hero__bd" src={`${IMG}/w780${tHeroBd}`} alt="" width={780} height={439} />
                <div className="rd-hero__cap">From {tHeroTitle} · via TMDB</div>
              </div>
            ) : null}
          </div>
        </div>

        <FilmTabBar
          center
          search={canonReadings.length > 0 ? { event: "theory:q", targetId: "concept-slate", placeholder: `Search ${canonReadings.length} readings…` } : undefined}
          tabs={[
            { id: "spelled-out", label: "Spelled out", color: "#D64534" },
            ...(tFigTop.length ? [{ id: "concept-figures", label: "Figures", badge: tFigTop.length, color: "#B8863B" }] : []),
            ...(desks.length ? [{ id: "concept-desks", label: "Desk essays", badge: desks.length, color: "#C87A2C" }] : []),
            ...(canonReadings.length ? [{ id: "concept-slate", label: "The full slate", badge: canonReadings.length, color: "#12897A" }] : []),
          ]}
        />

        <div className="mt-wrap">
          <Provenance updated={updated} />
          <div className="cmeta">
            {theorists.map((t) => (
              <span className="ccard__chip" key={t.name}>
                {t.slug ? <Link href={`/theorist/${t.slug}`}>{t.name}</Link> : t.name}
              </span>
            ))}
            {[tc.part, tc.major, tc.sub].filter(Boolean).map((x) => (
              <span key={x as string} className="ccard__chip" style={{ opacity: .75 }}>{x}</span>
            ))}
          </div>
          {tc.one_liner && (
            <p className="body reading" style={{ fontSize: 16, margin: "14px 0 0", maxWidth: "66ch" }}>
              <b style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", opacity: .55 }}>The idea in brief</b>{" "}
              — {tc.one_liner}
            </p>
          )}

          {/* ── The concept, spelled out — deterministic sentences ── */}
          <section style={{ margin: "22px 0 0" }} id="spelled-out">
            <h2 className="cmap-h2">{tCap}, spelled out</h2>
            <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.7, fontSize: 15, maxWidth: "78ch" }}>
              {canonReadings.length > 0 ? (
                <li>
                  {tCap} carries {canonReadings.length} Strong Misreading{canonReadings.length === 1 ? "" : "s"} across {tFilmArr.length} film{tFilmArr.length === 1 ? "" : "s"}
                  {tDated.length > 1 ? <>, from <Link href={`/film/${tDated[0].slug}`}>{tDated[0].title}</Link> ({tDated[0].year}) to <Link href={`/film/${tDated[tDated.length - 1].slug}`}>{tDated[tDated.length - 1].title}</Link> ({tDated[tDated.length - 1].year})</> : null}.
                </li>
              ) : null}
              {theorists.length > 0 ? (
                <li>
                  The theorists behind it: {theorists.slice(0, 4).map((t, i) => <span key={t.name}>{i > 0 ? " · " : ""}{t.slug ? <Link href={`/theorist/${t.slug}`}>{t.name}</Link> : t.name}</span>)}.
                </li>
              ) : null}
              {tFwTop[0] && canonReadings.length > 1 ? (
                <li>
                  The framework that stages {tName} most is <b>{tFwTop[0][0]}</b> ({tFwTop[0][1]} of {canonReadings.length})
                  {tFwTop[1] ? <>, ahead of {tFwTop[1][0]} ({tFwTop[1][1]})</> : null}.
                </li>
              ) : null}
              {tTop[0] && tTop[0].n > 1 ? (
                <li>
                  The film that stages it most is <Link href={`/film/${tTop[0].slug}`}>{tTop[0].title}</Link>
                  {tTop[0].year ? ` (${tTop[0].year})` : ""} — {tTop[0].n} readings there turn on {tName}.
                </li>
              ) : null}
              {desks.length > 0 ? (
                <li>
                  {desks.length} desk essay{desks.length === 1 ? "" : "s"} put {tName} to work — each is linked below.
                </li>
              ) : null}
            </ul>
            <ReadingLedger subject={tName} readings={canonReadings} essays={desks} />
          </section>

          {tFigTop.length > 0 ? (
            <section style={{ margin: "30px 0 0" }} id="concept-figures">
              <h2 className="cmap-h2">The figures that carry {tName}</h2>
              <p className="cmap-intro">The recurring anchors — characters, objects, places, forms — where {tName} does its work. Each chip opens a figure page.</p>
              <div className="fig-cloud">
                {tFigTop.map((f) => (
                  <Link key={f.label} href={f.href} className={`fig-chip${f.bd ? "" : " fig-chip--bare"}`}>
                    {f.bd ? <img src={`${IMG}/w300${f.bd}`} alt={`${f.film} still`} width={56} height={32} loading="lazy" /> : null}
                    <span>{f.label}{f.n > 1 ? <span className="fig-chip__n"> ×{f.n}</span> : null}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {desks.length > 0 && (
            <section style={{ margin: "34px 0 0" }} id="concept-desks">
              <h2 className="cmap-h2">From the desks — essays that put {tName} to work</h2>
              <DeskExplorer desks={desks} about={tName} listenEvent="theory:q" />
            </section>
          )}

          {canonReadings.length > 0 && (
            <section style={{ margin: "34px 0 0" }} id="concept-slate">
              <h2 className="cmap-h2">The full slate — {canonReadings.length} reading{canonReadings.length === 1 ? "" : "s"}</h2>
              <p className="cmap-intro">The complete archive, searchable and filterable by framework and decade. Each card links into the film&apos;s figure page, where the reading lives.</p>
              <ReadingsExplorer readings={canonReadings} about={tName} listenEvent="theory:q" />
            </section>
          )}

          {tTop.length > 0 ? (
            <section style={{ margin: "30px 0 0" }} id="concept-films">
              <h2 className="cmap-h2">The films that stage {tName}</h2>
              <p className="cmap-intro">Every panel opens the film — the readings there put {tName} to work in the scenes.</p>
              <div className="crd-grid">
                {tTop.slice(0, 6).map((f) => (
                  <a className="crd-panel" href={`/film/${f.slug}`} key={f.slug}>
                    {f.backdrop
                      ? /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={`${IMG}/w300${f.backdrop}`} alt="" width={124} height={70} loading="lazy" style={{ width: 124, height: 70, borderRadius: 6 }} />
                      : <span className="crd-ph" style={{ width: 124, height: 70, fontSize: 22 }} aria-hidden>{f.title[0]}</span>}
                    <span>
                      <span className="crd-k">{f.n} reading{f.n === 1 ? "" : "s"} · {tName}</span>
                      <h3>{f.title}{f.year ? ` (${f.year})` : ""}</h3>
                      <span className="crd-go">Open the film →</span>
                    </span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 26 }}>
            Analysis by Metatake Editorial · edited by <Link href="/editor">Wonwoo Yoon</Link> · <Link href="/methodology">How we read films →</Link>
          </p>
          <p className="th-foot"><Link href="/concept">← All concepts</Link></p>
        </div>

        {tTop.filter((f) => f.backdrop).length >= 2 ? (
          <div className="cur rd-plates">
            <div className="cur-wrap">
              <SectionHead title={`Keep reading through ${tName}`} count={`${Math.min(5, tTop.length)} doors`} />
              <div className="cur-grid">
                {tTop.filter((f) => f.backdrop).slice(0, 5).map((f) => (
                  <Card
                    key={f.slug}
                    href={`/film/${f.slug}/misreadings`}
                    film={{ slug: f.slug, title: f.title, year: f.year, backdrop_path: f.backdrop, poster_path: null }}
                    title={`${f.title}, read against the grain — the misreadings article`}
                    tag="Strong Misreadings"
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const { name, intro, readings, desks, tropes, updated } = data;
  const capName = name.charAt(0).toUpperCase() + name.slice(1);

  // ── Deterministic aggregates (the verbalizer) ──
  const filmsMap = new Map<string, { title: string; year: number | null; n: number; backdrop: string | null }>();
  for (const r of readings) {
    const cur = filmsMap.get(r.film_slug) ?? { title: r.film_title, year: r.film_year, n: 0, backdrop: r.backdrop_path };
    cur.n += 1;
    if (!cur.backdrop && r.backdrop_path) cur.backdrop = r.backdrop_path;
    filmsMap.set(r.film_slug, cur);
  }
  const filmArr = [...filmsMap.entries()].map(([fslug, f]) => ({ slug: fslug, ...f }));
  const datedF = filmArr.filter((f) => (f.year ?? 0) > 1880).sort((a, b) => (a.year! - b.year!) || a.title.localeCompare(b.title));
  const topFilmsC = [...filmArr].sort((a, b) => b.n - a.n || a.title.localeCompare(b.title));
  const thFreq = new Map<string, { slug: string | null; c: number }>();
  for (const r of readings) {
    if (!r.theorist_name) continue;
    const e = thFreq.get(r.theorist_name) ?? { slug: r.theorist_slug, c: 0 };
    e.c += 1; thFreq.set(r.theorist_name, e);
  }
  const thTop = [...thFreq.entries()].sort((a, b) => b[1].c - a[1].c).slice(0, 3);
  const fwFreq = new Map<string, number>();
  for (const r of readings) { const l = fw(r.framework).label; fwFreq.set(l, (fwFreq.get(l) ?? 0) + 1); }
  const fwTopC = [...fwFreq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const heroBd = topFilmsC.find((f) => f.backdrop)?.backdrop ?? null;
  const figCountC = new Map<string, { n: number; href: string; bd: string | null; film: string }>();
  for (const r of readings) {
    const k = r.fig_label.toLowerCase();
    const cur = figCountC.get(k) ?? { n: 0, href: `/film/${r.film_slug}/figure/${r.fig_slug}`, bd: r.backdrop_path, film: r.film_title };
    cur.n += 1;
    if (!cur.bd && r.backdrop_path) { cur.bd = r.backdrop_path; cur.film = r.film_title; }
    figCountC.set(k, cur);
  }
  const figTopC = [...figCountC.entries()].map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).slice(0, 24);

  const smJsonld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Concepts", item: "https://metatake.net/concept" },
      { "@type": "ListItem", position: 2, name: capName, item: `https://metatake.net/concept/${data.resolved}` },
    ] },
    { "@context": "https://schema.org", "@type": "DefinedTerm", "@id": `https://metatake.net/concept/${data.resolved}#term`,
      name: capName, url: `https://metatake.net/concept/${data.resolved}`,
      ...(intro ? { description: introDescription(intro) } : {}) },
  ];

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(smJsonld) }} />

      {/* ── Dark hero: the concept as a working lens, counted ── */}
      <div className="cur rd-hero">
        <div className="rd-hero__in">
          <div className="rd-hero__txt">
            <div className="rd-crumb">
              <Link href="/theorist">Theory</Link><span>›</span>
              <Link href="/concept">Concepts</Link><span>›</span>
              <span>{capName}</span>
            </div>
            <div className="rd-chiprow">
              <span className="rd-chip"><Link href="/concept" style={{ color: "inherit", textDecoration: "none" }}>Concepts on Screen</Link></span>
              <span className="rd-meta">{readings.length} readings · {filmArr.length} films{updated ? ` · revised ${fmtDate(updated) ?? ""}` : ""}</span>
            </div>
            <h1 className="rd-h1">{capName}</h1>
            <p className="rd-dek">
              {readings.length} Strong Misreading{readings.length === 1 ? "" : "s"} stage {name} across{" "}
              {filmArr.length} film{filmArr.length === 1 ? "" : "s"} of the Metatake corpus
              {datedF.length > 1 ? <> — from <i>{datedF[0].title}</i> ({datedF[0].year}) to <i>{datedF[datedF.length - 1].title}</i> ({datedF[datedF.length - 1].year})</> : null}
              {thTop[0] ? <>, most often after {thTop[0][0]}</> : null}.
              {" "}Every entry below is a close reading of a scene, not a definition.
            </p>
          </div>
          {heroBd ? (
            <div className="rd-hero__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="rd-hero__bd" src={`${IMG}/w780${heroBd}`} alt="" width={780} height={439} />
              <div className="rd-hero__cap">From {topFilmsC[0]?.title} · via TMDB</div>
            </div>
          ) : null}
        </div>
      </div>

      <FilmTabBar
        center
        search={{ event: "theory:q", targetId: "concept-slate", placeholder: `Search ${readings.length} readings…` }}
        tabs={[
          { id: "spelled-out", label: "Spelled out", color: "#D64534" },
          ...(figTopC.length ? [{ id: "concept-figures", label: "Figures", badge: figTopC.length, color: "#B8863B" }] : []),
          ...(tropes.length ? [{ id: "concept-tropes", label: "Patterns", badge: tropes.length, color: "#6B4E9E" }] : []),
          ...(desks.length ? [{ id: "concept-desks", label: "Desk essays", badge: desks.length, color: "#C87A2C" }] : []),
          { id: "concept-map", label: "Connections", color: "#2F6DB0" },
          { id: "concept-slate", label: "The full slate", badge: readings.length, color: "#12897A" },
        ]}
      />

      <div className="mt-wrap">
        <Provenance updated={updated} />
        {intro ? (
          <p className="body reading" style={{ fontSize: 16, margin: "14px 0 0", maxWidth: "66ch" }}>
            <b style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", opacity: .55 }}>The idea in brief</b>{" "}
            — {intro}
          </p>
        ) : null}

        {/* ── The concept, spelled out — deterministic sentences ── */}
        <section style={{ margin: "22px 0 0" }} id="spelled-out">
          <h2 className="cmap-h2">{capName}, spelled out</h2>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.7, fontSize: 15, maxWidth: "78ch" }}>
            <li>
              {capName} carries {readings.length} Strong Misreading{readings.length === 1 ? "" : "s"} across {filmArr.length} film{filmArr.length === 1 ? "" : "s"}
              {datedF.length > 1 ? <>, from <Link href={`/film/${datedF[0].slug}`}>{datedF[0].title}</Link> ({datedF[0].year}) to <Link href={`/film/${datedF[datedF.length - 1].slug}`}>{datedF[datedF.length - 1].title}</Link> ({datedF[datedF.length - 1].year})</> : null}.
            </li>
            {thTop.length > 0 ? (
              <li>
                The theorists behind it here: {thTop.map(([nm, e], i) => <span key={nm}>{i > 0 ? " · " : ""}{e.slug ? <Link href={`/theorist/${e.slug}`}>{nm}</Link> : nm} ({e.c})</span>)}.
              </li>
            ) : null}
            {fwTopC[0] ? (
              <li>
                The framework that stages {name} most is <b>{fwTopC[0][0]}</b> ({fwTopC[0][1]} of {readings.length})
                {fwTopC[1] ? <>, ahead of {fwTopC[1][0]} ({fwTopC[1][1]})</> : null}.
              </li>
            ) : null}
            {topFilmsC[0] && topFilmsC[0].n > 1 ? (
              <li>
                The film that stages it most is <Link href={`/film/${topFilmsC[0].slug}`}>{topFilmsC[0].title}</Link>
                {topFilmsC[0].year ? ` (${topFilmsC[0].year})` : ""} — {topFilmsC[0].n} readings there turn on {name}.
              </li>
            ) : null}
            {tropes.length > 0 ? (
              <li>
                As a recurring pattern, {name} anchors {tropes.length} trope{tropes.length === 1 ? "" : "s"} — the shelf is below.
              </li>
            ) : null}
          </ul>
          <ReadingLedger subject={name} readings={readings} essays={desks} />
        </section>

        {figTopC.length > 0 ? (
          <section style={{ margin: "30px 0 0" }} id="concept-figures">
            <h2 className="cmap-h2">The figures that carry {name}</h2>
            <p className="cmap-intro">The recurring anchors — characters, objects, places, forms — where {name} does its work. Each chip opens a figure page.</p>
            <div className="fig-cloud">
              {figTopC.map((f) => (
                <Link key={f.label} href={f.href} className={`fig-chip${f.bd ? "" : " fig-chip--bare"}`}>
                  {f.bd ? <img src={`${IMG}/w300${f.bd}`} alt={`${f.film} still`} width={56} height={32} loading="lazy" /> : null}
                  <span>{f.label}{f.n > 1 ? <span className="fig-chip__n"> ×{f.n}</span> : null}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

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
            <DeskExplorer desks={desks} about={name} listenEvent="theory:q" />
          </section>
        )}

        <section className="cmap-sec" id="concept-map">
          <h2 className="cmap-h2">Connections — {name} across the map</h2>
          <p className="cmap-stat"><b>{readings.length}</b> readings · <b>{new Set(readings.map((r) => r.film_slug)).size}</b> films</p>
          <p className="cmap-intro">The figures and films that stage <em>{name}</em>, and the theorists behind it, across Metatake&rsquo;s critical web. Click a node to open it.</p>
          <EntityMap api={`/api/map?type=idea&key=${slug}`} full={`/map?m=critical&t=idea&k=${slug}`} />
        </section>
        <section style={{ margin: "34px 0 0" }} id="concept-slate">
          <h2 className="cmap-h2">The full slate — {readings.length} readings</h2>
          <p className="cmap-intro">The complete archive, searchable and filterable by framework and decade. Each card links into the film&apos;s figure page, where the reading lives.</p>
          <ReadingsExplorer readings={readings} about={name} listenEvent="theory:q" />
        </section>

        {/* ── The doors in: the films that stage it most ── */}
        <section style={{ margin: "30px 0 0" }} id="concept-films">
          <h2 className="cmap-h2">The films that stage {name}</h2>
          <p className="cmap-intro">Every panel opens the film — the readings there put {name} to work in the scenes.</p>
          <div className="crd-grid">
            {topFilmsC.slice(0, 6).map((f) => (
              <a className="crd-panel" href={`/film/${f.slug}`} key={f.slug}>
                {f.backdrop
                  ? /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={`${IMG}/w300${f.backdrop}`} alt="" width={124} height={70} loading="lazy" style={{ width: 124, height: 70, borderRadius: 6 }} />
                  : <span className="crd-ph" style={{ width: 124, height: 70, fontSize: 22 }} aria-hidden>{f.title[0]}</span>}
                <span>
                  <span className="crd-k">{f.n} reading{f.n === 1 ? "" : "s"} · {name}</span>
                  <h3>{f.title}{f.year ? ` (${f.year})` : ""}</h3>
                  <span className="crd-go">Open the film →</span>
                </span>
              </a>
            ))}
          </div>
        </section>

        <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 26 }}>
          Analysis by Metatake Editorial · edited by <Link href="/editor">Wonwoo Yoon</Link> · <Link href="/methodology">How we read films →</Link>
        </p>
        <p className="th-foot"><Link href="/concept">← All concepts</Link></p>
      </div>

      {topFilmsC.filter((f) => f.backdrop).length >= 2 ? (
        <div className="cur rd-plates">
          <div className="cur-wrap">
            <SectionHead title={`Keep reading through ${name}`} count={`${Math.min(5, topFilmsC.length)} doors`} />
            <div className="cur-grid">
              {topFilmsC.filter((f) => f.backdrop).slice(0, 5).map((f) => (
                <Card
                  key={f.slug}
                  href={`/film/${f.slug}/misreadings`}
                  film={{ slug: f.slug, title: f.title, year: f.year, backdrop_path: f.backdrop, poster_path: null }}
                  title={`${f.title}, read against the grain — the misreadings article`}
                  tag="Strong Misreadings"
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
