import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_INDEXABLE } from "@/lib/seo";

/**
 * Dynamic sitemap — SPEC §8.5
 * Only published content. Includes films, questions, director hubs, and public profiles.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://metatake.net";
  // While not launch-ready, advertise nothing — pages are noindex anyway.
  if (!SITE_INDEXABLE) return [{ url: siteUrl, lastModified: new Date() }];
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const entries: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/film`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/meta-takes`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/tropes`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/latest`, lastModified: new Date(), changeFrequency: "daily", priority: 0.6 },
  ];

  // Published readings (/take) + tropes (/trope) — the core interpretive corpus.
  const { data: metas } = await supabase
    .from("meta_takes")
    .select("slug, kind, updated_at, created_at")
    .eq("status", "published")
    .in("kind", ["reading", "figure_type"]);
  for (const m of metas ?? []) {
    entries.push({
      url: `${siteUrl}/${m.kind === "figure_type" ? "trope" : "take"}/${m.slug}`,
      lastModified: new Date(m.updated_at || m.created_at),
      changeFrequency: "weekly",
      priority: m.kind === "figure_type" ? 0.7 : 0.85,
    });
  }

  // Films — only those with real content (>=3 figures). Just-added films with no
  // figures yet are NOT advertised to search engines (thin-content guard); they
  // enter the sitemap automatically once film-extract populates them.
  const { data: films } = await supabase.from("films").select("slug, created_at").eq("visible", true);
  for (const f of films ?? []) {
    entries.push({
      url: `${siteUrl}/film/${f.slug}`,
      lastModified: new Date(f.created_at),
      changeFrequency: "weekly",
      priority: 0.8,
    });
    entries.push({
      url: `${siteUrl}/movies-like/${f.slug}`,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  // Concept (canonical-term) pages
  entries.push({ url: `${siteUrl}/concept`, changeFrequency: "weekly", priority: 0.7 });
  const { data: concepts } = await supabase.rpc("concept_index");
  for (const c of (concepts ?? []) as { slug: string }[]) {
    entries.push({ url: `${siteUrl}/concept/${c.slug}`, changeFrequency: "weekly", priority: 0.6 });
  }

  // Published questions
  const { data: questions } = await supabase
    .from("questions")
    .select("slug, published_at, created_at, film:films!inner(slug, visible)")
    .eq("status", "published")
    .eq("film.visible", true);

  for (const q of questions ?? []) {
    const film = q.film as unknown as { slug: string };
    entries.push({
      url: `${siteUrl}/film/${film.slug}/q/${q.slug}`,
      lastModified: new Date(q.published_at || q.created_at),
      changeFrequency: "weekly",
      priority: 0.9,
    });
  }

  // Director hubs (unique director_slugs)
  const { data: directors } = await supabase
    .from("films")
    .select("director_slug")
    .eq("visible", true)
    .not("director_slug", "is", null);

  const uniqueDirectors = new Set((directors ?? []).map((d) => d.director_slug).filter(Boolean));
  for (const ds of uniqueDirectors) {
    entries.push({
      url: `${siteUrl}/director/${ds}`,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // Public profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("username")
    .eq("is_public", true)
    .neq("role", "system");

  for (const p of profiles ?? []) {
    if (p.username) {
      entries.push({
        url: `${siteUrl}/u/${p.username}`,
        changeFrequency: "weekly",
        priority: 0.4,
      });
    }
  }

  return entries;
}
