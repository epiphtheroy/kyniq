import { createClient } from "@supabase/supabase-js";

// RSS feed for the blog ("Between Film and the World").
// Needed by feed readers and blog directories (ooh.directory requires RSS);
// also gives crawlers a fresh-content signal independent of the sitemap.
export const revalidate = 600;

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
    .from("posts")
    .select("slug, title, edition_date, dek")
    .eq("status", "published")
    .order("edition_date", { ascending: false })
    .limit(50);

  const items = (data ?? [])
    .map((p) => {
      const url = `${siteUrl}/blog/${p.slug}`;
      return [
        "    <item>",
        `      <title>${escapeXml(p.title || `Between Film and the World · ${p.edition_date}`)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${new Date(`${p.edition_date}T06:00:00Z`).toUTCString()}</pubDate>`,
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
    <title>Between Film and the World — Metatake</title>
    <link>${siteUrl}/blog</link>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>The day's news, read as cinema. One short edition, almost every morning — five events and the films that already knew.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
