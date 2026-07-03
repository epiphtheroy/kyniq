import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Metatake — director";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [{ data: d }, { count }] = await Promise.all([
    supabase.from("directors").select("name, profile_path").eq("slug", slug).maybeSingle(),
    supabase.from("films").select("id", { count: "exact", head: true }).eq("director_slug", slug).eq("visible", true),
  ]);
  const name = d?.name ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const img = d?.profile_path ? `https://image.tmdb.org/t/p/w342${d.profile_path}` : null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#16233F", color: "#FBF8F1", fontFamily: "Georgia, serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "64px 56px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
            <div style={{ display: "flex", background: "#C0392B", color: "#FBF8F1", padding: "6px 18px", borderRadius: 6, fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>Metatake</div>
            <div style={{ display: "flex", fontSize: 26, color: "#E0922A", letterSpacing: 3 }}>DIRECTOR</div>
          </div>
          <div style={{ display: "flex", fontSize: name.length > 22 ? 62 : 78, fontWeight: 700, lineHeight: 1.05 }}>{name}</div>
          <div style={{ display: "flex", fontSize: 30, marginTop: 26, opacity: 0.85 }}>
            {count ? `${count} films read closely — style, tropes & where to start` : "Films, style & where to start"}
          </div>
        </div>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" width={340} height={630} style={{ objectFit: "cover" }} />
        ) : null}
      </div>
    ),
    size,
  );
}
