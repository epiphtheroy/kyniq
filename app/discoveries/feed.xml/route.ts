import { DIGESTS, DISCOVERIES_ENABLED } from "@/lib/discoveries/digests";

// RSS feed for Discoveries (/discoveries). Static array, no DB. One item per
// weekly digest. Mirrors app/updates/feed.xml.
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
  // Paused with the page (DISCOVERIES_ENABLED) — a feed that outlives its page
  // is how a reader keeps a dead subscription.
  if (!DISCOVERIES_ENABLED) return new Response("Not found", { status: 404 });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://metatake.net";
  const items = DIGESTS.slice(0, 50)
    .map((d) => {
      const names = [
        ...d.featured.map((f) => f.title || f.domain),
        ...d.observed.map((o) => o.domain),
      ];
      const body = `${d.intro} Sites: ${names.join(", ")}.`;
      return `    <item>
      <title>Discoveries — ${escapeXml(d.rangeLabel)}</title>
      <link>${siteUrl}/discoveries#${d.id}</link>
      <guid isPermaLink="true">${siteUrl}/discoveries#${d.id}</guid>
      <pubDate>${new Date(d.date + "T09:00:00+09:00").toUTCString()}</pubDate>
      <description>${escapeXml(body)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Metatake Discoveries</title>
    <link>${siteUrl}/discoveries</link>
    <atom:link href="${siteUrl}/discoveries/feed.xml" rel="self" type="application/rss+xml"/>
    <description>New film websites as they appear — an observation log surfaced from newly registered domains.</description>
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
