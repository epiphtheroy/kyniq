"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * YouTube Facade — click-to-load embed (§3.3 performance requirement).
 * Shows a thumbnail card with a play button; clicking opens a FLOATING
 * mini-player fixed to the bottom-right corner of the viewport, so the
 * article keeps scrolling underneath while the video stays put.
 * Only one floating player is open at a time (a custom window event
 * closes any other instance). The iframe loads from YouTube only on click.
 */
interface YouTubeFacadeProps {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  attribution?: string;
  duration?: string;
}

const PLAY_EVENT = "fc:float-play";

export default function YouTubeFacade({
  videoId,
  title,
  thumbnailUrl,
  attribution,
  duration,
}: YouTubeFacadeProps) {
  const [playing, setPlaying] = useState(false);

  const thumb =
    thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  const handlePlay = useCallback(() => {
    // Tell any other facade to close its floating player first
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: videoId }));
    setPlaying(true);
  }, [videoId]);

  const handleClose = useCallback(() => setPlaying(false), []);

  useEffect(() => {
    const onPlay = (e: Event) => {
      if ((e as CustomEvent).detail !== videoId) setPlaying(false);
    };
    window.addEventListener(PLAY_EVENT, onPlay);
    return () => window.removeEventListener(PLAY_EVENT, onPlay);
  }, [videoId]);

  return (
    <>
      <figure
        className="yt-card"
        style={{
          margin: 0,
          border: "1px solid var(--hairline)",
          borderRadius: 6,
          overflow: "hidden",
          background: "var(--surface)",
        }}
      >
        <button
          onClick={handlePlay}
          aria-label={`Play video: ${title}`}
          style={{
            position: "relative",
            display: "block",
            width: "100%",
            aspectRatio: "16/9",
            border: "none",
            padding: 0,
            cursor: "pointer",
            background: "linear-gradient(160deg, #2c3340, #161b22)",
          }}
        >
          {/* Thumbnail */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt={title}
            loading="lazy"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: playing ? 0.45 : 1,
              transition: "opacity 0.2s ease",
            }}
          />
          {/* Play button / now-playing state */}
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 54,
              height: 54,
              borderRadius: "50%",
              background: "var(--accent, #E0922A)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 14px rgba(0,0,0,.35)",
            }}
            aria-hidden="true"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="var(--bg, #FBF8F1)"
              style={{ marginLeft: 2 }}
            >
              <path d="M4 2l12 7-12 7z" />
            </svg>
          </span>
          {playing && (
            <span
              style={{
                position: "absolute",
                left: 8,
                bottom: 8,
                fontFamily: "var(--font-ui)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.04em",
                color: "#fff",
                background: "rgba(0,0,0,.72)",
                borderRadius: 3,
                padding: "2px 8px",
              }}
            >
              ▶ Now playing below
            </span>
          )}
          {/* Duration badge */}
          {duration && !playing && (
            <span
              style={{
                position: "absolute",
                right: 8,
                bottom: 8,
                fontFamily: "var(--font-ui)",
                fontSize: 11,
                color: "#fff",
                background: "rgba(0,0,0,.72)",
                borderRadius: 3,
                padding: "2px 6px",
              }}
            >
              {duration}
            </span>
          )}
        </button>
        <figcaption style={{ padding: "11px 13px 13px" }}>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "15.5px",
              lineHeight: 1.4,
              color: "var(--ink)",
            }}
          >
            {title}
          </div>
          {attribution && (
            <div className="credit" style={{ marginTop: 6 }}>
              {attribution}
            </div>
          )}
        </figcaption>
      </figure>

      {/* Floating mini-player — fixed to the viewport, independent of scroll */}
      {playing && (
        <div className="float-player" role="dialog" aria-label={`Playing: ${title}`}>
          <div className="float-player__bar">
            <span className="float-player__title">{title}</span>
            <button
              type="button"
              className="float-player__close"
              aria-label="Close video"
              onClick={handleClose}
            >
              ✕
            </button>
          </div>
          <div className="float-player__frame">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </>
  );
}
