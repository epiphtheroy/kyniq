/**
 * MediaGallery — renders TMDB images + YouTube facades for a question.
 * Server component: lazy-loads images, shows attribution.
 * YouTube facades are client-rendered via YouTubeFacade.
 *
 * Matches the ref-question-media.html reference design:
 * - TMDB stills in a horizontal strip (desaturated, attribution overlay)
 * - YouTube grid (2-col) with click-to-load facade
 */

import YouTubeFacade from "./YouTubeFacade";
import LightboxImage from "./LightboxImage";

interface MediaItem {
  id: string;
  kind: "image" | "video";
  source: "tmdb" | "youtube";
  external_id: string;
  url: string;
  thumbnail_url: string | null;
  title: string | null;
  attribution: string | null;
  duration?: string | null;
  channel_name?: string | null;
}

interface MediaGalleryProps {
  media: MediaItem[];
}

export default function MediaGallery({ media }: MediaGalleryProps) {
  if (!media || media.length === 0) return null;

  const images = media.filter((m) => m.kind === "image");
  const videos = media.filter((m) => m.kind === "video");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* TMDB stills strip — horizontal like the reference */}
      {images.length > 0 && (
        <div>
          <div
            className="still-strip"
            style={{
              display: "flex",
              gap: 8,
            }}
          >
            {images.slice(0, 3).map((img) => (
              <figure
                key={img.id}
                style={{
                  margin: 0,
                  flex: 1,
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 4,
                  border: "1px solid var(--hairline)",
                }}
              >
                <LightboxImage
                  src={img.thumbnail_url ?? img.url}
                  fullUrl={img.url ?? img.thumbnail_url}
                  alt={img.title ?? "Film still"}
                  loading="lazy"
                  width={780}
                  height={439}
                  caption={img.title ?? img.attribution ?? "Still via TMDB"}
                  style={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                    aspectRatio: "16/9",
                    objectFit: "cover",
                    opacity: 0.92,
                  }}
                />
              </figure>
            ))}
          </div>
          <div
            className="tmdb-note"
            style={{
              marginTop: 6,
              fontSize: "0.625rem",
              color: "var(--muted)",
              opacity: 0.7,
            }}
          >
            Stills via TMDB. This product uses the TMDB API but is not endorsed
            by TMDB.
          </div>
        </div>
      )}

      {/* YouTube "Related on YouTube" section — 2-col grid */}
      {videos.length > 0 && (
        <div>
          <div className="seclbl" style={{ marginBottom: 4 }}>
            Related on YouTube
          </div>
          <div className="tick" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                videos.length === 1 ? "1fr" : "1fr 1fr",
              gap: 16,
              marginTop: 4,
            }}
          >
            {videos.slice(0, 4).map((vid) => (
              <YouTubeFacade
                key={vid.id}
                videoId={vid.external_id}
                title={vid.title ?? "Video"}
                thumbnailUrl={vid.thumbnail_url ?? undefined}
                attribution={vid.attribution ?? undefined}
                duration={vid.duration ?? undefined}
              />
            ))}
          </div>

          <div
            className="credit"
            style={{ marginTop: 10 }}
          >
            Tap to play — loads from YouTube only on click.{" "}
            <span
              className="badge"
              style={{
                color: "var(--muted)",
                borderColor: "var(--hairline)",
                fontSize: 11,
                padding: "3px 9px",
              }}
            >
              Added by Curiobot
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
