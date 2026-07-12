import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Metadata } from "next";
import MethodologyBadge from "@/components/MethodologyBadge";
import { anchorHref, fmtClock, tmdbImg, type NowArticle } from "@/lib/now";

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
  "slug" | "headline" | "dek" | "keyword" | "anchor_type" | "anchor_slug" | "anchor_label" | "published_at" | "updated_at" | "image_path"
>;
type WireRow = {
  at: string; keyword: string; title: string | null; url: string | null;
  outlet: string | null; region: string | null; news_date: string | null;
  anchor_label: string | null; film_slug: string | null; director_slug: string | null; value_point: string | null;
};
type DigestRow = { digest_date: string; headline: string; dek: string | null };

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const dayOf = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function NowIndex() {
  let rows: Row[] = [];
  let wire: WireRow[] = [];
  let digest: DigestRow | null = null;
  try {
    const [a, w, dg] = await Promise.all([
      db().from("now_articles")
        .select("slug, headline, dek, keyword, anchor_type, anchor_slug, anchor_label, published_at, updated_at, image_path")
        .eq("status", "published").order("published_at", { ascending: false }).limit(60)
        .abortSignal(AbortSignal.timeout(4500)),
      db().from("now_stream")
        .select("at, keyword, title, url, outlet, region, news_date, anchor_label, film_slug, director_slug, value_point, published")
        .eq("published", false).order("at", { ascending: false }).limit(12)
        .abortSignal(AbortSignal.timeout(4500)),
      db().from("now_digests")
        .select("digest_date, headline, dek").order("digest_date", { ascending: false }).limit(1)
        .abortSignal(AbortSignal.timeout(4500)),
    ]);
    rows = (a.data as Row[] | null) ?? [];
    wire = (w.data as WireRow[] | null) ?? [];
    digest = ((dg.data as DigestRow[] | null) ?? [])[0] ?? null;
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
            every claim is one click from its data.{" "}
            <Link href="/methodology/now-playing" style={{ textDecoration: "none", whiteSpace: "nowrap" }}>How the live desk works →</Link>
            <MethodologyBadge href="/methodology/now-playing" label="How the live desk works — methodology" />
          </p>
        </header>

        {digest ? (
          <Link className="now-digest-strip" href={`/now/daily/${digest.digest_date}`}>
            <div className="k">The daily digest · {digest.digest_date}</div>
            <div className="h">{digest.headline}</div>
            {digest.dek ? <div className="d">{digest.dek}</div> : null}
          </Link>
        ) : null}

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
                  <Link className="now-row now-row--img" href={`/now/${r.slug}`} key={r.slug}>
                    <div className="now-row__body">
                      <div className="t">
                        <b>{fmtClock(r.published_at)}</b>
                        {r.keyword ? <> · chasing “{r.keyword}”</> : null}
                      </div>
                      <h2>{r.headline}</h2>
                      {r.dek ? <p className="dk">{r.dek}</p> : null}
                      <div className="meta">
                        Anchor: {r.anchor_label}
                        {ah ? " · in the corpus" : null}
                      </div>
                    </div>
                    {r.image_path ? (
                      <div className="now-row__thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={tmdbImg(r.image_path, "w500")} alt="" loading="lazy" />
                      </div>
                    ) : null}
                  </Link>
                );
              })}
            </section>
          ))
        )}

        {wire.length ? (
          <section>
            <div className="now-wire-head">The wire we watched</div>
            <p className="now-wire-lede">
              Spikes the desk reviewed this cycle and judged worth noting — but did not turn into a full piece.
              Timestamps are the news dates. They accrue under each film and filmmaker too.
            </p>
            <ul className="now-wire">
              {wire.map((r, i) => {
                const href = r.film_slug ? `/film/${r.film_slug}` : r.director_slug ? `/director/${r.director_slug}` : null;
                return (
                  <li key={i}>
                    <div className="w-meta">{[r.region, r.news_date, r.outlet].filter(Boolean).join(" · ")}</div>
                    <div className="w-t">
                      {r.url ? <a href={r.url} target="_blank" rel="noopener nofollow">{r.title || r.keyword}</a> : (r.title || r.keyword)}
                    </div>
                    {r.value_point ? <div className="w-v">{r.value_point}</div> : null}
                    {href && r.anchor_label ? (
                      <div className="w-anchor">In the archive: <Link href={href}>{r.anchor_label}</Link></div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <Link className="now-wire-more" href="/now/wire">Browse the full wire →</Link>
          </section>
        ) : null}

        <div className="cur-foot" style={{ display: "flex", gap: 22, marginTop: 30 }}>
          <Link href="/blog">The Daily — the morning edition →</Link>
          <Link href="/curious">Curious — the question desk →</Link>
        </div>
      </div>
    </>
  );
}
