import type { CSSProperties, ReactNode } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminUser, logContentEvent } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export const dynamic = "force-dynamic";

// ── server actions ────────────────────────────────────────────────
async function reviewMetaTake(formData: FormData) {
  "use server";
  const admin = await getAdminUser();
  if (!admin) return;
  const id = String(formData.get("id"));
  const action = String(formData.get("action"));
  const slug = String(formData.get("slug") || "");
  const supabase = createAdminClient();

  if (action === "approve") {
    // keep status 'published' (RLS shows published to the public); just record review
    await supabase.from("meta_takes").update({ critic_approved_by: admin.id }).eq("id", id);
    await logContentEvent({ entityType: "meta_take", entityId: id, event: "meta_take_reviewed", actorId: admin.id, actorKind: "human", meta: { slug } });
  } else if (action === "retire") {
    await supabase.from("meta_takes").update({ status: "retired" }).eq("id", id);
    await logContentEvent({ entityType: "meta_take", entityId: id, event: "meta_take_retired", actorId: admin.id, actorKind: "human", meta: { slug } });
  }
  revalidatePath("/admin");
}

// ── data ──────────────────────────────────────────────────────────
async function count(table: string, build: (q: any) => any) {
  const supabase = createAdminClient();
  const { count } = await build(supabase.from(table).select("*", { count: "exact", head: true }));
  return count ?? 0;
}

async function load() {
  const supabase = createAdminClient();

  const [
    publishedTotal, unreviewed, approved, retired, candidates,
    figuresTotal, takesTotal, takesLinked, filmsTotal,
    qDraft, aDraft, cDraft,
  ] = await Promise.all([
    count("meta_takes", (q) => q.eq("status", "published")),
    count("meta_takes", (q) => q.eq("status", "published").is("critic_approved_by", null)),
    count("meta_takes", (q) => q.eq("status", "published").not("critic_approved_by", "is", null)),
    count("meta_takes", (q) => q.eq("status", "retired")),
    count("meta_takes", (q) => q.eq("status", "candidate")),
    count("figures", (q) => q),
    count("takes", (q) => q),
    count("takes", (q) => q.not("meta_take_id", "is", null)),
    count("films", (q) => q),
    count("questions", (q) => q.eq("status", "draft")),
    count("canonical_answers", (q) => q.eq("status", "draft")),
    count("contributions", (q) => q.eq("status", "draft")),
  ]);

  // film counts per meta take
  const { data: fc } = await supabase.from("meta_take_film_counts").select("meta_take_id, film_count");
  const fcMap = new Map((fc ?? []).map((r) => [r.meta_take_id as string, r.film_count as number]));

  // unreviewed published meta takes (the review queue) — biggest first
  const { data: unrev } = await supabase
    .from("meta_takes")
    .select("id, slug, title, laconic, theorist:theorists(name)")
    .eq("status", "published").is("critic_approved_by", null);
  const queue = (unrev ?? [])
    .map((m) => ({ ...m, n: fcMap.get(m.id) ?? 0 }))
    .sort((a, b) => b.n - a.n);

  // split candidates: a published meta take spanning > 30 films is too broad
  const splitIds = [...fcMap.entries()].filter(([, n]) => n > 30).map(([id]) => id);
  let splits: { id: string; slug: string; title: string; n: number }[] = [];
  if (splitIds.length) {
    const { data: s } = await supabase.from("meta_takes")
      .select("id, slug, title").eq("status", "published").in("id", splitIds);
    splits = (s ?? []).map((m) => ({ ...m, n: fcMap.get(m.id) ?? 0 })).sort((a, b) => b.n - a.n);
  }

  // recent activity
  const { data: events } = await supabase
    .from("content_events")
    .select("entity_type, entity_id, event, actor_kind, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  return {
    stats: { publishedTotal, unreviewed, approved, retired, candidates, figuresTotal, takesTotal, takesLinked, filmsTotal, qDraft, aDraft, cDraft },
    queue, splits, events: events ?? [],
  };
}

// ── presentational ────────────────────────────────────────────────
const card: CSSProperties = { background: "#0f172a", border: "1px solid var(--hairline)", borderRadius: 8, padding: "1rem 1.1rem" };

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: "1.7rem", fontWeight: 700, color: tone ?? "var(--ink)", lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub ? <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

function relTime(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

const EVENT_LABEL: Record<string, { t: string; c: string }> = {
  meta_take_published_unreviewed: { t: "AI published a meta take", c: "#60a5fa" },
  meta_take_reviewed: { t: "Approved a meta take", c: "#34d399" },
  meta_take_retired: { t: "Retired a meta take", c: "#f87171" },
  split_candidate: { t: "Flagged as split candidate", c: "#fbbf24" },
  published: { t: "Published", c: "#34d399" },
  verified: { t: "Verified", c: "#60a5fa" },
  rejected: { t: "Rejected", c: "#f87171" },
};

export default async function AdminControlCenter() {
  const admin = await getAdminUser();
  const { stats, queue, splits, events } = await load();
  const orphanPct = stats.takesTotal ? Math.round((1 - stats.takesLinked / stats.takesTotal) * 100) : 0;
  const legacyDrafts = stats.qDraft + stats.aDraft + stats.cDraft;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "var(--ink)" }}>Control center</h1>
        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Welcome back{admin?.display_name ? `, ${admin.display_name}` : ""}</span>
      </div>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
        The state of the metatake wiki — what the agents built, and what still needs your eye.
      </p>

      {/* AT A GLANCE */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 28 }}>
        <Stat label="Published meta takes" value={stats.publishedTotal} sub={`${stats.approved} reviewed · ${stats.unreviewed} pending`} />
        <Stat label="Awaiting review" value={stats.unreviewed} tone={stats.unreviewed ? "#fbbf24" : "#34d399"} sub="published by AI, not yet checked" />
        <Stat label="Split candidates" value={splits.length} tone={splits.length ? "#fbbf24" : undefined} sub="span > 30 films — too broad" />
        <Stat label="Figures" value={stats.figuresTotal.toLocaleString()} sub={`${stats.filmsTotal} films`} />
        <Stat label="Takes" value={stats.takesTotal.toLocaleString()} sub={`${100 - orphanPct}% linked · ${orphanPct}% orphan`} />
        <Stat label="Retired" value={stats.retired} sub="pulled from the live site" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 22, alignItems: "start" }}>
        {/* NEEDS ATTENTION */}
        <div>
          <SectionTitle>Needs your attention</SectionTitle>

          {splits.length > 0 && (
            <div style={{ ...card, marginBottom: 14, borderColor: "rgba(251,191,36,0.4)" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#fbbf24", marginBottom: 8 }}>
                ⚠ {splits.length} meta take{splits.length > 1 ? "s" : ""} may be too broad — consider splitting
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {splits.map((s) => (
                  <Link key={s.id} href={`/take/${s.slug}`} target="_blank"
                    style={{ fontSize: "0.78rem", color: "var(--ink)", background: "#1e293b", border: "1px solid var(--hairline)", borderRadius: 6, padding: "3px 9px", textDecoration: "none" }}>
                    {s.title} <span style={{ color: "#fbbf24" }}>{s.n}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 8 }}>
            Review queue — {queue.length} AI-published meta takes to check (biggest first)
          </div>
          {queue.length === 0 ? (
            <div style={{ ...card, textAlign: "center", color: "var(--muted)" }}>✅ All meta takes reviewed</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {queue.slice(0, 25).map((m) => {
                const theorist = m.theorist as unknown as { name: string } | null;
                return (
                  <div key={m.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ minWidth: 34, textAlign: "center", fontSize: "0.95rem", fontWeight: 700, color: "var(--accent)" }}>{m.n}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/take/${m.slug}`} target="_blank" style={{ color: "var(--ink)", fontWeight: 600, fontSize: "0.9rem", textDecoration: "none" }}>{m.title}</Link>
                      <div style={{ fontSize: "0.74rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.laconic}{theorist ? ` · ${theorist.name}` : ""}
                      </div>
                    </div>
                    <form action={reviewMetaTake}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="slug" value={m.slug} />
                      <input type="hidden" name="action" value="approve" />
                      <button type="submit" style={btn("#059669")}>Approve</button>
                    </form>
                    <form action={reviewMetaTake}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="slug" value={m.slug} />
                      <input type="hidden" name="action" value="retire" />
                      <button type="submit" style={btn("#7f1d1d")}>Retire</button>
                    </form>
                  </div>
                );
              })}
              {queue.length > 25 ? <div style={{ fontSize: "0.74rem", color: "var(--muted)", padding: "4px 2px" }}>+ {queue.length - 25} more…</div> : null}
            </div>
          )}

          {legacyDrafts > 0 && (
            <div style={{ ...card, marginTop: 14 }}>
              <div style={{ fontSize: "0.8rem", color: "var(--ink)" }}>
                Legacy Q&amp;A drafts: <b>{legacyDrafts}</b> pending
                <span style={{ color: "var(--muted)" }}> ({stats.qDraft} questions · {stats.aDraft} answers · {stats.cDraft} readings)</span>
              </div>
              <Link href="/admin/review" style={{ fontSize: "0.78rem", color: "var(--accent)", textDecoration: "none" }}>Open the old review queue →</Link>
            </div>
          )}
        </div>

        {/* RECENT ACTIVITY */}
        <div>
          <SectionTitle>Recent activity</SectionTitle>
          <div style={card}>
            {events.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>No activity yet.</div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {events.map((e, i) => {
                  const lbl = EVENT_LABEL[e.event] ?? { t: e.event, c: "var(--muted)" };
                  const meta = (e.meta ?? {}) as { slug?: string };
                  return (
                    <li key={i} style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
                      <span style={{ width: 6, height: 6, borderRadius: 6, background: lbl.c, flexShrink: 0, marginTop: 5 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--ink)" }}>{lbl.t}</span>
                        {meta.slug ? <> <Link href={`/take/${meta.slug}`} target="_blank" style={{ fontSize: "0.8rem", color: "var(--accent)", textDecoration: "none" }}>{meta.slug}</Link></> : null}
                        <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}> · {e.actor_kind}</span>
                      </div>
                      <span style={{ fontSize: "0.7rem", color: "var(--muted)", flexShrink: 0 }}>{relTime(e.created_at)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", marginBottom: 12, borderBottom: "1px solid var(--hairline)", paddingBottom: 6 }}>{children}</h2>;
}

function btn(bg: string): CSSProperties {
  return { padding: "0.35rem 0.7rem", background: bg, color: "#fff", border: "none", borderRadius: 5, fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", flexShrink: 0 };
}
