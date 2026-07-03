import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Metatake — movies like";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: f } = await supabase.from("films").select("title, year, poster_path").eq("slug", slug).maybeSingle();
  const title = f?.title ?? slug.replace(/-/g, " ");
  const img = f?.poster_path ? `https://image.tmdb.org/t/p/w342${f.poster_path}` : null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#16233F", color: "#FBF8F1", fontFamily: "Georgia, serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "64px 56px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
            <div style={{ display: "flex", background: "#C0392B", color: "#FBF8F1", padding: "6px 18px", borderRadius: 6, fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>Metatake</div>
            <div style={{ display: "flex", fontSize: 26, color: "#E0922A", letterSpacing: 3 }}>FILMS LIKE</div>
          </div>
          <div style={{ display: "flex", fontSize: 34, opacity: 0.85, marginBottom: 8 }}>Movies like</div>
          <div style={{ display: "flex", fontSize: title.length > 24 ? 56 : 72, fontWeight: 700, lineHeight: 1.05 }}>
            {title}{f?.year ? ` (${f.year})` : ""}
          </div>
          <div style={{ display: "flex", fontSize: 28, marginTop: 26, opacity: 0.85 }}>
            Matched by the ideas they share — not just genre
          </div>
        </div>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" width={420} height={630} style={{ objectFit: "cover" }} />
        ) : null}
      </div>
    ),
    size,
  );
}
