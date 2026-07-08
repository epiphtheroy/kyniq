import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Metadata } from "next";
import { anchorHref, fmtTime, type NowArticle } from "@/lib/now";

/**
 * Now Playing index — the live layer's front page: every piece, newest first,
 * grouped by day, the publish clock leading every row.
 * Spec: hourly/README.md (v2) — beat-first, data-deep, 2–4 pieces/day.
 */
export const revalidate = 120;

export const metadata: Metadata = {
  title: "Now Playing — what's spiking, read through the archive",
  description:
    "Metatake's live layer: when film and culture news spikes, the archive answers within the hour — verified facts plus the corpus record of the films and people involved, timestamped.",
  alternates: {
    canonical: "/now",
    types: { "application/rss+xml": "/now/feed.xml" },
  },
  robots: { googleBot: { "max-image-preview": "large" } },
};

type Row = Pick<
  NowArticle,
  "slug" | "headline" | "dek" | "keyword" | "anchor_type" | "anchor_slug" | "anchor_label" | "published_at" | "updated_at"
>;

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const dayOf = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function NowIndex() {
  let rows: Row[] = [];
  try {
    const { data } = await db()
      .from("now_articles")
      .select("slug, headline, dek, keyword, anchor_type, anchor_slug, anchor_label, published_at, updated_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(60)
      .abortSignal(AbortSignal.timeout(4500));
    rows = (data as Row[] | null) ?? [];
  } catch {
    rows = [];
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://metatake.net";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Now Playing — Metatake's live layer",
    url: `${siteUrl}/now`,
    description:
      "When film and culture news spikes, the archive answers within the hour: verified facts plus the corpus record, timestamped.",
    publisher: { "@type": "Organization", name: "Metatake", url: siteUrl },
  };

  const groups: { day: string; rows: Row[] }[] = [];
  for (const r of rows) {
    const day = dayOf(r.published_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(r);
    else groups.push({ day, rows: [r] });
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="cur-wrap" style={{ maxWidth: 900 }}>
        <header className="cur-head" style={{ paddingTop: 30 }}>
          <div className="now-live"><span className="dot" />Live</div>
          <h1 style={{ marginTop: 10 }}>Now Playing</h1>
          <p className="dek">
            The live layer. When the world starts searching a film, a filmmaker, a moment — the archive answers
            within the hour: what happened, verified, and what the record already knows. Every piece is timestamped;
            every claim is one click from its data.
          </p>
        </header>

        {groups.length === 0 ? (
          <p className="cur-edby" style={{ padding: "30px 0 60px" }}>
            The projector is warming up — the first pieces land here soon. Meanwhile,{" "}
            <Link href="/blog">read The Daily</Link>.
          </p>
        ) : (
          groups.map((g) => (
            <section key={g.day}>
              <div className="now-day">{g.day}</div>
              {g.rows.map((r) => {
                const ah = anchorHref(r);
                return (
                  <Link className="now-row" href={`/now/${r.slug}`} key={r.slug}>
                    <div className="t">
                      <b>{fmtTime(r.published_at)} UTC</b>
                      {r.keyword ? <> · chasing “{r.keyword}”</> : null}
                    </div>
                    <h2>{r.headline}</h2>
                    {r.dek ? <p className="dk">{r.dek}</p> : null}
                    <div className="meta">
                      Anchor: {r.anchor_label}
                      {ah ? " · in the corpus" : null}
                    </div>
                  </Link>
                );
              })}
            </section>
          ))
        )}

        <div className="cur-foot" style={{ display: "flex", gap: 22, marginTop: 30 }}>
          <Link href="/blog">The Daily — the morning edition →</Link>
          <Link href="/curious">Curious — the question desk →</Link>
        </div>
      </div>
    </>
  );
}
