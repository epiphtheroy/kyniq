"use client";

import { useState, useCallback } from "react";

/**
 * YouTube Facade — click-to-load embed (§3.3 performance requirement).
 * Shows a thumbnail with a play button; loads the iframe only on click.
 * Matches ref-question-media.html design: card with thumb, play button,
 * duration badge, title, and channel attribution.
 */
interface YouTubeFacadeProps {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  attribution?: string;
  duration?: string;
}

export default function YouTubeFacade({
  videoId,
  title,
  thumbnailUrl,
  attribution,
  duration,
}: YouTubeFacadeProps) {
  const [loaded, setLoaded] = useState(false);

  const thumb =
    thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  const handleClick = useCallback(() => {
    setLoaded(true);
  }, []);

  if (loaded) {
    return (
      <figure style={{ margin: 0 }}>
        <div
          style={{
            position: "relative",
            paddingBottom: "56.25%",
            height: 0,
            overflow: "hidden",
            borderRadius: 6,
          }}
        >
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              border: "none",
            }}
          />
        </div>
        <figcaption
          style={{
            padding: "11px 13px 13px",
          }}
        >
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
    );
  }

  return (
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
        onClick={handleClick}
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
          }}
        />
        {/* Play button — oxblood accent circle */}
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 54,
            height: 54,
            borderRadius: "50%",
            background: "var(--accent, #8A2A21)",
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
            fill="var(--bg, #FAF7F0)"
            style={{ marginLeft: 2 }}
          >
            <path d="M4 2l12 7-12 7z" />
          </svg>
        </span>
        {/* Duration badge */}
        {duration && (
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
  );
}
