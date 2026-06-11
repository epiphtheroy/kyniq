"use client";

/**
 * InfiniteScrollFeed — Economist-style story list.
 * First item can render as the LEAD package (full-width 16:9 image,
 * red kicker, big serif headline, dek, meta). Every following item is
 * a hairline row: kicker / headline / dek / meta on the left,
 * square thumbnail on the right. Rows are links — no inline expand.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

const IMG_BASE = "https://image.tmdb.org/t/p";

interface FeedItem {
  id: string;
  title: string;
  slug: string;
  film: {
    title: string;
    year: number;
    director: string;
    directorSlug: string | null;
    slug: string;
    posterPath: string | null;
  };
  answer: string;
  answerTeaser: string;
  media: Array<{
    kind: string;
    source: string;
    external_id: string;
    url: string;
    thumbnail_url: string | null;
    title: string | null;
    attribution: string | null;
    duration: string | null;
    channel_name: string | null;
  }>;
  publishedAt: string;
  viewCount: number;
}

interface Props {
  initialItems: FeedItem[];
  initialCursor: string | null;
  filmId?: string;
  excludeId?: string;
  /** render the first item as the full-width lead story */
  lead?: boolean;
}

/* ---- helpers ---- */

function imageFor(item: FeedItem, big: boolean): string | null {
  const img = item.media.find((m) => m.kind === "image");
  if (img) return img.thumbnail_url ?? img.url;
  const vid = item.media.find((m) => m.kind === "video" && m.thumbnail_url);
  if (vid?.thumbnail_url) return vid.thumbnail_url;
  if (item.film.posterPath)
    return `${IMG_BASE}/${big ? "w780" : "w342"}${item.film.posterPath}`;
  return null;
}

function dekFor(item: FeedItem, max = 150): string {
  const flat = (item.answerTeaser || item.answer || "")
    .replace(/\s+/g, " ")
    .trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 60)) + "…";
}

function readMins(item: FeedItem): number {
  const words = (item.answer || "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

function timeAgo(d: string): string {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function Kicker({ item }: { item: FeedItem }) {
  return (
    <p className="kicker">
      <Link href={`/film/${item.film.slug}`}>
        {item.film.title}
      </Link>
      <span className="sep">|</span>
      <span className="topic">
        {item.film.year}
        {item.film.director ? ` · ${item.film.director}` : ""}
      </span>
    </p>
  );
}

function Meta({ item }: { item: FeedItem }) {
  return (
    <div className="meta">
      <span>{readMins(item)} min read</span>
      <span className="dot" />
      <span>{timeAgo(item.publishedAt)}</span>
      {item.viewCount > 0 && (
        <>
          <span className="dot" />
          <span>{item.viewCount.toLocaleString()} reads</span>
        </>
      )}
    </div>
  );
}

/* ---- component ---- */

export default function InfiniteScrollFeed({
  initialItems,
  initialCursor,
  filmId,
  excludeId,
  lead = false,
}: Props) {
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchMore = useCallback(async () => {
    if (loading || !cursor) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ cursor, limit: "10" });
      if (filmId) params.set("filmId", filmId);
      if (excludeId) params.set("exclude", excludeId);
      const res = await fetch(`/api/feed?${params}`);
      if (!res.ok) throw new Error("Feed fetch failed");
      const data = await res.json();
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
    } catch (e) {
      console.error("Feed error:", e);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, filmId, excludeId]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && cursor && !loading) {
          fetchMore();
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, loading, fetchMore]);

  return (
    <div className="feedwrap">
      {items.map((item, i) => {
        const href = `/film/${item.film.slug}/q/${item.slug}`;

        /* LEAD — full-width image package */
        if (lead && i === 0) {
          const img = imageFor(item, true);
          return (
            <article key={item.id} className="lead">
              {img && (
                <Link href={href} aria-hidden="true" tabIndex={-1}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt=""
                    className="lead__img"
                    width={780}
                    height={439}
                  />
                </Link>
              )}
              <Kicker item={item} />
              <h2 className="lead__title">
                <Link href={href}>{item.title}</Link>
              </h2>
              <p className="dek">{dekFor(item, 190)}</p>
              <Meta item={item} />
            </article>
          );
        }

        /* ROW — text left, square thumb right */
        const thumb = imageFor(item, false);
        return (
          <article key={item.id} className="story">
            <div className="story__text">
              <Kicker item={item} />
              <h2 className="story__title">
                <Link href={href}>{item.title}</Link>
              </h2>
              <p className="dek">{dekFor(item, 110)}</p>
              <Meta item={item} />
            </div>
            {thumb && (
              <Link href={href} aria-hidden="true" tabIndex={-1}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumb}
                  alt=""
                  className="story__thumb"
                  width={92}
                  height={92}
                  loading="lazy"
                />
              </Link>
            )}
          </article>
        );
      })}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="feed-sentinel" />

      {/* Loading skeletons */}
      {loading && (
        <div className="feed-loading">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="feed-skeleton">
              <div className="feed-skeleton__bar" style={{ width: "30%" }} />
              <div className="feed-skeleton__bar" style={{ width: "75%" }} />
              <div className="feed-skeleton__bar" style={{ width: "55%" }} />
            </div>
          ))}
        </div>
      )}

      {/* End of feed */}
      {!cursor && items.length > 0 && (
        <div className="feed-end">
          You&apos;ve reached the end — {items.length} interpretations read.
          <span className="endmark"> ■</span>
        </div>
      )}
    </div>
  );
}
