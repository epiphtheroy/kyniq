/** My Room v3 — single source of truth for the rail + CmdK PAGES.
 *  Spec: HANDOFF My Room v3 redesign doc, §2 (taxonomy) + §4 (shell).
 *  RoomShell renders NAV_GROUPS as real <Link> items; CmdK builds its PAGES
 *  section from NAV_ITEMS. Never fork this list — that drift is exactly what
 *  killed the v2 palette. Icons are Tabler webfont classes (ti ti-*). */

export type RailCountKey = "watchlist" | "collection";

export type NavItem = {
  /** English rail label (1–2 words, no subtitles). */
  label: string;
  /** Tabler icon class without the leading "ti " (e.g. "ti-sun"). */
  icon: string;
  href: string;
  /** Which shell count badge this item shows (Slate = watchlist, Holdings = seen). */
  countKey?: RailCountKey;
};

export type NavGroup = { sec: "SESSION" | "PORTFOLIO" | "RESEARCH"; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    sec: "SESSION",
    items: [
      { label: "Desk", icon: "ti-sun", href: "/room" },
      { label: "Screener", icon: "ti-target-arrow", href: "/room/screener" },
      { label: "Slate", icon: "ti-stack-2", href: "/room/slate", countKey: "watchlist" },
      { label: "Ledger", icon: "ti-star", href: "/room/ledger" },
      { label: "Masquerade", icon: "ti-masks-theater", href: "/room/masquerade" },
    ],
  },
  {
    sec: "PORTFOLIO",
    items: [
      { label: "Holdings", icon: "ti-list-details", href: "/room/holdings", countKey: "collection" },
      { label: "Performance", icon: "ti-chart-line", href: "/room/performance" },
      { label: "Coverage", icon: "ti-chart-arcs", href: "/room/coverage" },
      { label: "Auteurs", icon: "ti-crown", href: "/room/auteurs" },
      { label: "Locations", icon: "ti-map-2", href: "/room/locations" },
    ],
  },
  {
    sec: "RESEARCH",
    items: [
      { label: "Signature", icon: "ti-fingerprint", href: "/room/signature" },
      { label: "Lens", icon: "ti-telescope", href: "/room/lens" },
      { label: "Shelf", icon: "ti-books", href: "/room/shelf" },
      { label: "Packs", icon: "ti-file-download", href: "/room/packs" },
      { label: "Takes", icon: "ti-feather", href: "/room/takes" },
    ],
  },
];

/** Flat list (rail order) — what CmdK PAGES iterates. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Off-rail destinations that still deserve a palette entry. */
export const EXTRA_PAGES: NavItem[] = [
  { label: "Public profile", icon: "ti-user-circle", href: "/u/me" },
  { label: "Import", icon: "ti-download", href: "/me/import" },
];
