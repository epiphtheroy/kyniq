import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";
import NowModules from "@/components/NowModules";
import EntityMap from "@/components/EntityMap";
import FilmMap from "@/components/FilmMap";
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
      "slug, headline, dek, summary, dateline, keyword, lane, anchor_type, anchor_slug, anchor_label, film_slug, facts_html, reading_html, bottom_html, deposit, modules, sources, image_path, image_alt, archive_links, status, update_note, published_at, updated_at, created_at"
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
  const written = p.created_at ?? p.published_at; // when the letter was composed
  const ah = anchorHref(p);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: p.headline,
    ...(p.dek ? { description: p.dek } : {}),
    dateCreated: written,
    datePublished: p.published_at,
    dateModified: p.updated_at,
    url: `${siteUrl}/now/${p.slug}`,
    mainEntityOfPage: `${siteUrl}/now/${p.slug}`,
    isPartOf: { "@type": "WebPage", name: "Now Playing — Metatake's live layer", url: `${siteUrl}/now` },
    author: {
      "@type": "Person",
      "@id": `${siteUrl}/editor#person`,
      name: "Wonwoo Yoon",
      url: `${siteUrl}/editor`,
      email: "mailto:wonwoo@metatake.net",
    },
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
          <div className="cur-edby now-byline">
            <Link href="/editor" className="now-author" aria-label="Wonwoo Yoon, founder and editor">
              <span className="now-avatar" aria-hidden="true">W</span>
              <span className="now-author-name">Wonwoo Yoon</span>
            </Link>
            <span className="now-byline-rest">
              , founder &amp; editor · anchored on{" "}
              {ah ? <Link href={ah}>{p.anchor_label}</Link> : <b>{p.anchor_label}</b>} · every data point below is
              live in the corpus
            </span>
          </div>
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

          {/* the clock is the product: re-state when this letter was written and
              published, to the minute, right above the body (owner's rule 2026-07-10) */}
          <div className="now-timecard" aria-label="When this letter was written and published">
            <div><span className="k">Written</span> <time dateTime={written}>{fmtStamp(written)}</time></div>
            <div><span className="k">Published</span> <time dateTime={p.published_at}>{fmtStamp(p.published_at)}</time></div>
            {updated ? (
              <div><span className="k">Updated</span> <time dateTime={p.updated_at}>{fmtStamp(p.updated_at)}</time></div>
            ) : null}
          </div>

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

          {p.film_slug ? (
            <>
              <div className="now-sec">The map of connections</div>
              <p className="now-mapnote">
                How {p.anchor_label} sits in the corpus — the films, figures, and readings it links to.
                Drag to explore; open any node.
              </p>
              <div className="now-mapwrap">
                <EntityMap
                  api={`/api/map?type=film&key=${p.film_slug}`}
                  full={`/map?m=critical&t=film&k=${p.film_slug}`}
                  height={400}
                />
              </div>
              {(p.modules ?? []).some((m) => m.type === "locations") ? (
                <>
                  <div className="now-sec">Where it was shot</div>
                  <div className="now-mapwrap">
                    <FilmMap endpoint={`/api/geo?film=${p.film_slug}`} filmSlug={p.film_slug} height={400} />
                  </div>
                </>
              ) : null}
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
              <div className="now-sec">Read together — more in the archive</div>
              <p className="now-mapnote">Everything this piece touches, one click away. Curious questions, kin films, the readings, the record.</p>
              <div className="now-slots">
                {p.archive_links.map((l, i) => (
                  <Link className="now-slot" href={l.href} key={i}>
                    <span className="s-label">{l.label}</span>
                    {l.note ? <span className="s-note">{l.note}</span> : null}
                  </Link>
                ))}
              </div>
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
