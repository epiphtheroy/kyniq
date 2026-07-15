import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, getAdminUser, logContentEvent } from "@/lib/admin";
import { loadSettings, saveSettings } from "@/lib/crm/settings";
import { card, btn, SectionTitle, Badge, Warn } from "@/lib/crm/ui";
import type { CrmSettings } from "@/lib/crm/types";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function saveCrmSettings(formData: FormData) {
  "use server";
  const admin = await getAdminUser();
  if (!admin) return;
  const supabase = createAdminClient();

  const num = (k: string) => Number(formData.get(k));
  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v.length ? v : null;
  };

  const patch: Partial<CrmSettings> = {
    daily_send_cap: num("daily_send_cap"),
    weekly_send_cap: num("weekly_send_cap"),
    per_cron_send_cap: num("per_cron_send_cap"),
    system_send_enabled: formData.get("system_send_enabled") === "on",
    followup_max: num("followup_max"),
    bounce_rate_threshold: num("bounce_rate_threshold"),
    physical_address: str("physical_address"),
    gmail_account: str("gmail_account"),
    lia_doc_path: str("lia_doc_path"),
    unsubscribe_line: {
      en: String(formData.get("unsub_en") ?? "").trim(),
      ko: String(formData.get("unsub_ko") ?? "").trim(),
    },
  };

  await saveSettings(supabase, patch);
  await logContentEvent({
    entityType: "crm_settings",
    entityId: "1",
    event: "settings_saved",
    actorId: admin.id,
    actorKind: "human",
    meta: { system_send_enabled: patch.system_send_enabled },
  });
  revalidatePath("/crm/settings");
}

async function addSuppression(formData: FormData) {
  "use server";
  const admin = await getAdminUser();
  if (!admin) return;
  const supabase = createAdminClient();

  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  const domainRaw = String(formData.get("domain") ?? "").trim().toLowerCase();
  const reason = String(formData.get("reason") ?? "manual").trim();
  const email = emailRaw.length ? emailRaw : null;
  const domain = domainRaw.length ? domainRaw : null;
  if (!email && !domain) return;

  const { error } = await supabase.from("crm_suppression").insert({
    email,
    domain,
    reason,
    source: "manual",
  });
  if (error) return;

  await logContentEvent({
    entityType: "crm_suppression",
    entityId: email ?? domain ?? "",
    event: "suppression_added",
    actorId: admin.id,
    actorKind: "human",
    meta: { email, domain, reason },
  });
  revalidatePath("/crm/settings");
}

const label: React.CSSProperties = { display: "block", fontSize: "0.72rem", color: "var(--muted)", marginBottom: 4 };
const input: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--hairline)",
  borderRadius: 5,
  color: "var(--ink)",
  fontSize: "0.82rem",
};
const field: React.CSSProperties = { marginBottom: 14 };

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: "0.82rem", color: "var(--ink)" }}>
      <span style={{ flexShrink: 0 }}>{ok ? "✅" : "⛔"}</span>
      <span>{children}</span>
    </li>
  );
}

export default async function CrmSettingsPage() {
  await requireAdmin();
  const supabase = createAdminClient();
  const settings = await loadSettings(supabase);

  const { data: supp } = await supabase
    .from("crm_suppression")
    .select("id, email, domain, reason, source, added_at")
    .order("added_at", { ascending: false })
    .limit(200);
  const rows = supp ?? [];

  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "var(--ink)" }}>발송 규율·컴플라이언스 콘솔</h1>
      </div>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
        캡·수신거부·채널 계정 — 하드 게이트 설정. 발송은 언제나 사람 승인 뒤에만 일어납니다.
      </p>

      {/* ───── 설정 폼 ───── */}
      <form action={saveCrmSettings}>
        <div style={{ ...card, marginBottom: 22 }}>
          <SectionTitle>발송 상한 (§5-9)</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
            <div style={field}>
              <label style={label}>일일 발송 상한 (daily_send_cap)</label>
              <input name="daily_send_cap" type="number" defaultValue={settings.daily_send_cap} style={input} />
            </div>
            <div style={field}>
              <label style={label}>주간 발송 상한 (weekly_send_cap)</label>
              <input name="weekly_send_cap" type="number" defaultValue={settings.weekly_send_cap} style={input} />
            </div>
            <div style={field}>
              <label style={label}>크론 런당 상한 (per_cron_send_cap)</label>
              <input name="per_cron_send_cap" type="number" defaultValue={settings.per_cron_send_cap} style={input} />
            </div>
            <div style={field}>
              <label style={label}>팔로업 최대 횟수 (followup_max)</label>
              <input name="followup_max" type="number" defaultValue={settings.followup_max} style={input} />
            </div>
            <div style={field}>
              <label style={label}>반송률 임계값 (bounce_rate_threshold)</label>
              <input name="bounce_rate_threshold" type="number" step="0.01" defaultValue={settings.bounce_rate_threshold} style={input} />
            </div>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.82rem", color: "var(--ink)", marginTop: 4 }}>
            <input name="system_send_enabled" type="checkbox" defaultChecked={settings.system_send_enabled} />
            시스템 자동 발송 활성화 (system_send_enabled) — P3 옵트인, 켜기 전 컴플라이언스 체크 전항 필수
          </label>
        </div>

        <div style={{ ...card, marginBottom: 22 }}>
          <SectionTitle>컴플라이언스 필드</SectionTitle>
          <div style={field}>
            <label style={label}>물리 주소 (physical_address · CAN-SPAM 필수 푸터)</label>
            <input name="physical_address" type="text" defaultValue={settings.physical_address ?? ""} style={input} placeholder="발송 이메일 푸터에 노출되는 실제 우편 주소" />
          </div>
          <div style={field}>
            <label style={label}>Gmail 계정 (gmail_account)</label>
            <input name="gmail_account" type="text" defaultValue={settings.gmail_account ?? ""} style={input} placeholder="발신 Gmail 주소" />
          </div>
          <div style={field}>
            <label style={label}>LIA 문서 경로 (lia_doc_path · 저장소 커밋 후 링크)</label>
            <input name="lia_doc_path" type="text" defaultValue={settings.lia_doc_path ?? ""} style={input} placeholder="docs/lia-assessment.md 등" />
          </div>
          <div style={field}>
            <label style={label}>수신거부 문구 (unsubscribe_line.en)</label>
            <textarea name="unsub_en" defaultValue={settings.unsubscribe_line.en} style={{ ...input, minHeight: 60, resize: "vertical" }} />
          </div>
          <div style={field}>
            <label style={label}>수신거부 문구 (unsubscribe_line.ko)</label>
            <textarea name="unsub_ko" defaultValue={settings.unsubscribe_line.ko} style={{ ...input, minHeight: 60, resize: "vertical" }} />
          </div>
        </div>

        <button type="submit" style={{ ...btn("var(--accent)"), marginBottom: 30 }}>설정 저장</button>
      </form>

      {/* ───── 컴플라이언스 체크리스트 ───── */}
      <SectionTitle>컴플라이언스 체크리스트</SectionTitle>
      <div style={{ ...card, marginBottom: 22 }}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <Check ok={!!settings.physical_address}>물리 주소 설정됨 (CAN-SPAM 푸터 필수)</Check>
          <Check ok={!!settings.lia_doc_path}>LIA 평가 문서 커밋·링크됨</Check>
          <Check ok={!!settings.gmail_account}>Gmail 계정 지정됨</Check>
          <Check ok={settings.system_send_enabled}>시스템 자동 발송 활성화됨 (P3)</Check>
        </ul>
        <p style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: 12, lineHeight: 1.6, borderTop: "1px solid var(--hairline)", paddingTop: 10 }}>
          <strong style={{ color: "var(--ink)" }}>OAuth 셋업 안내 (§5-6-A):</strong> Gmail 자격증명은 오너의 GCP 콘솔 작업 1회(약 15분)가 필요합니다.
          {" "}<code>worker/gmail-auth.py</code>로 refresh token을 발급한 뒤 <code>GMAIL_REFRESH_TOKEN</code>을 갱신하세요.
          {" "}OAuth 앱은 반드시 GCP <strong style={{ color: "var(--ink)" }}>In production</strong> 상태여야 합니다 — Testing 상태는 7일 만료 함정(§17).
        </p>
      </div>

      {/* ───── Gmail 연결 상태 ───── */}
      <SectionTitle>Gmail 연결 상태</SectionTitle>
      <div style={{ marginBottom: 22 }}>
        {settings.gmail_token_error ? (
          <Warn tone="var(--bad)">
            ⚠️ Gmail 토큰 오류(invalid_grant). <code>worker/gmail-auth.py</code>로 재발급 후 <code>GMAIL_REFRESH_TOKEN</code>을 갱신하세요. OAuth 앱이 In production 상태인지 확인(§17).
          </Warn>
        ) : (
          <div style={{ ...card }}>
            <span style={{ fontSize: "0.85rem", color: "var(--ink)" }}>
              {settings.gmail_account ? (
                <>토큰 정상 · 발신 계정 <strong>{settings.gmail_account}</strong></>
              ) : (
                <span style={{ color: "var(--muted)" }}>미설정 — 발신 Gmail 계정을 지정하세요.</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ───── Suppression 관리 ───── */}
      <SectionTitle>Suppression 관리 ({rows.length})</SectionTitle>
      <div style={{ ...card, marginBottom: 16 }}>
        <p style={{ fontSize: "0.76rem", color: "var(--muted)", marginBottom: 12 }}>
          수신거부·반송·컴플레인·법적 차단 목록. <strong style={{ color: "var(--ink)" }}>영구 — 삭제 UI 없음(§10-2)</strong>. complaint 사유는 Google Postmaster Tools 주기 확인 후 수동 등록.
        </p>
        <form action={addSuppression} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 16, borderBottom: "1px solid var(--hairline)", paddingBottom: 16 }}>
          <div>
            <label style={label}>이메일</label>
            <input name="email" type="text" placeholder="user@example.com" style={{ ...input, minWidth: 200 }} />
          </div>
          <div>
            <label style={label}>또는 도메인</label>
            <input name="domain" type="text" placeholder="example.com" style={{ ...input, minWidth: 160 }} />
          </div>
          <div>
            <label style={label}>사유</label>
            <select name="reason" defaultValue="manual" style={{ ...input, minWidth: 130 }}>
              <option value="unsubscribe">unsubscribe</option>
              <option value="bounce">bounce</option>
              <option value="complaint">complaint</option>
              <option value="manual">manual</option>
              <option value="legal">legal</option>
            </select>
          </div>
          <button type="submit" style={btn("var(--warn)")}>수동 추가</button>
        </form>

        {rows.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>차단 항목 없음.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ fontSize: "0.8rem", width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--hairline)", textAlign: "left" }}>
                  <th style={{ padding: "4px 6px" }}>이메일 / 도메인</th>
                  <th style={{ padding: "4px 6px" }}>사유</th>
                  <th style={{ padding: "4px 6px" }}>소스</th>
                  <th style={{ padding: "4px 6px" }}>등록일</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
                    <td style={{ padding: "4px 6px", color: "var(--ink)" }}>{r.email ?? (r.domain ? `@${r.domain}` : "—")}</td>
                    <td style={{ padding: "4px 6px" }}><Badge text={r.reason} tone={r.reason === "legal" || r.reason === "complaint" ? "var(--bad)" : undefined} /></td>
                    <td style={{ padding: "4px 6px", color: "var(--muted)" }}>{r.source ?? "—"}</td>
                    <td style={{ padding: "4px 6px", color: "var(--muted)" }}>{r.added_at ? new Date(r.added_at).toLocaleDateString("ko-KR") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
