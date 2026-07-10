import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

/**
 * lib/og-template.tsx — one 1200×630 social card renderer for every page type
 * (see HANDOFF-공유-저장-시스템.md §5.2). System fonts only (no font fetch),
 * TMDB backdrop/poster behind a dark gradient, an eyebrow (what kind of page),
 * a step-down headline, a subline, and up to 4 data badges (the share hook made
 * visual: TakeScore, rank, honors, counts). Each route: load data → ogCard(...).
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";
const IMG = "https://image.tmdb.org/t/p";

type Badge = { label: string; value: string; tone?: "score" | "plain" | "hot" };

export function ogCard(opts: {
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  backdropPath?: string | null;
  posterPath?: string | null;   // shown as a card on the left when there's no backdrop focus
  badges?: Badge[];
}) {
  const { eyebrow, title, subtitle, backdropPath, posterPath, badges = [] } = opts;
  const bg = backdropPath ? `${IMG}/w1280${backdropPath}` : null;
  const poster = posterPath ? `${IMG}/w500${posterPath}` : null;
  const titleSize = title.length > 64 ? 46 : title.length > 42 ? 56 : title.length > 24 ? 68 : 82;

  const toneStyle = (tone?: Badge["tone"]) =>
    tone === "score"
      ? { background: "rgba(15,110,86,0.22)", border: "1px solid rgba(60,200,150,0.5)", color: "#7ff0c4" }
      : tone === "hot"
        ? { background: "rgba(227,18,11,0.2)", border: "1px solid rgba(240,90,80,0.55)", color: "#ff9b93" }
        : { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.25)", color: "#eaeae2" };

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", position: "relative", background: "#0a0a0a",
        color: "#f5f5f0", fontFamily: "serif" }}>
        {bg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bg} width={1200} height={630} style={{ position: "absolute", top: 0, left: 0,
            width: "1200px", height: "630px", objectFit: "cover", opacity: 0.42 }} />
        ) : null}
        <div style={{ position: "absolute", top: 0, left: 0, width: "1200px", height: "630px", display: "flex",
          background: "linear-gradient(180deg, rgba(10,10,10,0.25) 0%, rgba(10,10,10,0.55) 50%, rgba(10,10,10,0.97) 100%)" }} />

        {/* top row: eyebrow + wordmark */}
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between",
          alignItems: "center", padding: "40px 56px 0 56px" }}>
          <div style={{ display: "flex", fontSize: 24, letterSpacing: 3, fontFamily: "sans-serif",
            fontWeight: 700, color: "#c9c9bf", textTransform: "uppercase" }}>{eyebrow ?? "Metatake"}</div>
          <div style={{ display: "flex", fontSize: 24, letterSpacing: 4, fontFamily: "sans-serif",
            fontWeight: 700, color: "#f5f5f0" }}>METATAKE</div>
        </div>

        {/* bottom: poster + headline + badges */}
        <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 34,
          padding: "0 60px 54px 60px" }}>
          {poster && !bg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} width={220} height={330} style={{ width: 220, height: 330, objectFit: "cover",
              borderRadius: 14, boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }} />
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            <div style={{ display: "flex", fontSize: titleSize, lineHeight: 1.06, fontWeight: 700, maxWidth: 1040 }}>{title}</div>
            {subtitle ? (
              <div style={{ display: "flex", fontSize: 29, color: "#c9c9bf", fontFamily: "sans-serif" }}>{subtitle}</div>
            ) : null}
            {badges.length ? (
              <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                {badges.slice(0, 4).map((b, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "9px 16px",
                    borderRadius: 999, fontFamily: "sans-serif", ...toneStyle(b.tone) }}>
                    <span style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>{b.value}</span>
                    <span style={{ display: "flex", fontSize: 20, opacity: 0.85 }}>{b.label}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE }
  );
}

export function ogFallback() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#0a0a0a", color: "#fff", fontSize: 64, fontFamily: "serif",
        letterSpacing: 6 }}>METATAKE</div>
    ),
    { ...OG_SIZE }
  );
}

/** Small anon Supabase client for OG loaders. */
export function ogDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
