import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, getAdminUser, logContentEvent } from "@/lib/admin";
import { loadSettings } from "@/lib/crm/settings";
import { card, btn, Badge, Warn, Empty, SectionTitle, relTime } from "@/lib/crm/ui";
import { STAGE_LABEL, STAGE_TONE, DRAFT_STATUS_LABEL, type Stage } from "@/lib/crm/types";
import { inKrWindow } from "@/lib/crm/render";
import { createDraft, GmailAuthError } from "@/lib/crm/gmail";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface DraftRow {
  id: number;
  contact_id: number | null;
  offer_id: number | null;
  kind: string;
  subject: string;
  body: string;
  status: string;
  created_by: string;
  error: string | null;
  created_at: string;
}

interface ContactRow {
  id: number;
  name: string | null;
  org_name: string | null;
  email: string | null;
  jurisdiction: string | null;
  kr_law_flag: boolean | null;
  segment_code: string | null;
  stage: string;
}

const KIND_LABEL: Record<string, string> = { first: "1차", followup: "팔로업", reply: "회신" };

export default async function Outbox() {
  await requireAdmin();
  const supabase = createAdminClient();
  const settings = await loadSettings(supabase);

  const { data: draftsRaw } = await supabase
    .from("crm_drafts")
    .select("id, contact_id, offer_id, kind, subject, body, status, created_by, error, created_at")
    .eq("status", "proposed")
    .order("created_at", { ascending: false })
    .limit(100);
  const drafts = (draftsRaw ?? []) as DraftRow[];

  const contactIds = [...new Set(drafts.map((d) => d.contact_id).filter((v): v is number => v != null))];
  const { data: contactsRaw } = contactIds.length
    ? await supabase
        .from("crm_contacts")
        .select("id, name, org_name, email, jurisdiction, kr_law_flag, segment_code, stage")
        .in("id", contactIds)
    : { data: [] as ContactRow[] };
  const byId = new Map<number, ContactRow>(((contactsRaw ?? []) as ContactRow[]).map((c) => [c.id, c]));

  const now = new Date();
  const krWindowOpen = inKrWindow(now, settings);

  // ── Server actions ──────────────────────────────────────────────

  async function approveDraft(formData: FormData) {
    "use server";
    const admin = await getAdminUser();
    if (!admin) return;
    const supabase = createAdminClient();
    const draftId = String(formData.get("draft_id") || "");
    if (!draftId) return;

    const { data: draft } = await supabase
      .from("crm_drafts")
      .select("id, contact_id, subject, body, status")
      .eq("id", draftId)
      .maybeSingle();
    if (!draft || draft.status !== "proposed") return;

    const { data: contact } = await supabase
      .from("crm_contacts")
      .select("id, email")
      .eq("id", draft.contact_id)
      .maybeSingle();

    // 이메일 없으면 발송 대상 아님 — 스킵(무동작).
    if (!contact?.email) return;

    const settings = await loadSettings(supabase);
    const email = String(contact.email).toLowerCase();
    const domain = email.includes("@") ? email.split("@")[1] : "";

    // §10-2 발송 직전 게이트: suppression 재조회.
    const { data: supp } = await supabase
      .from("crm_suppression")
      .select("id")
      .or(domain ? `email.eq.${email},domain.eq.${domain}` : `email.eq.${email}`)
      .limit(1);
    if (supp && supp.length) {
      await supabase
        .from("crm_drafts")
        .update({ status: "rejected", error: "suppression 목록에 있어 거부됨(수신거부/반송/불만)", updated_at: now.toISOString() })
        .eq("id", draftId);
      await logContentEvent({
        entityType: "crm_draft",
        entityId: String(draftId),
        event: "rejected",
        actorId: admin.id,
        actorKind: "human",
        meta: { reason: "suppressed" },
      });
      revalidatePath("/crm/outbox");
      return;
    }

    try {
      const res = await createDraft(email, draft.subject, draft.body, { from: settings.gmail_account ?? undefined });
      await supabase
        .from("crm_drafts")
        .update({
          status: "approved",
          gmail_draft_id: res.draftId,
          gmail_thread_id: res.threadId,
          error: null,
          updated_at: now.toISOString(),
        })
        .eq("id", draftId);
      await logContentEvent({
        entityType: "crm_draft",
        entityId: String(draftId),
        event: "approved",
        actorId: admin.id,
        actorKind: "human",
        meta: { gmail_draft_id: res.draftId, mode: "p2" },
      });
    } catch (e) {
      const note = e instanceof GmailAuthError ? "Gmail 인증 오류(토큰 재발급 필요)" : `Gmail 초안 생성 실패: ${String((e as Error)?.message ?? e).slice(0, 200)}`;
      await supabase.from("crm_drafts").update({ error: note, updated_at: now.toISOString() }).eq("id", draftId);
      await logContentEvent({
        entityType: "crm_draft",
        entityId: String(draftId),
        event: "error",
        actorId: admin.id,
        actorKind: "human",
        meta: { error: note },
      });
    }
    revalidatePath("/crm/outbox");
  }

  async function approveAndQueue(formData: FormData) {
    "use server";
    const admin = await getAdminUser();
    if (!admin) return;
    const supabase = createAdminClient();
    const settings = await loadSettings(supabase);
    // P3: 시스템 발송이 꺼져 있으면 무동작.
    if (!settings.system_send_enabled) return;

    const draftId = String(formData.get("draft_id") || "");
    if (!draftId) return;

    const { data: draft } = await supabase
      .from("crm_drafts")
      .select("id, contact_id, subject, body, status")
      .eq("id", draftId)
      .maybeSingle();
    if (!draft || draft.status !== "proposed") return;

    const { data: contact } = await supabase
      .from("crm_contacts")
      .select("id, email")
      .eq("id", draft.contact_id)
      .maybeSingle();
    if (!contact?.email) return;

    const email = String(contact.email).toLowerCase();
    const domain = email.includes("@") ? email.split("@")[1] : "";

    const { data: supp } = await supabase
      .from("crm_suppression")
      .select("id")
      .or(domain ? `email.eq.${email},domain.eq.${domain}` : `email.eq.${email}`)
      .limit(1);
    if (supp && supp.length) {
      await supabase
        .from("crm_drafts")
        .update({ status: "rejected", error: "suppression 목록에 있어 거부됨", updated_at: now.toISOString() })
        .eq("id", draftId);
      revalidatePath("/crm/outbox");
      return;
    }

    try {
      const res = await createDraft(email, draft.subject, draft.body, { from: settings.gmail_account ?? undefined });
      // 초안 생성 후 큐 전환 — 크론 잡 ⑤가 scheduled_for 도래분을 발송.
      await supabase
        .from("crm_drafts")
        .update({
          status: "queued",
          gmail_draft_id: res.draftId,
          gmail_thread_id: res.threadId,
          error: null,
          updated_at: now.toISOString(),
        })
        .eq("id", draftId);
      await logContentEvent({
        entityType: "crm_draft",
        entityId: String(draftId),
        event: "queued",
        actorId: admin.id,
        actorKind: "human",
        meta: { gmail_draft_id: res.draftId, mode: "p3" },
      });
    } catch (e) {
      const note = e instanceof GmailAuthError ? "Gmail 인증 오류(토큰 재발급 필요)" : `Gmail 초안 생성 실패: ${String((e as Error)?.message ?? e).slice(0, 200)}`;
      await supabase.from("crm_drafts").update({ error: note, updated_at: now.toISOString() }).eq("id", draftId);
      await logContentEvent({
        entityType: "crm_draft",
        entityId: String(draftId),
        event: "error",
        actorId: admin.id,
        actorKind: "human",
        meta: { error: note },
      });
    }
    revalidatePath("/crm/outbox");
  }

  async function rejectDraft(formData: FormData) {
    "use server";
    const admin = await getAdminUser();
    if (!admin) return;
    const supabase = createAdminClient();
    const draftId = String(formData.get("draft_id") || "");
    if (!draftId) return;
    await supabase
      .from("crm_drafts")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", draftId);
    await logContentEvent({
      entityType: "crm_draft",
      entityId: String(draftId),
      event: "rejected",
      actorId: admin.id,
      actorKind: "human",
      meta: { by: "human" },
    });
    revalidatePath("/crm/outbox");
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "var(--ink)" }}>아웃박스</h1>
          <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            기계가 만든 초안을 검토·승인합니다
          </span>
        </div>
      </div>

      {/* Top banner */}
      <Warn tone={drafts.length ? "var(--warn)" : "var(--accent)"}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>검토 대기 초안 {drafts.length}건</div>
        <div style={{ fontSize: "0.78rem", lineHeight: 1.5 }}>
          [승인]은 Gmail 초안만 생성합니다 — 실제 발송은 오너가 Gmail 앱에서 마지막 확인 후 직접 보냅니다
          {settings.system_send_enabled
            ? " (또는 [승인·발송]으로 큐에 넣으면 크론 잡이 캡 한도 내에서 대신 전송)."
            : ". (시스템 자동 발송 P3는 설정에서 꺼져 있음 — 승인 후 수동 전송만.)"}
          {" "}사람 승인 없는 발송은 없습니다.
        </div>
      </Warn>

      {drafts.length === 0 ? (
        <Empty>검토 대기 중인 초안이 없습니다. 룰·수동·자동응답이 초안을 만들면 여기 쌓입니다.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {drafts.map((d) => {
            const c = d.contact_id != null ? byId.get(d.contact_id) : undefined;
            const isKR = c?.jurisdiction === "KR" || !!c?.kr_law_flag;
            const krOutside = isKR && !krWindowOpen;
            const stage = (c?.stage ?? "none") as Stage;
            return (
              <div key={d.id} style={card}>
                {/* Contact header */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                  {c ? (
                    <Link href={`/crm/contacts/${c.id}`} style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)" }}>
                      {c.name || c.org_name || "(이름 없음)"}
                    </Link>
                  ) : (
                    <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--muted)" }}>컨택 없음</span>
                  )}
                  <span style={{ fontSize: "0.78rem", color: c?.email ? "var(--muted)" : "var(--bad)" }}>
                    {c?.email || "이메일 없음 (승인 시 스킵)"}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{relTime(d.created_at)}</span>
                </div>

                {/* Badges */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {c?.segment_code ? <Badge text={`세그 ${c.segment_code}`} tone="#a78bfa" /> : null}
                  {isKR ? (
                    <Badge text="KR · 옵트인/광고표기" tone="var(--warn)" />
                  ) : c?.jurisdiction ? (
                    <Badge text={c.jurisdiction} />
                  ) : null}
                  <Badge text={STAGE_LABEL[stage] ?? stage} tone={STAGE_TONE[stage]} />
                  <Badge text={KIND_LABEL[d.kind] ?? d.kind} tone="#60a5fa" />
                  <Badge text={`${DRAFT_STATUS_LABEL[d.status] ?? d.status} · ${d.created_by}`} />
                </div>

                {krOutside ? (
                  <div style={{ marginBottom: 10 }}>
                    <Warn>
                      KR 발송 윈도우(현재 {settings.kr_window.start}–{settings.kr_window.end}시 {settings.kr_window.tz}) 밖입니다 — 지금 승인해도 실제 전송은 윈도우 안에서 하세요.
                    </Warn>
                  </div>
                ) : null}

                {d.error ? (
                  <div style={{ marginBottom: 10 }}>
                    <Warn tone="var(--bad)">{d.error}</Warn>
                  </div>
                ) : null}

                {/* Rendered message */}
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>{d.subject}</div>
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily: "inherit",
                    fontSize: "0.8rem",
                    color: "var(--muted)",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--hairline)",
                    borderRadius: 6,
                    padding: "0.7rem 0.8rem",
                    margin: 0,
                    lineHeight: 1.55,
                  }}
                >
                  {d.body}
                </pre>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                  <form action={approveDraft}>
                    <input type="hidden" name="draft_id" value={d.id} />
                    <button type="submit" style={btn("var(--accent)")}>승인 (Gmail 초안)</button>
                  </form>
                  {settings.system_send_enabled ? (
                    <form action={approveAndQueue}>
                      <input type="hidden" name="draft_id" value={d.id} />
                      <button type="submit" style={btn("#22c55e")}>승인·발송 (큐)</button>
                    </form>
                  ) : null}
                  <form action={rejectDraft}>
                    <input type="hidden" name="draft_id" value={d.id} />
                    <button type="submit" style={btn("var(--bad)")}>거부</button>
                  </form>
                  {c ? (
                    <Link href={`/crm/contacts/${c.id}`} style={{ fontSize: "0.75rem", color: "var(--accent)", marginLeft: 4 }}>
                      컨택 열기 →
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SectionTitle>발송 원칙</SectionTitle>
      <div style={{ ...card, fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.6 }}>
        승인된 초안은 Gmail의 초안함에 만들어집니다. P2(기본): 오너가 Gmail 앱에서 직접 전송. P3(설정에서 system_send_enabled 켜짐): [승인·발송]으로 status=queued 전환 → 크론 잡 ⑤가 캡 한도 내에서 sendDraft. 어느 경로든 발송 직전 suppression·윈도우가 재확인됩니다.
      </div>
    </div>
  );
}
