import { createClient } from "@supabase/supabase-js";

// RSS feed for Now Playing (/now) — the live layer. Fast-content signal for
// crawlers and feed readers, independent of the sitemap (same pattern as the
// blog's app/feed.xml). Fresh window matters here, so the cache is short.
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
  const { data } = await supabase
    .from("now_articles")
    .select("slug, headline, dek, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);

  const items = (data ?? [])
    .map((p) => {
      const url = `${siteUrl}/now/${p.slug}`;
      return [
        "    <item>",
        `      <title>${escapeXml(p.headline)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>`,
        p.dek ? `      <description>${escapeXml(p.dek)}</description>` : null,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Now Playing — Metatake</title>
    <link>${siteUrl}/now</link>
    <atom:link href="${siteUrl}/now/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Metatake's live layer: when film and culture news spikes, the archive answers within the hour — verified facts plus the corpus record, timestamped.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
    },
  });
}
