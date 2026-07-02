import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Metatake — figures & strong misreadings";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

async function loadMinimal(slug: string, figureSlug: string) {
  const supabase = db();
  const { data: film } = await supabase
    .from("films")
    .select("id, title, year")
    .eq("slug", slug)
    .maybeSingle();
  if (!film) return null;

  const { data: figure } = await supabase
    .from("figures")
    .select("id, label")
    .eq("film_id", film.id)
    .eq("slug", figureSlug)
    .maybeSingle();
  if (!figure) return null;

  const { count } = await supabase
    .from("takes")
    .select("id", { count: "exact", head: true })
    .eq("figure_id", figure.id)
    .eq("status", "published")
    .eq("is_invitation", false);

  return {
    title: figure.label as string,
    filmTitle: film.title as string,
    year: film.year as number | null,
    misreadingCount: count ?? 0,
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

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; figureSlug: string }>;
}) {
  try {
    const { slug, figureSlug } = await params;
    const data = await loadMinimal(slug, figureSlug);
    if (!data) return fallbackImage();

    const { title, filmTitle, year, misreadingCount } = data;

    // Font-size step-down so long titles don't overflow 3 lines at 1200x630.
    const titleFontSize = title.length > 40 ? 56 : title.length > 24 ? 68 : 84;

    const statsLine = misreadingCount
      ? `${misreadingCount} strong misreading${misreadingCount === 1 ? "" : "s"}`
      : null;

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
            <div style={{ display: "flex", fontSize: 30, color: "#c9c9bf", fontFamily: "sans-serif" }}>
              {filmTitle}
              {year ? <span style={{ color: "#a3a39a", marginLeft: 10 }}>({year})</span> : null}
            </div>
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
