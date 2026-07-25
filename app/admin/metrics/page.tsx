/**
 * /admin/metrics — first-party analytics dashboard.
 *
 * Reads mt_events via the three service-role RPCs from migration 0058
 * (mt_overview_json / mt_page_json / mt_live_json) — one call per panel
 * group, jsonb single-row so the PostgREST 1000-row cap never applies.
 * Collection: components/Metrics.tsx → /api/metrics.
 * GSC panels light up once worker/gsc-pull.py has filled mt_gsc_daily.
 */
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import MetricsChart, { type MetricsPoint } from "@/components/admin/MetricsChart";
import MetricsOptOut from "@/components/admin/MetricsOptOut";
import { Kpi, Panel, SubTitle, BarList, fmt, num, grid2, type Row } from "@/components/admin/AdminUI";

export const dynamic = "force-dynamic";

const RANGES = [
  { d: 1, label: "24h" },
  { d: 7, label: "7d" },
  { d: 28, label: "28d" },
  { d: 90, label: "90d" },
];

// Row + presentational helpers (Kpi/Panel/SubTitle/BarList/fmt/num/grid2) now in @/components/admin/AdminUI

interface Overview {
  totals: {
    pageviews: number; visitors: number; sessions: number;
    pv_per_session: number | null; bounce_pct: number | null;
    avg_dwell_s: number | null; avg_scroll_pct: number | null;
  };
  series: MetricsPoint[];
  top_pages: Row[]; referrers: Row[]; countries: Row[]; devices: Row[]; browsers: Row[];
  entries: Row[]; exits: Row[]; clicks: Row[]; searches: Row[]; vitals: Row[]; transitions: Row[];
}

interface PageDetail {
  totals: { pageviews: number; visitors: number; avg_dwell_s: number | null; avg_scroll_pct: number | null };
  series: MetricsPoint[];
  referrers: Row[]; countries: Row[]; prevs: Row[]; nexts: Row[]; gsc: Row[]; gsc_queries: Row[];
}

interface AiReferrals {
  total_visits: number;
  total_visitors: number;
  sources: Row[];  // { source, n, visitors }
  landings: Row[]; // { path, n }
}

interface GscOverview {
  totals: {
    impressions_7d: number; clicks_7d: number; pos_7d: number | null;
    impressions_prev: number; clicks_prev: number; pos_prev: number | null;
    latest_day: string | null;
  };
  series: MetricsPoint[];
  top_queries: Row[]; top_pages: Row[]; new_queries: Row[];
}

/** Regenerate the one-line report feed when older than 30 min (also cron-run). */
async function refreshInsightsIfStale(supabase: ReturnType<typeof createAdminClient>) {
  try {
    const { data: last } = await supabase
      .from("mt_insights").select("ts").eq("kind", "_run")
      .order("ts", { ascending: false }).limit(1);
    const lastTs = last?.[0]?.ts ? new Date(last[0].ts).getTime() : 0;
    if (Date.now() - lastTs < 30 * 60 * 1000) return;
    await supabase.rpc("mt_generate_insights");
    await supabase.from("mt_insights").insert({
      kind: "_run", key: "run:" + new Date().toISOString().slice(0, 19), line: "",
    });
  } catch {}
}

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; path?: string; b?: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) notFound();

  const sp = await searchParams;
  const d = RANGES.some((r) => r.d === Number(sp.d)) ? Number(sp.d) : 7;
  const drillPath = typeof sp.path === "string" && sp.path.startsWith("/") ? sp.path : null;
  // hourly bucket: automatic for 24h, opt-in (?b=h) up to 7d
  const hourly = d <= 2 || (sp.b === "h" && d <= 7);

  const to = new Date();
  const from = new Date(to.getTime() - d * 24 * 60 * 60 * 1000);
  const bucket = hourly ? "hour" : "day";

  const supabase = createAdminClient();
  await refreshInsightsIfStale(supabase);
  const args = { p_from: from.toISOString(), p_to: to.toISOString(), p_tz: "Asia/Seoul", p_bucket: bucket };

  const [ovRes, liveRes, pageRes, insightsRes, gscRes, aiRes, wrRes] = await Promise.all([
    supabase.rpc("mt_overview_json", args),
    supabase.rpc("mt_live_json"),
    drillPath ? supabase.rpc("mt_page_json", { p_path: drillPath, ...args }) : Promise.resolve({ data: null, error: null }),
    supabase.from("mt_insights").select("ts, kind, line").neq("kind", "_run").order("ts", { ascending: false }).limit(24),
    supabase.rpc("mt_gsc_overview_json", { p_days: 28 }),
    supabase.rpc("mt_ai_referrals_json", { p_from: from.toISOString(), p_to: to.toISOString() }),
    // North star (전환마스터 §8): fails soft until migration 0111 is applied.
    supabase.rpc("mt_weekly_return_json", { p_weeks: 8 }),
  ]);

  const ov = (ovRes.data ?? null) as Overview | null;
  const live = (liveRes.data ?? null) as { active_5m: number; active_30m: number; paths: Row[] } | null;
  const detail = (pageRes.data ?? null) as PageDetail | null;
  const insights = (insightsRes.data ?? []) as { ts: string; kind: string; line: string }[];
  const gsc = (gscRes.data ?? null) as GscOverview | null;
  const ai = (aiRes.data ?? null) as AiReferrals | null;
  const wr = (wrRes.data ?? null) as { week: string; visitors: number; returning: number }[] | null;

  if (ovRes.error) {
    return <div style={{ color: "#e66767" }}>Failed to load metrics: {ovRes.error.message}</div>;
  }
  if (!ov) return <div style={{ color: "#94a3b8" }}>No data.</div>;

  const t = ov.totals;
  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams();
    p.set("d", String(extra.d ?? d));
    if (extra.path) p.set("path", String(extra.path));
    if (extra.b) p.set("b", String(extra.b));
    return `/admin/metrics?${p.toString()}`;
  };
  const fmtTs = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const delta = (cur: number, prev: number) =>
    prev > 0 ? ` (전주 ${prev.toLocaleString()})` : "";

  return (
    <div style={{ maxWidth: 1160 }}>
      {/* header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Analytics</h1>
        <div style={{ display: "flex", gap: 4 }}>
          {RANGES.map((r) => (
            <Link
              key={r.d}
              href={qs({ d: r.d, ...(drillPath ? { path: drillPath } : {}) })}
              style={{
                padding: "4px 12px", borderRadius: 6, fontSize: 13, textDecoration: "none",
                background: r.d === d ? "#60a5fa" : "rgba(148,163,184,0.12)",
                color: r.d === d ? "#0f172a" : "#cbd5e1", fontWeight: r.d === d ? 700 : 400,
              }}
            >
              {r.label}
            </Link>
          ))}
        </div>
        {d <= 7 && (
          <div style={{ display: "flex", gap: 4 }}>
            {[{ b: "h", label: "시간별" }, { b: "d", label: "일별" }].map((o) => (
              <Link
                key={o.b}
                href={qs({ d, b: o.b, ...(drillPath ? { path: drillPath } : {}) })}
                style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 12, textDecoration: "none",
                  background: (o.b === "h") === hourly ? "rgba(96,165,250,0.25)" : "rgba(148,163,184,0.12)",
                  color: (o.b === "h") === hourly ? "#93c5fd" : "#94a3b8",
                }}
              >
                {o.label}
              </Link>
            ))}
          </div>
        )}
        {live && (
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            <span style={{ color: "#0ca30c" }}>●</span> now: <b style={{ color: "#e2e8f0" }}>{live.active_5m}</b> active
            · 30 min: <b style={{ color: "#e2e8f0" }}>{live.active_30m}</b>
          </span>
        )}
        <div style={{ marginLeft: "auto" }}><MetricsOptOut /></div>
      </div>

      {/* one-line report feed (rule-based, regenerated every 30 min) */}
      <Panel title="한줄 리포트 — 기계 감지 (30분 주기, LLM 없음)">
        {insights.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#64748b" }}>아직 감지된 것이 없습니다 — 데이터가 쌓이면 새 검색어·순위 변동·트래픽 급증 등이 여기 한 줄씩 올라옵니다.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {insights.map((i, idx) => (
              <div key={idx} style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.5, display: "flex", gap: 10 }}>
                <span style={{ color: "#64748b", fontVariantNumeric: "tabular-nums", flexShrink: 0, fontSize: 11.5, paddingTop: 1 }}>{fmtTs(i.ts)}</span>
                <span>{i.line}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* KPI tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 20 }}>
        <Kpi label="Visitors" value={fmt(t.visitors)} />
        <Kpi label="Pageviews" value={fmt(t.pageviews)} />
        <Kpi label="Sessions" value={fmt(t.sessions)} />
        <Kpi label="Pages / session" value={t.pv_per_session != null ? String(t.pv_per_session) : "–"} />
        <Kpi label="Bounce" value={t.bounce_pct != null ? `${t.bounce_pct}%` : "–"} />
        <Kpi label="Avg dwell" value={t.avg_dwell_s != null ? `${t.avg_dwell_s}s` : "–"} />
        <Kpi label="Avg scroll" value={t.avg_scroll_pct != null ? `${t.avg_scroll_pct}%` : "–"} />
      </div>

      {/* time series */}
      <Panel title={`Traffic (${bucket === "hour" ? "hourly" : "daily"}, KST)`}>
        <MetricsChart data={ov.series} />
      </Panel>

      {/* Google Search Console — rankings & exposure */}
      {/* ⭐ North star — weekly returning visitors (동반자 전환의 성적표) */}
      <Panel title="⭐ 주간 재방문자 (북극성)">
        {wr && wr.length > 0 ? (
          <table style={{ fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ paddingRight: 16 }}>ISO week</th>
                <th style={num}>visitors</th>
                <th style={num}>returning (≥2일)</th>
                <th style={num}>rate</th>
              </tr>
            </thead>
            <tbody>
              {wr.map((r, i) => (
                <tr key={i}>
                  <td style={{ paddingRight: 16, color: "#cbd5e1" }}>{r.week}</td>
                  <td style={num}>{fmt(r.visitors)}</td>
                  <td style={num}><b style={{ color: "#f1f5f9" }}>{fmt(r.returning)}</b></td>
                  <td style={num}>{r.visitors ? Math.round((r.returning / r.visitors) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.6 }}>
            아직 데이터 없음 — ①마이그레이션 0111 적용(오너 <code>!</code>) ②비콘이 props.wv를 쌓기 시작한
            2026-07-25 이후 첫 주가 차면 나타납니다. 재방문 = 같은 ISO주에 ≥2일 방문한 방문자(주 단위 회전
            해시, PII 없음). GSC 노출·클릭은 관찰 지표 — <b>이 표가 동반자 전환의 성적표입니다.</b>
          </div>
        )}
      </Panel>

      <Panel title={`Google 검색 노출 (GSC, 최근 28일${gsc?.totals?.latest_day ? ` · 데이터 ~${gsc.totals.latest_day}` : ""})`}>
        {gsc && gsc.series.length > 0 ? (
          <>
            <div style={{ display: "flex", gap: 24, fontSize: 13, color: "#cbd5e1", marginBottom: 12, flexWrap: "wrap" }}>
              <span>7일 노출 <b style={{ color: "#f1f5f9" }}>{fmt(gsc.totals.impressions_7d)}</b>{delta(gsc.totals.impressions_7d, gsc.totals.impressions_prev)}</span>
              <span>7일 클릭 <b style={{ color: "#f1f5f9" }}>{fmt(gsc.totals.clicks_7d)}</b>{delta(gsc.totals.clicks_7d, gsc.totals.clicks_prev)}</span>
              <span>평균 순위 <b style={{ color: "#f1f5f9" }}>{gsc.totals.pos_7d ?? "–"}</b>{gsc.totals.pos_prev != null ? ` (전주 ${gsc.totals.pos_prev})` : ""}</span>
            </div>
            <MetricsChart data={gsc.series} height={170} labels={["Impressions", "Clicks"]} />
            <div style={grid2}>
              <div>
                <SubTitle>검색어 (노출·순위)</SubTitle>
                <table style={{ fontSize: 12.5, width: "100%" }}>
                  <thead><tr style={{ textAlign: "left", color: "#94a3b8" }}><th>query</th><th style={num}>클릭</th><th style={num}>노출</th><th style={num}>순위</th></tr></thead>
                  <tbody>
                    {gsc.top_queries.map((r, i) => (
                      <tr key={i}>
                        <td style={{ padding: "3px 0", color: "#e2e8f0" }}>{String(r.query)}</td>
                        <td style={num}>{fmt(r.clicks)}</td>
                        <td style={num}>{fmt(r.impressions)}</td>
                        <td style={num}>{r.pos ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <SubTitle>노출 페이지</SubTitle>
                <table style={{ fontSize: 12.5, width: "100%" }}>
                  <thead><tr style={{ textAlign: "left", color: "#94a3b8" }}><th>page</th><th style={num}>클릭</th><th style={num}>노출</th><th style={num}>순위</th></tr></thead>
                  <tbody>
                    {gsc.top_pages.map((r, i) => (
                      <tr key={i}>
                        <td style={{ padding: "3px 0", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}>
                          <Link href={qs({ d, path: String(r.path) })} style={{ color: "#e2e8f0", textDecoration: "none" }}>{String(r.path)}</Link>
                        </td>
                        <td style={num}>{fmt(r.clicks)}</td>
                        <td style={num}>{fmt(r.impressions)}</td>
                        <td style={num}>{r.pos ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {gsc.new_queries.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <SubTitle>이번 주 새 검색어</SubTitle>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12.5, color: "#cbd5e1" }}>
                      {gsc.new_queries.map((r, i) => (
                        <div key={i}>“{String(r.query)}” → {String(r.path)} <span style={{ color: "#64748b" }}>({r.pos}위 · 노출 {fmt(r.impressions)})</span></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: "#64748b" }}>GSC 데이터 없음 — worker/gsc-daily-watch.sh 가동 여부를 확인하세요.</div>
        )}
      </Panel>

      {/* AI referrals — traffic sent back by AI assistants (the context-pack ROI signal) */}
      <Panel title="AI 유입 — 챗봇이 보내준 트래픽 (인용 채널 ROI)">
        {ai && ai.total_visits > 0 ? (
          <>
            <div style={{ display: "flex", gap: 24, fontSize: 13, color: "#cbd5e1", marginBottom: 12, flexWrap: "wrap" }}>
              <span>AI 유입 방문 <b style={{ color: "#f1f5f9" }}>{fmt(ai.total_visits)}</b></span>
              <span>순 방문자 <b style={{ color: "#f1f5f9" }}>{fmt(ai.total_visitors)}</b></span>
              {ov.totals.pageviews > 0 && (
                <span style={{ color: "#94a3b8" }}>
                  전체 페이지뷰의 <b style={{ color: "#e2e8f0" }}>{((ai.total_visits / ov.totals.pageviews) * 100).toFixed(1)}%</b>
                </span>
              )}
            </div>
            <div style={grid2}>
              <BarList title="AI 소스 (ChatGPT · Perplexity · Claude · …)" rows={ai.sources} labelKey="source" />
              <BarList title="AI가 보낸 착지 페이지" rows={ai.landings} labelKey="path" linkD={d} />
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.6 }}>
            아직 AI 챗봇발(發) 유입이 잡히지 않았습니다 — ChatGPT·Perplexity·Claude·Gemini 등이 답변에 metatake.net을
            링크하고 사용자가 그 링크를 클릭하면 여기에 소스별로 쌓입니다. 컨텍스트 팩·Copy-for-AI 전략이 트래픽으로
            돌아오는지를 이 패널로 90일간 판정하세요. (검색엔진 AI모드는 일반 검색과 구분 불가라 Referrers 패널에 집계됩니다.)
          </div>
        )}
      </Panel>

      {/* per-page drilldown */}
      {drillPath && (
        <Panel
          title={
            <>
              Page: <span style={{ color: "#60a5fa" }}>{drillPath}</span>{" "}
              <Link href={qs({ d })} style={{ fontSize: 12, color: "#94a3b8", marginLeft: 10 }}>✕ close</Link>
            </>
          }
        >
          {detail ? (
            <>
              <div style={{ display: "flex", gap: 24, fontSize: 13, color: "#cbd5e1", marginBottom: 12, flexWrap: "wrap" }}>
                <span>{fmt(detail.totals.pageviews)} pageviews</span>
                <span>{fmt(detail.totals.visitors)} visitors</span>
                <span>dwell {detail.totals.avg_dwell_s ?? "–"}s</span>
                <span>scroll {detail.totals.avg_scroll_pct ?? "–"}%</span>
                <a href={`https://metatake.net${drillPath}`} target="_blank" rel="noopener" style={{ color: "#60a5fa" }}>open ↗</a>
              </div>
              <MetricsChart data={detail.series} height={160} />
              <div style={grid2}>
                <BarList title="Came from (referrers)" rows={detail.referrers} labelKey="d" />
                <BarList title="Countries" rows={detail.countries} labelKey="c" />
                <BarList title="Previous page in session" rows={detail.prevs} labelKey="path" linkD={d} />
                <BarList title="Next page in session" rows={detail.nexts} labelKey="path" linkD={d} />
              </div>
              {detail.gsc_queries.length > 0 ? (
                <div style={{ marginTop: 14 }}>
                  <SubTitle>Google Search queries (GSC)</SubTitle>
                  <table style={{ fontSize: 12.5, width: "100%" }}>
                    <thead><tr style={{ textAlign: "left" }}><th>query</th><th style={num}>clicks</th><th style={num}>impressions</th><th style={num}>avg pos</th></tr></thead>
                    <tbody>
                      {detail.gsc_queries.map((r, i) => (
                        <tr key={i}>
                          <td style={{ padding: "3px 0" }}>{String(r.query)}</td>
                          <td style={num}>{fmt(r.clicks)}</td>
                          <td style={num}>{fmt(r.impressions)}</td>
                          <td style={num}>{r.position ?? "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 12 }}>
                  GSC data not loaded yet — run <code>worker/gsc-pull.py</code> (see HANDOFF-사이트분석.md).
                </div>
              )}
            </>
          ) : (
            <div style={{ color: "#94a3b8", fontSize: 13 }}>No data for this page in range.</div>
          )}
        </Panel>
      )}

      {/* panel grid */}
      <div style={grid2}>
        <BarList title="Top pages" rows={ov.top_pages} labelKey="path" valueKey="pv" linkD={d} extra={(r) => (r.dwell_s != null ? `${r.dwell_s}s · ${r.scroll_pct ?? "–"}%` : "")} />
        <BarList title="Referrers" rows={ov.referrers} labelKey="d" />
        <BarList title="Entry pages" rows={ov.entries} labelKey="path" linkD={d} />
        <BarList title="Exit pages" rows={ov.exits} labelKey="path" linkD={d} />
        <BarList title="Countries" rows={ov.countries} labelKey="c" />
        <div>
          <BarList title="Devices" rows={ov.devices} labelKey="d" />
          <div style={{ height: 14 }} />
          <BarList title="Browsers" rows={ov.browsers} labelKey="b" />
        </div>
        <BarList title="On-site searches" rows={ov.searches} labelKey="q" />
        <BarList title="Clicks (data-mt + outbound)" rows={ov.clicks} labelKey="name" />
        <BarList title="Session flows (page → page)" rows={ov.transitions.map((r) => ({ ...r, pair: `${r.f} → ${r.t}` }))} labelKey="pair" />
        <div>
          <SubTitle>Web vitals (p75)</SubTitle>
          {ov.vitals.length ? (
            <table style={{ fontSize: 12.5 }}>
              <tbody>
                {ov.vitals.map((v, i) => (
                  <tr key={i}>
                    <td style={{ paddingRight: 16, color: "#cbd5e1" }}>{String(v.name)}</td>
                    <td style={{ ...num, color: "#e2e8f0" }}>{v.name === "CLS" ? v.p75 : `${fmt(v.p75)} ms`}</td>
                    <td style={{ ...num, color: "#64748b" }}>n={fmt(v.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: 12, color: "#64748b" }}>Sampled 1-in-3 sessions — accumulates over time.</div>
          )}
        </div>
      </div>

      <p style={{ fontSize: 11.5, color: "#64748b", marginTop: 22, lineHeight: 1.6 }}>
        First-party collection (components/Metrics.tsx → /api/metrics → mt_events). Cookieless: visitor ids rotate daily.
        Bots are filtered by UA + the beacon only runs in real browsers. Click a page row to drill down.
        Instrument any element with <code>data-mt=&quot;name&quot;</code> to count it under Clicks.
      </p>
    </div>
  );
}

