"use client";

import { useState, useCallback } from "react";

/**
 * YouTube Facade — click-to-load embed (§3.3 performance requirement).
 * Shows a thumbnail with a play button; loads the iframe only on click.
 * Never eager-loads heavy YouTube embeds.
 */
interface YouTubeFacadeProps {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  attribution?: string;
}

export default function YouTubeFacade({
  videoId,
  title,
  thumbnailUrl,
  attribution,
}: YouTubeFacadeProps) {
  const [loaded, setLoaded] = useState(false);

  const thumb =
    thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  const handleClick = useCallback(() => {
    setLoaded(true);
  }, []);

  if (loaded) {
    return (
      <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: 8 }}>
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
    );
  }

  return (
    <div>
      <button
        onClick={handleClick}
        aria-label={`Play: ${title}`}
        style={{
          position: "relative",
          display: "block",
          width: "100%",
          paddingBottom: "56.25%",
          height: 0,
          overflow: "hidden",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          background: "#000",
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
        {/* Play button overlay */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 68,
            height: 48,
            borderRadius: 12,
            background: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </button>
      {/* Attribution */}
      {attribution && (
        <p
          style={{
            marginTop: 4,
            fontSize: "0.6875rem",
            color: "var(--muted)",
            lineHeight: 1.3,
          }}
        >
          {attribution}
        </p>
      )}
    </div>
  );
}
