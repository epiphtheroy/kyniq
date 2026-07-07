import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import Link from "next/link";
import { SectionHead } from "@/components/curious/ui";
import { BROWSABLE, FAMILIES } from "@/lib/frameworks";

/**
 * Strong Misreadings, film by film — the Curious-side index of the
 * /film/[slug]/misreadings articles (2026-07-07). Every analyzed film
 * carries 9–15 readings assembled into one article; this page is the
 * crawlable A–Z bridge. Framework-first browsing stays at
 * /strong-misreadings (untouched).
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Strong Misreadings, film by film — every film read against the grain",
  description:
    "Every analyzed film on Metatake carries 9–15 Strong Misreadings — bold, defensible arguments filed across 14 critical frameworks. Read them film by film, as single articles.",
  alternates: { canonical: "/curious/misreadings" },
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type FilmRow = { slug: string; title: string; year: number | null; director: string | null };

const loadFilms = unstable_cache(
  async (): Promise<FilmRow[]> => {
    const supabase = db();
    const out: FilmRow[] = [];
    for (let from = 0; from < 6000; from += 1000) {
      const { data } = await supabase
        .from("films")
        .select("slug, title, year, director")
        .eq("visible", true)
        .eq("is_analyzed", true)
        .order("title", { ascending: true })
        .range(from, from + 999);
      const batch = (data ?? []) as FilmRow[];
      out.push(...batch);
      if (batch.length < 1000) break;
    }
    return out;
  },
  ["curious-misreadings-films-1"],
  { revalidate: 3600 }
);

export default async function CuriousMisreadingsIndex() {
  const films = await loadFilms();

  return (
    <div className="cur-wrap">
      <header className="cur-head">
        <h1>Strong Misreadings<span className="q">.</span></h1>
        <p className="dek">
          The boldest defensible thing each film lets you say — {films.length.toLocaleString()} films, every one read
          against the grain through up to 14 <Link href="/strong-misreadings">critical frameworks</Link>, assembled
          into a single article per film. Arguments with a thesis, never summaries.{" "}
          <Link href="/about#strong-misreadings">What is a Strong Misreading? →</Link>
        </p>
      </header>

      <section>
        <SectionHead title="Browse by framework" count={`${BROWSABLE.length} lenses`} moreHref="/strong-misreadings" moreLabel="All frameworks" />
        <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.8 }}>
          {FAMILIES.filter((f) => f.key !== "title").map((fam, fi) => (
            <span key={fam.key}>
              {fi > 0 ? <span style={{ opacity: 0.4 }}> — </span> : null}
              <b style={{ fontFamily: "var(--cur-display)", textTransform: "uppercase", letterSpacing: "0.6px", fontSize: 13 }}>{fam.label}: </b>
              {BROWSABLE.filter((f) => f.family === fam.key).map((f, i) => (
                <span key={f.slug}>
                  {i > 0 ? " · " : ""}
                  <Link href={`/strong-misreadings/${f.slug}`} style={{ color: f.color }}>{f.label}</Link>
                </span>
              ))}
            </span>
          ))}
        </p>
      </section>

      <section>
        <SectionHead title="All films, A–Z" count={`${films.length.toLocaleString()} films`} />
        <div className="cur-qindex" style={{ columns: 3 }}>
          {films.map((f) => (
            <div className="cur-qindex__film" key={f.slug} style={{ marginBottom: 10 }}>
              <Link href={`/film/${f.slug}/misreadings`}>
                {f.title}
                {f.year ? <span className="yr">({f.year})</span> : null}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <div className="cur-foot">
        <Link href="/curious">← Curious — all questions &amp; desks</Link>
      </div>
    </div>
  );
}
