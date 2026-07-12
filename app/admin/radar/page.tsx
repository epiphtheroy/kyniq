/**
 * /admin/radar — Keyword Radar feed (정본: HANDOFF-키워드레이더.md §8).
 *
 * Reads radar_items + radar_hits + radar_keywords (migration 0083). Filters by
 * time window (discovered_at — "what the radar found recently"), platform, and
 * keyword. Cards only in Phase 0 (title + author + snippet + matched keywords +
 * link-out; §9). Ingestion is the Mac radar/ worker fleet; this page just reads
 * with the service-role client (radar_* has no RLS). Free-only Phase 0 — no X /
 * Threads.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://metatake.net").replace(/\/$/, "");
const WINDOWS: Record<string, number> = { "1h": 1, "6h": 6, "24h": 24, "7d": 168 };
const PLATFORM_LABEL: Record<string, string> = {
  letterboxd: "Letterboxd", bluesky: "Bluesky", mastodon: "Mastodon", youtube: "YouTube",
  news: "News", wordpress: "WordPress", substack: "Substack", medium: "Medium",
  ghost: "Ghost", hn: "HN", blog: "Blog", x: "X", threads: "Threads", reddit: "Reddit",
};
// view: which authors to show. Default hides institutions (major outlets/news).
const VIEWS: Record<string, string> = { people: "People", all: "All", orgs: "Institutions" };

type SP = { w?: string; platform?: string; kw?: string; tab?: string; view?: string };

type Hit = { matched_on: string; radar_keywords: { id: number; keyword: string } | null };
type Item = {
  id: number; url: string; platform: string; author: string | null; author_url: string | null;
  title: string | null; snippet: string | null; published_at: string | null;
  discovered_at: string; author_kind: string; meta: Record<string, unknown> | null; radar_hits: Hit[];
};
type Source = {
  id: number; platform: string; kind: string; label: string | null; beat: string | null;
  active: boolean; fail_count: number; last_ok_at: string | null;
};

function ago(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function qs(base: SP, patch: Partial<SP>): string {
  const merged = { ...base, ...patch };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
  const s = p.toString();
  return "/admin/radar" + (s ? `?${s}` : "");
}

export default async function RadarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await getAdminUser();
  if (!admin) notFound();

  const sp = await searchParams;
  const w = WINDOWS[sp.w || ""] ? (sp.w as string) : "6h";
  const hours = WINDOWS[w];
  const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
  const platform = sp.platform || "";
  const kwId = sp.kw && /^\d+$/.test(sp.kw) ? Number(sp.kw) : null;
  const tab = sp.tab === "sources" ? "sources" : "feed";
  const view = VIEWS[sp.view || ""] ? (sp.view as string) : "people";

  const sb = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byView = (q: any) =>
    view === "people" ? q.neq("author_kind", "institution")
      : view === "orgs" ? q.eq("author_kind", "institution")
      : q; // 'all'

  // headline counts (respect the current view so the platform tally matches the feed)
  const [{ count: kwCount }, { data: winPlatforms }] = await Promise.all([
    sb.from("radar_keywords").select("*", { count: "exact", head: true }).eq("active", true),
    byView(sb.from("radar_items").select("platform").gte("discovered_at", cutoff)).limit(1000),
  ]);
  const platformCounts: Record<string, number> = {};
  for (const r of (winPlatforms ?? []) as { platform: string }[]) {
    platformCounts[r.platform] = (platformCounts[r.platform] ?? 0) + 1;
  }
  const windowTotal = (winPlatforms ?? []).length;

  // feed query
  let feedItems: Item[] = [];
  if (tab === "feed") {
    let q = sb
      .from("radar_items")
      .select(
        kwId
          ? "id,url,platform,author,author_url,title,snippet,published_at,discovered_at,radar_hits!inner(matched_on,keyword_id,radar_keywords(id,keyword))"
          : "id,url,platform,author,author_url,title,snippet,published_at,discovered_at,radar_hits(matched_on,radar_keywords(id,keyword))"
      )
      .gte("discovered_at", cutoff)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (platform) q = q.eq("platform", platform);
    if (kwId) q = q.eq("radar_hits.keyword_id", kwId);
    const { data } = await q;
    feedItems = (data ?? []) as unknown as Item[];
  }

  let sources: Source[] = [];
  let latestRuns: { engine: string; finished_at: string | null; items_seen: number | null; hits: number | null }[] = [];
  if (tab === "sources") {
    const { data } = await sb
      .from("radar_sources")
      .select("id,platform,kind,label,beat,active,fail_count,last_ok_at")
      .order("fail_count", { ascending: false })
      .order("last_ok_at", { ascending: false, nullsFirst: false })
      .limit(400);
    sources = (data ?? []) as Source[];
  }
  const { data: runs } = await sb
    .from("radar_runs")
    .select("engine,finished_at,items_seen,hits")
    .order("started_at", { ascending: false })
    .limit(40);
  const seenEngines = new Set<string>();
  for (const r of (runs ?? []) as typeof latestRuns) {
    if (seenEngines.has(r.engine)) continue;
    seenEngines.add(r.engine);
    latestRuns.push(r);
  }

  const th: React.CSSProperties = { textAlign: "left", padding: "6px 10px", borderBottom: "2px solid #334155", fontSize: 12, whiteSpace: "nowrap", color: "#94a3b8" };
  const td: React.CSSProperties = { padding: "6px 10px", borderBottom: "1px solid #263449", fontSize: 13, verticalAlign: "top", color: "#cbd5e1" };
  const chip = (active: boolean): React.CSSProperties => ({
    display: "inline-block", padding: "3px 10px", marginRight: 6, marginBottom: 6, borderRadius: 999,
    fontSize: 12, textDecoration: "none", border: "1px solid #334155",
    background: active ? "#2563eb" : "#0f172a", color: active ? "#fff" : "#93a3b8",
  });

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Keyword Radar</h1>
      <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 14px" }}>
        {kwCount ?? 0} active keywords · {windowTotal} item{windowTotal === 1 ? "" : "s"} found in the last {w}
        {windowTotal >= 1000 ? "+ (capped)" : ""} · free-only Phase 0 (Bluesky · Mastodon · YouTube · news · blogs · HN)
      </p>

      {/* tabs */}
      <div style={{ marginBottom: 12 }}>
        <Link href={qs(sp, { tab: undefined })} style={chip(tab === "feed")}>Feed</Link>
        <Link href={qs(sp, { tab: "sources" })} style={chip(tab === "sources")}>Sources &amp; health</Link>
      </div>

      {/* window + platform filters */}
      {tab === "feed" && (
        <div style={{ marginBottom: 10 }}>
          <div>
            <span style={{ fontSize: 11, color: "#64748b", marginRight: 6 }}>WINDOW</span>
            {Object.keys(WINDOWS).map((k) => (
              <Link key={k} href={qs(sp, { w: k })} style={chip(w === k)}>{k}</Link>
            ))}
          </div>
          <div style={{ marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "#64748b", marginRight: 6 }}>PLATFORM</span>
            <Link href={qs(sp, { platform: undefined })} style={chip(!platform)}>all</Link>
            {Object.keys(platformCounts).sort((a, b) => platformCounts[b] - platformCounts[a]).map((p) => (
              <Link key={p} href={qs(sp, { platform: p })} style={chip(platform === p)}>
                {PLATFORM_LABEL[p] ?? p} · {platformCounts[p]}
              </Link>
            ))}
          </div>
          {kwId && (
            <div style={{ marginTop: 6 }}>
              <span style={{ fontSize: 11, color: "#64748b", marginRight: 6 }}>KEYWORD</span>
              <Link href={qs(sp, { kw: undefined })} style={chip(true)}>
                {feedItems[0]?.radar_hits?.find((h) => h.radar_keywords?.id === kwId)?.radar_keywords?.keyword
                  ?? `#${kwId}`} ✕
              </Link>
            </div>
          )}
        </div>
      )}

      {/* feed */}
      {tab === "feed" && (
        <div>
          {feedItems.length === 0 && (
            <p style={{ fontSize: 13, color: "#94a3b8" }}>
              No items in this window yet. If the Mac worker (radar/radar-watch.sh) is running, matched
              content will appear here within minutes (Bluesky/Mastodon are real-time; feeds poll hourly).
            </p>
          )}
          {feedItems.map((it) => {
            const kws = (it.radar_hits ?? []).map((h) => h.radar_keywords).filter(Boolean) as { id: number; keyword: string }[];
            const uniq = Array.from(new Map(kws.map((k) => [k.id, k])).values());
            return (
              <div key={it.id} style={{ padding: "10px 0", borderBottom: "1px solid #263449" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase" }}>
                    {PLATFORM_LABEL[it.platform] ?? it.platform}
                  </span>
                  {it.author && (
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>
                      {it.author_url ? <a href={it.author_url} target="_blank" rel="noopener noreferrer" style={{ color: "#94a3b8" }}>{it.author}</a> : it.author}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: "#64748b" }}>{ago(it.published_at || it.discovered_at)}</span>
                </div>
                <a href={it.url} target="_blank" rel="noopener noreferrer"
                   style={{ display: "block", fontSize: 15, fontWeight: 600, color: "#e2e8f0", textDecoration: "none", margin: "3px 0" }}>
                  {it.title || it.url}
                </a>
                {it.snippet && <p style={{ fontSize: 13, color: "#94a3b8", margin: "2px 0 6px" }}>{it.snippet}</p>}
                <div>
                  {uniq.map((k) => (
                    <Link key={k.id} href={qs(sp, { kw: String(k.id) })}
                          style={{ display: "inline-block", fontSize: 11, color: "#c4b5fd", background: "#1e1b4b",
                                   padding: "2px 8px", borderRadius: 4, marginRight: 6, textDecoration: "none" }}>
                      {k.keyword}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* sources & health */}
      {tab === "sources" && (
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: "8px 0" }}>Engine liveness (latest run per engine)</h2>
          <div style={{ overflowX: "auto", marginBottom: 20 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr><th style={th}>Engine</th><th style={th}>Last run</th><th style={th}>Items</th><th style={th}>Hits</th></tr></thead>
              <tbody>
                {latestRuns.length === 0 && <tr><td style={td} colSpan={4}>No runs yet — start radar/radar-watch.sh.</td></tr>}
                {latestRuns.map((r) => (
                  <tr key={r.engine}>
                    <td style={{ ...td, fontWeight: 600 }}>{r.engine}</td>
                    <td style={td}>{ago(r.finished_at)}</td>
                    <td style={td}>{r.items_seen ?? 0}</td>
                    <td style={td}>{r.hits ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 600, margin: "8px 0" }}>Sources ({sources.length})</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr>
                <th style={th}>Label</th><th style={th}>Platform</th><th style={th}>Kind</th>
                <th style={th}>Beat</th><th style={th}>Fails</th><th style={th}>Last OK</th><th style={th}>Active</th>
              </tr></thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id}>
                    <td style={{ ...td, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label ?? "—"}</td>
                    <td style={td}>{s.platform}</td>
                    <td style={td}>{s.kind}</td>
                    <td style={td}>{s.beat ?? "—"}</td>
                    <td style={{ ...td, color: s.fail_count >= 3 ? "#f87171" : "#cbd5e1", fontWeight: s.fail_count >= 3 ? 700 : 400 }}>{s.fail_count}</td>
                    <td style={td}>{ago(s.last_ok_at)}</td>
                    <td style={td}>{s.active ? "✓" : "✕"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
