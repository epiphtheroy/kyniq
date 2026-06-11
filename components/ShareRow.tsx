"use client";

/**
 * ShareRow — article meta actions (≈ Economist share/save icons).
 * Uses the native share sheet when available, else copies the URL.
 */

import { useState } from "react";

export default function ShareRow({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* user dismissed the sheet */
    }
  };

  return (
    <button className="act" onClick={share} aria-label="Share this article">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 1.5v9M8 1.5L4.8 4.7M8 1.5l3.2 3.2M2.5 8v5.5h11V8"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
