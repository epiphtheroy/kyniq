/**
 * MediaGallery — renders TMDB images + YouTube facades for a question.
 * Server component: lazy-loads images, shows attribution.
 * YouTube facades are client-rendered via YouTubeFacade.
 */

import YouTubeFacade from "./YouTubeFacade";

interface MediaItem {
  id: string;
  kind: "image" | "video";
  source: "tmdb" | "youtube";
  external_id: string;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  attribution: string | null;
}

interface MediaGalleryProps {
  media: MediaItem[];
}

export default function MediaGallery({ media }: MediaGalleryProps) {
  if (!media || media.length === 0) return null;

  const images = media.filter((m) => m.kind === "image");
  const videos = media.filter((m) => m.kind === "video");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Image gallery */}
      {images.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: images.length === 1 ? "1fr" : "1fr 1fr",
            gap: "0.5rem",
          }}
        >
          {images.map((img) => (
            <figure
              key={img.id}
              style={{ margin: 0, position: "relative", overflow: "hidden", borderRadius: 8 }}
            >
              <img
                src={img.thumbnail_url ?? img.url}
                alt={img.caption ?? "Film still"}
                loading="lazy"
                width={780}
                height={439}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  aspectRatio: "16/9",
                  objectFit: "cover",
                }}
              />
              {img.attribution && (
                <figcaption
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: "0.25rem 0.5rem",
                    background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                    color: "rgba(255,255,255,0.8)",
                    fontSize: "0.625rem",
                    textAlign: "right",
                  }}
                >
                  {img.attribution}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      {/* Video facades */}
      {videos.map((vid) => (
        <YouTubeFacade
          key={vid.id}
          videoId={vid.external_id}
          title={vid.caption ?? "Video"}
          thumbnailUrl={vid.thumbnail_url ?? undefined}
          attribution={vid.attribution ?? undefined}
        />
      ))}
    </div>
  );
}
