import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin";
import { loadSettings } from "@/lib/crm/settings";
import { card, Stat, SectionTitle, Warn, relTime } from "@/lib/crm/ui";
import { STAGE_LABEL, STAGE_TONE, FUNNEL_ORDER, type Stage } from "@/lib/crm/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Stats {
  queues: { proposed: number; unhandled_inbound: number; new_candidates: number; due_actions: number };
  funnel: Record<string, number>;
  clusters: { code: string; name_ko: string; contacts: number; sent: number; replied: number }[];
  hygiene: { unsubs: number; suppression: number; bounced: number; sent_7d: number };
}

export default async function CrmDashboard() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();
  const settings = await loadSettings(supabase);
  const { data } = await supabase.rpc("crm_dashboard_stats");
  const stats = (data ?? { queues: {}, funnel: {}, clusters: [], hygiene: {} }) as Stats;

  const { data: recent } = await supabase
    .from("crm_touches")
    .select("id, direction, kind, subject, happened_at, contact_id")
    .order("happened_at", { ascending: false })
    .limit(20);

  const q = stats.queues ?? { proposed: 0, unhandled_inbound: 0, new_candidates: 0, due_actions: 0 };
  const funnelTotal = FUNNEL_ORDER.reduce((s, k) => s + (stats.funnel?.[k] ?? 0), 0);
  const maxFunnel = Math.max(1, ...FUNNEL_ORDER.map((k) => stats.funnel?.[k] ?? 0));
  const h = stats.hygiene ?? { unsubs: 0, suppression: 0, bounced: 0, sent_7d: 0 };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "var(--ink)" }}>Touchpoint Engine</h1>
        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{admin.display_name ? `${admin.display_name} · ` : ""}오늘의 접점 상황</span>
      </div>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
        기계가 준비해 둔 것 — 검토·승인만 하면 됩니다. 발송은 언제나 사람 승인 뒤에만 일어납니다.
      </p>

      {settings.gmail_token_error ? (
        <div style={{ marginBottom: 16 }}>
          <Warn tone="var(--bad)">⚠️ Gmail 토큰 오류(invalid_grant). worker/gmail-auth.py로 재발급 후 GMAIL_REFRESH_TOKEN을 갱신하세요. → <Link href="/crm/settings">설정</Link></Warn>
        </div>
      ) : null}

      {/* action queues */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
        <Stat label="검토 대기 초안" value={q.proposed} tone={q.proposed ? "#fbbf24" : "#34d399"} href="/crm/outbox" sub="승인 → Gmail 초안" />
        <Stat label="미처리 응답" value={q.unhandled_inbound} tone={q.unhandled_inbound ? "#60a5fa" : undefined} href="/crm/inbox" sub="분류·자동응답 초안" />
        <Stat label="심사 대기 후보" value={q.new_candidates} tone={q.new_candidates ? "#a78bfa" : undefined} href="/crm/research" sub="서치 봇이 찾은 것" />
        <Stat label="오늘 예정 액션" value={q.due_actions} tone={q.due_actions ? "#fbbf24" : undefined} href="/crm/contacts?due=1" sub="팔로업 예정" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 22, alignItems: "start" }}>
        <div>
          <SectionTitle>파이프라인 ({funnelTotal.toLocaleString()} 컨택)</SectionTitle>
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 7 }}>
            {FUNNEL_ORDER.map((k) => {
              const n = stats.funnel?.[k] ?? 0;
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 64, fontSize: "0.76rem", color: "var(--muted)", flexShrink: 0 }}>{STAGE_LABEL[k as Stage]}</div>
                  <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 16, overflow: "hidden" }}>
                    <div style={{ width: `${(n / maxFunnel) * 100}%`, background: STAGE_TONE[k as Stage], height: "100%" }} />
                  </div>
                  <div style={{ width: 56, textAlign: "right", fontSize: "0.8rem", color: "var(--ink)", fontWeight: 600 }}>{n.toLocaleString()}</div>
                </div>
              );
            })}
          </div>

          <SectionTitle>세그먼트 현황</SectionTitle>
          <div style={card}>
            <table style={{ fontSize: "0.8rem" }}>
              <thead><tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                <th style={{ padding: "4px 6px" }}>클러스터</th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>컨택</th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>발송</th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>응답</th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>응답률</th>
              </tr></thead>
              <tbody>
                {(stats.clusters ?? []).map((c) => (
                  <tr key={c.code} style={{ borderBottom: "1px solid var(--hairline)" }}>
                    <td style={{ padding: "4px 6px" }}><Link href={`/crm/segments/${c.code}`}>{c.code}. {c.name_ko}</Link></td>
                    <td style={{ padding: "4px 6px", textAlign: "right" }}>{c.contacts}</td>
                    <td style={{ padding: "4px 6px", textAlign: "right" }}>{c.sent}</td>
                    <td style={{ padding: "4px 6px", textAlign: "right" }}>{c.replied}</td>
                    <td style={{ padding: "4px 6px", textAlign: "right", color: "var(--muted)" }}>{c.sent ? Math.round((c.replied / c.sent) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <SectionTitle>위생 지표</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            <Stat label="최근 7일 발송" value={h.sent_7d} sub={`주간 상한 ${settings.weekly_send_cap}`} tone={h.sent_7d > settings.weekly_send_cap ? "#fbbf24" : undefined} />
            <Stat label="반송" value={h.bounced} tone={h.bounced ? "#f87171" : undefined} />
            <Stat label="수신거부" value={h.unsubs} />
            <Stat label="Suppression" value={h.suppression} />
          </div>

          <SectionTitle>최근 활동</SectionTitle>
          <div style={card}>
            {(recent ?? []).length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>아직 활동 없음.</div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                {(recent ?? []).map((t) => (
                  <li key={t.id} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ flexShrink: 0 }}>{t.direction === "out" ? "→" : "←"}</span>
                    <Link href={`/crm/contacts/${t.contact_id}`} style={{ flex: 1, minWidth: 0, fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.subject || t.kind}
                    </Link>
                    <span style={{ fontSize: "0.7rem", color: "var(--muted)", flexShrink: 0 }}>{relTime(t.happened_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
