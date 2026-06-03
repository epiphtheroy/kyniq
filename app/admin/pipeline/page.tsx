import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminPipelinePage() {
  const supabase = createAdminClient();

  // Get all films for the selector
  const { data: films } = await supabase
    .from("films")
    .select("id, title, year, director")
    .order("title");

  // Get recent pipeline events
  const { data: recentEvents } = await supabase
    .from("content_events")
    .select("id, entity_type, entity_id, event, actor_kind, meta, created_at")
    .in("event", ["generated", "verified", "published"])
    .eq("actor_kind", "ai")
    .order("created_at", { ascending: false })
    .limit(20);

  // Count items by status
  const { count: draftCount } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft")
    .eq("source", "ai");

  const { count: reviewCount } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("status", "in_review")
    .eq("source", "ai");

  const { count: publishedCount } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .eq("source", "ai");

  const questionTypes = [
    "interpretation",
    "symbolism",
    "character",
    "technique",
    "theme",
    "ending",
    "comparison",
    "context",
  ];

  const eventColors: Record<string, string> = {
    generated: "#2563eb",
    verified: "#7c3aed",
    published: "#059669",
  };

  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.5rem",
          color: "var(--ink)",
          marginBottom: "0.5rem",
        }}
      >
        Pipeline Controls
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
        AI content generation pipeline (generate → verify → publish)
      </p>

      {/* Status cards */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        {[
          { label: "Draft", count: draftCount ?? 0, color: "#6b7280" },
          { label: "In Review", count: reviewCount ?? 0, color: "#d97706" },
          { label: "Published", count: publishedCount ?? 0, color: "#059669" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              flex: 1,
              background: "#0f172a",
              border: "1px solid var(--hairline)",
              borderRadius: 8,
              padding: "1.25rem",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 500, textTransform: "uppercase", marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: s.color }}>
              {s.count}
            </div>
          </div>
        ))}
      </div>

      {/* Generate form */}
      <div
        style={{
          background: "#0f172a",
          border: "1px solid var(--hairline)",
          borderRadius: 8,
          padding: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.125rem",
            color: "var(--ink)",
            marginBottom: "1rem",
          }}
        >
          Generate Content
        </h2>

        <form
          action="/api/admin/pipeline"
          method="POST"
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--ink)", marginBottom: 4 }}>
              Film
            </label>
            <select
              name="film_id"
              required
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid var(--hairline)",
                borderRadius: 6,
                fontSize: "0.8125rem",
              }}
            >
              <option value="">Select a film…</option>
              {(films ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} ({f.year}) — {f.director}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: "1rem" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--ink)", marginBottom: 4 }}>
                Question Type
              </label>
              <select
                name="question_type"
                required
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid var(--hairline)",
                  borderRadius: 6,
                  fontSize: "0.8125rem",
                }}
              >
                {questionTypes.map((qt) => (
                  <option key={qt} value={qt}>
                    {qt.charAt(0).toUpperCase() + qt.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ width: 120 }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--ink)", marginBottom: 4 }}>
                Threshold
              </label>
              <input
                type="number"
                name="threshold"
                defaultValue="0.85"
                min="0"
                max="1"
                step="0.05"
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid var(--hairline)",
                  borderRadius: 6,
                  fontSize: "0.8125rem",
                }}
              />
            </div>

            <div style={{ width: 80 }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--ink)", marginBottom: 4 }}>
                Count
              </label>
              <input
                type="number"
                name="count"
                defaultValue="1"
                min="1"
                max="5"
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid var(--hairline)",
                  borderRadius: 6,
                  fontSize: "0.8125rem",
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            style={{
              alignSelf: "flex-start",
              padding: "0.625rem 1.5rem",
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🚀 Generate
          </button>
        </form>
      </div>

      {/* Configuration note */}
      <div
        style={{
          background: "#1e3a5f",
          border: "1px solid #2563eb",
          borderRadius: 8,
          padding: "1rem 1.25rem",
          marginBottom: "2rem",
          fontSize: "0.8125rem",
          color: "#93c5fd",
        }}
      >
        <strong>Configuration:</strong> Auto-publish threshold = 0.85 · Max 5 items per run ·
        Rate limit enforced server-side · Items below threshold → admin Review Queue
      </div>

      {/* Recent pipeline events */}
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.125rem",
          color: "var(--ink)",
          marginBottom: "1rem",
        }}
      >
        Recent Pipeline Events
      </h2>

      <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155" }}>
              <th style={{ textAlign: "left", padding: "0.625rem 1rem", fontWeight: 600, color: "var(--muted)" }}>Time</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Event</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Entity</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {(recentEvents ?? []).map((ev) => {
              const meta = ev.meta as Record<string, unknown> | null;
              return (
                <tr key={ev.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
                  <td style={{ padding: "0.625rem 1rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                    {new Date(ev.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: "0.625rem 0.75rem" }}>
                    <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: "0.6875rem", fontWeight: 600, color: "#fff", background: eventColors[ev.event] ?? "#6b7280" }}>
                      {ev.event}
                    </span>
                  </td>
                  <td style={{ padding: "0.625rem 0.75rem" }}>
                    <span style={{ fontWeight: 500 }}>{ev.entity_type}</span>
                    <span style={{ color: "var(--muted)", fontSize: "0.6875rem" }}> {ev.entity_id.slice(0, 8)}…</span>
                  </td>
                  <td style={{ padding: "0.625rem 0.75rem", fontSize: "0.6875rem", color: "var(--muted)" }}>
                    {meta?.confidence !== undefined && (
                      <span style={{ fontWeight: 600, color: (meta.confidence as number) >= 0.85 ? "#059669" : "#dc2626" }}>
                        {((meta.confidence as number) * 100).toFixed(0)}% confidence
                      </span>
                    )}
                    {meta?.model && <span> · {meta.model as string}</span>}
                    {meta?.question_type && <span> · {meta.question_type as string}</span>}
                  </td>
                </tr>
              );
            })}
            {(!recentEvents || recentEvents.length === 0) && (
              <tr>
                <td colSpan={4} style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
                  No pipeline events yet — generate your first content above
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
