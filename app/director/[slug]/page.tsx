import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";

function supabaseAnon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const name = slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return {
    title: `${name} — Director | FilmCurio`,
    description: `Films directed by ${name} and the questions readers are asking on FilmCurio.`,
  };
}

export default async function DirectorPage({ params }: Props) {
  const { slug } = await params;
  const supabase = supabaseAnon();

  // Get films by this director
  const { data: films } = await supabase
    .from("films")
    .select("id, title, year, slug, poster_path, director")
    .eq("director_slug", slug)
    .order("year", { ascending: true });

  if (!films || films.length === 0) notFound();

  const directorName = films[0].director || slug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  // Get question counts per film
  const filmIds = films.map((f) => f.id);
  const { data: questionCounts } = await supabase
    .from("questions")
    .select("film_id")
    .in("film_id", filmIds)
    .eq("status", "published");

  const qCountMap: Record<string, number> = {};
  for (const q of questionCounts ?? []) {
    qCountMap[q.film_id] = (qCountMap[q.film_id] || 0) + 1;
  }

  const totalQuestions = Object.values(qCountMap).reduce((a, b) => a + b, 0);

  // Notable questions across films
  const { data: notableQuestions } = await supabase
    .from("questions")
    .select("id, title, slug, film:films!inner(title, slug)")
    .in("film_id", filmIds)
    .eq("status", "published")
    .order("view_count", { ascending: false })
    .limit(6);

  // JSON-LD
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://filmcurio.com";
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${directorName} — Films on FilmCurio`,
    description: `Films directed by ${directorName} with reader interpretations.`,
    url: `${siteUrl}/director/${slug}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: films.map((f, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Movie",
          name: f.title,
          dateCreated: f.year?.toString(),
          url: `${siteUrl}/film/${f.slug}`,
          director: { "@type": "Person", name: directorName },
        },
      })),
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Directors" },
      { "@type": "ListItem", position: 3, name: directorName },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <main className="shell">
        <div className="ui muted" style={{ fontSize: 12, margin: "18px 0 16px" }}>
          <Link href="/" style={{ color: "var(--muted)", textDecoration: "none" }}>Home</Link> › Directors
        </div>

        <h1 className="disp" style={{ fontSize: 30, margin: 0, lineHeight: 1.18 }}>{directorName}</h1>
        <div className="ui muted" style={{ fontSize: 13, marginTop: 7 }}>
          Director · {films.length} film{films.length !== 1 ? "s" : ""} on FilmCurio · {totalQuestions} questions
        </div>

        <hr className="rule" />

        <div className="seclbl">Films</div>
        <div className="tick" />

        <div>
          {films.map((f, i) => (
            <Link
              key={f.id}
              href={`/film/${f.slug}`}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 14, padding: "12px 0",
                borderBottom: i < films.length - 1 ? "1px solid var(--hairline)" : "none",
                textDecoration: "none", color: "inherit",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 13 }}>
                {f.poster_path ? (
                  <img src={posterUrl(f.poster_path, "w185")!} alt={f.title} style={{ width: 34, height: 48, borderRadius: 4, objectFit: "cover" }} />
                ) : (
                  <span className="poster" style={{ width: 34, height: 48 }} />
                )}
                <span>
                  <span className="disp" style={{ fontSize: 17 }}>{f.title}</span>{" "}
                  <span className="ui muted" style={{ fontSize: 12 }}>{f.year}</span>
                </span>
              </span>
              <span className="ui muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                {qCountMap[f.id] || 0} questions
              </span>
            </Link>
          ))}
        </div>

        <hr className="rule" />

        <div className="seclbl">Notable questions across these films</div>
        <div className="tick" />

        <div>
          {(notableQuestions ?? []).map((q: any) => {
            const film = q.film as { title: string; slug: string };
            return (
              <Link
                key={q.id}
                href={`/film/${film.slug}/q/${q.slug}`}
                className="qrow"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <span>
                  <span className="disp" style={{ fontSize: 17 }}>{q.title}</span>
                  <span className="ui muted" style={{ fontSize: 12, display: "block", marginTop: 3 }}>{film.title}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
