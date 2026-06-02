import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string }>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();
  const query = params.q ?? "";
  const statusFilter = params.status ?? "";
  const typeFilter = params.type ?? "question";

  let items: Array<{
    id: string;
    title?: string;
    body: string;
    status: string;
    source: string;
    created_at: string;
    type: string;
    film_title?: string;
  }> = [];

  if (typeFilter === "question") {
    let q = supabase
      .from("questions")
      .select("id, title, body, status, source, created_at, films!inner(title)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (statusFilter) q = q.eq("status", statusFilter);
    if (query) q = q.ilike("title", `%${query}%`);

    const { data } = await q;
    items = (data ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      body: d.body ?? "",
      status: d.status,
      source: d.source,
      created_at: d.created_at,
      type: "question",
      film_title: (d.films as unknown as { title: string })?.title,
    }));
  } else if (typeFilter === "canonical_answer") {
    let q = supabase
      .from("canonical_answers")
      .select("id, body, status, source, created_at, questions!inner(title, films!inner(title))")
      .order("created_at", { ascending: false })
      .limit(50);

    if (statusFilter) q = q.eq("status", statusFilter);
    if (query) q = q.ilike("body", `%${query}%`);

    const { data } = await q;
    items = (data ?? []).map((d) => {
      const question = d.questions as unknown as { title: string; films: { title: string } };
      return {
        id: d.id,
        title: `Answer: ${question?.title}`,
        body: d.body,
        status: d.status,
        source: d.source,
        created_at: d.created_at,
        type: "canonical_answer",
        film_title: question?.films?.title,
      };
    });
  } else {
    let q = supabase
      .from("contributions")
      .select("id, body, status, source, created_at, questions!inner(title, films!inner(title))")
      .order("created_at", { ascending: false })
      .limit(50);

    if (statusFilter) q = q.eq("status", statusFilter);
    if (query) q = q.ilike("body", `%${query}%`);

    const { data } = await q;
    items = (data ?? []).map((d) => {
      const question = d.questions as unknown as { title: string; films: { title: string } };
      return {
        id: d.id,
        title: `Reading: ${question?.title}`,
        body: d.body,
        status: d.status,
        source: d.source,
        created_at: d.created_at,
        type: "contribution",
        film_title: question?.films?.title,
      };
    });
  }

  const statusColors: Record<string, string> = {
    published: "#059669",
    draft: "#6b7280",
    in_review: "#d97706",
    rejected: "#dc2626",
    hidden: "#9ca3af",
  };

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "var(--ink)", marginBottom: "1rem" }}>
        Content Management
      </h1>

      {/* Filters */}
      <form
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search…"
          style={{
            padding: "0.5rem 0.75rem",
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            fontSize: "0.8125rem",
            width: 200,
          }}
        />
        <select
          name="type"
          defaultValue={typeFilter}
          style={{
            padding: "0.5rem",
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            fontSize: "0.8125rem",
          }}
        >
          <option value="question">Questions</option>
          <option value="canonical_answer">Canonical Answers</option>
          <option value="contribution">Contributions</option>
        </select>
        <select
          name="status"
          defaultValue={statusFilter}
          style={{
            padding: "0.5rem",
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            fontSize: "0.8125rem",
          }}
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="in_review">In Review</option>
          <option value="rejected">Rejected</option>
          <option value="hidden">Hidden</option>
        </select>
        <button
          type="submit"
          style={{
            padding: "0.5rem 1rem",
            background: "var(--ink)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: "0.8125rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Filter
        </button>
      </form>

      {/* Results table */}
      <div style={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid var(--hairline)" }}>
              <th style={{ textAlign: "left", padding: "0.625rem 1rem", fontWeight: 600, color: "var(--muted)" }}>Title</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Film</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Status</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Source</th>
              <th style={{ textAlign: "left", padding: "0.625rem 0.75rem", fontWeight: 600, color: "var(--muted)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
                <td style={{ padding: "0.625rem 1rem", maxWidth: 300 }}>
                  <div style={{ fontWeight: 500, color: "var(--ink)" }}>
                    {(item.title ?? item.body.slice(0, 60)).slice(0, 60)}
                  </div>
                </td>
                <td style={{ padding: "0.625rem 0.75rem", color: "var(--muted)" }}>{item.film_title}</td>
                <td style={{ padding: "0.625rem 0.75rem" }}>
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "#fff",
                      background: statusColors[item.status] ?? "#6b7280",
                    }}
                  >
                    {item.status}
                  </span>
                </td>
                <td style={{ padding: "0.625rem 0.75rem", color: "var(--muted)" }}>{item.source}</td>
                <td style={{ padding: "0.625rem 0.75rem" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {item.status !== "published" && (
                      <form action="/api/admin/review" method="POST" style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="type" value={item.type} />
                        <input type="hidden" name="action" value="publish" />
                        <button type="submit" style={{ padding: "2px 8px", fontSize: "0.6875rem", background: "#059669", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
                          Publish
                        </button>
                      </form>
                    )}
                    {item.status === "published" && (
                      <form action="/api/admin/review" method="POST" style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="type" value={item.type} />
                        <input type="hidden" name="action" value="hide" />
                        <button type="submit" style={{ padding: "2px 8px", fontSize: "0.6875rem", background: "#6b7280", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
                          Hide
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
                  No items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
