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

/** Migration 0120 — the visitor count with automated clients and the owner
 *  removed. Classified on session shape, not user-agent. Upper bound: a bot
 *  that loads one page and leaves looks like a one-page human. */
interface RealVisitors {
  days: {
    day: string; visitors: number; pageviews: number; clicks: number;
    pv_per_visitor: number | null; clicks_per_visitor: number | null;
    bots: number; bot_pageviews: number;
    owner_hashes: number; owner_pageviews: number; raw_visitors: number;
  }[];
  avg: { days: number; visitors_per_day: number; pv_per_visitor: number; clicks_per_visitor: number } | null;
}

interface AiReferrals {
  total_visits: number;
  total_visitors: number;
  sources: Row[];  // { source, n, visitors }
  landings: Row[]; // { path, n }
}

/** Migration 0144 — the native app leaves no beacon and no Vercel pageview;
 *  its only trace is the api_calls ledger every /api/v1/app/* route writes.
 *  Counts are a floor (most BFF responses are CDN-cached; only misses ledger). */
interface AppActivity {
  days: {
    day: string; calls: number; ios: number; android: number;
    networks: number; new_networks: number; downloads: number | null;
    devices: number; screens: number; taps: number;
  }[];
  endpoints: { endpoint: string; n: number; networks: number }[];
  /** 0145 beacon — exact counts, unlike the cache-miss ledger above. */
  screens_top: { name: string; n: number; devices: number }[];
  taps_top: { name: string; n: number; devices: number }[];
  totals: {
    calls: number; networks: number; ios: number; android: number;
    new_networks: number; downloads: number; push_devices: number; push_seen_7d: number;
    devices: number; screens: number; taps: number;
  };
}

const APP_TAP_LABELS: Record<string, string> = {
  "watchlist:add": "♥ 볼래 담기",
  "watchlist:remove": "볼래 해제",
  seen: "봤어 표시",
  rate: "별점 매김",
  pass: "✕ 패스",
  "pass:restore": "패스 복구",
  "judgment:undo": "실행취소",
  "list:save": "★ 리스트 저장",
  "list:unsave": "리스트 저장 해제",
  "reader:open": "리더·웹뷰 열기",
};

const APP_ENDPOINT_LABELS: Record<string, string> = {
  app_tonight: "Tonight 덱",
  app_film: "영화 상세",
  app_navigator: "Navigator 드라이브 (정확)",
  app_director: "감독 화면",
  app_tmdb_search: "검색 · TMDB 폴백",
  app_countries: "온보딩 · 국가",
  app_services: "온보딩 · 스트리밍 서비스",
  app_handoff: "웹뷰 SSO 핸드오프 (정확)",
  app_account_delete: "계정 삭제",
};

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

  const [ovRes, liveRes, pageRes, insightsRes, gscRes, aiRes, wrRes, rvRes, appRes, waRes] = await Promise.all([
    supabase.rpc("mt_overview_json", args),
    supabase.rpc("mt_live_json"),
    drillPath ? supabase.rpc("mt_page_json", { p_path: drillPath, ...args }) : Promise.resolve({ data: null, error: null }),
    supabase.from("mt_insights").select("ts, kind, line").neq("kind", "_run").order("ts", { ascending: false }).limit(24),
    supabase.rpc("mt_gsc_overview_json", { p_days: 28 }),
    supabase.rpc("mt_ai_referrals_json", { p_from: from.toISOString(), p_to: to.toISOString() }),
    // North star (전환마스터 §8). 0149 rewrote this to apply the 0120 bot
    // classifier — until then the headline number counted machines.
    supabase.rpc("mt_weekly_return_json", { p_weeks: 8 }),
    // Real visitors (0120): every other count on this page includes bots.
    supabase.rpc("mt_real_visitors_json", { p_days: 14 }),
    // Mobile app (0144): fails soft until the migration is applied.
    supabase.rpc("mt_app_activity_json", { p_days: 14 }),
    // The bot-proof floor (0149): authenticated users who actually wrote something.
    supabase.rpc("mt_weekly_auth_active_json", { p_weeks: 8 }),
  ]);

  const ov = (ovRes.data ?? null) as Overview | null;
  const live = (liveRes.data ?? null) as { active_5m: number; active_30m: number; paths: Row[] } | null;
  const detail = (pageRes.data ?? null) as PageDetail | null;
  const insights = (insightsRes.data ?? []) as { ts: string; kind: string; line: string }[];
  const gsc = (gscRes.data ?? null) as GscOverview | null;
  const ai = (aiRes.data ?? null) as AiReferrals | null;
  const wr = (wrRes.data ?? null) as {
    week: string; visitors: number; visitors_raw: number;
    returning: number; returning_raw: number; returning_engaged: number; removed: number;
  }[] | null;
  const rv = (rvRes.data ?? null) as RealVisitors | null;
  const appAct = (appRes.data ?? null) as AppActivity | null;
  const wa = (waRes.data ?? null) as { week: string; active: number; multi_day: number }[] | null;
  const waBy = new Map((wa ?? []).map((r) => [r.week, r]));

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

      {/* ⭐ Real visitors — first panel on the page on purpose. Every other
          count here (KPI tiles, Traffic chart, Visitors) includes automated
          clients: on 08-02 a Google Cloud sweep added 688 events and read as
          the best day of the month. This is the number to steer by. */}
      <div style={{
        background: "linear-gradient(180deg, rgba(96,165,250,0.10), rgba(15,23,42,0))",
        border: "1px solid rgba(96,165,250,0.35)", borderRadius: 10,
        padding: "16px 18px", marginBottom: 20,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 3 }}>
          ⭐ 실제 방문자 <span style={{ fontWeight: 400, color: "#93c5fd" }}>— 봇·나(오너) 제외</span>
        </div>
        <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 12 }}>
          아래 다른 모든 숫자(Visitors·Pageviews·Traffic)는 봇이 포함된 값입니다.
        </div>
        {rv && rv.days.length > 0 ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
              <Kpi label={`오늘 ${rv.days[0].day} (진행중)`} value={fmt(rv.days[0].visitors)} />
              {rv.avg && <Kpi label={`하루 평균 (${rv.avg.days}일)`} value={fmt(rv.avg.visitors_per_day)} />}
              {rv.avg && <Kpi label="페이지 / 방문자" value={String(rv.avg.pv_per_visitor)} />}
              {rv.avg && <Kpi label="클릭 / 방문자" value={String(rv.avg.clicks_per_visitor)} />}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ fontSize: 12.5, width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                    <th style={{ paddingRight: 16, fontWeight: 500 }}>날짜</th>
                    <th style={{ ...num, fontWeight: 500 }}>실방문자</th>
                    <th style={{ ...num, fontWeight: 500 }}>PV</th>
                    <th style={{ ...num, fontWeight: 500 }}>클릭</th>
                    <th style={{ ...num, fontWeight: 500 }}>PV/명</th>
                    <th style={{ ...num, fontWeight: 500 }}>클릭/명</th>
                    <th style={{ ...num, fontWeight: 500, color: "#64748b" }}>제외 봇</th>
                    <th style={{ ...num, fontWeight: 500, color: "#64748b" }}>제외 나</th>
                    <th style={{ ...num, fontWeight: 500, color: "#64748b" }}>원시</th>
                  </tr>
                </thead>
                <tbody>
                  {rv.days.map((r, i) => (
                    <tr key={r.day} style={i === 0 ? { color: "#93c5fd" } : undefined}>
                      <td style={{ paddingRight: 16, color: i === 0 ? "#93c5fd" : "#cbd5e1" }}>
                        {r.day}{i === 0 ? " ·" : ""}
                      </td>
                      <td style={num}><b style={{ color: i === 0 ? "#93c5fd" : "#f1f5f9" }}>{fmt(r.visitors)}</b></td>
                      <td style={num}>{fmt(r.pageviews)}</td>
                      <td style={num}>{fmt(r.clicks)}</td>
                      <td style={num}>{r.pv_per_visitor ?? "–"}</td>
                      <td style={num}>{r.clicks_per_visitor ?? "–"}</td>
                      <td style={{ ...num, color: "#64748b" }}>{r.bots ? `${fmt(r.bots)} (${fmt(r.bot_pageviews)}pv)` : "–"}</td>
                      <td style={{ ...num, color: "#64748b" }}>{r.owner_pageviews ? `${fmt(r.owner_pageviews)}pv` : "–"}</td>
                      <td style={{ ...num, color: "#64748b" }}>{fmt(r.raw_visitors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.65, marginTop: 12 }}>
              봇 판정은 UA가 아니라 <b>세션 모양</b>입니다 — 페이지마다 세션이 새로 생기면(세션수 ≈ 방문 페이지수)
              자동화입니다. 실측 분리선: 봇 2.3~3.6 이벤트/세션, 사람 6.0~17.7. /24 단위로 걸러서
              한 대역이 방문자 해시를 20개씩 찍어내는 농장도 한 번에 잡습니다.
              나(오너) 제외는 <code>180.70.243.0/24</code>와 하루 8PV 이상 한국 방문입니다.
              <b style={{ color: "#94a3b8" }}> 이 수치는 상한선입니다</b> — 한 페이지만 열고 나가는 봇은 한 페이지 읽고 나가는 사람과 구분되지 않습니다.
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.6 }}>
            아직 데이터 없음 — 마이그레이션 0120 적용 후 나타납니다.
          </div>
        )}
      </div>

      {/* 📱 Mobile app — the traffic every other number on this page misses.
          Native screens run no beacon and no Vercel analytics script; their
          only trace is the api_calls ledger written by /api/v1/app/*. */}
      <div style={{
        background: "linear-gradient(180deg, rgba(52,211,153,0.08), rgba(15,23,42,0))",
        border: "1px solid rgba(52,211,153,0.30)", borderRadius: 10,
        padding: "16px 18px", marginBottom: 20,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 3 }}>
          📱 모바일 앱 <span style={{ fontWeight: 400, color: "#6ee7b7" }}>— 다운로드 · 활동 (위 방문자 수에 안 잡히는 트래픽)</span>
        </div>
        <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 12 }}>
          앱은 웹 비콘도 Vercel 페이지뷰도 남기지 않아 위 실방문자 수치 어디에도 포함되지 않습니다.
          <b style={{ color: "#6ee7b7" }}> 초록 숫자(기기·화면·탭)는 앱 비콘 실측</b>이고,
          회색(요청·망)은 BFF 레저 기반 추정 — 대부분 CDN 캐시라 <b>미스만 기록된 하한선</b>입니다.
        </div>
        {appAct && appAct.totals ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
              <Kpi label="14일 활성 기기 (실측)" value={fmt(appAct.totals.devices)} />
              <Kpi label="화면 열람 (실측)" value={fmt(appAct.totals.screens)} />
              <Kpi label="탭·판단 액션 (실측)" value={fmt(appAct.totals.taps)} />
              <Kpi label="App Store 다운로드 (누적)" value={appAct.totals.downloads > 0 ? fmt(appAct.totals.downloads) : "—"} />
              <Kpi label="14일 앱 요청 (캐시미스)" value={fmt(appAct.totals.calls)} />
              <Kpi label="신규 네트워크 (설치 추정)" value={fmt(appAct.totals.new_networks)} />
              <Kpi label="푸시 등록 기기" value={fmt(appAct.totals.push_devices)} />
            </div>
            {appAct.totals.screens + appAct.totals.taps > 0 ? (
              <div style={{ ...grid2, marginBottom: 4 }}>
                <BarList
                  title="화면 열람 (비콘 실측 · 기기수 병기)"
                  rows={appAct.screens_top.map((s) => ({ label: s.name, n: s.n, devices: s.devices }))}
                  labelKey="label"
                  extra={(r) => `${r.devices}대`}
                />
                <BarList
                  title="⭐ 앱 내 탭 — 판단 액션 (비콘 실측)"
                  rows={appAct.taps_top.map((t2) => ({
                    label: APP_TAP_LABELS[t2.name] ?? t2.name, n: t2.n, devices: t2.devices,
                  }))}
                  labelKey="label"
                  extra={(r) => `${r.devices}대`}
                />
              </div>
            ) : (
              <div style={{
                fontSize: 12, color: "#94a3b8", lineHeight: 1.6, marginBottom: 12,
                background: "rgba(148,163,184,0.08)", borderRadius: 8, padding: "10px 12px",
              }}>
                <b style={{ color: "#cbd5e1" }}>비콘 대기 중</b> — 앱 내 탭(볼래·봤어·별점·패스)과 화면 열람은
                마이그레이션 0145 + 앱 OTA가 나간 뒤부터 여기에 <b>정확한 실측</b>으로 쌓입니다.
                그때까지 위 숫자는 BFF 레저 기반 추정치입니다.
              </div>
            )}
            <div style={grid2}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ fontSize: 12.5, width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                      <th style={{ paddingRight: 16, fontWeight: 500 }}>날짜</th>
                      <th style={{ ...num, fontWeight: 500, color: "#6ee7b7" }}>기기</th>
                      <th style={{ ...num, fontWeight: 500, color: "#6ee7b7" }}>화면</th>
                      <th style={{ ...num, fontWeight: 500, color: "#6ee7b7" }}>탭</th>
                      <th style={{ ...num, fontWeight: 500 }}>다운로드</th>
                      <th style={{ ...num, fontWeight: 500, color: "#64748b" }}>요청</th>
                      <th style={{ ...num, fontWeight: 500, color: "#64748b" }}>iOS</th>
                      <th style={{ ...num, fontWeight: 500, color: "#64748b" }}>Android</th>
                      <th style={{ ...num, fontWeight: 500, color: "#64748b" }}>망</th>
                      <th style={{ ...num, fontWeight: 500, color: "#64748b" }}>신규망</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appAct.days.map((r, i) => (
                      <tr key={r.day} style={i === 0 ? { color: "#6ee7b7" } : undefined}>
                        <td style={{ paddingRight: 16, color: i === 0 ? "#6ee7b7" : "#cbd5e1" }}>
                          {r.day}{i === 0 ? " ·" : ""}
                        </td>
                        <td style={num}><b style={{ color: i === 0 ? "#6ee7b7" : "#f1f5f9" }}>{r.devices ? fmt(r.devices) : "–"}</b></td>
                        <td style={num}>{r.screens ? fmt(r.screens) : "–"}</td>
                        <td style={num}>{r.taps ? fmt(r.taps) : "–"}</td>
                        <td style={num}>{r.downloads != null ? fmt(r.downloads) : "–"}</td>
                        <td style={{ ...num, color: "#64748b" }}>{fmt(r.calls)}</td>
                        <td style={{ ...num, color: "#64748b" }}>{fmt(r.ios)}</td>
                        <td style={{ ...num, color: "#64748b" }}>{fmt(r.android)}</td>
                        <td style={{ ...num, color: "#64748b" }}>{fmt(r.networks)}</td>
                        <td style={{ ...num, color: "#64748b" }}>{r.new_networks ? fmt(r.new_networks) : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <BarList
                title="화면별 (14일, 캐시미스 기준)"
                rows={appAct.endpoints.map((e) => ({
                  label: APP_ENDPOINT_LABELS[e.endpoint] ?? e.endpoint, n: e.n, networks: e.networks,
                }))}
                labelKey="label"
                extra={(r) => `${r.networks}망`}
              />
            </div>
            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.65, marginTop: 12 }}>
              <b style={{ color: "#6ee7b7" }}>실측(기기·화면·탭)</b>은 앱 비콘 → <code>/api/metrics/app</code> → <code>mt_app_events</code>.
              기기 ID는 폰에서 만들고 <b>매일 새로 발급</b>되어 날짜를 넘겨 사람을 잇지 않으며 IP는 저장하지 않습니다
              (개발 빌드는 수집 제외). <b>추정(회색)</b>은 fetch UA 기준 — iOS <code>CFNetwork</code>·Android <code>okhttp</code>,
              <b> 망</b>=고유 /24, <b>신규망</b>=90일 내 첫 등장. 앱 안의 웹뷰(리더·Where to watch)는 웹 페이지라
              위 실방문자 쪽에도 집계되며, 앱에서 넘어간 지점은 "리더·웹뷰 열기" 탭으로 표시됩니다.
              {appAct.totals.downloads === 0 && (
                <> <b style={{ color: "#94a3b8" }}>다운로드 실수치</b>는 오너가 <code>node worker/asc-sales-pull.mjs</code>를
                실행하면 App Store Connect에서 채워집니다 (ASC .p8 키 필요 · 최초 1회 <code>ASC_VENDOR_NUMBER</code> 설정).</>
              )}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.6 }}>
            아직 데이터 없음 — 마이그레이션 0144 적용 후 나타납니다.
          </div>
        )}
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
          <>
          <table style={{ fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ paddingRight: 16 }}>ISO week</th>
                <th style={num}>visitors</th>
                <th style={num}>returning (≥2일)</th>
                <th style={num}>그중 클릭·체류</th>
                <th style={num}>봇 제거</th>
                <th style={num}>인증 활동</th>
                <th style={num}>rate</th>
              </tr>
            </thead>
            <tbody>
              {wr.map((r, i) => (
                <tr key={i}>
                  <td style={{ paddingRight: 16, color: "#cbd5e1" }}>{r.week}</td>
                  <td style={num}>{fmt(r.visitors)}</td>
                  <td style={num}><b style={{ color: "#f1f5f9" }}>{fmt(r.returning)}</b></td>
                  <td style={num}>{fmt(r.returning_engaged)}</td>
                  <td style={{ ...num, color: r.removed ? "#e0a458" : "#64748b" }}>
                    {r.removed ? `−${fmt(r.removed)}` : "—"}
                  </td>
                  <td style={{ ...num, color: "#94a3b8" }}>{fmt(waBy.get(r.week)?.active ?? 0)}</td>
                  <td style={num}>{r.visitors ? Math.round((r.returning / r.visitors) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.65, marginTop: 10 }}>
            <b style={{ color: "#94a3b8" }}>이 숫자를 읽는 법 (0149).</b> <b>returning</b> = 0120 봇 분류기를
            통과한 추정치, <b>그중 클릭·체류</b> = 브라우저가 실제로 JS를 돌린 증거가 있는 하한,
            <b>인증 활동</b> = 로그인 사용자가 저장·기록·핀을 남긴 수(봇이 위조 불가한 바닥).
            셋을 같이 보십시오 — 하나만 보면 8/31처럼 틀립니다.
            <br />
            <b style={{ color: "#e0a458" }}>한계:</b> 주간 신원은 <code>sha256(ISO주|IP|UA)</code>라 사람이 아니라
            <b> 네트워크</b>입니다. IP가 도는 모바일 독자는 재방문으로 <b>영영 안 잡히고</b>(과소), 같은 NAT
            뒤 두 사람은 <b>한 명</b>이 됩니다(과대). 해시가 매주 회전하므로 &ldquo;2주 연속&rdquo;은 구조상 측정 불가 —
            이 표는 <b>추세선이지 인원수가 아닙니다.</b>
          </div>
          </>
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

