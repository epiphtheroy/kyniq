import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Now Playing — Metatake's live layer";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const stamp = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  return `${date} · ${time} UTC`;
};

function fallbackImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          color: "#0d0d0d",
          fontSize: 64,
          fontFamily: "serif",
        }}
      >
        NOW PLAYING
      </div>
    ),
    { ...size }
  );
}

// Text-design card only — no film stills (rights). Newspaper grain: paper
// white, ink, the one red accent, the timestamp as part of the design.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { data } = await db()
      .from("now_articles")
      .select("headline, anchor_label, published_at")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (!data) return fallbackImage();

    const headline = data.headline as string;
    const titleFontSize = headline.length > 90 ? 46 : headline.length > 55 ? 56 : 68;

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "#ffffff",
            color: "#0d0d0d",
            fontFamily: "serif",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", height: 14, width: "1200px", background: "#E3120B" }} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "34px 64px 0 64px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  fontSize: 26,
                  letterSpacing: 5,
                  fontFamily: "sans-serif",
                  fontWeight: 700,
                  color: "#E3120B",
                }}
              >
                <div style={{ display: "flex", width: 16, height: 16, borderRadius: 999, background: "#E3120B" }} />
                NOW PLAYING
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 24,
                  letterSpacing: 3,
                  fontFamily: "sans-serif",
                  fontWeight: 700,
                  color: "#0d0d0d",
                }}
              >
                METATAKE
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "0 64px 48px 64px",
              gap: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: titleFontSize,
                lineHeight: 1.12,
                fontWeight: 700,
                maxWidth: 1060,
              }}
            >
              {headline}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                fontSize: 25,
                fontFamily: "sans-serif",
                color: "#6b6b6b",
                borderTop: "2px solid #0d0d0d",
                paddingTop: 20,
                width: 1060,
              }}
            >
              <div style={{ display: "flex", color: "#0d0d0d", fontWeight: 700 }}>{data.anchor_label as string}</div>
              <div style={{ display: "flex" }}>·</div>
              <div style={{ display: "flex" }}>{stamp(data.published_at as string)}</div>
            </div>
          </div>
        </div>
      ),
      { ...size }
    );
  } catch {
    return fallbackImage();
  }
}
