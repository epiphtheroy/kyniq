import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface ReviewItem {
  id: string;
  type: "question" | "canonical_answer" | "contribution";
  title?: string;
  body: string;
  status: string;
  source: string;
  created_at: string;
  film_title?: string;
  film_slug?: string;
  author_name?: string;
  events: Array<{
    event: string;
    actor_kind: string;
    meta: Record<string, unknown>;
    created_at: string;
  }>;
}

async function getReviewItems(): Promise<ReviewItem[]> {
  const supabase = createAdminClient();
  const items: ReviewItem[] = [];

  // Questions draft
  const { data: questions } = await supabase
    .from("questions")
    .select(`
      id, title, body, status, source, created_at,
      films!inner(title, slug),
      profiles!questions_author_id_fkey(display_name)
    `)
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  for (const q of questions ?? []) {
    const { data: events } = await supabase
      .from("content_events")
      .select("event, actor_kind, meta, created_at")
      .eq("entity_type", "question")
      .eq("entity_id", q.id)
      .order("created_at", { ascending: false });

    const film = q.films as unknown as { title: string; slug: string };
    const author = q.profiles as unknown as { display_name: string } | null;

    items.push({
      id: q.id,
      type: "question",
      title: q.title,
      body: q.body ?? "",
      status: q.status,
      source: q.source,
      created_at: q.created_at,
      film_title: film?.title,
      film_slug: film?.slug,
      author_name: author?.display_name ?? "Unknown",
      events: events ?? [],
    });
  }

  // Canonical answers draft
  const { data: answers } = await supabase
    .from("canonical_answers")
    .select(`
      id, body, status, source, created_at,
      questions!inner(title, slug, films!inner(title, slug))
    `)
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  for (const a of answers ?? []) {
    const { data: events } = await supabase
      .from("content_events")
      .select("event, actor_kind, meta, created_at")
      .eq("entity_type", "canonical_answer")
      .eq("entity_id", a.id)
      .order("created_at", { ascending: false });

    const question = a.questions as unknown as {
      title: string;
      slug: string;
      films: { title: string; slug: string };
    };

    items.push({
      id: a.id,
      type: "canonical_answer",
      title: `Answer: ${question?.title}`,
      body: a.body,
      status: a.status,
      source: a.source,
      created_at: a.created_at,
      film_title: question?.films?.title,
      film_slug: question?.films?.slug,
      author_name: "Metatake Editorial",
      events: events ?? [],
    });
  }

  // Contributions draft
  const { data: contribs } = await supabase
    .from("contributions")
    .select(`
      id, body, status, source, created_at,
      questions!inner(title, slug, films!inner(title, slug)),
      profiles!contributions_author_id_fkey(display_name)
    `)
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  for (const c of contribs ?? []) {
    const { data: events } = await supabase
      .from("content_events")
      .select("event, actor_kind, meta, created_at")
      .eq("entity_type", "contribution")
      .eq("entity_id", c.id)
      .order("created_at", { ascending: false });

    const question = c.questions as unknown as {
      title: string;
      slug: string;
      films: { title: string; slug: string };
    };
    const author = c.profiles as unknown as { display_name: string } | null;

    items.push({
      id: c.id,
      type: "contribution",
      title: `Reading: ${question?.title}`,
      body: c.body,
      status: c.status,
      source: c.source,
      created_at: c.created_at,
      film_title: question?.films?.title,
      film_slug: question?.films?.slug,
      author_name: author?.display_name ?? "Unknown",
      events: events ?? [],
    });
  }

  return items.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export default async function AdminReviewPage() {
  await requireAdmin();
  const items = await getReviewItems();

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
        Review Queue
      </h1>
      <p
        style={{
          color: "var(--muted)",
          fontSize: "0.875rem",
          marginBottom: "1.5rem",
        }}
      >
        Items awaiting review ({items.length})
      </p>

      {items.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "var(--muted)",
            background: "#0f172a",
            borderRadius: 8,
            border: "1px solid var(--hairline)",
          }}
        >
          <p style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>✅ All clear</p>
          <p style={{ fontSize: "0.8125rem" }}>No items pending review</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {items.map((item) => (
            <ReviewCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ item }: { item: ReviewItem }) {
  const typeLabel =
    item.type === "question"
      ? "Question"
      : item.type === "canonical_answer"
        ? "Canonical Answer"
        : "Contribution";

  const typeBadgeColor =
    item.type === "question"
      ? "#3b82f6"
      : item.type === "canonical_answer"
        ? "#8b5cf6"
        : "#10b981";

  // Extract verification info from events
  const verifyEvent = item.events.find((e) => e.event === "verified");
  const confidence = verifyEvent?.meta?.confidence as number | undefined;

  return (
    <div
      style={{
        background: "#0f172a",
        border: "1px solid var(--hairline)",
        borderRadius: 8,
        padding: "1.25rem",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.75rem",
        }}
      >
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: "#fff",
            background: typeBadgeColor,
            textTransform: "uppercase",
          }}
        >
          {typeLabel}
        </span>
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: "0.6875rem",
            fontWeight: 500,
            color: "#92400e",
            background: "#fef3c7",
          }}
        >
          {item.source}
        </span>
        {confidence !== undefined && (
          <span
            style={{
              fontSize: "0.75rem",
              color: confidence >= 0.8 ? "#059669" : "#dc2626",
              fontWeight: 600,
            }}
          >
            Confidence: {(confidence * 100).toFixed(0)}%
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          {new Date(item.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Title and film */}
      <h3
        style={{
          fontSize: "0.9375rem",
          fontWeight: 600,
          color: "var(--ink)",
          marginBottom: "0.25rem",
        }}
      >
        {item.title || "Untitled"}
      </h3>
      {item.film_title && (
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
          Film:{" "}
          <Link
            href={`/film/${item.film_slug}`}
            style={{ color: "var(--accent)", textDecoration: "none" }}
          >
            {item.film_title}
          </Link>{" "}
          · by {item.author_name}
        </p>
      )}

      {/* Body preview */}
      <p
        style={{
          fontSize: "0.8125rem",
          color: "#94a3b8",
          lineHeight: 1.5,
          marginBottom: "0.75rem",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {item.body}
      </p>

      {/* Verification notes */}
      {verifyEvent && (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            background: "#064e3b",
            border: "1px solid #065f46",
            borderRadius: 6,
            fontSize: "0.75rem",
            color: "#6ee7b7",
            marginBottom: "0.75rem",
          }}
        >
          <strong>AI Verification:</strong>{" "}
          {(verifyEvent.meta?.notes as string) ?? "No notes"}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <form action={`/api/admin/review`} method="POST">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="type" value={item.type} />
          <input type="hidden" name="action" value="publish" />
          <button
            type="submit"
            style={{
              padding: "0.375rem 0.875rem",
              background: "#059669",
              color: "#fff",
              border: "none",
              borderRadius: 5,
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Approve & Publish
          </button>
        </form>
        <form action={`/api/admin/review`} method="POST">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="type" value={item.type} />
          <input type="hidden" name="action" value="reject" />
          <button
            type="submit"
            style={{
              padding: "0.375rem 0.875rem",
              background: "#dc2626",
              color: "#fff",
              border: "none",
              borderRadius: 5,
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reject
          </button>
        </form>
      </div>
    </div>
  );
}
