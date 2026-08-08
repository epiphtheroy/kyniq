/**
 * Talk layer — focus-surface gating (walking skeleton).
 *
 * The plan's #1 risk is empty comment boxes replicated across 7,000 pages, so
 * Talk mounts only on an explicit focus list until the skeleton proves itself
 * (canonical plan: /admin/docs/talk-layer §3.4 — density first). Widening the
 * rollout = adding slugs here (or replacing with an env/DB flag later).
 */

export const TALK_FOCUS_FILMS = new Set<string>(["parasite-2019"]);
export const TALK_FOCUS_DIRECTORS = new Set<string>(["bong-joon-ho"]);

export function talkEnabledForFilm(slug: string): boolean {
  return TALK_FOCUS_FILMS.has(slug);
}

export function talkEnabledForDirector(slug: string): boolean {
  return TALK_FOCUS_DIRECTORS.has(slug);
}

/** Resident cast — display metadata shared by web + admin surfaces.
 *  Live: tray (delivery replies to humans), gazette (extra-filmic opening
 *  comments, pre-generated + owner-skimmed), prism (seed-set replies only).
 *  Shelved: draft, jab. */
export const TALK_APPS: Record<string, { name: string; color: string }> = {
  gazette: { name: "Gazette", color: "#5A5348" },
  draft: { name: "Draft", color: "#8A93A6" },
  prism: { name: "Prism", color: "#6B4FA3" },
  tray: { name: "Tray", color: "#A8742F" },
  jab: { name: "Jab", color: "#8E1610" },
};

/** Curated 12-color default-avatar palette — humans are circles, apps squares. */
export const TALK_AVATAR_PALETTE = [
  "#3E4C63", "#8E1610", "#2E5C41", "#6B4FA3", "#A8742F", "#0E6C76",
  "#5A3A31", "#37505C", "#7A5C2E", "#4A5D4E", "#6B5B45", "#59426B",
];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TALK_AVATAR_PALETTE[h % TALK_AVATAR_PALETTE.length];
}
