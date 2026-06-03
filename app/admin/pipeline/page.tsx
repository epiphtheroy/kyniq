import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminPipelinePage() {
  const supabase = createAdminClient();

  // Get all films for the selector
  const { data: films } = await supabase
    .from("films")
    .select("id, title, year, director")
    .order("title");

  // Get recent jobs
  const { data: recentJobs } = await supabase
    .from("jobs")
    .select("id, film_id, status, target_count, result, error, created_at, updated_at, films!inner(title)")
    .order("created_at", { ascending: false })
    .limit(10);

  // Get pipeline config
  const { data: configs } = await supabase
    .from("pipeline_config")
    .select("key, value")
    .in("key", ["model_router", "gate_threshold", "rate_limits", "worker_state"]);

  const configMap = new Map((configs ?? []).map((c) => [c.key, c.value]));
  const routerConfig = (configMap.get("model_router") ?? {}) as Record<string, { provider: string; model: string }>;
  const gateConfig = (configMap.get("gate_threshold") ?? { default: 0.85 }) as { default: number };
  const workerState = (configMap.get("worker_state") ?? { paused: false }) as { paused: boolean };

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

  // Recent pipeline events
  const { data: recentEvents } = await supabase
    .from("content_events")
    .select("id, entity_type, entity_id, event, actor_kind, meta, created_at")
    .in("event", ["generated", "verified", "published", "media_curated"])
    .eq("actor_kind", "ai")
    .order("created_at", { ascending: false })
    .limit(15);

  const jobStatusColors: Record<string, string> = {
    queued: "#3b82f6",
    claimed: "#8b5cf6",
    running: "#d97706",
    done: "#059669",
    failed: "#dc2626",
  };

  const eventColors: Record<string, string> = {
    generated: "#2563eb",
    verified: "#7c3aed",
    published: "#059669",
    media_curated: "#0891b2",
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
        Multi-model AI content pipeline — worker service with cross-model verification
      </p>

      {/* Worker status bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          background: workerState.paused ? "#7f1d1d" : "#064e3b",
          border: `1px solid ${workerState.paused ? "#991b1b" : "#065f46"}`,
          borderRadius: 8,
          padding: "0.75rem 1.25rem",
          marginBottom: "1.5rem",
          fontSize: "0.8125rem",
          color: workerState.paused ? "#fca5a5" : "#6ee7b7",
        }}
      >
        <span style={{ fontSize: "1.25rem" }}>{workerState.paused ? "⏸" : "▶"}</span>
        <span style={{ fontWeight: 600 }}>
          Worker: {workerState.paused ? "PAUSED" : "ACTIVE"}
        </span>
        <span style={{ color: workerState.paused ? "#fca5a5" : "#a7f3d0", marginLeft: "auto" }}>
          Gate threshold: {gateConfig.default}
        </span>
      </div>

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
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "1.25rem",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 500, textTransform: "uppercase", marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: s.color }}>
              {s.count}
            </div>
          </div>
        ))}
      </div>

      {/* Enqueue Job form */}
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: 8,
          padding: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.125rem",
            color: "#e2e8f0",
            marginBottom: "1rem",
          }}
        >
          Enqueue Job
        </h2>

        <form
          action="/api/admin/pipeline"
          method="POST"
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "#cbd5e1", marginBottom: 4 }}>
              Film
            </label>
            <select
              name="film_id"
              required
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid #334155",
                borderRadius: 6,
                fontSize: "0.8125rem",
                background: "#1e293b",
                color: "#e2e8f0",
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
            <div style={{ width: 120 }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "#cbd5e1", marginBottom: 4 }}>
                Target Count
              </label>
              <input
                type="number"
                name="target_count"
                defaultValue="10"
                min="1"
                max="20"
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  fontSize: "0.8125rem",
                  background: "#1e293b",
                  color: "#e2e8f0",
                }}
              />
            </div>

            <div style={{ width: 120 }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "#cbd5e1", marginBottom: 4 }}>
                Threshold
              </label>
              <input
                type="number"
                name="threshold"
                defaultValue={String(gateConfig.default)}
                min="0"
                max="1"
                step="0.05"
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  fontSize: "0.8125rem",
                  background: "#1e293b",
                  color: "#e2e8f0",
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
            📋 Enqueue Job
          </button>
        </form>
      </div>

      {/* Model Router Config */}
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: 8,
          padding: "1.25rem",
          marginBottom: "2rem",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1rem",
            color: "#e2e8f0",
            marginBottom: "0.75rem",
          }}
        >
          Model Router Config
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.8125rem" }}>
          {Object.entries(routerConfig).map(([role, cfg]) => (
            <div
              key={role}
              style={{
                background: "#1e293b",
                padding: "0.5rem 0.75rem",
                borderRadius: 6,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: "#94a3b8", fontWeight: 500 }}>{role}</span>
              <span style={{ color: "#e2e8f0" }}>
                {cfg.provider}/{cfg.model}
              </span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: "0.6875rem", color: "#64748b", marginTop: "0.5rem" }}>
          Edit via Supabase → pipeline_config → model_router
        </p>
      </div>

      {/* Recent Jobs */}
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.125rem",
          color: "#e2e8f0",
          marginBottom: "1rem",
        }}
      >
        Recent Jobs
      </h2>

      <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, overflow: "hidden", marginBottom: "2rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155" }}>
              <th style={{ textAlign: "left", padding: "0.625rem 1rem", fontWeight: 600, color: "#94a3b8" }}>Film</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "#94a3b8" }}>Status</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "#94a3b8" }}>Target</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "#94a3b8" }}>Result</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "#94a3b8" }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {(recentJobs ?? []).map((job) => {
              const result = job.result as { questions_created?: number; questions_published?: number; total_cost_usd?: number } | null;
              const filmData = job.films as unknown as { title: string } | null;
              return (
                <tr key={job.id} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "0.625rem 1rem", color: "#e2e8f0" }}>
                    {filmData?.title ?? "—"}
                  </td>
                  <td style={{ padding: "0.625rem 0.75rem" }}>
                    <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: "0.6875rem", fontWeight: 600, color: "#fff", background: jobStatusColors[job.status] ?? "#6b7280" }}>
                      {job.status}
                    </span>
                  </td>
                  <td style={{ padding: "0.625rem 0.75rem", color: "#94a3b8" }}>
                    {job.target_count}
                  </td>
                  <td style={{ padding: "0.625rem 0.75rem", fontSize: "0.6875rem", color: "#94a3b8" }}>
                    {result ? (
                      <span>
                        {result.questions_created ?? 0} created · {result.questions_published ?? 0} published
                        {result.total_cost_usd ? ` · $${result.total_cost_usd.toFixed(4)}` : ""}
                      </span>
                    ) : job.error ? (
                      <span style={{ color: "#f87171" }}>{job.error.slice(0, 60)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ padding: "0.625rem 0.75rem", color: "#64748b", whiteSpace: "nowrap" }}>
                    {new Date(job.created_at).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {(!recentJobs || recentJobs.length === 0) && (
              <tr>
                <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                  No jobs yet — enqueue your first job above
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent Pipeline Events */}
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.125rem",
          color: "#e2e8f0",
          marginBottom: "1rem",
        }}
      >
        Recent Pipeline Events
      </h2>

      <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155" }}>
              <th style={{ textAlign: "left", padding: "0.625rem 1rem", fontWeight: 600, color: "#94a3b8" }}>Time</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "#94a3b8" }}>Event</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "#94a3b8" }}>Entity</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "#94a3b8" }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {(recentEvents ?? []).map((ev) => {
              const meta = ev.meta as Record<string, unknown> | null;
              return (
                <tr key={ev.id} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "0.625rem 1rem", color: "#64748b", whiteSpace: "nowrap" }}>
                    {new Date(ev.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: "0.625rem 0.75rem" }}>
                    <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: "0.6875rem", fontWeight: 600, color: "#fff", background: eventColors[ev.event] ?? "#6b7280" }}>
                      {ev.event}
                    </span>
                  </td>
                  <td style={{ padding: "0.625rem 0.75rem" }}>
                    <span style={{ fontWeight: 500, color: "#e2e8f0" }}>{ev.entity_type}</span>
                    <span style={{ color: "#64748b", fontSize: "0.6875rem" }}> {ev.entity_id.slice(0, 8)}…</span>
                  </td>
                  <td style={{ padding: "0.625rem 0.75rem", fontSize: "0.6875rem", color: "#94a3b8" }}>
                    {meta?.confidence !== undefined && (
                      <span style={{ fontWeight: 600, color: (meta.confidence as number) >= 0.85 ? "#059669" : "#dc2626" }}>
                        {((meta.confidence as number) * 100).toFixed(0)}%
                      </span>
                    )}
                    {meta?.model && <span> · {meta.model as string}</span>}
                    {meta?.provider && <span> ({meta.provider as string})</span>}
                    {meta?.cost !== undefined && <span> · ${(meta.cost as number).toFixed(4)}</span>}
                  </td>
                </tr>
              );
            })}
            {(!recentEvents || recentEvents.length === 0) && (
              <tr>
                <td colSpan={4} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                  No pipeline events yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
