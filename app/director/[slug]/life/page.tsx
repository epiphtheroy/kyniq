import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import Byline from "@/components/Byline";
import { pageRobots } from "@/lib/seo";
import { directorNative } from "@/lib/nativeName";

/**
 * /director/[slug]/life — "Who is X?" as its own indexable page.
 * The director page keeps a teaser (first facts + link here); this page is
 * the full researched life: name meaning, intro, every sourced fact.
 */
export const revalidate = 3600;
export async function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";

type Fact = { n: number; text: string; source?: string | null };
type FactsRow = { director_slug: string; name_meaning: string | null; intro: string | null; facts: Fact[] };

function load(slug: string) {
  return unstable_cache(
    async () => {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const [{ data: facts }, { data: d }, { data: films }] = await Promise.all([
        supabase.from("director_facts").select("director_slug, name_meaning, intro, facts").eq("director_slug", slug).maybeSingle(),
        supabase.from("directors").select("name, profile_path, birthday, place_of_birth").eq("slug", slug).maybeSingle(),
        supabase.from("films").select("slug, title, year, director").eq("director_slug", slug).eq("visible", true).order("year"),
      ]);
      if (!facts || !Array.isArray(facts.facts) || facts.facts.length === 0) return null;
      const director = d?.name || films?.[0]?.director || slug.replace(/-/g, " ");
      return { facts: facts as FactsRow, d, films: films ?? [], director };
    },
    ["director-life", slug],
    { revalidate: 3600, tags: [`director:${slug}`] },
  )();
}

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const native = await directorNative(data.director);
  const n = data.facts.facts.length;
  const title = `Who Is ${data.director}${native ? ` (${native})` : ""}? — ${n} Researched Moments from the Life`;
  const description = data.facts.intro
    ? data.facts.intro.slice(0, 155)
    : `${n} verified moments from ${data.director}'s life — each one checked against a live source. The person behind the films.`;
  return {
    title,
    description,
    authors: [{ name: "Metatake Editorial", url: "https://metatake.net/about" }],
    alternates: { canonical: `/director/${slug}/life` },
    openGraph: { title, description, type: "profile" },
    robots: pageRobots(n >= 4),
  };
}

export default async function DirectorLifePage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { facts, d, films, director } = data;
  const native = await directorNative(director);
  const sorted = facts.facts.slice().sort((a, b) => a.n - b.n);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: `Who Is ${director}?`,
    url: `https://metatake.net/director/${slug}/life`,
    mainEntity: {
      "@type": "Person",
      name: director,
      ...(native ? { alternateName: native } : {}),
      jobTitle: "Film director",
      ...(d?.birthday ? { birthDate: d.birthday } : {}),
      ...(d?.place_of_birth ? { birthPlace: d.place_of_birth } : {}),
      ...(d?.profile_path ? { image: `${IMG}/w342${d.profile_path}` } : {}),
      url: `https://metatake.net/director/${slug}`,
    },
    author: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
    editor: { "@type": "Person", "@id": "https://metatake.net/editor#person", name: "Wonwoo Yoon", url: "https://metatake.net/editor" },
    publisher: { "@type": "Organization", "@id": "https://metatake.net/#org", name: "Metatake" },
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mt-wrap" style={{ maxWidth: 820, padding: "28px 20px 60px" }}>
        <div className="df-crumb" style={{ marginBottom: 14 }}>
          <Link href="/director">Directors</Link><span className="df-sep">›</span>
          <Link href={`/director/${slug}`}>{director}</Link><span className="df-sep">›</span><span>The Life</span>
        </div>

        <header style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 8 }}>
          {d?.profile_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${IMG}/w185${d.profile_path}`} alt={director} width={96} height={144} style={{ borderRadius: 8, objectFit: "cover" }} />
          ) : null}
          <div>
            <h1 style={{ fontSize: 30, lineHeight: 1.15, margin: "2px 0 4px" }}>
              Who is {director}{native ? <span style={{ fontWeight: 400, opacity: 0.72 }}> ({native})</span> : null}?
            </h1>
            <p style={{ margin: "0 0 6px", opacity: 0.8 }}>
              {sorted.length} researched moments from the life behind {films.length ? `${films.length} films` : "the films"} — each verified against a live source.
            </p>
            <Byline />
          </div>
        </header>

        {facts.name_meaning ? (
          <div className="dr-namemean" style={{ margin: "18px 0" }}>
            <span className="dr-nm-k">The name</span>
            <p>{facts.name_meaning}</p>
          </div>
        ) : null}

        {facts.intro ? <p className="dr-life-intro" style={{ fontSize: 17, lineHeight: 1.65 }}>{facts.intro}</p> : null}

        <ol className="dr-life-list">
          {sorted.map((f) => {
            let host = "";
            try { if (f.source) host = new URL(f.source).hostname.replace(/^www\./, ""); } catch {}
            return (
              <li key={f.n} className="dr-fact">
                {f.text}
                {f.source ? <> <a className="dr-fact-src" href={f.source} target="_blank" rel="noopener nofollow" title={f.source}>↗ {host}</a></> : null}
              </li>
            );
          })}
        </ol>
        <div className="dr-src">Each fact is written freely, then verified against a live web source (English &amp; native-language). Source link per fact.</div>

        <p style={{ marginTop: 26 }}>
          <Link className="rcp-h" href={`/director/${slug}`}>← {director} on Metatake: films, readings &amp; where to start</Link>
        </p>
      </div>
    </div>
  );
}
