import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity_type?: string; event?: string }>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("content_events")
    .select("id, entity_type, entity_id, event, actor_id, actor_kind, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (params.entity_type) query = query.eq("entity_type", params.entity_type);
  if (params.event) query = query.eq("event", params.event);

  const { data: events } = await query;

  const eventColors: Record<string, string> = {
    generated: "#2563eb",
    verified: "#7c3aed",
    published: "#059669",
    edited: "#d97706",
    rejected: "#dc2626",
    hidden: "#6b7280",
    flag_resolved: "#0891b2",
  };

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "var(--ink)", marginBottom: "0.5rem" }}>
        Audit Log
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1rem" }}>
        Content events trail ({events?.length ?? 0})
      </p>

      {/* Filters */}
      <form style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <select name="entity_type" defaultValue={params.entity_type ?? ""} style={{ padding: "0.5rem", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: "0.8125rem" }}>
          <option value="">All entities</option>
          <option value="question">Questions</option>
          <option value="canonical_answer">Answers</option>
          <option value="contribution">Contributions</option>
          <option value="profile">Profiles</option>
          <option value="flag">Flags</option>
        </select>
        <select name="event" defaultValue={params.event ?? ""} style={{ padding: "0.5rem", border: "1px solid var(--hairline)", borderRadius: 6, fontSize: "0.8125rem" }}>
          <option value="">All events</option>
          <option value="generated">Generated</option>
          <option value="verified">Verified</option>
          <option value="published">Published</option>
          <option value="edited">Edited</option>
          <option value="rejected">Rejected</option>
          <option value="hidden">Hidden</option>
          <option value="flag_resolved">Flag Resolved</option>
        </select>
        <button type="submit" style={{ padding: "0.5rem 1rem", background: "var(--ink)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer" }}>
          Filter
        </button>
      </form>

      <div style={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid var(--hairline)" }}>
              <th style={{ textAlign: "left", padding: "0.625rem 1rem", fontWeight: 600, color: "var(--muted)" }}>Time</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Event</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Entity</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Actor</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Meta</th>
            </tr>
          </thead>
          <tbody>
            {(events ?? []).map((ev) => (
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
                  <span style={{ color: "var(--ink)", fontWeight: 500 }}>{ev.entity_type}</span>
                  <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>{ev.entity_id.slice(0, 8)}…</div>
                </td>
                <td style={{ padding: "0.625rem 0.75rem" }}>
                  <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: "0.6875rem", background: ev.actor_kind === "human" ? "#dbeafe" : ev.actor_kind === "ai" ? "#fce7f3" : "#e0e7ff", color: ev.actor_kind === "human" ? "#1d4ed8" : ev.actor_kind === "ai" ? "#be185d" : "#4338ca" }}>
                    {ev.actor_kind}
                  </span>
                </td>
                <td style={{ padding: "0.625rem 0.75rem", fontSize: "0.6875rem", color: "var(--muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {ev.meta ? JSON.stringify(ev.meta).slice(0, 80) : "—"}
                </td>
              </tr>
            ))}
            {(!events || events.length === 0) && (
              <tr>
                <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
                  No events recorded yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
