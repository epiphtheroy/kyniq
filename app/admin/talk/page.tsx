/**
 * /admin/talk — the moderation queue for the Talk layer (walking skeleton).
 *
 * Three lists in one page: held (links / auto-guards), then everything recent.
 * Publish-then-audit (0017): nothing here blocks posting; this is the weekly
 * five-minute sweep. Actions POST to /api/admin/talk (same pattern as review).
 */

import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { TALK_APPS } from "@/lib/talk/config";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  addr_type: string;
  addr_key: string;
  parent_id: string | null;
  author_app: string | null;
  body: string;
  status: string;
  created_at: string;
  author: { username: string | null; display_name: string | null } | null;
}

const cell: React.CSSProperties = { padding: "0.5rem 0.75rem", verticalAlign: "top", fontSize: "0.8125rem" };

function StatusActions({ row }: { row: Row }) {
  const btn: React.CSSProperties = {
    fontSize: "0.75rem",
    padding: "2px 10px",
    borderRadius: 6,
    border: "1px solid var(--hairline)",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
  };
  const act = (status: string, label: string) => (
    <form key={status} action="/api/admin/talk" method="POST" style={{ display: "inline-block", marginRight: 6 }}>
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" style={btn}>
        {label}
      </button>
    </form>
  );
  return (
    <>
      {row.status !== "published" ? act("published", "Publish") : null}
      {row.status !== "hidden" ? act("hidden", "Hide") : null}
      {row.status !== "deleted" ? act("deleted", "Delete") : null}
    </>
  );
}

function TalkTable({ title, rows }: { title: string; rows: Row[] }) {
  if (!rows.length) return null;
  return (
    <section style={{ marginBottom: "2rem" }}>
      <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
        {title} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({rows.length})</span>
      </h2>
      <div style={{ overflowX: "auto", background: "#0f172a", border: "1px solid var(--hairline)", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ ...cell, whiteSpace: "nowrap", color: "var(--muted)" }}>
                  {new Date(r.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td style={{ ...cell, whiteSpace: "nowrap" }}>
                  {r.author_app ? `${TALK_APPS[r.author_app]?.name ?? r.author_app} (app)` : r.author?.username || r.author?.display_name || "—"}
                </td>
                <td style={{ ...cell, whiteSpace: "nowrap", color: "var(--muted)" }}>
                  {r.addr_type}:{r.addr_key}
                  {r.parent_id ? " · reply" : ""}
                </td>
                <td style={{ ...cell, maxWidth: 420 }}>{r.body.length > 220 ? `${r.body.slice(0, 220)}…` : r.body}</td>
                <td style={{ ...cell, whiteSpace: "nowrap", color: "var(--muted)" }}>{r.status}</td>
                <td style={{ ...cell, whiteSpace: "nowrap" }}>
                  <StatusActions row={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function AdminTalk() {
  const admin = await getAdminUser();
  if (!admin) notFound();

  const c = createAdminClient();
  const { data } = await c
    .from("talk_posts")
    .select(
      "id, addr_type, addr_key, parent_id, author_app, body, status, created_at, author:profiles!talk_posts_author_id_fkey(username, display_name)"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as unknown as Row[];

  const held = rows.filter((r) => r.status === "held");
  const rest = rows.filter((r) => r.status !== "held");

  return (
    <div style={{ maxWidth: 1080 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", margin: "0 0 0.25rem" }}>Talk</h1>
      <p style={{ color: "var(--muted)", margin: "0 0 1.75rem", fontSize: "0.875rem" }}>
        모더레이션 큐 — held는 링크 자동 보류분. 발행 후 감사 원칙(0017): 여기서의 일은 주 1회 5분이 목표.
      </p>
      {rows.length === 0 ? <p style={{ color: "var(--muted)" }}>아직 글이 없습니다.</p> : null}
      <TalkTable title="Held — 검토 대기" rows={held} />
      <TalkTable title="Recent" rows={rest} />
    </div>
  );
}
