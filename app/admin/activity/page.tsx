import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  // ── NOW: agent_activity heartbeat ───────────────────────────────
  const { data: heartbeats } = await supabase
    .from("agent_activity")
    .select("*")
    .order("last_heartbeat_at", { ascending: false })
    .limit(5);

  const activeWorker = heartbeats?.[0] ?? null;

  // How long since last heartbeat
  const heartbeatAge = activeWorker
    ? Math.round((Date.now() - new Date(activeWorker.last_heartbeat_at).getTime()) / 1000)
    : null;
  const isStale = heartbeatAge !== null && heartbeatAge > 60;

  // ── NOW: today's stats from jobs ────────────────────────────────
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: todayJobsDone } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "done")
    .gte("updated_at", todayStart.toISOString());

  const { count: totalFilms } = await supabase
    .from("films")
    .select("id", { count: "exact", head: true });

  const { count: filmsWithQuestions } = await supabase
    .from("questions")
    .select("film_id", { count: "exact", head: true })
    .eq("status", "published")
    .eq("source", "ai");

  // ── TIMELINE: content_events + jobs ─────────────────────────────
  const { data: timelineEvents } = await supabase
    .from("content_events")
    .select("id, entity_type, entity_id, event, actor_kind, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: recentJobs } = await supabase
    .from("jobs")
    .select("id, film_id, status, current_step, questions_done, target_count, result, error, started_at, finished_at, created_at, updated_at, films!inner(title, slug)")
    .order("created_at", { ascending: false })
    .limit(10);

  // ── LATEST OUTPUTS ──────────────────────────────────────────────
  const { data: latestDrafts } = await supabase
    .from("questions")
    .select("id, title, slug, film_id, created_at, status, films!inner(title, slug)")
    .in("status", ["draft", "draft"])
    .eq("source", "ai")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: latestPublished } = await supabase
    .from("questions")
    .select("id, title, slug, film_id, published_at, status, films!inner(title, slug)")
    .eq("status", "published")
    .eq("source", "ai")
    .order("published_at", { ascending: false })
    .limit(5);

  // ── Helpers ─────────────────────────────────────────────────────

  const stateColors: Record<string, string> = {
    idle: "#3b82f6",
    running: "#059669",
    paused: "#d97706",
  };

  const eventColors: Record<string, string> = {
    generated: "#2563eb",
    verified: "#7c3aed",
    published: "#059669",
    media_curated: "#0891b2",
    rejected: "#dc2626",
    hidden: "#6b7280",
    edited: "#d97706",
  };

  const jobStatusColors: Record<string, string> = {
    queued: "#3b82f6",
    claimed: "#8b5cf6",
    running: "#d97706",
    done: "#059669",
    failed: "#dc2626",
  };

  function timeAgo(dateStr: string): string {
    const s = Math.round((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
  }

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
        Activity Log
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
        What the agent is doing now, what it did, and where the outputs are.
      </p>

      {/* ════════════════════════════════════════════════════════════
          NOW — Current State
          ════════════════════════════════════════════════════════════ */}
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
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span style={{ fontSize: "1.25rem" }}>📡</span>
          Now
        </h2>

        {activeWorker ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* State banner */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                background: isStale ? "#7f1d1d" : (activeWorker.state === "running" ? "#064e3b" : "#1e293b"),
                border: `1px solid ${isStale ? "#991b1b" : (activeWorker.state === "running" ? "#065f46" : "#334155")}`,
                borderRadius: 6,
                padding: "0.75rem 1rem",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: isStale ? "#dc2626" : (stateColors[activeWorker.state] ?? "#6b7280"),
                  display: "inline-block",
                  boxShadow: isStale ? "0 0 6px #dc2626" : `0 0 6px ${stateColors[activeWorker.state] ?? "#6b7280"}`,
                }}
              />
              <span style={{ fontWeight: 600, color: isStale ? "#fca5a5" : "#e2e8f0", fontSize: "0.875rem" }}>
                {isStale ? "STALE" : activeWorker.state.toUpperCase()}
              </span>
              <span style={{ color: "#94a3b8", fontSize: "0.8125rem", flex: 1 }}>
                {activeWorker.message ?? "—"}
              </span>
              <span style={{ color: "#64748b", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                {heartbeatAge !== null && `${heartbeatAge}s ago`}
              </span>
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: "1rem" }}>
              {[
                { label: "Today Published", value: activeWorker.today_published ?? 0, color: "#059669" },
                { label: "Today Cost", value: `$${(activeWorker.today_cost ?? 0).toFixed(4)}`, color: "#d97706" },
                { label: "Jobs Done Today", value: todayJobsDone ?? 0, color: "#3b82f6" },
                { label: "Films Total", value: totalFilms ?? 0, color: "#94a3b8" },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    flex: 1,
                    background: "#1e293b",
                    borderRadius: 6,
                    padding: "0.75rem",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: s.color }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: "0.6875rem", color: "#475569" }}>
              Worker: {activeWorker.worker_id}
            </div>
          </div>
        ) : (
          <div style={{ color: "#64748b", fontSize: "0.875rem", padding: "1rem 0" }}>
            No worker heartbeat detected. Start the worker to see activity.
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          LATEST OUTPUTS
          ════════════════════════════════════════════════════════════ */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        {/* Latest Drafts */}
        <div
          style={{
            flex: 1,
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 8,
            padding: "1.25rem",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1rem",
              color: "#e2e8f0",
              marginBottom: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "1rem" }}>📝</span>
            Latest Drafts / Review
          </h2>
          {(latestDrafts ?? []).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {(latestDrafts ?? []).map((q) => {
                const filmData = q.films as unknown as { title: string; slug: string } | null;
                return (
                  <div
                    key={q.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem 0.625rem",
                      background: "#1e293b",
                      borderRadius: 4,
                      fontSize: "0.8125rem",
                    }}
                  >
                    <span
                      style={{
                        padding: "1px 5px",
                        borderRadius: 3,
                        fontSize: "0.625rem",
                        fontWeight: 600,
                        color: "#fff",
                        background: q.status === "draft" ? "#d97706" : "#6b7280",
                        textTransform: "uppercase",
                        flexShrink: 0,
                      }}
                    >
                      {q.status}
                    </span>
                    <span style={{ color: "#e2e8f0", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {q.title}
                    </span>
                    <span style={{ color: "#475569", fontSize: "0.6875rem", flexShrink: 0 }}>
                      {filmData?.title ?? "—"}
                    </span>
                    <span style={{ color: "#475569", fontSize: "0.625rem", flexShrink: 0 }}>
                      {timeAgo(q.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: "#475569", fontSize: "0.8125rem" }}>No drafts in queue</div>
          )}
        </div>

        {/* Latest Published */}
        <div
          style={{
            flex: 1,
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 8,
            padding: "1.25rem",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1rem",
              color: "#e2e8f0",
              marginBottom: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "1rem" }}>✅</span>
            Latest Published
          </h2>
          {(latestPublished ?? []).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {(latestPublished ?? []).map((q) => {
                const filmData = q.films as unknown as { title: string; slug: string } | null;
                return (
                  <a
                    key={q.id}
                    href={filmData ? `/film/${filmData.slug}/q/${q.slug}` : "#"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem 0.625rem",
                      background: "#1e293b",
                      borderRadius: 4,
                      fontSize: "0.8125rem",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <span style={{ color: "#059669", fontSize: "0.875rem", flexShrink: 0 }}>✓</span>
                    <span style={{ color: "#e2e8f0", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {q.title}
                    </span>
                    <span style={{ color: "#475569", fontSize: "0.6875rem", flexShrink: 0 }}>
                      {filmData?.title ?? "—"}
                    </span>
                    <span style={{ color: "#475569", fontSize: "0.625rem", flexShrink: 0 }}>
                      {q.published_at ? timeAgo(q.published_at) : "—"}
                    </span>
                  </a>
                );
              })}
            </div>
          ) : (
            <div style={{ color: "#475569", fontSize: "0.8125rem" }}>No published items yet</div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          RECENT JOBS
          ════════════════════════════════════════════════════════════ */}
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: 8,
          overflow: "hidden",
          marginBottom: "2rem",
        }}
      >
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #334155" }}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1rem",
              color: "#e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "1rem" }}>🔄</span>
            Recent Jobs
          </h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #334155" }}>
              <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 600, color: "#94a3b8" }}>Film</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", fontWeight: 600, color: "#94a3b8" }}>Status</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", fontWeight: 600, color: "#94a3b8" }}>Step</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", fontWeight: 600, color: "#94a3b8" }}>Progress</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", fontWeight: 600, color: "#94a3b8" }}>Result</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", fontWeight: 600, color: "#94a3b8" }}>Duration</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", fontWeight: 600, color: "#94a3b8" }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {(recentJobs ?? []).map((job) => {
              const r = job.result as { questions_created?: number; questions_published?: number; total_cost_usd?: number } | null;
              const filmData = job.films as unknown as { title: string; slug: string } | null;
              const duration = job.started_at && job.finished_at
                ? `${Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000)}s`
                : job.started_at ? "running…" : "—";

              return (
                <tr key={job.id} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "0.5rem 1rem", color: "#e2e8f0" }}>
                    {filmData?.title ?? "—"}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>
                    <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: "0.625rem", fontWeight: 600, color: "#fff", background: jobStatusColors[job.status] ?? "#6b7280", textTransform: "uppercase" }}>
                      {job.status}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#94a3b8", fontSize: "0.75rem" }}>
                    {job.current_step ?? "—"}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#94a3b8" }}>
                    {job.questions_done ?? 0}/{job.target_count}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.6875rem", color: "#94a3b8" }}>
                    {r ? (
                      <span>
                        {r.questions_published ?? 0} pub · {(r.questions_created ?? 0) - (r.questions_published ?? 0)} review
                        {r.total_cost_usd ? ` · $${r.total_cost_usd.toFixed(4)}` : ""}
                      </span>
                    ) : job.error ? (
                      <span style={{ color: "#f87171" }}>{job.error.slice(0, 40)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#64748b", fontSize: "0.75rem" }}>
                    {duration}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#64748b", whiteSpace: "nowrap", fontSize: "0.75rem" }}>
                    {timeAgo(job.created_at)}
                  </td>
                </tr>
              );
            })}
            {(!recentJobs || recentJobs.length === 0) && (
              <tr>
                <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                  No jobs yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ════════════════════════════════════════════════════════════
          TIMELINE — content_events
          ════════════════════════════════════════════════════════════ */}
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #334155" }}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1rem",
              color: "#e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "1rem" }}>📜</span>
            Timeline
          </h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #334155" }}>
              <th style={{ textAlign: "left", padding: "0.5rem 1rem", fontWeight: 600, color: "#94a3b8" }}>Time</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", fontWeight: 600, color: "#94a3b8" }}>Event</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", fontWeight: 600, color: "#94a3b8" }}>Entity</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", fontWeight: 600, color: "#94a3b8" }}>Actor</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", fontWeight: 600, color: "#94a3b8" }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {(timelineEvents ?? []).map((ev) => {
              const meta = ev.meta as Record<string, unknown> | null;
              return (
                <tr key={ev.id} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "0.5rem 1rem", color: "#64748b", whiteSpace: "nowrap", fontSize: "0.75rem" }}>
                    {timeAgo(ev.created_at)}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>
                    <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: "0.625rem", fontWeight: 600, color: "#fff", background: eventColors[ev.event] ?? "#6b7280", textTransform: "uppercase" }}>
                      {ev.event}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>
                    <span style={{ fontWeight: 500, color: "#e2e8f0", fontSize: "0.75rem" }}>{ev.entity_type}</span>
                    <span style={{ color: "#475569", fontSize: "0.625rem" }}> {ev.entity_id.slice(0, 8)}…</span>
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#94a3b8", fontSize: "0.75rem" }}>
                    {ev.actor_kind}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.6875rem", color: "#94a3b8" }}>
                    {meta?.confidence !== undefined && (
                      <span style={{ fontWeight: 600, color: (meta.confidence as number) >= 0.85 ? "#059669" : "#dc2626" }}>
                        {((meta.confidence as number) * 100).toFixed(0)}%
                      </span>
                    )}
                    {meta?.voice && <span> · {meta.voice as string}</span>}
                    {meta?.model && <span> · {meta.model as string}</span>}
                    {meta?.provider && <span> ({meta.provider as string})</span>}
                    {meta?.cost !== undefined && <span> · ${(meta.cost as number).toFixed(4)}</span>}
                    {meta?.gate && <span> · gate: {meta.gate as string}</span>}
                  </td>
                </tr>
              );
            })}
            {(!timelineEvents || timelineEvents.length === 0) && (
              <tr>
                <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                  No events yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
