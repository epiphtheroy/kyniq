import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, getAdminUser, logContentEvent } from "@/lib/admin";
import { card, btn, Badge, Empty, SectionTitle } from "@/lib/crm/ui";
import { DEPTH_LABEL, DEPTH_TONE, type OfferDepth } from "@/lib/crm/types";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SegmentDetail({ params }: { params: Promise<{ code: string }> }) {
  await requireAdmin();
  const { code } = await params;
  const supabase = createAdminClient();

  const { data: seg } = await supabase
    .from("crm_segments")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (!seg) notFound();

  const isCluster = seg.parent_code == null;

  // 클러스터면 하위 그룹, 그룹이면 컨택/오퍼/룰.
  const [{ data: groupsRaw }, { data: contactsRaw }, { data: offersRaw }, { data: rulesRaw }] =
    await Promise.all([
      isCluster
        ? supabase
            .from("crm_segments")
            .select("code, name_ko, rationale, priority, status")
            .eq("parent_code", code)
            .order("priority", { ascending: true })
            .order("code", { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
      isCluster
        ? Promise.resolve({ data: [] as any[] })
        : supabase
            .from("crm_contacts")
            .select("id, name, org_name, stage, email")
            .eq("segment_code", code)
            .order("org_name", { ascending: true })
            .limit(200),
      isCluster
        ? Promise.resolve({ data: [] as any[] })
        : supabase
            .from("crm_offers")
            .select("id, title, coupling, depth, status, sort")
            .eq("segment_code", code)
            .order("depth", { ascending: true })
            .order("sort", { ascending: true }),
      isCluster
        ? Promise.resolve({ data: [] as any[] })
        : supabase
            .from("crm_rules")
            .select("id, name, enabled, match, priority")
            .eq("enabled", true),
    ]);

  const groups = groupsRaw ?? [];
  const contacts = contactsRaw ?? [];
  const offers = offersRaw ?? [];

  // 그룹별 컨택 수 (클러스터 뷰).
  const groupCounts = await Promise.all(
    groups.map(async (g) => {
      const { count } = await supabase
        .from("crm_contacts")
        .select("*", { count: "exact", head: true })
        .eq("segment_code", g.code);
      return count ?? 0;
    })
  );

  // 이 세그먼트를 대상으로 하는 룰 (JS 필터).
  const rules = (rulesRaw ?? []).filter((r) => {
    const codes = (r.match as { segment_codes?: string[] } | null)?.segment_codes;
    return Array.isArray(codes) && codes.includes(code);
  });

  // ── Server actions ──────────────────────────────────────────────
  async function editSegment(formData: FormData) {
    "use server";
    const admin = await getAdminUser();
    if (!admin) return;
    const supabase = createAdminClient();

    const nameKo = String(formData.get("name_ko") || "").trim();
    const rationale = String(formData.get("rationale") || "").trim() || null;
    const priorityRaw = String(formData.get("priority") || "").trim();
    const priority = priorityRaw ? Number(priorityRaw) : null;
    if (!nameKo) return;

    await supabase
      .from("crm_segments")
      .update({
        name_ko: nameKo,
        rationale,
        ...(priority != null && Number.isFinite(priority) ? { priority } : {}),
      })
      .eq("code", code);

    await logContentEvent({
      entityType: "crm_segment",
      entityId: String(code),
      event: "edited",
      actorId: admin.id,
      actorKind: "human",
      meta: {},
    });
    revalidatePath(`/crm/segments/${code}`);
  }

  async function retireSegment() {
    "use server";
    const admin = await getAdminUser();
    if (!admin) return;
    const supabase = createAdminClient();

    // 소프트 은퇴 — 컨택·오퍼·룰이 참조하므로 하드 삭제 금지 (§5-3).
    await supabase.from("crm_segments").update({ status: "retired" }).eq("code", code);

    await logContentEvent({
      entityType: "crm_segment",
      entityId: String(code),
      event: "retired",
      actorId: admin.id,
      actorKind: "human",
      meta: {},
    });
    revalidatePath(`/crm/segments/${code}`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <Link href="/crm/segments" style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            ← 세그먼트
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "var(--ink)" }}>
            {seg.code}. {seg.name_ko}
          </h1>
          <Badge text={isCluster ? "클러스터" : `그룹 · ${seg.parent_code}`} />
          {seg.status === "retired" ? <Badge text="은퇴" tone="var(--muted)" /> : null}
          <Badge text={`P${seg.priority ?? "—"}`} />
        </div>
        {seg.rationale ? (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 8, lineHeight: 1.6 }}>{seg.rationale}</p>
        ) : null}
      </div>

      {isCluster ? (
        /* 클러스터: 하위 그룹 목록 */
        <div>
          <SectionTitle>하위 그룹 ({groups.length})</SectionTitle>
          {groups.length === 0 ? (
            <Empty>하위 그룹이 없습니다.</Empty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groups.map((g, i) => (
                <Link
                  key={g.code}
                  href={`/crm/segments/${g.code}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: "0.88rem" }}>
                        {g.code}. {g.name_ko}
                      </div>
                      {g.rationale ? (
                        <div style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: 2 }}>{g.rationale}</div>
                      ) : null}
                    </div>
                    {g.status === "retired" ? <Badge text="은퇴" tone="var(--muted)" /> : null}
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)", flexShrink: 0 }}>
                      컨택 <span style={{ color: "var(--ink)", fontWeight: 600 }}>{groupCounts[i].toLocaleString()}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 그룹: 오퍼 */}
          <div>
            <SectionTitle>오퍼 ({offers.length})</SectionTitle>
            {offers.length === 0 ? (
              <Empty>이 그룹에 연결된 오퍼가 없습니다.</Empty>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {offers.map((o) => (
                  <div key={o.id} style={{ ...card, display: "flex", alignItems: "baseline", gap: 10 }}>
                    <Badge text={DEPTH_LABEL[o.depth as OfferDepth] ?? o.depth} tone={DEPTH_TONE[o.depth as OfferDepth]} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.85rem", color: "var(--ink)", fontWeight: 600 }}>{o.title}</div>
                      {o.coupling ? (
                        <div style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: 2 }}>{o.coupling}</div>
                      ) : null}
                    </div>
                    {o.status !== "active" ? <Badge text={o.status} tone="var(--muted)" /> : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 그룹: 걸린 룰 */}
          <div>
            <SectionTitle>걸린 룰 ({rules.length})</SectionTitle>
            {rules.length === 0 ? (
              <Empty>이 그룹을 대상으로 하는 활성 룰이 없습니다.</Empty>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rules.map((r) => (
                  <div key={r.id} style={{ ...card, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: "0.84rem", color: "var(--ink)" }}>{r.name}</div>
                    <Badge text={`P${r.priority ?? "—"}`} />
                    <Badge text="활성" tone="var(--accent)" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 그룹: 컨택 */}
          <div>
            <SectionTitle>컨택 ({contacts.length})</SectionTitle>
            <div style={{ marginBottom: 8 }}>
              <Link href={`/crm/contacts?seg=${seg.code}`} style={{ fontSize: "0.8rem", color: "var(--accent)" }}>
                이 그룹의 컨택 전체 보기 →
              </Link>
            </div>
            {contacts.length === 0 ? (
              <Empty>이 그룹에 컨택이 없습니다.</Empty>
            ) : (
              <div style={card}>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
                  {contacts.map((c) => (
                    <li key={c.id} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <Link
                        href={`/crm/contacts/${c.id}`}
                        style={{ flex: 1, minWidth: 0, fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {c.name ? `${c.name} · ${c.org_name}` : c.org_name}
                      </Link>
                      <span style={{ fontSize: "0.72rem", color: "var(--muted)", flexShrink: 0 }}>{c.stage}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}

      {/* 수정 */}
      <div>
        <SectionTitle>수정</SectionTitle>
        <form action={editSegment} style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.74rem", color: "var(--muted)" }}>
            이름 (한국어)
            <input
              name="name_ko"
              required
              defaultValue={seg.name_ko ?? ""}
              style={{
                padding: "0.4rem 0.6rem",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--hairline)",
                borderRadius: 5,
                color: "var(--ink)",
                fontSize: "0.85rem",
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.74rem", color: "var(--muted)" }}>
            명분 (rationale)
            <textarea
              name="rationale"
              rows={2}
              defaultValue={seg.rationale ?? ""}
              style={{
                padding: "0.4rem 0.6rem",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--hairline)",
                borderRadius: 5,
                color: "var(--ink)",
                fontSize: "0.85rem",
                resize: "vertical",
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.74rem", color: "var(--muted)", maxWidth: 160 }}>
            우선순위
            <input
              name="priority"
              type="number"
              defaultValue={seg.priority ?? 100}
              style={{
                padding: "0.4rem 0.6rem",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--hairline)",
                borderRadius: 5,
                color: "var(--ink)",
                fontSize: "0.85rem",
              }}
            />
          </label>
          <div>
            <button type="submit" style={btn("var(--accent)")}>
              수정 저장
            </button>
          </div>
        </form>
      </div>

      {/* 은퇴 */}
      {seg.status !== "retired" ? (
        <form action={retireSegment}>
          <button type="submit" style={btn("var(--bad)")}>
            은퇴 (소프트 삭제)
          </button>
        </form>
      ) : null}
    </div>
  );
}
