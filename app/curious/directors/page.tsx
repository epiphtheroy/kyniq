import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import Link from "next/link";
import { SectionHead } from "@/components/curious/ui";
import { cachedAtlasEligibility } from "@/lib/atlas";
import { pageRobots } from "@/lib/seo";

/**
 * Directors, Researched — the Curious-side index of the director article
 * layer (2026-07-09): /director/x/life (sourced life facts), /director/x/
 * start (curated first-five routes), /director/x/next (kinship lists) and
 * /director/x/locations (filming-location maps). Mirrors /curious/locations
 * and /curious/misreadings in role: the crawlable A–Z bridge. Every link is
 * derived from the same source as the page it points to — rendering a link
 * to a 404 is a bug (404-link ban), so the roster is additionally gated on
 * hub existence (visible films; drops the 3 known orphan-slug facts rows).
 */
export const revalidate = 3600;

const IMG = "https://image.tmdb.org/t/p";
const SITE = "https://metatake.net";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/** PostgREST caps every response at 1000 rows — page until a short batch.
 * (director_picks ≈ 1,019 rows and director_next ≈ 1,011 rows both overflow
 * a single response, so this is load-bearing, not defensive.) */
async function fetchAll<T>(run: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 40000; from += 1000) {
    const { data } = await run(from, from + 999);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

type DirRow = {
  slug: string;
  name: string;
  profile_path: string | null;
  life: number; // sourced facts on /life — page exists from 1 (robots-gates itself at 4)
  start: number; // picks on /start — page exists from 1
  next: number; // recommendations on /next — page exists from 1
  locations: boolean; // /locations clears the atlas gate (≥2 located films & ≥6 merged pins)
};

type Index = { rows: DirRow[]; lives: number; starts: number; kinships: number; maps: number };

const loadIndex = unstable_cache(
  async (): Promise<Index> => {
    const supabase = db();
    const [hubRows, factRows, pickRows, nextRows, atlas] = await Promise.all([
      // Hub existence — /director/[slug] 404s without a visible film, so the
      // roster is gated on the same source the sitemap's directorEntries uses.
      fetchAll<{ director_slug: string }>((from, to) =>
        supabase
          .from("films")
          .select("director_slug")
          .eq("visible", true)
          .not("director_slug", "is", null)
          .order("slug")
          .range(from, to)
      ),
      // LIFE — one row per director; count = facts.length.
      fetchAll<{ director_slug: string; facts: unknown }>((from, to) =>
        supabase.from("director_facts").select("director_slug, facts").order("director_slug").range(from, to)
      ),
      // START — one row per pick (~5/director).
      fetchAll<{ director_slug: string }>((from, to) =>
        supabase.from("director_picks").select("director_slug").order("director_slug").order("pos").range(from, to)
      ),
      // NEXT — one row per recommendation, keyed by the recommending director.
      fetchAll<{ director_slug: string }>((from, to) =>
        supabase.from("director_next").select("director_slug").order("director_slug").order("pos").range(from, to)
      ),
      // LOCATIONS — the exact roster atlasEntries() puts in the sitemap
      // (atlas_eligibility_json → directors), so this can never link a 404.
      cachedAtlasEligibility(),
    ]);

    const hub = new Set(hubRows.map((r) => r.director_slug));
    const life = new Map<string, number>();
    for (const r of factRows) {
      const n = Array.isArray(r.facts) ? r.facts.length : 0;
      if (n >= 1) life.set(r.director_slug, n);
    }
    const start = new Map<string, number>();
    for (const r of pickRows) start.set(r.director_slug, (start.get(r.director_slug) ?? 0) + 1);
    const next = new Map<string, number>();
    for (const r of nextRows) next.set(r.director_slug, (next.get(r.director_slug) ?? 0) + 1);
    const locations = new Set(atlas.directors.map((d) => d.slug));

    const slugs = [...new Set([...life.keys(), ...start.keys(), ...next.keys(), ...locations])].filter((s) =>
      hub.has(s)
    );

    // Names + photos from `directors`, in batches of 150 (.in() URL length).
    const meta = new Map<string, { name: string | null; profile_path: string | null }>();
    for (let i = 0; i < slugs.length; i += 150) {
      const { data } = await supabase
        .from("directors")
        .select("slug, name, profile_path")
        .in("slug", slugs.slice(i, i + 150));
      for (const d of (data ?? []) as { slug: string; name: string | null; profile_path: string | null }[]) {
        meta.set(d.slug, { name: d.name, profile_path: d.profile_path });
      }
    }
    const fallbackName = (slug: string) =>
      slug
        .split("-")
        .filter(Boolean)
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(" ");

    const rows: DirRow[] = slugs
      .map((slug) => ({
        slug,
        name: meta.get(slug)?.name || fallbackName(slug),
        profile_path: meta.get(slug)?.profile_path ?? null,
        life: life.get(slug) ?? 0,
        start: start.get(slug) ?? 0,
        next: next.get(slug) ?? 0,
        locations: locations.has(slug),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "en"));

    return {
      rows,
      lives: rows.filter((r) => r.life > 0).length,
      starts: rows.filter((r) => r.start > 0).length,
      kinships: rows.filter((r) => r.next > 0).length,
      maps: rows.filter((r) => r.locations).length,
    };
  },
  ["curious-directors-1"],
  { revalidate: 86400 }
);

function descriptionOf(i: Index): string {
  return `${i.rows.length} film directors, researched layer by layer: ${i.lives} sourced lives, ${i.starts} where-to-start routes, ${i.kinships} who-to-watch-next kinship lists and ${i.maps} filming-location maps — every count from the database.`;
}

export async function generateMetadata(): Promise<Metadata> {
  const index = await loadIndex();
  return {
    title: "Film Directors, Researched — Lives, Starting Points, Kinships & Maps",
    description: descriptionOf(index),
    alternates: { canonical: "/curious/directors" },
    robots: pageRobots(true),
  };
}

/** A–Z bucket letter — diacritics fold (Éric → E), non-Latin → "#". */
function letterOf(name: string): string {
  const c = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .charAt(0)
    .toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}

export default async function CuriousDirectorsIndex() {
  const index = await loadIndex();
  const { rows, lives, starts, kinships, maps } = index;

  const byLetter = new Map<string, DirRow[]>();
  for (const r of rows) {
    const l = letterOf(r.name);
    const arr = byLetter.get(l) ?? [];
    arr.push(r);
    byLetter.set(l, arr);
  }
  const letters = [...byLetter.keys()].sort((a, b) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)));

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Curious", item: `${SITE}/curious` },
        { "@type": "ListItem", position: 2, name: "Directors", item: `${SITE}/curious/directors` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Film Directors, Researched — Lives, Starting Points, Kinships & Maps",
      url: `${SITE}/curious/directors`,
      description: descriptionOf(index),
      mainEntity: { "@type": "ItemList", numberOfItems: rows.length },
    },
  ];

  return (
    <div className="cur-wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="cur-head">
        <h1>
          Directors, Researched<span className="q">.</span>
        </h1>
        <p className="dek">
          {rows.length.toLocaleString()} directors · {lives.toLocaleString()} lives ·{" "}
          {starts.toLocaleString()} starting routes · {kinships.toLocaleString()} kinship lists ·{" "}
          {maps.toLocaleString()} location maps. The life — sourced moments from the person behind the
          films. Where to start — a curated first-five route through the work. Who&apos;s next — kindred
          directors, each with a reason. Locations — where the films were really shot, mapped.{" "}
          <Link href="/director">All directors on Metatake →</Link>
        </p>
      </header>

      {letters.map((letter) => {
        const items = byLetter.get(letter)!;
        return (
          <section key={letter}>
            <SectionHead title={letter} count={`${items.length} director${items.length === 1 ? "" : "s"}`} />
            <div className="cur-qindex" style={{ columns: 3 }}>
              {items.map((d) => {
                const links: { href: string; label: string }[] = [];
                if (d.life > 0) links.push({ href: `/director/${d.slug}/life`, label: `The life (${d.life})` });
                if (d.start > 0) links.push({ href: `/director/${d.slug}/start`, label: `Where to start (${d.start})` });
                if (d.next > 0) links.push({ href: `/director/${d.slug}/next`, label: `Who's next (${d.next})` });
                if (d.locations) links.push({ href: `/director/${d.slug}/locations`, label: "Locations" });
                links.push({ href: `/director/${d.slug}`, label: "Hub" });
                return (
                  <div className="cur-qindex__film" key={d.slug} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {d.profile_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${IMG}/w92${d.profile_path}`}
                          alt=""
                          loading="lazy"
                          width={40}
                          height={40}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            objectFit: "cover",
                            flex: "none",
                            background: "#0c0c0c",
                          }}
                        />
                      ) : null}
                      <Link
                        href={`/director/${d.slug}`}
                        style={{ fontFamily: "var(--cur-display)", fontWeight: 600, fontSize: 17, color: "#fff" }}
                      >
                        {d.name}
                      </Link>
                    </div>
                    <div style={{ margin: "5px 0 0", fontSize: 12.5, lineHeight: 1.8, color: "#5f5d5e" }}>
                      {links.map((l, i) => (
                        <span key={l.href}>
                          {i > 0 ? " · " : ""}
                          <Link href={l.href} style={{ color: "#cfcdce" }}>
                            {l.label}
                          </Link>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="cur-foot">
        <Link href="/curious">← Curious — all questions &amp; desks</Link>
      </div>
    </div>
  );
}
