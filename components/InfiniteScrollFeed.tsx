"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

const POSTER_BASE = "https://image.tmdb.org/t/p";

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
}

export default function InfiniteScrollFeed({
  initialItems,
  initialCursor,
  filmId,
  excludeId,
}: Props) {
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
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

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const timeAgo = (d: string) => {
    if (!d) return "";
    const diff = Date.now() - new Date(d).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "yesterday";
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  };

  return (
    <div className="feed">
      {items.map((item) => {
        const isExpanded = expandedIds.has(item.id);
        const answerParagraphs = item.answer.split(/\n\n+/).filter(Boolean);
        const teaserParagraphs = item.answerTeaser.split(/\n\n+/).filter(Boolean);
        const hasMore = item.answer.length > item.answerTeaser.length + 20;
        const firstVideo = item.media.find(
          (m) => m.kind === "video" && m.source === "youtube"
        );

        return (
          <article key={item.id} className="feed-item">
            {/* Film chips — poster integrated into film chip */}
            <div className="feed-item__chips">
              <Link
                href={`/film/${item.film.slug}`}
                className="feed-item__chip feed-item__chip--film"
              >
                {item.film.posterPath && (
                  <img
                    src={`${POSTER_BASE}/w92${item.film.posterPath}`}
                    alt=""
                    className="feed-item__chip-poster"
                    loading="lazy"
                  />
                )}
                <span>{item.film.title} ({item.film.year})</span>
              </Link>
              <span className="feed-item__chip feed-item__chip--director">
                {item.film.director}
              </span>
            </div>

            {/* QUESTION — the hero (full width) */}
            <h2 className="feed-item__question">
              <Link href={`/film/${item.film.slug}/q/${item.slug}`}>
                {item.title}
              </Link>
            </h2>

            {/* ANSWER — immediately readable, full width */}
            <div className="feed-item__answer">
              {(isExpanded ? answerParagraphs : teaserParagraphs).map(
                (p, i) => (
                  <p key={i}>{p}</p>
                )
              )}
            </div>

            {/* Continue reading */}
            {hasMore && (
              <div className="feed-item__expand">
                {isExpanded ? (
                  <button
                    onClick={() => toggleExpand(item.id)}
                    className="feed-item__expand-btn"
                  >
                    Show less ▴
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => toggleExpand(item.id)}
                      className="feed-item__expand-btn"
                    >
                      Continue reading →
                    </button>
                    <Link
                      href={`/film/${item.film.slug}/q/${item.slug}`}
                      className="feed-item__readmore"
                    >
                      Open full page
                    </Link>
                  </>
                )}
              </div>
            )}

            {/* Minimal meta */}
            <div className="feed-item__actions">
              <span className="feed-item__stat">
                {item.viewCount > 0
                  ? `${item.viewCount.toLocaleString()} reads`
                  : "New"}
              </span>
              <span className="feed-item__stat">
                {timeAgo(item.publishedAt)}
              </span>
              <Link
                href={`/film/${item.film.slug}/q/${item.slug}`}
                className="feed-item__action"
              >
                Share your reading →
              </Link>
            </div>
          </article>
        );
      })}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="feed-sentinel" />

      {/* Loading state */}
      {loading && (
        <div className="feed-loading">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="feed-skeleton">
              <div className="feed-skeleton__bar" style={{ width: "30%" }} />
              <div className="feed-skeleton__bar" style={{ width: "75%" }} />
              <div className="feed-skeleton__bar" style={{ width: "90%" }} />
              <div className="feed-skeleton__bar" style={{ width: "60%" }} />
            </div>
          ))}
        </div>
      )}

      {/* End of feed */}
      {!cursor && items.length > 0 && (
        <div className="feed-end">
          You&apos;ve explored {items.length} film interpretations.
        </div>
      )}
    </div>
  );
}
