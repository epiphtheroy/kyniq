import { UPDATES, CATEGORY_LABEL } from "@/lib/updates/posts";

// RSS feed for Updates (/updates) — the company-news thread. Static array, no
// DB. Mirrors app/now/feed.xml and app/feed.xml.
export const revalidate = 600;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// [text](href) → text; feeds get plain prose (relative links can't travel).
function plain(body: string): string {
  return body.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
}

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://metatake.net";
  const items = UPDATES.slice(0, 50)
    .map(
      (p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${siteUrl}/updates#${p.id}</link>
      <guid isPermaLink="true">${siteUrl}/updates#${p.id}</guid>
      <pubDate>${new Date(p.date + "T09:00:00+09:00").toUTCString()}</pubDate>
      <category>${escapeXml(CATEGORY_LABEL[p.cat])}</category>
      <description>${escapeXml(plain(p.body))}</description>
    </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Metatake Updates</title>
    <link>${siteUrl}/updates</link>
    <atom:link href="${siteUrl}/updates/feed.xml" rel="self" type="application/rss+xml"/>
    <description>What is new at Metatake — features, data, policy, index status, films.</description>
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
