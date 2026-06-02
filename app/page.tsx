export default function Home() {
  return (
    <div style={{ minHeight: 400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 16 }}>
      {/* Masthead: the descriptor from the logo lockup */}
      <div className="seclbl" style={{ letterSpacing: "0.18em" }}>
        FILM INTERPRETATION COMMUNITY
      </div>
      <div className="tick" />

      {/* Editorial voice tagline */}
      <h1
        className="disp"
        style={{ fontSize: 30, margin: 0 }}
      >
        Read films closely.
      </h1>

      {/* Brief value proposition */}
      <p className="muted ui" style={{ fontSize: 14, maxWidth: "46ch", marginTop: 8 }}>
        Kyniq is a community Q&amp;A platform for interpreting difficult films —
        meaning, symbolism, and intent. Every question builds toward a single,
        continuously improved canonical answer.
      </p>
    </div>
  );
}
