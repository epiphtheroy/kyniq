import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, getAdminUser, logContentEvent } from "@/lib/admin";
import { card, btn, PageTitle, SectionTitle, Badge, Empty, relTime } from "@/lib/crm/ui";
import { INBOUND_CLASS_LABEL } from "@/lib/crm/types";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function markHandled(formData: FormData) {
  "use server";
  const admin = await getAdminUser();
  if (!admin) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = createAdminClient();
  await supabase.from("crm_inbound").update({ handled: true }).eq("id", id);
  await logContentEvent({
    entityType: "crm_inbound",
    entityId: id,
    event: "handled",
    actorId: admin.id,
    actorKind: "human",
    meta: {},
  });
  revalidatePath("/crm/inbox");
}

async function linkContact(formData: FormData) {
  "use server";
  const admin = await getAdminUser();
  if (!admin) return;
  const id = String(formData.get("id") ?? "");
  const q = String(formData.get("q") ?? "").trim();
  if (!id || !q) return;
  const supabase = createAdminClient();

  // Match a contact by numeric id or by email (email / alt_emails).
  let contactId: number | null = null;
  if (/^\d+$/.test(q)) {
    const { data } = await supabase.from("crm_contacts").select("id").eq("id", Number(q)).maybeSingle();
    if (data) contactId = data.id as number;
  }
  if (!contactId) {
    const { data } = await supabase.from("crm_contacts").select("id").eq("email", q.toLowerCase()).maybeSingle();
    if (data) contactId = data.id as number;
  }
  if (!contactId) {
    const { data } = await supabase.from("crm_contacts").select("id").contains("alt_emails", [q.toLowerCase()]).maybeSingle();
    if (data) contactId = data.id as number;
  }
  if (!contactId) return;

  await supabase.from("crm_inbound").update({ contact_id: contactId }).eq("id", id);
  await logContentEvent({
    entityType: "crm_inbound",
    entityId: id,
    event: "link_contact",
    actorId: admin.id,
    actorKind: "human",
    meta: { contact_id: contactId },
  });
  revalidatePath("/crm/inbox");
}

export default async function CrmInbox() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: rows } = await supabase
    .from("crm_inbound")
    .select("id, contact_id, from_email, subject, snippet, classified_as, auto_draft_id, received_at")
    .eq("handled", false)
    .order("received_at", { ascending: false })
    .limit(100);

  const inbound = rows ?? [];

  const contactIds = Array.from(new Set(inbound.map((r) => r.contact_id).filter((v): v is number => v != null)));
  const contactMap = new Map<number, { id: number; name: string | null; org_name: string; email: string | null }>();
  if (contactIds.length) {
    const { data: contacts } = await supabase
      .from("crm_contacts")
      .select("id, name, org_name, email")
      .in("id", contactIds);
    for (const c of contacts ?? []) contactMap.set(c.id as number, c);
  }

  return (
    <div>
      <PageTitle title="수신 응답 큐" sub={`미처리 ${inbound.length}건 — 분류·연결·자동응답 초안 검토 후 처리 완료`} />

      {inbound.length === 0 ? (
        <Empty>미처리 수신 메시지가 없습니다.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {inbound.map((r) => {
            const c = r.contact_id != null ? contactMap.get(r.contact_id) : null;
            return (
              <div key={r.id} style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--ink)", fontWeight: 600 }}>{r.from_email}</span>
                  {c ? (
                    <Link href={`/crm/contacts/${c.id}`} style={{ fontSize: "0.78rem" }}>
                      {c.name || c.org_name}
                    </Link>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "var(--warn)" }}>미매칭</span>
                  )}
                  {r.classified_as ? (
                    <Badge text={INBOUND_CLASS_LABEL[r.classified_as] ?? r.classified_as} />
                  ) : (
                    <Badge text="분류 대기(다음 크론)" tone="var(--muted)" />
                  )}
                  <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--muted)" }}>{relTime(r.received_at)}</span>
                </div>

                <div style={{ fontSize: "0.82rem", color: "var(--ink)" }}>{r.subject || "(제목 없음)"}</div>
                {r.snippet ? (
                  <div style={{ fontSize: "0.76rem", color: "var(--muted)", lineHeight: 1.5 }}>{r.snippet}</div>
                ) : null}

                {r.auto_draft_id ? (
                  <div style={{ fontSize: "0.76rem", color: "var(--accent)" }}>
                    자동응답 초안 생성됨 → <Link href="/crm/outbox">/crm/outbox</Link>
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
                  <form action={markHandled}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" style={btn("var(--accent)")}>처리 완료</button>
                  </form>

                  <form action={linkContact} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="hidden" name="id" value={r.id} />
                    <input
                      name="q"
                      placeholder="컨택 ID 또는 이메일"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--hairline)",
                        borderRadius: 4,
                        color: "var(--ink)",
                        fontSize: "0.76rem",
                        padding: "4px 8px",
                        width: 180,
                      }}
                    />
                    <button type="submit" style={btn("var(--muted)")}>수동 연결</button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
