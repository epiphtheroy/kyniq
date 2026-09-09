/**
 * /admin/app — the mobile app's own page.
 *
 * Daily active devices, first launches and store downloads, each split iOS /
 * Android, then what people actually do: screens, taps, films, searches, the
 * hand-offs to the web reader, versions, countries, hour of day, session
 * lengths and four device funnels.
 *
 * One read: mt_app_panel_json (migration 0151), a single jsonb row through the
 * service-role client — the PostgREST 1000-row cap never applies and the
 * function runs in well under a second (mt_app_events is small; api_calls is
 * indexed on ts). Collection: mobile/src/lib/beacon.ts → /api/metrics/app →
 * mt_app_events. Downloads: worker/asc-sales-pull.mjs (iOS, App Store Connect)
 * and worker/play-installs-pull.mjs (Android, Play's Cloud Storage export).
 */
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import MetricsChart from "@/components/admin/MetricsChart";
import { Kpi, Panel, SubTitle, BarList, fmt, num, grid2 } from "@/components/admin/AdminUI";

export const dynamic = "force-dynamic";

const RANGES = [
  { d: 14, label: "14d" },
  { d: 30, label: "30d" },
  { d: 90, label: "90d" },
];

interface Day {
  day: string; devices: number; ios: number; android: number;
  sessions: number; ios_sessions: number; android_sessions: number;
  screens: number; taps: number; ios_first: number; android_first: number;
  avg_session_s: number | null; ios_dl: number | null; android_dl: number | null;
  ios_calls: number; android_calls: number;
}
interface Split { name: string; n: number; devices: number; ios: number; android: number }
interface Funnel { [step: string]: number }
interface AppPanel {
  days: Day[];
  screens_top: Split[];
  taps_top: Split[];
  films_top: { slug: string; title: string; n: number; devices: number }[];
  searches_top: { q: string; n: number; devices: number }[];
  reader_top: { path: string; n: number; devices: number }[];
  versions: { platform: string; app_v: string; devices: number }[];
  countries: { country: string; devices: number; ios: number; android: number }[];
  hours: { h: number; events: number; devices: number }[];
  session_len: { ord: number; label: string; n: number; ios: number; android: number }[];
  funnels: { onboarding: Funnel; judgment: Funnel; navigator: Funnel; search: Funnel; auth: Funnel };
  totals: {
    devices_7d: number; devices_prev7d: number; ios_7d: number; android_7d: number;
    sessions_7d: number; first_7d: number; ios_first_7d: number; android_first_7d: number;
    screens_7d: number; taps_7d: number;
    avg_session_s_7d: number | null; median_session_s_7d: number | null; screens_per_session_7d: number | null;
    ios_dl_total: number; android_dl_total: number; ios_dl_7d: number | null; android_dl_7d: number | null;
    ios_dl_latest: string | null; android_dl_latest: string | null;
    first_event: string | null; push_devices: number;
  };
}

const SCREEN_LABELS: Record<string, string> = {
  "/(tabs)": "Tonight (홈 탭)",
  "/": "루트 (콜드 스타트 첫 프레임)",
  "/(tabs)/search": "Explore (탐색 탭)",
  "/(tabs)/navigator": "Navigator 탭",
  "/(tabs)/my": "You (마이 탭)",
  "/(tabs)/map": "Locations 지도",
  "/film/[slug]": "영화 상세",
  "/director/[slug]": "감독 화면",
  "/list/[slug]": "리스트",
  "/navigator/drive": "Navigator 드라이브",
  "/read": "웹 리더 (앱 안 웹뷰)",
  "/onboarding": "온보딩 · 로그인 시트",
  "/connect": "기록 가져오기",
  "/auth-callback": "로그인 콜백",
  "/connect-callback": "커넥트 콜백",
  "/preview": "프리뷰",
  "/+not-found": "not found",
};

const TAP_LABELS: Record<string, string> = {
  "watchlist:add": "♥ 볼래 담기",
  "watchlist:remove": "볼래 해제",
  seen: "봤어 표시",
  rate: "별점 매김",
  pass: "✕ 패스",
  "pass:restore": "패스 복구",
  "judgment:undo": "실행취소",
  "list:save": "★ 리스트 저장",
  "list:unsave": "리스트 저장 해제",
  "list:add_all": "리스트 전체 담기",
  "reader:open": "웹 리더 열기",
  "review:ask": "평점 프롬프트 노출",
  "review:listing": "스토어 평가 페이지 열기",
  "home:filter": "홈 필터 변경",
  "home:refresh": "홈 당겨서 새로고침",
  "search:query": "검색어 입력 (확정)",
  "search:open": "검색 결과 열기",
  "search:browse": "장르·연대로 탐색",
  "navigator:open": "Navigator 목적지 선택",
  "navigator:resume": "Navigator 이어서",
  "navigator:pref": "경로 선호 변경",
  "navigator:seen": "Navigator에서 봤어",
  "navigator:skip": "Navigator 건너뛰기",
  "film:director": "영화 → 감독",
  "film:score": "TakeScore 펼치기",
  "film:map": "촬영지 지도 열기",
  "film:maps_outbound": "Google 지도로 나감",
  "film:kindred": "유사작으로 이동",
  "film:invitation": "초대문 더 보기",
  "film:rating_edit": "별점 수정",
  share: "공유 시트",
  "onboarding:step": "온보딩 단계 진입",
  "onboarding:finish": "온보딩 완료",
  "onboarding:close": "온보딩 닫기",
  "auth:apple": "Apple로 로그인",
  "auth:google": "Google로 로그인",
  "auth:password": "비밀번호 로그인",
  "auth:signup": "가입 (비밀번호)",
  "auth:otp": "이메일 코드 로그인",
  "auth:signout": "로그아웃",
  "settings:open": "설정 열기",
  "settings:push": "푸시 토글",
  "my:face": "마이 탭 면 전환",
  "my:sort": "마이 정렬 변경",
  "account:delete_prompt": "계정 삭제 확인창",
  "connect:import": "기록 가져오기 실행",
  "connect:sync": "동기화",
  "connect:start": "서비스 연결 시작",
  "connect:disconnect": "연결 해제",
  "connect:export": "내보내기 페이지로",
  "connect:collect": "수집 페이지로",
  "director:film": "감독 → 영화",
};

const READER_LABELS: Record<string, string> = {
  "/whereto": "Where to watch",
  "/takescore": "TakeScore 상세",
  "/film": "영화 전문 (웹)",
  "/tv": "TV 방송",
  "/omni": "웹 검색 (omni)",
  "/about": "About · 크레딧",
  "/journey": "Journey",
  "/": "홈",
};

const ONBOARDING_STEPS: [string, string][] = [
  ["seen", "온보딩 화면 봄"], ["account", "계정 단계"], ["edition", "에디션 단계"], ["taste", "취향 단계"], ["finish", "완료"],
];
const JUDGMENT_STEPS: [string, string][] = [
  ["film_seen", "영화 상세 봄"], ["judged", "판단 탭 (볼래·봤어·별점·패스)"], ["rated", "별점까지"], ["read_web", "웹 리더로 넘어감"],
];
const NAVIGATOR_STEPS: [string, string][] = [
  ["tab", "Navigator 탭 봄"], ["drive", "드라이브 시작"], ["seen", "드라이브에서 봤어"],
];
const SEARCH_STEPS: [string, string][] = [
  ["tab", "탐색 탭 봄"], ["query", "검색어 입력"], ["film", "결과 열기"],
];

const dur = (s: number | null | undefined) =>
  s == null ? "–" : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
const th: CSSProperties = { ...num, fontWeight: 500 };
const thL: CSSProperties = { paddingRight: 14, fontWeight: 500, textAlign: "left" };
const grey: CSSProperties = { ...num, color: "#64748b" };
const IOS = "#93c5fd";
const AND = "#6ee7b7";

function pct(a: number, b: number) {
  return b > 0 ? `${Math.round((a / b) * 100)}%` : "–";
}

function FunnelTable({ title, steps, data }: { title: string; steps: [string, string][]; data: Funnel | undefined }) {
  if (!data) return null;
  const first = Number(data[steps[0][0]] ?? 0);
  return (
    <div>
      <SubTitle>{title}</SubTitle>
      <table style={{ fontSize: 12.5, width: "100%" }}>
        <tbody>
          {steps.map(([k, label], i) => {
            const v = Number(data[k] ?? 0);
            const prev = i > 0 ? Number(data[steps[i - 1][0]] ?? 0) : v;
            return (
              <tr key={k}>
                <td style={{ padding: "3px 0", color: "#cbd5e1" }}>{label}</td>
                <td style={num}><b style={{ color: "#f1f5f9" }}>{fmt(v)}</b></td>
                <td style={grey}>{i === 0 ? "" : pct(v, first)}</td>
                <td style={grey}>{i === 0 ? "" : `(직전 대비 ${pct(v, prev)})`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SplitBars({ title, rows, label }: { title: string; rows: Split[]; label: (n: string) => string }) {
  return (
    <BarList
      title={title}
      rows={rows.map((r) => ({ label: label(r.name), n: r.n, devices: r.devices, ios: r.ios, android: r.android }))}
      labelKey="label"
      extra={(r) => `${r.devices}대 (iOS ${r.ios} · And ${r.android})`}
    />
  );
}

export default async function AdminAppPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) notFound();

  const sp = await searchParams;
  const d = RANGES.some((r) => r.d === Number(sp.d)) ? Number(sp.d) : 30;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("mt_app_panel_json", { p_days: d });
  const p = (data ?? null) as AppPanel | null;

  if (error) {
    return (
      <div style={{ color: "#e66767", fontSize: 13, lineHeight: 1.6 }}>
        Failed to load: {error.message}
        <div style={{ color: "#94a3b8", marginTop: 6 }}>마이그레이션 0151(<code>mt_app_panel_json</code>)이 적용되면 나타납니다.</div>
      </div>
    );
  }
  if (!p) return <div style={{ color: "#94a3b8" }}>No data.</div>;

  const t = p.totals;
  const days = p.days;
  const today = days[0];
  const series = [...days].reverse().map((r) => ({ b: r.day.slice(5), pv: r.devices, vis: r.ios }));
  const hasSessions = t.avg_session_s_7d != null;
  const hasFirst = days.some((r) => r.ios_first + r.android_first > 0);
  const maxHour = Math.max(1, ...p.hours.map((h) => h.devices));
  const deltaPct = t.devices_prev7d > 0 ? Math.round(((t.devices_7d - t.devices_prev7d) / t.devices_prev7d) * 100) : null;

  return (
    <div style={{ maxWidth: 1160 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 6 }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>📱 App</h1>
        <div style={{ display: "flex", gap: 4 }}>
          {RANGES.map((r) => (
            <Link
              key={r.d}
              href={`/admin/app?d=${r.d}`}
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
        <span style={{ fontSize: 12, color: "#94a3b8" }}>
          비콘 수집 시작 {t.first_event ?? "–"} · <Link href="/admin/metrics" style={{ color: "#94a3b8" }}>웹 Analytics ↗</Link>
        </span>
      </div>
      <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 16px", lineHeight: 1.6 }}>
        <span style={{ color: IOS }}>■ iOS</span> · <span style={{ color: AND }}>■ Android</span>.
        <b style={{ color: "#cbd5e1" }}> 접속 기기</b> = 그날 비콘을 보낸 기기 수(기기 ID는 매일 새로 발급 → 일 단위만 정확, 주간 합산은 중복).
        <b style={{ color: "#cbd5e1" }}> 첫 실행</b> = 설치 후 첫 구동(앱이 직접 보고, 당일 반영).
        <b style={{ color: "#cbd5e1" }}> 다운로드</b> = 스토어 리포트(iOS 하루 지연 · Android는 Play 내보내기).
        개발 빌드·오너 옵트아웃 기기는 제외.
      </p>

      {/* headline — trailing 7 days */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 18 }}>
        <Kpi
          label="7일 접속 기기 (일별 합산)"
          value={<>{fmt(t.devices_7d)}{deltaPct != null && <span style={{ fontSize: 12, color: deltaPct >= 0 ? AND : "#f87171", marginLeft: 6 }}>{deltaPct >= 0 ? "+" : ""}{deltaPct}%</span>}</>}
        />
        <Kpi label={<span style={{ color: IOS }}>iOS 7일</span>} value={fmt(t.ios_7d)} />
        <Kpi label={<span style={{ color: AND }}>Android 7일</span>} value={fmt(t.android_7d)} />
        <Kpi label={`오늘 ${today?.day ?? ""} (진행중)`} value={<>{fmt(today?.devices ?? 0)} <span style={{ fontSize: 12, color: "#94a3b8" }}>iOS {today?.ios ?? 0} · And {today?.android ?? 0}</span></>} />
        <Kpi label="7일 세션" value={fmt(t.sessions_7d)} />
        <Kpi label="7일 첫 실행 (설치 실측)" value={hasFirst ? <>{fmt(t.first_7d)} <span style={{ fontSize: 12, color: "#94a3b8" }}>iOS {t.ios_first_7d} · And {t.android_first_7d}</span></> : <span style={{ fontSize: 13, color: "#64748b" }}>OTA 후 집계</span>} />
        <Kpi label={<>다운로드 7일 <span style={{ color: IOS }}>iOS</span>{t.ios_dl_latest ? <span style={{ color: "#64748b" }}> · ~{t.ios_dl_latest.slice(5)}</span> : null}</>} value={t.ios_dl_7d != null ? fmt(t.ios_dl_7d) : "–"} />
        <Kpi label={<>다운로드 7일 <span style={{ color: AND }}>Android</span>{t.android_dl_latest ? <span style={{ color: "#64748b" }}> · ~{t.android_dl_latest.slice(5)}</span> : null}</>} value={t.android_dl_7d != null ? fmt(t.android_dl_7d) : <span style={{ fontSize: 13, color: "#64748b" }}>미수집</span>} />
        <Kpi label="다운로드 누적 iOS / Android" value={<>{fmt(t.ios_dl_total)} <span style={{ color: "#64748b" }}>/</span> {t.android_dl_latest ? fmt(t.android_dl_total) : "–"}</>} />
        <Kpi label="세션 평균 · 중앙값 (7일)" value={hasSessions ? `${dur(t.avg_session_s_7d)} · ${dur(t.median_session_s_7d)}` : <span style={{ fontSize: 13, color: "#64748b" }}>OTA 후 집계</span>} />
        <Kpi label="화면 / 세션 (7일)" value={t.screens_per_session_7d != null ? String(t.screens_per_session_7d) : t.sessions_7d ? (t.screens_7d / t.sessions_7d).toFixed(1) : "–"} />
        <Kpi label="탭·판단 액션 (7일)" value={fmt(t.taps_7d)} />
      </div>

      <Panel title={`일별 접속 기기 (${d}일, KST) — 합계 · iOS`}>
        <MetricsChart data={series} height={190} labels={["Devices", "iOS"]} />
      </Panel>

      {/* the daily table — what was asked for */}
      <Panel title="일별 — 접속 기기 · 세션 · 첫 실행 · 다운로드 (iOS / Android)">
        <div style={{ overflowX: "auto" }}>
          <table style={{ fontSize: 12.5, width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#94a3b8" }}>
                <th style={thL}>날짜</th>
                <th style={{ ...th, color: IOS }}>iOS 접속</th>
                <th style={{ ...th, color: AND }}>And 접속</th>
                <th style={th}>합계</th>
                <th style={th}>세션 (iOS/And)</th>
                <th style={{ ...th, color: IOS }}>iOS 첫실행</th>
                <th style={{ ...th, color: AND }}>And 첫실행</th>
                <th style={{ ...th, color: IOS }}>iOS 다운로드</th>
                <th style={{ ...th, color: AND }}>And 다운로드</th>
                <th style={th}>화면</th>
                <th style={th}>탭</th>
                <th style={th}>평균 세션</th>
                <th style={{ ...th, color: "#64748b" }}>요청 iOS/And</th>
              </tr>
            </thead>
            <tbody>
              {days.map((r, i) => (
                <tr key={r.day} style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}>
                  <td style={{ paddingRight: 14, padding: "3px 14px 3px 0", color: i === 0 ? "#93c5fd" : "#cbd5e1", whiteSpace: "nowrap" }}>
                    {r.day}{i === 0 ? " ·" : ""}
                  </td>
                  <td style={{ ...num, color: IOS }}><b>{r.ios ? fmt(r.ios) : "–"}</b></td>
                  <td style={{ ...num, color: AND }}><b>{r.android ? fmt(r.android) : "–"}</b></td>
                  <td style={num}><b style={{ color: "#f1f5f9" }}>{r.devices ? fmt(r.devices) : "–"}</b></td>
                  <td style={num}>{r.sessions ? `${fmt(r.sessions)} (${r.ios_sessions}/${r.android_sessions})` : "–"}</td>
                  <td style={num}>{r.ios_first ? fmt(r.ios_first) : "–"}</td>
                  <td style={num}>{r.android_first ? fmt(r.android_first) : "–"}</td>
                  <td style={num}>{r.ios_dl != null ? fmt(r.ios_dl) : <span style={{ color: "#475569" }}>–</span>}</td>
                  <td style={num}>{r.android_dl != null ? fmt(r.android_dl) : <span style={{ color: "#475569" }}>–</span>}</td>
                  <td style={num}>{r.screens ? fmt(r.screens) : "–"}</td>
                  <td style={num}>{r.taps ? fmt(r.taps) : "–"}</td>
                  <td style={num}>{dur(r.avg_session_s)}</td>
                  <td style={grey}>{r.ios_calls || r.android_calls ? `${r.ios_calls}/${r.android_calls}` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.65, marginTop: 10 }}>
          다운로드 <span style={{ color: "#475569" }}>–</span> = 그날 리포트를 아직 안 가져옴(0이 아님). iOS는 Apple이 다음날 아침 리포트를 내고
          <code> worker/app-stores-daily-watch.sh</code>가 하루 한 번 가져옵니다. Android는 <code>PLAY_REPORTS_BUCKET</code>을
          설정하면 같은 워처가 채웁니다(<code>worker/play-installs-pull.mjs</code> 상단 2단계). <b>요청</b>은 BFF 캐시미스 하한(0144)이라 접속과 비례하지 않습니다.
        </div>
      </Panel>

      {/* what they do */}
      <div style={grid2}>
        <SplitBars title={`화면 열람 (${d}일 · 기기수 병기)`} rows={p.screens_top} label={(n) => SCREEN_LABELS[n] ?? n} />
        <SplitBars title="⭐ 탭 — 판단·이동·설정 (실측)" rows={p.taps_top} label={(n) => TAP_LABELS[n] ?? n} />
        <BarList
          title="가장 많이 열린 영화"
          rows={p.films_top.map((f) => ({ label: f.title, n: f.n, devices: f.devices, slug: f.slug }))}
          labelKey="label"
          extra={(r) => `${r.devices}대`}
          linkTo={(_, r) => `https://metatake.net/film/${r.slug}`}
        />
        {p.searches_top.length ? (
          <BarList title="앱 내 검색어 (확정 입력)" rows={p.searches_top.map((s) => ({ label: s.q, n: s.n, devices: s.devices }))} labelKey="label" extra={(r) => `${r.devices}대`} />
        ) : (
          <div>
            <SubTitle>앱 내 검색어</SubTitle>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>OTA 이후부터 쌓입니다 — 검색어가 확정(디바운스)될 때마다 한 건.</div>
          </div>
        )}
        <BarList title="웹 리더로 넘어간 곳 (앱 → 웹 핸드오프)" rows={p.reader_top.map((r) => ({ label: READER_LABELS[r.path] ?? r.path, n: r.n, devices: r.devices }))} labelKey="label" extra={(r) => `${r.devices}대`} />
        <div>
          <SubTitle>앱 버전 분포 (7일 · 기기)</SubTitle>
          <table style={{ fontSize: 12.5 }}>
            <tbody>
              {p.versions.map((v, i) => (
                <tr key={i}>
                  <td style={{ paddingRight: 14, color: v.platform === "ios" ? IOS : AND }}>{v.platform}</td>
                  <td style={{ paddingRight: 14, color: "#e2e8f0" }}>{v.app_v}</td>
                  <td style={num}>{fmt(v.devices)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ height: 14 }} />
          <SubTitle>국가 (기기)</SubTitle>
          <table style={{ fontSize: 12.5 }}>
            <tbody>
              {p.countries.map((c, i) => (
                <tr key={i}>
                  <td style={{ paddingRight: 14, color: "#e2e8f0" }}>{c.country}</td>
                  <td style={num}>{fmt(c.devices)}</td>
                  <td style={grey}>iOS {c.ios} · And {c.android}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <SubTitle>시간대별 활동 (KST · 기기)</SubTitle>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90 }}>
            {p.hours.map((h) => (
              <div key={h.h} title={`${h.h}시 · ${h.devices}대 · ${h.events}건`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ width: "100%", height: Math.max(2, Math.round((h.devices / maxHour) * 70)), background: "#60a5fa", borderRadius: 2, opacity: h.devices ? 0.9 : 0.25 }} />
                <span style={{ fontSize: 9, color: "#64748b" }}>{h.h % 3 === 0 ? h.h : ""}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 14 }} />
          <SubTitle>세션 길이 (7일)</SubTitle>
          {hasSessions ? (
            <table style={{ fontSize: 12.5 }}>
              <tbody>
                {p.session_len.map((s) => (
                  <tr key={s.ord}>
                    <td style={{ paddingRight: 14, color: "#e2e8f0" }}>{s.label}</td>
                    <td style={num}>{fmt(s.n)}</td>
                    <td style={grey}>iOS {s.ios} · And {s.android}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>OTA 이후부터 — 앱이 백그라운드로 갈 때 세션 길이를 보고합니다(30분 이상 떠나면 새 세션).</div>
          )}
        </div>
      </div>

      <Panel title={`퍼널 — 기기 기준 (${d}일)`}>
        <div style={grid2}>
          <FunnelTable title="온보딩" steps={ONBOARDING_STEPS} data={p.funnels?.onboarding} />
          <FunnelTable title="영화 → 판단" steps={JUDGMENT_STEPS} data={p.funnels?.judgment} />
          <FunnelTable title="Navigator" steps={NAVIGATOR_STEPS} data={p.funnels?.navigator} />
          <FunnelTable title="탐색 → 검색 → 열기" steps={SEARCH_STEPS} data={p.funnels?.search} />
        </div>
        <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.65, marginTop: 10 }}>
          단계별 기기수는 같은 날 안에서만 같은 기기로 잇습니다(ID가 매일 회전). 온보딩 단계·검색어·세션 길이·첫 실행은
          이번 OTA부터 보고되므로 그 전 날짜는 0으로 보입니다. 로그인 {fmt(p.funnels?.auth?.signed ?? 0)}대 (계정 단계 노출 {fmt(p.funnels?.auth?.prompted ?? 0)}대).
        </div>
      </Panel>

      <p style={{ fontSize: 11.5, color: "#64748b", marginTop: 8, lineHeight: 1.65 }}>
        수집: <code>mobile/src/lib/beacon.ts</code> → <code>/api/metrics/app</code> → <code>mt_app_events</code> (0145·0151).
        기기 ID는 폰에서 만들고 매일 새로 발급, IP 미저장, 개발 빌드 제외. 화면은 라우트 패턴으로 묶고(<code>/film/[slug]</code>),
        탭은 앱 안 실제 조작입니다. 앱 안의 웹뷰(리더·Where to watch)는 웹 페이지라 <Link href="/admin/metrics" style={{ color: "#94a3b8" }}>웹 Analytics</Link>의
        실방문자에도 함께 잡힙니다. 푸시 등록 기기 {fmt(t.push_devices)}.
      </p>
    </div>
  );
}
