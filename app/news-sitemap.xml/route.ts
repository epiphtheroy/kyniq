import { createClient } from "@supabase/supabase-js";

/**
 * Google News sitemap for Now Playing (/now) — the fast lane for hourly news
 * content. Per the news-sitemap spec, only pieces from the LAST 48 HOURS are
 * listed (older pieces stay in sitemaps/now.xml); Google crawls news sitemaps
 * of active sites every few minutes. Submitted in GSC alongside sitemap.xml
 * and listed in robots.ts.
 */
export const revalidate = 300;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://metatake.net";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("now_articles")
    .select("slug, headline, published_at")
    .eq("status", "published")
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false })
    .limit(100);

  const urls = (data ?? [])
    .map((p) =>
      [
        "  <url>",
        `    <loc>${siteUrl}/now/${p.slug}</loc>`,
        "    <news:news>",
        "      <news:publication>",
        "        <news:name>Metatake</news:name>",
        "        <news:language>en</news:language>",
        "      </news:publication>",
        `      <news:publication_date>${new Date(p.published_at).toISOString()}</news:publication_date>`,
        `      <news:title>${escapeXml(p.headline)}</news:title>`,
        "    </news:news>",
        "  </url>",
      ].join("\n")
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
