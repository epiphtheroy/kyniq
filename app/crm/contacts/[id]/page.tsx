import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, getAdminUser, logContentEvent } from "@/lib/admin";
import { loadSettings } from "@/lib/crm/settings";
import { card, btn, Badge, Warn, Empty, SectionTitle, relTime } from "@/lib/crm/ui";
import {
  STAGE_LABEL,
  STAGE_TONE,
  FUNNEL_ORDER,
  DEPTH_LABEL,
  DEPTH_TONE,
  needsConsent,
  liaOk,
  type Stage,
  type OfferDepth,
} from "@/lib/crm/types";
import { renderMessage } from "@/lib/crm/render";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const CONSENT_LABEL: Record<string, string> = {
  none: "동의 없음",
  requested: "동의 요청됨",
  granted: "동의 완료",
  denied: "동의 거부",
};

export default async function ContactDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: contact } = await supabase
    .from("crm_contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!contact) notFound();

  const settings = await loadSettings(supabase);

  const [{ data: touches }, { data: offers }, { data: templates }] = await Promise.all([
    supabase
      .from("crm_touches")
      .select("id, direction, kind, subject, snippet, gmail_thread_id, happened_at")
      .eq("contact_id", id)
      .order("happened_at", { ascending: false }),
    contact.segment_code
      ? supabase
          .from("crm_offers")
          .select("id, title, coupling, depth, sort")
          .eq("segment_code", contact.segment_code)
          .order("depth", { ascending: true })
          .order("sort", { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("crm_templates")
      .select("id, name, kind, non_commercial, subject_tpl, body_tpl, language, segment_code")
      .order("name", { ascending: true }),
  ]);

  const seg = (contact.segment_code || "") as string;
  const isEduSeg = seg.startsWith("E") || seg.startsWith("G");
  const jur = contact.jurisdiction as string | null;
  const lia = liaOk(contact);

  // ── Server actions ──────────────────────────────────────────────

  async function setMetatakeUrl(formData: FormData) {
    "use server";
    const admin = await getAdminUser();
    if (!admin) return;
    const supabase = createAdminClient();
    const url = String(formData.get("metatake_url") || "").trim();
    await supabase.from("crm_contacts").update({ metatake_url: url || null }).eq("id", id);
    await logContentEvent({
      entityType: "crm_contact",
      entityId: String(id),
      event: "edited",
      actorId: admin.id,
      actorKind: "human",
      meta: { field: "metatake_url" },
    });
    revalidatePath(`/crm/contacts/${id}`);
  }

  async function composeDraft(formData: FormData) {
    "use server";
    const admin = await getAdminUser();
    if (!admin) return;
    const supabase = createAdminClient();

    const templateId = String(formData.get("template_id") || "");
    const personalLine = String(formData.get("personal_line") || "");
    if (!templateId) return;

    const { data: tpl } = await supabase
      .from("crm_templates")
      .select("*")
      .eq("id", templateId)
      .maybeSingle();
    const { data: c } = await supabase.from("crm_contacts").select("*").eq("id", id).maybeSingle();
    if (!tpl || !c) return;

    // §10-5b: E*·G* 세그먼트는 non_commercial 템플릿만 — 위반 시 무동작.
    const cSeg = (c.segment_code || "") as string;
    const eduBlock = (cSeg.startsWith("E") || cSeg.startsWith("G")) && tpl.non_commercial === false;
    if (eduBlock) return;

    const settings = await loadSettings(supabase);
    const { subject, body } = renderMessage(tpl, c, settings, personalLine);

    const { data: inserted } = await supabase
      .from("crm_drafts")
      .insert({
        contact_id: id,
        template_id: tpl.id,
        offer_id: null,
        kind: tpl.kind,
        subject,
        body,
        status: "proposed",
        created_by: "manual",
      })
      .select("id")
      .maybeSingle();

    await logContentEvent({
      entityType: "crm_draft",
      entityId: String(inserted?.id ?? id),
      event: "created",
      actorId: admin.id,
      actorKind: "human",
      meta: { contact_id: id, template_id: tpl.id },
    });
    revalidatePath(`/crm/contacts/${id}`);
  }

  async function logTouch(formData: FormData) {
    "use server";
    const admin = await getAdminUser();
    if (!admin) return;
    const supabase = createAdminClient();

    const direction = (String(formData.get("direction") || "out") === "in" ? "in" : "out") as
      | "in"
      | "out";
    const channel = String(formData.get("channel") || "manual");
    const kind = String(formData.get("kind") || "note");
    const subject = String(formData.get("subject") || "").trim() || null;
    const now = new Date().toISOString();

    await supabase.from("crm_touches").insert({
      contact_id: id,
      direction,
      channel,
      kind,
      subject,
      happened_at: now,
    });

    // 실제 아웃리치 기록 시에만 stage·last_touch_at 갱신 (§5-2).
    if (kind === "first" || kind === "followup") {
      const stage: Stage = kind === "first" ? "first_sent" : "followup";
      await supabase.from("crm_contacts").update({ stage, last_touch_at: now }).eq("id", id);
    }

    await logContentEvent({
      entityType: "crm_contact",
      entityId: String(id),
      event: "touch_logged",
      actorId: admin.id,
      actorKind: "human",
      meta: { kind, direction, channel },
    });
    revalidatePath(`/crm/contacts/${id}`);
  }

  async function setStage(formData: FormData) {
    "use server";
    const admin = await getAdminUser();
    if (!admin) return;
    const supabase = createAdminClient();
    const stage = String(formData.get("stage") || "");
    if (!stage) return;
    await supabase.from("crm_contacts").update({ stage }).eq("id", id);
    await logContentEvent({
      entityType: "crm_contact",
      entityId: String(id),
      event: "stage_changed",
      actorId: admin.id,
      actorKind: "human",
      meta: { stage },
    });
    revalidatePath(`/crm/contacts/${id}`);
  }

  async function eraseContact() {
    "use server";
    const admin = await getAdminUser();
    if (!admin) return;
    const supabase = createAdminClient();

    const { data: c } = await supabase
      .from("crm_contacts")
      .select("email")
      .eq("id", id)
      .maybeSingle();

    if (c?.email) {
      await supabase.from("crm_suppression").insert({ email: c.email, reason: "legal", source: "gdpr_erase" });
    }

    await supabase
      .from("crm_contacts")
      .update({ name: null, email: null, alt_emails: null, role_title: null, owner_notes: null })
      .eq("id", id);

    // 집계용 행은 보존, 인적 정보만 스크럽.
    await supabase.from("crm_touches").update({ snippet: null }).eq("contact_id", id);
    await supabase.from("crm_inbound").update({ snippet: null }).eq("contact_id", id);

    await logContentEvent({
      entityType: "crm_contact",
      entityId: String(id),
      event: "gdpr_erased",
      actorId: admin.id,
      actorKind: "human",
      meta: {},
    });
    redirect("/crm/contacts");
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "var(--ink)" }}>
            {contact.name || contact.org_name}
          </h1>
          <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            {[contact.role_title, contact.org_name, contact.country].filter(Boolean).join(" · ")}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <Badge text={STAGE_LABEL[contact.stage as Stage] ?? contact.stage} tone={STAGE_TONE[contact.stage as Stage]} />
          {jur === "KR" ? (
            <Badge text="KR · 옵트인 필요" tone="var(--warn)" />
          ) : jur === "CA" ? (
            <Badge text="CA · CASL 동의" tone="var(--bad)" />
          ) : jur ? (
            <Badge text={jur} />
          ) : null}
          {needsConsent(jur, contact.kr_law_flag) && jur !== "KR" && jur !== "CA" ? (
            <Badge text="옵트인 필요" tone="var(--warn)" />
          ) : null}
          <Badge text={`동의: ${CONSENT_LABEL[contact.consent_status] ?? contact.consent_status}`} />
        </div>

        {/* LIA panel */}
        <div style={{ ...card, marginTop: 12, fontSize: "0.8rem", color: "var(--muted)" }}>
          <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>LIA 근거 (초안 전제조건)</div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px" }}>
            <span>출처 URL</span>
            <span>
              {contact.source_url ? (
                <a href={contact.source_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                  {contact.source_url}
                </a>
              ) : (
                "—"
              )}
            </span>
            <span>수집일</span>
            <span>{contact.collected_at || "—"}</span>
            <span>법적근거</span>
            <span>{contact.legal_basis || "—"}</span>
          </div>
        </div>
        {!lia ? (
          <div style={{ marginTop: 10 }}>
            <Warn>발송 불가: 출처 증빙 미기록</Warn>
          </div>
        ) : null}
      </div>

      {/* Metatake link */}
      <div>
        <SectionTitle>Metatake 링크</SectionTitle>
        <div style={card}>
          {contact.metatake_url ? (
            <a href={contact.metatake_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: "0.85rem" }}>
              {contact.metatake_url}
            </a>
          ) : (
            <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>미기록 — 가장 강한 개인화 재료입니다.</span>
          )}
          <form action={setMetatakeUrl} style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              name="metatake_url"
              defaultValue={contact.metatake_url ?? ""}
              placeholder="https://metatake.net/..."
              style={{ flex: 1, padding: "0.35rem 0.6rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--hairline)", borderRadius: 5, color: "var(--ink)", fontSize: "0.8rem" }}
            />
            <button type="submit" style={btn("var(--accent)")}>저장</button>
          </form>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <SectionTitle>이력 타임라인</SectionTitle>
        {(touches ?? []).length === 0 ? (
          <Empty>아직 접촉 이력이 없습니다.</Empty>
        ) : (
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 10 }}>
            {(touches ?? []).map((t) => (
              <div key={t.id} style={{ display: "flex", gap: 10, alignItems: "baseline", borderBottom: "1px solid var(--hairline)", paddingBottom: 8 }}>
                <span style={{ flexShrink: 0, fontSize: "0.9rem" }}>{t.direction === "out" ? "→" : "←"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.82rem", color: "var(--ink)" }}>
                    {t.subject || t.kind} <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>· {t.kind}</span>
                  </div>
                  {t.snippet ? <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>{t.snippet}</div> : null}
                  {t.gmail_thread_id ? (
                    <a href={`https://mail.google.com/mail/u/0/#all/${t.gmail_thread_id}`} target="_blank" rel="noreferrer" style={{ fontSize: "0.72rem", color: "var(--accent)" }}>
                      Gmail 스레드
                    </a>
                  ) : null}
                </div>
                <span style={{ flexShrink: 0, fontSize: "0.72rem", color: "var(--muted)" }}>{relTime(t.happened_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Matched offers */}
      <div>
        <SectionTitle>매칭 오퍼 ({contact.segment_code || "세그먼트 미지정"})</SectionTitle>
        {(offers ?? []).length === 0 ? (
          <Empty>이 세그먼트에 걸린 오퍼가 없습니다.</Empty>
        ) : (
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 10 }}>
            {(offers ?? []).map((o) => (
              <div key={o.id} style={{ display: "flex", gap: 10, alignItems: "baseline", borderBottom: "1px solid var(--hairline)", paddingBottom: 8 }}>
                <Badge text={DEPTH_LABEL[o.depth as OfferDepth] ?? o.depth} tone={DEPTH_TONE[o.depth as OfferDepth]} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.82rem", color: "var(--ink)", fontWeight: 600 }}>{o.title}</div>
                  {o.coupling ? <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>{o.coupling}</div> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Draft composer */}
      <div>
        <SectionTitle>초안 컴포저</SectionTitle>
        <div style={card}>
          {isEduSeg ? (
            <div style={{ marginBottom: 10 }}>
              <Warn>학계·교육 세그먼트({seg}) — non_commercial 템플릿만 저장됩니다 (§10-5b). 상업 톤 템플릿 선택 시 저장이 차단됩니다.</Warn>
            </div>
          ) : null}
          <form action={composeDraft} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              템플릿
              <select
                name="template_id"
                required
                style={{ display: "block", width: "100%", marginTop: 4, padding: "0.35rem 0.6rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--hairline)", borderRadius: 5, color: "var(--ink)", fontSize: "0.8rem" }}
              >
                <option value="">— 선택 —</option>
                {(templates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.kind}{t.non_commercial ? " · 비상업" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              개인화 한두 줄 (personal_line)
              <textarea
                name="personal_line"
                rows={3}
                placeholder="당신을 이렇게 읽었다 — 한두 줄의 개인화"
                style={{ display: "block", width: "100%", marginTop: 4, padding: "0.35rem 0.6rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--hairline)", borderRadius: 5, color: "var(--ink)", fontSize: "0.8rem", resize: "vertical" }}
              />
            </label>
            <button type="submit" style={{ ...btn("var(--accent)"), alignSelf: "flex-start" }}>초안 생성 (검토 대기)</button>
          </form>
        </div>
      </div>

      {/* Manual touch log */}
      <div>
        <SectionTitle>수동 접촉 기록</SectionTitle>
        <div style={card}>
          <form action={logTouch} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
            <label style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
              방향
              <select name="direction" style={{ display: "block", marginTop: 4, padding: "0.3rem 0.5rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--hairline)", borderRadius: 5, color: "var(--ink)", fontSize: "0.78rem" }}>
                <option value="out">→ 발신</option>
                <option value="in">← 수신</option>
              </select>
            </label>
            <label style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
              채널
              <select name="channel" style={{ display: "block", marginTop: 4, padding: "0.3rem 0.5rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--hairline)", borderRadius: 5, color: "var(--ink)", fontSize: "0.78rem" }}>
                <option value="manual">manual</option>
                <option value="gmail">gmail</option>
                <option value="form">form</option>
                <option value="dm">dm</option>
              </select>
            </label>
            <label style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
              유형
              <select name="kind" defaultValue="note" style={{ display: "block", marginTop: 4, padding: "0.3rem 0.5rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--hairline)", borderRadius: 5, color: "var(--ink)", fontSize: "0.78rem" }}>
                <option value="note">note (stage 불변)</option>
                <option value="first">first (→ 1차발송)</option>
                <option value="followup">followup (→ 팔로업)</option>
                <option value="reply_out">reply_out</option>
              </select>
            </label>
            <input
              name="subject"
              placeholder="제목·메모"
              style={{ flex: 1, minWidth: 160, padding: "0.35rem 0.6rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--hairline)", borderRadius: 5, color: "var(--ink)", fontSize: "0.78rem" }}
            />
            <button type="submit" style={btn("#60a5fa")}>기록</button>
          </form>
        </div>
      </div>

      {/* Manual stage change */}
      <div>
        <SectionTitle>단계 변경 (수동)</SectionTitle>
        <div style={card}>
          <form action={setStage} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select name="stage" defaultValue={contact.stage} style={{ padding: "0.35rem 0.6rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--hairline)", borderRadius: 5, color: "var(--ink)", fontSize: "0.8rem" }}>
              {FUNNEL_ORDER.map((s) => (
                <option key={s} value={s}>{STAGE_LABEL[s]}</option>
              ))}
            </select>
            <button type="submit" style={btn("var(--warn)")}>단계 저장</button>
            <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>협상·성사는 수동 전용입니다.</span>
          </form>
        </div>
      </div>

      {/* GDPR erase */}
      <div>
        <SectionTitle>개인정보 삭제 (GDPR)</SectionTitle>
        <Warn tone="var(--bad)">
          <div style={{ marginBottom: 8 }}>
            인적 필드(이름·이메일·역할·메모)를 익명화하고, touches·inbound의 스니펫을 스크럽합니다. 재발송 방지를 위해 이메일 1건만 suppression에 적법 보존됩니다 (§10-15). 되돌릴 수 없습니다.
          </div>
          <form action={eraseContact}>
            <button type="submit" style={btn("var(--bad)")}>이 컨택의 개인정보 영구 삭제</button>
          </form>
        </Warn>
      </div>
    </div>
  );
}
