import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Metatake — credits";

export default async function OgImage({ params }: { params: Promise<{ person: string }> }) {
  const { person } = await params;
  const name = person.replace(/-\d+$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "64px 72px", background: "#16233F", color: "#FBF8F1", fontFamily: "Georgia, serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 30 }}>
          <div style={{ display: "flex", background: "#C0392B", color: "#FBF8F1", padding: "6px 18px", borderRadius: 6, fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>Metatake</div>
          <div style={{ display: "flex", fontSize: 26, color: "#E0922A", letterSpacing: 3 }}>CREDITS</div>
        </div>
        <div style={{ display: "flex", fontSize: name.length > 22 ? 60 : 78, fontWeight: 700, lineHeight: 1.05 }}>{name}</div>
        <div style={{ display: "flex", fontSize: 30, marginTop: 28, opacity: 0.85 }}>
          Films, collaborations & the company they keep
        </div>
      </div>
    ),
    size,
  );
}
