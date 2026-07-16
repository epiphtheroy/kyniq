// Metatake editorial identity ported from web DESIGN-SYSTEM.md v4 / globals.css :root.
// PT Serif headlines · Inter chrome · single red accent · hairlines · square corners.
import { useColorScheme } from "react-native";

export const brand = {
  accent: "#E3120B",
  accentHover: "#B80D05",
  accentInk: "#FFFFFF",
  teal: "#167C6B",
  tsGreen: "#0F6E56", // net TakeScore / Value axis
  tsRisk: "#C8102E",
  tsCost: "#8A8F98",
  success: "#2E7D4F",
} as const;

export type Palette = {
  bg: string;
  surface: string;
  ink: string;
  inkSoft: string;
  muted: string;
  subtle: string;
  hairline: string;
  hairline2: string;
  scrim: string;
};

export const light: Palette = {
  bg: "#FFFFFF",
  surface: "#F2F2F2",
  ink: "#0D0D0D",
  inkSoft: "#1F1F1F",
  muted: "#6B6B6B",
  subtle: "#8F8F8F",
  hairline: "#D8D8D8",
  hairline2: "#B9B9B9",
  scrim: "rgba(0,0,0,0.42)",
};

export const dark: Palette = {
  bg: "#0D0D0D",
  surface: "#1F1F1F",
  ink: "#F2F2F2",
  inkSoft: "#E5E5E5",
  muted: "#A9A9A9",
  subtle: "#8F8F8F",
  hairline: "rgba(255,255,255,0.18)",
  hairline2: "rgba(255,255,255,0.30)",
  scrim: "rgba(0,0,0,0.55)",
};

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}

// 4px spacing scale (--sp-*)
export const sp = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 24, s6: 32, s7: 48, s8: 64 } as const;

// Fluid ramp minimums (phone values of --fs-*)
export const fs = {
  xs: 10.5,
  sm: 12.5,
  base: 15,
  md: 16,
  lg: 18.5,
  xl: 20,
  x2: 24,
  x3: 30,
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

// Square corners are the signature — radius stays 0 everywhere except pills (999).
export const radius = { none: 0, pill: 999 } as const;

// Availability tier → dot color (sub = you have it, free = open, rent/buy = pay-per-view)
export function tierColor(kind: string): string {
  if (kind === "flatrate" || kind === "library") return brand.tsGreen;
  if (kind === "free" || kind === "ads") return brand.teal;
  return "#8F8F8F";
}
export function tierGroup(kind: string): "sub" | "free" | "rent" {
  if (kind === "flatrate" || kind === "library") return "sub";
  if (kind === "rent" || kind === "buy") return "rent";
  return "free";
}
