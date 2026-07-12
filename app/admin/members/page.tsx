import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: members } = await supabase
    .from("profiles")
    .select("id, username, display_name, role, account_status, reputation, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const statusColors: Record<string, string> = {
    active: "#059669",
    suspended: "#dc2626",
  };

  const roleColors: Record<string, string> = {
    admin: "#7c3aed",
    system: "#2563eb",
    user: "#6b7280",
  };

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "var(--ink)", marginBottom: "0.5rem" }}>
        Members
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
        {members?.length ?? 0} registered users
      </p>

      <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155" }}>
              <th style={{ textAlign: "left", padding: "0.625rem 1rem", fontWeight: 600, color: "var(--muted)" }}>User</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Role</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Status</th>
              <th style={{ textAlign: "right", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Rep</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Joined</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
                <td style={{ padding: "0.625rem 1rem" }}>
                  <div style={{ fontWeight: 500, color: "var(--ink)" }}>{m.display_name || "—"}</div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>@{m.username || m.id.slice(0, 8)}</div>
                </td>
                <td style={{ padding: "0.625rem 0.75rem" }}>
                  <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: "0.6875rem", fontWeight: 600, color: "#fff", background: roleColors[m.role] ?? "#6b7280" }}>
                    {m.role}
                  </span>
                </td>
                <td style={{ padding: "0.625rem 0.75rem" }}>
                  <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: "0.6875rem", fontWeight: 600, color: "#fff", background: statusColors[m.account_status] ?? "#6b7280" }}>
                    {m.account_status}
                  </span>
                </td>
                <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 600 }}>{m.reputation}</td>
                <td style={{ padding: "0.625rem 0.75rem", color: "var(--muted)" }}>
                  {new Date(m.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: "0.625rem 0.75rem" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {m.role !== "system" && (
                      <>
                        {m.account_status === "active" ? (
                          <form action="/api/admin/members" method="POST" style={{ display: "inline" }}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="action" value="suspend" />
                            <button type="submit" style={{ padding: "2px 8px", fontSize: "0.6875rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
                              Suspend
                            </button>
                          </form>
                        ) : (
                          <form action="/api/admin/members" method="POST" style={{ display: "inline" }}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="action" value="reactivate" />
                            <button type="submit" style={{ padding: "2px 8px", fontSize: "0.6875rem", background: "#059669", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
                              Reactivate
                            </button>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
