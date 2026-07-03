"use client";

/**
 * LightboxImage — an <img> that opens a full-screen lightbox on click.
 * Close: backdrop click, ✕ button, or Escape. Body scroll is locked while open.
 * `fullUrl` is the large version shown in the lightbox (falls back to src).
 */

import { useCallback, useEffect, useState, type CSSProperties } from "react";

interface Props {
  src: string;
  fullUrl?: string | null;
  alt: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  style?: CSSProperties;
  className?: string;
  caption?: string | null;
}

export default function LightboxImage({
  src,
  fullUrl,
  alt,
  width,
  height,
  loading,
  fetchPriority,
  style,
  className,
  caption,
}: Props) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        fetchPriority={fetchPriority}
        className={className}
        style={{ cursor: "zoom-in", ...style }}
        onClick={() => setOpen(true)}
      />
      {open && (
        <div
          className="lightbox-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={close}
        >
          <button
            type="button"
            className="lightbox-close"
            aria-label="Close image"
            onClick={close}
          >
            ✕
          </button>
          <figure
            className="lightbox-figure"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fullUrl || src} alt={alt} className="lightbox-img" />
            {caption && <figcaption className="lightbox-caption">{caption}</figcaption>}
          </figure>
        </div>
      )}
    </>
  );
}
