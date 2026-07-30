// Design system v2 — "Lava" (2026-07-17, owner directive: benchmark the app rated
// best-designed in 2026 and follow it closely).
// Benchmark: Airbnb's 2025 "Lava" design system + iOS 26 Liquid Glass conventions.
//   - warm neutrals, near-black ink, ONE saturated red→pink gradient for CTAs
//   - concentric radii: buttons 8 / cards 14 / sheets 24 / pills 999
//   - soft ambient shadows instead of hairline-only flatness
//   - blurred translucent chrome (tab bar, headers)
//   - springy, tactile motion; friendly sentence-case microcopy
// Brand thread kept: PT Serif survives ONLY for film/director display titles
// (the editorial nod), and the gradient stays in the Metatake red family.
import { useColorScheme } from "react-native";

export const brand = {
  // Lava gradient — CTA buttons, active states, selection rings.
  gradA: "#FF385C",
  gradB: "#E61E4D",
  gradC: "#D70466",
  accent: "#E61E4D", // solid fallback of the gradient midpoint
  accentHover: "#C4103E",
  accentInk: "#FFFFFF",
  // TakeScore keeps its own semantic colors (web never-blend adjacency)
  tsGreen: "#008A05",
  tsRisk: "#C13515",
  tsCost: "#8A8F98",
  teal: "#128273",
  success: "#008A05",
} as const;

export const gradient: readonly [string, string, string] = [
  brand.gradA,
  brand.gradB,
  brand.gradC,
];

export type Palette = {
  bg: string;
  surface: string; // grouped-section background
  card: string; // elevated card fill
  ink: string;
  inkSoft: string;
  muted: string;
  subtle: string;
  hairline: string;
  hairline2: string;
  scrim: string;
  chrome: string; // translucent chrome tint (tab bar / headers over blur)
};

export const light: Palette = {
  bg: "#FFFFFF",
  surface: "#F7F7F7",
  card: "#FFFFFF",
  ink: "#222222",
  inkSoft: "#484848",
  muted: "#6A6A6A",
  subtle: "#9E9E9E",
  hairline: "#EBEBEB",
  hairline2: "#DDDDDD",
  scrim: "rgba(0,0,0,0.38)",
  chrome: "rgba(255,255,255,0.72)",
};

export const dark: Palette = {
  bg: "#111111",
  surface: "#1D1D1D",
  card: "#1D1D1D",
  ink: "#F7F7F7",
  inkSoft: "#E3E3E3",
  muted: "#B0B0B0",
  subtle: "#8A8A8A",
  hairline: "rgba(255,255,255,0.14)",
  hairline2: "rgba(255,255,255,0.26)",
  scrim: "rgba(0,0,0,0.55)",
  chrome: "rgba(17,17,17,0.72)",
};

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}

// 4px spacing scale
export const sp = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 24, s6: 32, s7: 48, s8: 64 } as const;

// Type ramp (Airbnb Cereal analog = Inter; serif reserved for display titles)
export const fs = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  x2: 26,
  x3: 32,
} as const;

export const font = {
  serif: "PTSerif_400Regular",
  serifBold: "PTSerif_700Bold",
  serifItalic: "PTSerif_400Regular_Italic",
  ui: "Inter_400Regular",
  uiMed: "Inter_500Medium",
  uiSemi: "Inter_600SemiBold",
  uiBold: "Inter_700Bold",
} as const;

// Concentric radius scale (benchmark: buttons 8 · cards 14 · sheets/strips 24-32)
export const radius = { xs: 8, sm: 12, md: 14, lg: 24, xl: 32, pill: 999 } as const;

// Soft ambient elevation (the benchmark's card/search-bar shadow)
export const shadow = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  float: {
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

// Motion constants — springy, tactile (press scale, tab bounce).
// One vocabulary for the whole app so nothing animates "off key": three springs,
// three durations, and the entrance rhythm lists share (see components/motion.tsx).
export const motion = {
  pressScale: 0.96,
  spring: { damping: 16, stiffness: 220, mass: 0.6 },
  /** Settles without overshoot — sheets, progress, layout shifts. */
  gentle: { damping: 20, stiffness: 150, mass: 0.9 },
  /** Quick and decisive — chips, toggles, tab icons. */
  snappy: { damping: 18, stiffness: 320, mass: 0.5 },
  /** Overshoots on purpose — hearts, confirmations, badge pops. */
  bouncy: { damping: 9, stiffness: 300, mass: 0.6 },
  fast: 150,
  base: 260,
  slow: 420,
  /** One shimmer sweep across a skeleton. */
  shimmer: 1300,
  /** One specular sweep across a primary CTA, and the rest between sweeps. */
  sheen: 900,
  sheenRest: 3200,
  /** Entrance rhythm: cards rise `rise` px, each `stagger` ms after the last,
   *  and only the first `staggerCap` stagger — anything scrolled to later
   *  animates immediately so long lists never feel like they lag behind. */
  stagger: 45,
  staggerCap: 7,
  rise: 14,
} as const;

/** Skeleton fill + the sheen that sweeps across it, per scheme. */
export const shimmerTint = {
  light: { base: "#EFEFEF", sheen: "rgba(255,255,255,0.95)" },
  dark: { base: "#242424", sheen: "rgba(255,255,255,0.07)" },
} as const;

// Availability tier → dot color
export function tierColor(kind: string): string {
  if (kind === "flatrate" || kind === "library") return brand.tsGreen;
  if (kind === "free" || kind === "ads") return brand.teal;
  return "#9E9E9E";
}
export function tierGroup(kind: string): "sub" | "free" | "rent" {
  if (kind === "flatrate" || kind === "library") return "sub";
  if (kind === "rent" || kind === "buy") return "rent";
  return "free";
}
