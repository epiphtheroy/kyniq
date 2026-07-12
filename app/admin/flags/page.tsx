import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminFlagsPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: flags } = await supabase
    .from("flags")
    .select(`
      id, target_type, target_id, reason, status, created_at,
      profiles!flags_user_id_fkey(display_name)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  const statusColors: Record<string, string> = {
    open: "#d97706",
    resolved: "#059669",
    dismissed: "#6b7280",
  };

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "var(--ink)", marginBottom: "0.5rem" }}>
        Flags
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
        User reports ({flags?.length ?? 0})
      </p>

      {!flags || flags.length === 0 ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--muted)", background: "#0f172a", borderRadius: 8, border: "1px solid #334155" }}>
          <p style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>🏳️ No flags</p>
          <p style={{ fontSize: "0.8125rem" }}>No user reports to review</p>
        </div>
      ) : (
        <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155" }}>
                <th style={{ textAlign: "left", padding: "0.625rem 1rem", fontWeight: 600, color: "var(--muted)" }}>Target</th>
                <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Reason</th>
                <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Reporter</th>
                <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Status</th>
                <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Date</th>
                <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => {
                const reporter = f.profiles as unknown as { display_name: string } | null;
                return (
                  <tr key={f.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
                    <td style={{ padding: "0.625rem 1rem" }}>
                      <span style={{ fontWeight: 500 }}>{f.target_type}</span>
                      <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>{f.target_id.slice(0, 8)}…</div>
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", color: "var(--ink)", maxWidth: 200 }}>
                      {f.reason || "No reason given"}
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", color: "var(--muted)" }}>
                      {reporter?.display_name || "Anonymous"}
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem" }}>
                      <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: "0.6875rem", fontWeight: 600, color: "#fff", background: statusColors[f.status] ?? "#6b7280" }}>
                        {f.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", color: "var(--muted)" }}>
                      {new Date(f.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem" }}>
                      {f.status === "open" && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <form action="/api/admin/flags" method="POST" style={{ display: "inline" }}>
                            <input type="hidden" name="id" value={f.id} />
                            <input type="hidden" name="action" value="resolve_hide" />
                            <input type="hidden" name="target_type" value={f.target_type} />
                            <input type="hidden" name="target_id" value={f.target_id} />
                            <button type="submit" style={{ padding: "2px 8px", fontSize: "0.6875rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
                              Hide Content
                            </button>
                          </form>
                          <form action="/api/admin/flags" method="POST" style={{ display: "inline" }}>
                            <input type="hidden" name="id" value={f.id} />
                            <input type="hidden" name="action" value="dismiss" />
                            <button type="submit" style={{ padding: "2px 8px", fontSize: "0.6875rem", background: "#6b7280", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
                              Dismiss
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
