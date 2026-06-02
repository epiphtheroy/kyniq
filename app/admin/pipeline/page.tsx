export const dynamic = "force-dynamic";

export default function AdminPipelinePage() {
  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "var(--ink)", marginBottom: "0.5rem" }}>
        Pipeline Controls
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "2rem" }}>
        AI content generation pipeline — wired in Mission 9b
      </p>

      <div
        style={{
          background: "#fff",
          border: "2px dashed var(--hairline)",
          borderRadius: 8,
          padding: "3rem",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⚙️</div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.125rem",
            color: "var(--ink)",
            marginBottom: "0.5rem",
          }}
        >
          Coming in Mission 9b
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.8125rem", lineHeight: 1.6, maxWidth: 480, margin: "0 auto" }}>
          This section will let you trigger AI content generation for a film + question_type,
          view pipeline status and confidence scores, set the publish-gate confidence threshold,
          and pause/resume automated publishing (rate limit per §3.2).
        </p>

        <div
          style={{
            marginTop: "2rem",
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {["Generate for Film", "Confidence Threshold", "Pause Publishing", "Pipeline Status"].map(
            (label) => (
              <div
                key={label}
                style={{
                  padding: "0.75rem 1.25rem",
                  background: "#f3f4f6",
                  borderRadius: 6,
                  fontSize: "0.8125rem",
                  color: "#9ca3af",
                  fontWeight: 500,
                }}
              >
                {label}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
