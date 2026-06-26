// Shared visual + routing helpers for the v7 home port.
// Ported faithfully from metatake-home-mockup-v7.html (TONES / tone / initials),
// with a deterministic tone index (hash of slug/title) so placeholders are stable.

import { IMG_POSTER, IMG_BACKDROP, IMG_PROFILE } from "@/lib/home2";

// ── Tone-gradient placeholders (exact palette from the mockup) ──
export const TONES: [string, string][] = [
  ["#2b3543", "#10141b"], ["#5c4a33", "#241a12"], ["#3a4a52", "#121a1f"],
  ["#4a3a52", "#15101a"], ["#7a3a2a", "#2a100c"], ["#3a5a4a", "#0f201a"],
  ["#6a5a2a", "#241f0e"], ["#46505c", "#161b22"], ["#5a2a3a", "#1f0f17"],
  ["#2a4a5a", "#0e1c22"], ["#7a6a4a", "#28221a"], ["#3a3a4a", "#131318"],
];

export function tone(i: number): string {
  const t = TONES[((i % TONES.length) + TONES.length) % TONES.length];
  return `linear-gradient(155deg,${t[0]},${t[1]} 72%)`;
}

// Stable hash → tone index, so a film/concept always gets the same placeholder.
export function hashTone(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % TONES.length;
}

export function initials(n: string): string {
  return n
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ── Image URL builders (paths are TMDB poster/backdrop/profile paths). ──
export const posterUrl = (p: string | null | undefined) => (p ? IMG_POSTER + p : null);
export const backdropUrl = (p: string | null | undefined) => (p ? IMG_BACKDROP + p : null);
export const profileUrl = (p: string | null | undefined) => (p ? IMG_PROFILE + p : null);

// ── Route helpers (per the handoff §9.2 route map) ──
export const filmHref = (slug: string) => `/film/${slug}`;
export const figureHref = (slug: string, figureSlug?: string | null) =>
  figureSlug ? `/film/${slug}/figure/${figureSlug}` : `/film/${slug}`;
export const directorHref = (slug: string) => `/director/${slug}`;
export const tropeHref = (slug: string) => (slug ? `/trope/${slug}` : "/tropes");
export const conceptHref = (slug: string) => (slug ? `/idea/${slug}` : "/idea");
export const blogHref = (slug: string) => (slug ? `/blog/${slug}` : "/blog");
