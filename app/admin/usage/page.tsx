/**
 * /admin/usage — "The Meter": MCP + REST API + packs + AI crawlers + AI-referral
 * ROI in one owner-facing view. Canonical: HANDOFF-AI사용현황-어드민.md.
 *
 * One service-role jsonb read (usage_overview_json, migration 0100) + the
 * existing mt_ai_referrals_json. Client/crawler UA families are classified in TS
 * (lib/aiClients) so the panels separate REAL use from registry/health-checker
 * noise — the whole point (98%+ of MCP traffic is automated directory crawlers).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import MetricsChart, { type MetricsPoint } from "@/components/admin/MetricsChart";
import { Kpi, Panel, SubTitle, BarList, fmt, grid2, type Row } from "@/components/admin/AdminUI";
import {
  classifyMcpClient, classifyWebCrawler, CLIENT_FAMILY_LABEL, CRAWLER_FAMILY_LABEL,
  type ClientFamily, type CrawlerFamily,
} from "@/lib/aiClients";

export const dynamic = "force-dynamic";

const MCP_LAUNCH = new Date("2026-07-12T00:00:00Z"); // channel-② 90-day verdict clock
const CORPUS_START = new Date("2026-07-01T00:00:00Z"); // "since launch" floor

type Overview = {
  mcp: {
    total: number; handshakes: number; tool_calls: number; clients: number;
    by_tool: { tool: string; n: number; ok_pct: number }[];
    series: { day: string; calls: number; prefixes: number }[];
  };
  api: {
    total: number; blocked: number; clients: number;
    by_endpoint: { endpoint: string; n: number; blocked: number }[];
    series: { day: string; calls: number; prefixes: number }[];
  };
  demand: { arg: string; n: number; sources: string[]; is_film: boolean; is_analyzed: boolean; visible: boolean }[];
  clients: { ua: string; n: number; prefixes: number; trusted: boolean }[];
  crawler: { ua: string; hits: number; last_seen: string }[];
  packs: { downloads: number; top_films: { slug: string; n: number }[]; defense_hits: number };
  freshness: { mcp_calls: string | null; api_calls: string | null; crawler: string | null; usage_daily: string | null };
};
type AiReferrals = { total_visits: number; total_visitors: number; sources: Row[]; landings: Row[] } | null;

const RANGES = [
  { k: "since", label: "since launch" },
  { k: "7", label: "7d" },
  { k: "14", label: "14d" },
  { k: "90", label: "90d" },
];

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; noise?: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) notFound();

  const sp = await searchParams;
  const noise = sp.noise === "1";
  const dk = RANGES.some((r) => r.k === sp.d) ? sp.d! : "since";
  const to = new Date();
  const from = dk === "since" ? CORPUS_START : new Date(to.getTime() - Number(dk) * 86400_000);

  const supabase = createAdminClient();
  const [ovRes, aiRes] = await Promise.all([
    supabase.rpc("usage_overview_json", { p_from: from.toISOString(), p_to: to.toISOString(), p_noise: noise }),
    supabase.rpc("mt_ai_referrals_json", { p_from: from.toISOString(), p_to: to.toISOString() }),
  ]);
  if (ovRes.error) return <div style={{ color: "#e66767" }}>Failed to load usage: {ovRes.error.message}</div>;
  const ov = (ovRes.data ?? null) as Overview | null;
  if (!ov) return <div style={{ color: "#94a3b8" }}>No data.</div>;
  const ai = (aiRes.data ?? null) as AiReferrals;

  // ── derive: client families, crawler families, chart series, freshness ──
  const clientFamilies = new Map<ClientFamily, number>();
  for (const c of ov.clients) {
    const f = classifyMcpClient(c.ua).family;
    clientFamilies.set(f, (clientFamilies.get(f) ?? 0) + c.n);
  }
  const famRows: Row[] = (Object.keys(CLIENT_FAMILY_LABEL) as ClientFamily[])
    .map((f) => ({ label: CLIENT_FAMILY_LABEL[f], n: clientFamilies.get(f) ?? 0, fam: f }))
    .filter((r) => (r.n as number) > 0)
    .sort((a, b) => (b.n as number) - (a.n as number));

  const aiCrawlers = ov.crawler
    .map((c) => ({ ...c, cls: classifyWebCrawler(c.ua) }))
    .filter((c) => c.cls.isAi)
    .map((c) => ({ label: c.cls.label + " · " + shortUa(c.ua), n: c.hits, last: c.last_seen }));
  const crawlerFamilies = new Map<CrawlerFamily, number>();
  for (const c of ov.crawler) {
    const f = classifyWebCrawler(c.ua).family;
    crawlerFamilies.set(f, (crawlerFamilies.get(f) ?? 0) + c.hits);
  }
  const crawlerFamRows: Row[] = (Object.keys(CRAWLER_FAMILY_LABEL) as CrawlerFamily[])
    .map((f) => ({ label: CRAWLER_FAMILY_LABEL[f], n: crawlerFamilies.get(f) ?? 0 }))
    .filter((r) => (r.n as number) > 0)
    .sort((a, b) => (b.n as number) - (a.n as number));

  // merged daily chart: MCP calls (pv) vs API calls (vis)
  const byDay = new Map<string, { pv: number; vis: number }>();
  for (const s of ov.mcp.series) byDay.set(s.day, { pv: s.calls, vis: byDay.get(s.day)?.vis ?? 0 });
  for (const s of ov.api.series) byDay.set(s.day, { pv: byDay.get(s.day)?.pv ?? 0, vis: s.calls });
  const chart: MetricsPoint[] = [...byDay.entries()].sort().map(([b, v]) => ({ b, pv: v.pv, vis: v.vis }));

  const elapsed = Math.floor((to.getTime() - MCP_LAUNCH.getTime()) / 86400_000);
  const topClients: Row[] = ov.clients.slice(0, 15).map((c) => ({
    label: shortUa(c.ua), n: c.n, prefixes: c.prefixes,
    fam: classifyMcpClient(c.ua).family, trusted: c.trusted,
  }));

  return (
    <div style={{ maxWidth: 1160 }}>
      {/* header + range + noise toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 6 }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>AI Usage — The Meter</h1>
        <div style={{ display: "flex", gap: 4 }}>
          {RANGES.map((r) => (
            <Link key={r.k} href={qs({ d: r.k, noise })} style={chip(r.k === dk)}>{r.label}</Link>
          ))}
        </div>
        <Link href={qs({ d: dk, noise: !noise })} style={{ ...chip(noise), marginLeft: 4 }}>
          {noise ? "◧ noise: on" : "◧ noise: off"}
        </Link>
      </div>
      <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>
        Supply side (who pulls our data via MCP/API) + demand ROI (do people come back). Counts are honest:
        REST/embed numbers are <b>cache-miss distinct fetches</b>, not raw loads (see §strip). Handshakes &
        health-checkers are hidden unless <b>noise: on</b> — real tool use is the small number.
      </p>

      {/* A — headline KPIs */}
      <div style={{ ...grid2, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginBottom: 18 }}>
        <Kpi label="MCP tool calls (real use)" value={fmt(ov.mcp.tool_calls)} />
        <Kpi label="Directory discovery (MCP clients)" value={fmt(ov.mcp.clients)} />
        <Kpi label="REST API calls (cache-miss)" value={fmt(ov.api.total)} />
        <Kpi label="AI-referred visits" value={fmt(ai?.total_visits ?? 0)} />
        <Kpi label="Pack downloads" value={fmt(ov.packs.downloads)} />
        <Kpi label="Distinct demand topics" value={fmt(ov.demand.length)} />
      </div>

      <div style={grid2}>
        {/* B — usage trend */}
        <Panel title="Usage trend (daily)">
          {chart.length ? (
            <MetricsChart data={chart} height={180} labels={["MCP calls", "API calls"]} />
          ) : <Empty note="No calls in range." />}
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
            MCP handshakes {noise ? "included" : "excluded"} · toggle noise to see directory-crawler volume.
          </div>
        </Panel>

        {/* C — demand: what films/topics are pulled */}
        <Panel title="What's being asked for (demand → content pipeline)">
          <BarList
            title="Top slugs / queries (MCP + API)"
            rows={ov.demand as unknown as Row[]}
            labelKey="arg"
            linkTo={(_l, r) => (r.is_film ? `/film/${r.arg}` : null)}
            tail={(r) => <TierBadge r={r} />}
          />
        </Panel>

        {/* D — who pulls (client families, noise separated) */}
        <Panel title="Who's pulling (MCP/API clients)">
          <BarList title="By family" rows={famRows} labelKey="label" tail={(r) => (r.fam === "health" ? <Tag c="#64748b">noise</Tag> : r.fam === "assistant" ? <Tag c="#0ca30c">real</Tag> : r.fam === "registry" ? <Tag c="#60a5fa">discovery</Tag> : null)} />
          <div style={{ height: 12 }} />
          <BarList title="Top clients" rows={topClients} labelKey="label" extra={(r) => `${r.prefixes} ip`} tail={(r) => r.trusted ? <Tag c="#c084fc">Anthropic</Tag> : null} />
        </Panel>

        {/* E — AI web crawlers */}
        <Panel title="AI web crawlers (indexing the site)">
          <BarList title="AI assistants & search bots" rows={aiCrawlers} labelKey="label" extra={(r) => tsShort(r.last as string)} />
          <div style={{ height: 12 }} />
          <BarList title="All crawlers by family (cumulative hits)" rows={crawlerFamRows} labelKey="label" />
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
            Classified from raw UA (bot_name parsing is unreliable). Cumulative counters — daily series accrues from the 30-min rollup.
          </div>
        </Panel>

        {/* F — AI referral ROI */}
        <Panel title="Do people come back? (AI-referral ROI)">
          <div style={{ display: "flex", gap: 20, alignItems: "baseline", marginBottom: 8 }}>
            <div><div style={{ fontSize: 26, fontWeight: 700, color: (ai?.total_visits ?? 0) > 0 ? "#0ca30c" : "#e2e8f0" }}>{fmt(ai?.total_visits ?? 0)}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>visits from AI answers</div></div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>Channel-② hypothesis · Day {elapsed} of 90 (verdict 2026-10-10)</div>
          </div>
          {ai && ai.sources.length > 0
            ? <BarList title="By assistant" rows={ai.sources} labelKey="source" />
            : <div style={{ fontSize: 12, color: "#64748b" }}>0 AI-referred visits yet — supply (they pull) is running ahead of demand (they cite & people click). Full referral panel in <Link href="/admin/metrics" style={{ color: "#60a5fa" }}>Analytics</Link>.</div>}
        </Panel>

        {/* G — packs & embed */}
        <Panel title="Packs & embed">
          <div style={{ display: "flex", gap: 22, marginBottom: 10 }}>
            <Stat n={ov.packs.downloads} l="downloads (gated)" />
            <Stat n={ov.packs.defense_hits} l="harvest-defense hits" />
          </div>
          <BarList title="Top downloaded films" rows={ov.packs.top_films as unknown as Row[]} labelKey="slug" linkTo={(l) => `/film/${l}`} />
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
            Free copy-for-AI + embed loads are edge-cached → not counted here (copy clicks live in Analytics; embed per-load is uncountable).
          </div>
        </Panel>
      </div>

      {/* H — instrumentation status (freshness + what's NOT measured) */}
      <Panel title="Instrumentation status">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8, fontSize: 12 }}>
          <FreshRow l="MCP calls (mcp_calls)" ts={ov.freshness.mcp_calls} cadence="real-time" />
          <FreshRow l="REST API (api_calls)" ts={ov.freshness.api_calls} cadence="real-time (from 0100)" />
          <FreshRow l="AI crawlers" ts={ov.freshness.crawler} cadence="counter live · series 30-min rollup" />
          <FreshRow l="Daily rollup (usage_daily)" ts={ov.freshness.usage_daily} cadence="30-min cron · raw kept 90d" />
        </div>
        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 10, lineHeight: 1.6 }}>
          <b style={{ color: "#94a3b8" }}>Not measured (by design):</b> embed badge per-load (edge-cached), API cache HITS (served by CDN without running the route → API counts are distinct fetches ≈ distinct slugs/day), robots-blocked bots (never reach us), and free pack copies (client beacon only, in Analytics clicks).
        </div>
      </Panel>
    </div>
  );
}

// ── small local presentational bits ─────────────────────────────────────────
function chip(active: boolean) {
  return { padding: "4px 12px", borderRadius: 6, fontSize: 13, textDecoration: "none",
    background: active ? "#60a5fa" : "rgba(148,163,184,0.12)", color: active ? "#0f172a" : "#cbd5e1", fontWeight: active ? 700 : 400 } as const;
}
function qs(o: { d: string; noise: boolean }) {
  const p = new URLSearchParams(); p.set("d", o.d); if (o.noise) p.set("noise", "1"); return `/admin/usage?${p.toString()}`;
}
function shortUa(ua: string): string {
  if (!ua) return "(none)";
  return ua.length > 46 ? ua.slice(0, 44) + "…" : ua;
}
function tsShort(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}
function Tag({ c, children }: { c: string; children: React.ReactNode }) {
  return <span style={{ marginLeft: 8, fontSize: 10.5, color: c, border: `1px solid ${c}55`, borderRadius: 4, padding: "0 5px", verticalAlign: "middle" }}>{children}</span>;
}
function TierBadge({ r }: { r: Row }) {
  if (!r.is_film) return <Tag c="#64748b">query</Tag>;
  if (r.is_analyzed && r.visible) return <Tag c="#0ca30c">Tier-1</Tag>;
  if (!r.is_analyzed) return <Tag c="#f59e0b">Tier-2 · 🏭 factory candidate</Tag>;
  return <Tag c="#94a3b8">hidden</Tag>;
}
function Stat({ n, l }: { n: number; l: string }) {
  return <div><div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", fontVariantNumeric: "tabular-nums" }}>{fmt(n)}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{l}</div></div>;
}
function Empty({ note }: { note: string }) {
  return <div style={{ fontSize: 12, color: "#64748b", padding: "18px 0" }}>{note}</div>;
}
function FreshRow({ l, ts, cadence }: { l: string; ts: string | null; cadence: string }) {
  return (
    <div style={{ background: "#0b1220", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 6, padding: "6px 10px" }}>
      <div style={{ color: "#cbd5e1", fontWeight: 600 }}>{l}</div>
      <div style={{ color: ts ? "#94a3b8" : "#64748b" }}>{ts ? `last: ${tsShort(ts)}` : "no data yet"}</div>
      <div style={{ color: "#475569", fontSize: 11 }}>{cadence}</div>
    </div>
  );
}
