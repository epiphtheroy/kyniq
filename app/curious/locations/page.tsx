import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import Link from "next/link";
import { SectionHead } from "@/components/curious/ui";
import { cachedLocationsEligibility, countryPhrase } from "@/lib/locations";

/**
 * On Location — the Curious-side index of the filming-location articles
 * (/film/locations/[slug], 2026-07-08). Every film that clears the atlas gate
 * (≥3 merged locations) gets a fact-checked, geocoded, source-cited article;
 * this page is the crawlable A–Z bridge plus the country shortcuts. The map
 * itself lives on /locations (the play layer).
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "On Location — where the films were really shot, fact-checked & mapped",
  description:
    "Filming locations, film by film: every place researched from cited sources, geocoded to the exact spot where possible, and mapped. Built sets flagged, story-world kept separate.",
  alternates: { canonical: "/curious/locations" },
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Row = { slug: string; title: string; year: number | null; n: number };

const loadIndex = unstable_cache(
  async (): Promise<{ rows: Row[]; countries: { name: string; slug: string; pins: number; films: number }[] }> => {
    const elig = await cachedLocationsEligibility();
    const bySlug = new Map(elig.films.map((f) => [f.slug, f.n]));
    const supabase = db();
    const rows: Row[] = [];
    for (let from = 0; from < 12000; from += 1000) {
      const { data } = await supabase
        .from("films")
        .select("slug, title, year, visible")
        .eq("visible", true)
        .order("title", { ascending: true })
        .range(from, from + 999);
      const batch = (data ?? []) as { slug: string; title: string; year: number | null }[];
      for (const f of batch) {
        const n = bySlug.get(f.slug);
        if (n) rows.push({ slug: f.slug, title: f.title, year: f.year, n });
      }
      if (batch.length < 1000) break;
    }
    return { rows, countries: elig.countries.slice(0, 24) };
  },
  ["curious-locations-index-1"],
  { revalidate: 86400 }
);

export default async function CuriousLocationsIndex() {
  const { rows, countries } = await loadIndex();
  const totalPins = rows.reduce((s, r) => s + r.n, 0);

  return (
    <div className="cur-wrap">
      <header className="cur-head">
        <h1>On Location<span className="q">.</span></h1>
        <p className="dek">
          Where the films were really shot — {rows.length.toLocaleString()} films,{" "}
          {totalPins.toLocaleString()} places, every one researched from cited sources, geocoded and mapped.
          Built sets are flagged as sets; the world a story claims is kept separate from where the cameras
          stood. <Link href="/methodology#locations">How we research locations →</Link>
        </p>
      </header>

      <section>
        <SectionHead title="By country" count={`${countries.length} of 73 hubs`} moreHref="/locations" moreLabel="Locations" />
        <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.9 }}>
          {countries.map((c, i) => (
            <span key={c.slug}>
              {i > 0 ? " · " : ""}
              <Link href={`/locations/${c.slug}`} style={{ color: "var(--cur-accent-soft)" }}>
                {countryPhrase(c.name)}
              </Link>
              <span style={{ color: "#8f8d8e", fontSize: 12 }}> {c.films}</span>
            </span>
          ))}
        </p>
      </section>

      <section>
        <SectionHead title="All films, A–Z" count={`${rows.length.toLocaleString()} films`} />
        <div className="cur-qindex" style={{ columns: 3 }}>
          {rows.map((f) => (
            <div className="cur-qindex__film" key={f.slug} style={{ marginBottom: 10 }}>
              <Link href={`/film/locations/${f.slug}`}>
                {f.title}
                {f.year ? <span className="yr">({f.year})</span> : null}
                <span className="yr">· {f.n} places</span>
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
