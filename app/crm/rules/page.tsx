import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, getAdminUser, logContentEvent } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { card, btn, PageTitle, SectionTitle, Badge, Warn, Empty, relTime } from "@/lib/crm/ui";

export const dynamic = "force-dynamic";

interface Rule {
  id: number;
  name: string;
  enabled: boolean;
  match: Record<string, unknown> | null;
  trigger: Record<string, unknown> | null;
  action: Record<string, unknown> | null;
  caps: Record<string, unknown> | null;
  priority: number | null;
  last_run_at: string | null;
  notes: string | null;
}

interface RuleRun {
  id: number;
  rule_id: number | null;
  started_at: string | null;
  matched: number | null;
  drafted: number | null;
  skipped_suppressed: number | null;
  skipped_capped: number | null;
  errors: string | null;
}

interface Tpl {
  id: number;
  name: string;
  segment_code: string | null;
  kind: string;
  non_commercial: boolean;
}

function fmtList(v: unknown): string | null {
  if (Array.isArray(v) && v.length) return v.join(", ");
  return null;
}

// --- server actions ---
async function toggleRule(formData: FormData) {
  "use server";
  const admin = await getAdminUser();
  if (!admin) return;
  const id = String(formData.get("id") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  if (!id) return;
  const supabase = createAdminClient();
  await supabase.from("crm_rules").update({ enabled }).eq("id", id);
  await logContentEvent({
    entityType: "crm_rule",
    entityId: id,
    event: enabled ? "rule_enabled" : "rule_disabled",
    actorId: admin.id,
    actorKind: "human",
    meta: {},
  });
  revalidatePath("/crm/rules");
}

async function addRule(formData: FormData) {
  "use server";
  const admin = await getAdminUser();
  if (!admin) return;
  const supabase = createAdminClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const segRaw = String(formData.get("segment_codes") ?? "").trim();
  const stagesRaw = String(formData.get("stages") ?? "").trim();
  const segment_codes = segRaw ? segRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const stages = stagesRaw ? stagesRaw.split(",").map((s) => s.trim()).filter(Boolean) : ["none"];

  const days = Number(formData.get("days_since_last_touch") ?? 7) || 7;
  const maxTouches = Number(formData.get("max_total_touches") ?? 2) || 2;
  const perDay = Number(formData.get("per_day") ?? 20) || 20;
  const draftKind = String(formData.get("draft_kind") ?? "first") === "followup" ? "followup" : "first";
  const templateId = Number(formData.get("template_id") ?? 0);

  const match: Record<string, unknown> = { stages, require_email: true };
  if (segment_codes.length) match.segment_codes = segment_codes;

  const trigger = {
    kind: "stage_age",
    days_since_last_touch: days,
    max_total_touches: maxTouches,
  };

  const action: Record<string, unknown> = { kind: "create_draft", draft_kind: draftKind };
  if (templateId) action.template_id = templateId;

  const caps = { per_run: 10, per_day: perDay };

  const { data, error } = await supabase
    .from("crm_rules")
    .insert({ name, enabled: false, match, trigger, action, caps, priority: 100 })
    .select("id")
    .maybeSingle();

  if (!error) {
    await logContentEvent({
      entityType: "crm_rule",
      entityId: String(data?.id ?? ""),
      event: "rule_created",
      actorId: admin.id,
      actorKind: "human",
      meta: { name },
    });
  }
  revalidatePath("/crm/rules");
}

export default async function RulesPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: rulesData } = await supabase
    .from("crm_rules")
    .select("id, name, enabled, match, trigger, action, caps, priority, last_run_at, notes")
    .order("priority", { ascending: true });
  const rules = (rulesData ?? []) as Rule[];

  const { data: runsData } = await supabase
    .from("crm_rule_runs")
    .select("id, rule_id, started_at, matched, drafted, skipped_suppressed, skipped_capped, errors")
    .order("started_at", { ascending: false })
    .limit(15);
  const runs = (runsData ?? []) as RuleRun[];

  const { data: tplData } = await supabase
    .from("crm_templates")
    .select("id, name, segment_code, kind, non_commercial")
    .order("name", { ascending: true });
  const templates = (tplData ?? []) as Tpl[];

  const ruleName = new Map(rules.map((r) => [r.id, r.name] as const));

  return (
    <div>
      <PageTitle title="스케줄링 룰" sub="크론이 매시 평가해 초안 큐에 쌓는 규칙 — 룰은 발송하지 않고 초안만 만든다." />

      <div style={{ marginBottom: 20 }}>
        <Warn tone="var(--bad)">
          ⚠️ 재대사 전 룰 금지 — Gmail 소급 동기화(재대사)와 기존 아웃리치 원장 흡수가 끝나기 전에는 모든 룰을 꺼 둔 채로
          두세요(§10-6). 기발송분에 중복 1차 메일이 나갑니다. 그래서 모든 룰은 enabled=false로 시작합니다.
        </Warn>
      </div>

      <SectionTitle>룰 목록 ({rules.length})</SectionTitle>
      {rules.length === 0 ? (
        <Empty>아직 룰이 없습니다. 아래에서 추가하세요.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {rules.map((r) => {
            const m = r.match ?? {};
            const t = r.trigger ?? {};
            const a = r.action ?? {};
            const c = r.caps ?? {};
            const segs = fmtList(m.segment_codes);
            const juris = fmtList(m.jurisdictions);
            const stages = fmtList(m.stages);
            return (
              <div key={r.id} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: "0.95rem" }}>{r.name}</span>
                  <Badge text={r.enabled ? "켜짐" : "꺼짐"} tone={r.enabled ? "var(--accent)" : "var(--muted)"} />
                  <Badge text={`priority ${r.priority ?? 100}`} />
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>마지막 실행 {relTime(r.last_run_at)}</span>
                </div>

                <div style={{ fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.7 }}>
                  <div>
                    <b style={{ color: "var(--ink)" }}>대상</b>{" "}
                    {segs ? `세그먼트 ${segs}` : "전체 세그먼트"}
                    {juris ? ` · 관할권 ${juris}` : ""}
                    {stages ? ` · stage ${stages}` : ""}
                    {typeof m.parked_reason === "string" ? ` · parked=${m.parked_reason}` : ""}
                  </div>
                  <div>
                    <b style={{ color: "var(--ink)" }}>발동</b>{" "}
                    마지막 접촉 후 {typeof t.days_since_last_touch === "number" ? t.days_since_last_touch : "?"}일 경과 · 총
                    아웃바운드 {typeof t.max_total_touches === "number" ? t.max_total_touches : "?"}회 미만
                  </div>
                  <div>
                    <b style={{ color: "var(--ink)" }}>액션</b>{" "}
                    {a.draft_kind === "followup" ? "팔로업" : "1차"} 초안 생성
                    {typeof a.template_id === "number" ? ` · 템플릿 #${a.template_id}` : ""}
                    {typeof a.offer_id === "number" ? ` · 오퍼 #${a.offer_id}` : ""}
                  </div>
                  <div>
                    <b style={{ color: "var(--ink)" }}>상한</b>{" "}
                    런당 {typeof c.per_run === "number" ? c.per_run : 10}건 · 하루{" "}
                    {typeof c.per_day === "number" ? c.per_day : 20}건
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                  <form action={toggleRule}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="enabled" value={r.enabled ? "false" : "true"} />
                    <button type="submit" style={btn(r.enabled ? "var(--bad)" : "var(--accent)")}>
                      {r.enabled ? "끄기" : "켜기"}
                    </button>
                  </form>
                  <span style={{ fontSize: "0.7rem", color: "var(--warn)" }}>
                    ⚠️ 재대사(Gmail 소급 동기화) 완료 전에는 켜지 마세요.
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SectionTitle>룰 추가</SectionTitle>
      <div style={{ ...card, marginBottom: 28 }}>
        <form action={addRule} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <label style={labelStyle}>
            <span style={labelText}>룰 이름</span>
            <input name="name" required placeholder="C1 그룹 1차 접촉" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span style={labelText}>세그먼트 코드 (쉼표)</span>
            <input name="segment_codes" placeholder="C1, C2" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span style={labelText}>stage (쉼표)</span>
            <input name="stages" defaultValue="none" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span style={labelText}>마지막 접촉 후 경과일</span>
            <input name="days_since_last_touch" type="number" min={0} defaultValue={7} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span style={labelText}>총 아웃바운드 상한</span>
            <input name="max_total_touches" type="number" min={1} defaultValue={2} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span style={labelText}>초안 종류</span>
            <select name="draft_kind" defaultValue="first" style={inputStyle}>
              <option value="first">1차 (first)</option>
              <option value="followup">팔로업 (followup)</option>
            </select>
          </label>
          <label style={labelStyle}>
            <span style={labelText}>템플릿</span>
            <select name="template_id" defaultValue="" style={inputStyle}>
              <option value="">(선택 안 함)</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} · {tpl.kind}
                  {tpl.segment_code ? ` · ${tpl.segment_code}` : ""}
                  {tpl.non_commercial ? " · 비상업" : ""}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            <span style={labelText}>하루 상한 (per_day)</span>
            <input name="per_day" type="number" min={1} defaultValue={20} style={inputStyle} />
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" style={btn("var(--accent)")}>룰 추가 (꺼진 상태로)</button>
          </div>
        </form>
      </div>

      <SectionTitle>최근 실행 ({runs.length})</SectionTitle>
      <div style={card}>
        {runs.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>아직 실행 이력이 없습니다.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ fontSize: "0.78rem", width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--hairline)", textAlign: "left" }}>
                  <th style={thStyle}>룰</th>
                  <th style={thRight}>대상</th>
                  <th style={thRight}>초안</th>
                  <th style={thRight}>스킵</th>
                  <th style={thRight}>오류</th>
                  <th style={thRight}>시각</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const skipped = (run.skipped_suppressed ?? 0) + (run.skipped_capped ?? 0);
                  return (
                    <tr key={run.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
                      <td style={tdStyle}>{run.rule_id ? ruleName.get(run.rule_id) ?? `#${run.rule_id}` : "—"}</td>
                      <td style={tdRight}>{run.matched ?? 0}</td>
                      <td style={{ ...tdRight, color: (run.drafted ?? 0) > 0 ? "var(--accent)" : "var(--muted)" }}>{run.drafted ?? 0}</td>
                      <td style={{ ...tdRight, color: "var(--muted)" }}>{skipped}</td>
                      <td style={{ ...tdRight, color: run.errors ? "var(--bad)" : "var(--muted)" }}>{run.errors ? "있음" : "—"}</td>
                      <td style={{ ...tdRight, color: "var(--muted)" }}>{relTime(run.started_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 4 };
const labelText = { fontSize: "0.72rem", color: "var(--muted)" };
const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--hairline)",
  borderRadius: 5,
  padding: "0.4rem 0.55rem",
  color: "var(--ink)",
  fontSize: "0.8rem",
};
const thStyle = { padding: "5px 7px", color: "var(--muted)", fontWeight: 600 };
const thRight = { ...thStyle, textAlign: "right" as const };
const tdStyle = { padding: "5px 7px", color: "var(--ink)" };
const tdRight = { padding: "5px 7px", textAlign: "right" as const, color: "var(--ink)" };
