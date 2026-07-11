import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";
import EntityNetwork from "@/components/EntityNetwork";
import { fmtDay } from "@/lib/now";

/**
 * Now Playing — the daily digest. The editor's note over one day of the wire:
 * what spiked, what we watched, what we wrote. Shell = app/now/layout.tsx.
 * Spec: hourly/README.md (v3) + hourly/pipeline/digest.py.
 */
export const revalidate = 300;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type DigestItem = {
  time: string; keyword: string; title: string | null; url: string | null;
  outlet: string | null; region: string | null; news_date: string | null;
  anchor_label: string | null; anchor_href: string | null; film_slug?: string | null;
  value_point: string | null; piece_slug: string | null;
};
type Digest = {
  digest_date: string; headline: string; dek: string | null;
  intro_html: string; items: DigestItem[]; published_at: string; updated_at: string;
};

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

async function load(date: string): Promise<Digest | null> {
  if (!isDate(date)) return null;
  const { data } = await db()
    .from("now_digests")
    .select("digest_date, headline, dek, intro_html, items, published_at, updated_at")
    .eq("digest_date", date)
    .maybeSingle();
  return (data as Digest | null) ?? null;
}

interface Props { params: Promise<{ date: string }>; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  const d = await load(date);
  if (!d) return { title: "Digest not found — Now Playing" };
  return {
    title: d.headline,
    description: d.dek ?? undefined,
    openGraph: { title: d.headline, ...(d.dek ? { description: d.dek } : {}), type: "article", publishedTime: d.published_at, modifiedTime: d.updated_at },
    alternates: { canonical: `/now/daily/${date}` },
    robots: { googleBot: { "max-image-preview": "large" } },
  };
}

export default async function DailyDigest({ params }: Props) {
  const { date } = await params;
  const d = await load(date);
  if (!d) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://metatake.net";
  const items = d.items ?? [];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: d.headline,
    ...(d.dek ? { description: d.dek } : {}),
    datePublished: d.published_at,
    dateModified: d.updated_at,
    url: `${siteUrl}/now/daily/${date}`,
    isPartOf: { "@type": "WebPage", name: "Now Playing — the daily digest", url: `${siteUrl}/now` },
    author: { "@type": "Person", name: "Wonwoo Yoon", url: `${siteUrl}/about` },
    publisher: { "@type": "Organization", name: "Metatake", url: siteUrl },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="cur-wrap" style={{ maxWidth: 900 }}>
        <header className="cur-head" style={{ paddingTop: 30 }}>
          <div className="now-live"><span className="dot" />The daily digest</div>
          <p className="now-dateline" style={{ marginTop: 12, borderBottom: "none", paddingBottom: 0 }}>
            {fmtDay(d.published_at)}
          </p>
          <h1 style={{ marginTop: 6 }}>{d.headline}</h1>
          {d.dek ? <p className="dek">{d.dek}</p> : null}
          <p className="cur-edby">By <b>Wonwoo Yoon</b> · the Now Playing desk closed the day</p>
        </header>

        <article className="cur-paper blg">
          <div className="now-letter" dangerouslySetInnerHTML={{ __html: d.intro_html }} />

          {(() => {
            const lead = items.find((it) => it.film_slug);
            return lead?.film_slug ? (
              <>
                <div className="now-sec">The day&apos;s connections</div>
                <p className="now-mapnote">
                  {lead.anchor_label} sat at the center of today&apos;s wire — here is how it links across the corpus.
                </p>
                <div className="now-mapwrap">
                  <EntityNetwork api={`/api/map?type=film&key=${lead.film_slug}`} full={`/network?m=critical&t=film&k=${lead.film_slug}`} height={360} />
                </div>
              </>
            ) : null;
          })()}

          {items.length ? (
            <>
              <div className="now-sec">The wire, hour by hour</div>
              <ul className="now-digest-list">
                {items.map((it, i) => (
                  <li key={i}>
                    <div className="dg-meta">
                      {it.time}
                      {[it.region, it.news_date, it.outlet].filter(Boolean).length ? " · " : ""}
                      {[it.region, it.news_date, it.outlet].filter(Boolean).join(" · ")}
                    </div>
                    <div className="dg-t">
                      {it.piece_slug ? (
                        <Link href={`/now/${it.piece_slug}`}>{it.title || it.keyword}</Link>
                      ) : it.url ? (
                        <a href={it.url} target="_blank" rel="noopener nofollow">{it.title || it.keyword}</a>
                      ) : (
                        it.title || it.keyword
                      )}
                      {it.piece_slug ? <span className="dg-badge">We wrote it</span> : null}
                    </div>
                    {it.value_point ? <div className="dg-v">{it.value_point}</div> : null}
                    {it.anchor_href && it.anchor_label ? (
                      <div className="dg-anchor">In the archive: <Link href={it.anchor_href}>{it.anchor_label}</Link></div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </article>

        <div className="cur-foot" style={{ display: "flex", gap: 22 }}>
          <Link href="/now">← Now Playing, live</Link>
          <Link href="/blog">The Daily — the morning edition →</Link>
        </div>
      </div>

      <div className="cur-band">
        <div className="cur-band__in">
          <p className="k">Now Playing</p>
          <h3>One note at the close of every day.</h3>
          <p>The digest and the best of the live layer land in the newsletter. Free, no spam.</p>
          <SubscribeForm source="now-digest" />
        </div>
      </div>
    </>
  );
}
