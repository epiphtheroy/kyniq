import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";
import NowModules from "@/components/NowModules";
import { anchorHref, fmtDay, fmtStamp, tmdbImg, type NowArticle } from "@/lib/now";

/**
 * One Now Playing piece — the live layer (shell in app/now/layout.tsx):
 * timestamp block up top (the clock is the product), the verified facts,
 * "The record" (the corpus data modules), the reading, the deposit.
 * Spec: hourly/README.md (v2).
 */
export const revalidate = 120;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ slug: string }>; }

async function load(slug: string) {
  const { data } = await db()
    .from("now_articles")
    .select(
      "slug, headline, dek, summary, dateline, keyword, lane, anchor_type, anchor_slug, anchor_label, film_slug, facts_html, reading_html, bottom_html, deposit, modules, sources, image_path, image_alt, archive_links, status, update_note, published_at, updated_at"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as NowArticle | null) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) return { title: "Piece not found — Now Playing" };
  const description = p.dek ?? p.summary ?? undefined;
  return {
    title: p.headline,
    description,
    openGraph: {
      title: p.headline,
      ...(description ? { description } : {}),
      type: "article",
      publishedTime: p.published_at,
      modifiedTime: p.updated_at,
    },
    alternates: { canonical: `/now/${slug}` },
    robots: { googleBot: { "max-image-preview": "large" } },
  };
}

export default async function NowPiece({ params }: Props) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://metatake.net";
  const updated = p.updated_at && p.updated_at !== p.published_at;
  const ah = anchorHref(p);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: p.headline,
    ...(p.dek ? { description: p.dek } : {}),
    datePublished: p.published_at,
    dateModified: p.updated_at,
    url: `${siteUrl}/now/${p.slug}`,
    mainEntityOfPage: `${siteUrl}/now/${p.slug}`,
    isPartOf: { "@type": "WebPage", name: "Now Playing — Metatake's live layer", url: `${siteUrl}/now` },
    author: { "@type": "Person", name: "Wonwoo Yoon", url: `${siteUrl}/about` },
    publisher: { "@type": "Organization", name: "Metatake", url: siteUrl },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="cur-wrap" style={{ maxWidth: 900 }}>
        <header className="cur-head" style={{ paddingTop: 30 }}>
          <div className="now-live"><span className="dot" />Now Playing</div>
          <div className="now-stamp" style={{ marginTop: 8 }}>
            <b>Published {fmtStamp(p.published_at)}</b>
            {updated ? (
              <>
                <span className="sep">·</span>
                Updated <b>{fmtStamp(p.updated_at)}</b>
              </>
            ) : null}
            <span className="sep">·</span>
            {fmtDay(p.published_at)}
          </div>
          {p.keyword ? (
            <div className="now-kw">
              The world is searching: <b>{p.keyword}</b>
            </div>
          ) : null}
          <h1 style={{ marginTop: 14 }}>{p.headline}</h1>
          {p.dek ? <p className="dek">{p.dek}</p> : null}
          {p.summary ? <p className="now-summary">{p.summary}</p> : null}
          <p className="cur-edby">
            By <b>Wonwoo Yoon</b> · anchored on{" "}
            {ah ? <Link href={ah}>{p.anchor_label}</Link> : <b>{p.anchor_label}</b>} · every data point below is
            live in the corpus
          </p>
        </header>

        {p.image_path ? (
          <figure className="now-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tmdbImg(p.image_path)} alt={p.image_alt ?? p.anchor_label} loading="eager" />
            <figcaption>
              Promotional still from{" "}
              {ah ? <Link href={ah}>{p.anchor_label}</Link> : <span>{p.anchor_label}</span>}. Source:{" "}
              <a href="https://www.themoviedb.org/" target="_blank" rel="noopener nofollow">The Movie Database (TMDB)</a>.
              Not an image of the news event.
            </figcaption>
          </figure>
        ) : null}

        <article className="cur-paper blg">
          {p.update_note ? <div className="now-note">Update: {p.update_note}</div> : null}

          {p.dateline ? <p className="now-dateline">{p.dateline}</p> : null}

          {/* v3: the editor's letter — continuous prose, no section furniture */}
          <div className="now-letter" dangerouslySetInnerHTML={{ __html: p.facts_html }} />
          <div className="now-letter" dangerouslySetInnerHTML={{ __html: p.reading_html }} />
          {p.bottom_html ? <div className="now-letter" dangerouslySetInnerHTML={{ __html: p.bottom_html }} /> : null}

          {p.modules?.length ? (
            <>
              <div className="now-sec">From the archive</div>
              <NowModules modules={p.modules} />
            </>
          ) : null}

          {p.sources?.length ? (
            <>
              <div className="now-sec">Sources</div>
              <ul className="now-src">
                {p.sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noopener">
                      {s.outlet}
                      {s.title ? ` — ${s.title}` : ""}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {p.deposit ? (
            <p className="now-deposit">
              <span className="k">→ In Metatake:</span> {p.deposit}
            </p>
          ) : null}

          {p.archive_links?.length ? (
            <div className="now-archive">
              <div className="now-sec">Keep reading in the archive</div>
              <ul>
                {p.archive_links.map((l, i) => (
                  <li key={i}>
                    <Link href={l.href}>{l.label}</Link>
                    {l.note ? <span className="n"> — {l.note}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>

        {/* v3 (owner's rule 5): rejected news is not published — the cutting-room
            floor stays in the ledger, not on the page. */}

        <div className="cur-foot" style={{ display: "flex", gap: 22 }}>
          <Link href="/now">← All of Now Playing</Link>
          <Link href="/blog">The Daily — the morning edition →</Link>
        </div>
      </div>

      <div className="cur-band">
        <div className="cur-band__in">
          <p className="k">Now Playing</p>
          <h3>The archive answers while the story is still moving.</h3>
          <p>
            The best of the live layer lands in The Daily, one short edition almost every morning. Free. No spam,
            unsubscribe anytime.
          </p>
          <SubscribeForm source="now-piece" />
          <p className="fine">Join the readers getting the wire through cinema.</p>
        </div>
      </div>
    </>
  );
}
