import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Metatake — tropes & strong misreadings";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

async function loadMinimal(slug: string) {
  const supabase = db();
  const { data: t } = await supabase
    .from("meta_takes")
    .select("id, title, laconic")
    .eq("slug", slug)
    .eq("kind", "figure_type")
    .eq("status", "published")
    .maybeSingle();
  if (!t) return null;

  const { data: rd } = await supabase
    .from("takes")
    .select("figure:figures!inner(film:films!inner(slug))")
    .eq("trope_id", t.id)
    .eq("status", "published");

  const filmSlugs = new Set<string>();
  let readingCount = 0;
  for (const r of (rd ?? []) as unknown[]) {
    readingCount++;
    const row = r as { figure: { film: { slug: string } } };
    if (row.figure?.film?.slug) filmSlugs.add(row.figure.film.slug);
  }

  return {
    title: t.title as string,
    laconic: t.laconic as string | null,
    filmCount: filmSlugs.size,
    readingCount,
  };
}

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
          background: "#0a0a0a",
          color: "#fff",
          fontSize: 64,
          fontFamily: "serif",
        }}
      >
        METATAKE
      </div>
    ),
    { ...size }
  );
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const data = await loadMinimal(slug);
    if (!data) return fallbackImage();

    const { title, laconic, filmCount, readingCount } = data;

    // Font-size step-down so long titles don't overflow 3 lines at 1200x630.
    const titleFontSize = title.length > 40 ? 56 : title.length > 24 ? 68 : 84;

    const statsLine = [
      filmCount ? `${filmCount} film${filmCount === 1 ? "" : "s"}` : null,
      readingCount ? `${readingCount} reading${readingCount === 1 ? "" : "s"}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            background: "#0a0a0a",
            color: "#f5f5f0",
            fontFamily: "serif",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "1200px",
              height: "630px",
              background:
                "linear-gradient(180deg, rgba(10,10,10,0.15) 0%, rgba(10,10,10,0.55) 55%, rgba(10,10,10,0.96) 100%)",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "relative",
              display: "flex",
              justifyContent: "flex-end",
              padding: "44px 56px 0 56px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 26,
                letterSpacing: 4,
                fontFamily: "sans-serif",
                fontWeight: 700,
                color: "#f5f5f0",
              }}
            >
              METATAKE
            </div>
          </div>
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              padding: "0 64px 56px 64px",
              gap: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: titleFontSize,
                lineHeight: 1.08,
                fontWeight: 700,
                maxWidth: 1000,
              }}
            >
              {title}
            </div>
            {laconic ? (
              <div style={{ display: "flex", fontSize: 30, color: "#c9c9bf", fontFamily: "sans-serif" }}>
                {laconic}
              </div>
            ) : null}
            {statsLine ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
                  color: "#f5f5f0",
                  fontFamily: "sans-serif",
                  letterSpacing: 0.5,
                }}
              >
                {statsLine}
              </div>
            ) : null}
          </div>
        </div>
      ),
      { ...size }
    );
  } catch {
    return fallbackImage();
  }
}
