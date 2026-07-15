import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, getAdminUser, logContentEvent } from "@/lib/admin";
import { card, btn, PageTitle, SectionTitle, Badge, Empty } from "@/lib/crm/ui";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export const dynamic = "force-dynamic";

const CODE_RE = /^[A-Z]{1,2}\d{0,2}$/;

export default async function SegmentsPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: clustersRaw } = await supabase
    .from("crm_segments")
    .select("code, name_ko, name_en, rationale, priority, status")
    .is("parent_code", null)
    .order("priority", { ascending: true })
    .order("code", { ascending: true });

  const clusters = clustersRaw ?? [];

  // 클러스터별 컨택 수 — left(segment_code,1)=클러스터코드 (head count).
  const counts = await Promise.all(
    clusters.map(async (c) => {
      const { count } = await supabase
        .from("crm_contacts")
        .select("*", { count: "exact", head: true })
        .like("segment_code", `${c.code}%`);
      return count ?? 0;
    })
  );

  // ── Server action: 그룹 추가 ─────────────────────────────────────
  async function addSegment(formData: FormData) {
    "use server";
    const admin = await getAdminUser();
    if (!admin) return;
    const supabase = createAdminClient();

    const code = String(formData.get("code") || "").trim().toUpperCase();
    const parentCode = String(formData.get("parent_code") || "").trim() || null;
    const nameKo = String(formData.get("name_ko") || "").trim();
    const rationale = String(formData.get("rationale") || "").trim() || null;
    const priorityRaw = String(formData.get("priority") || "").trim();
    const priority = priorityRaw ? Number(priorityRaw) : 100;

    if (!CODE_RE.test(code)) return; // 형식 검증 (§5-3)
    if (!nameKo) return;

    const { error } = await supabase.from("crm_segments").insert({
      code,
      parent_code: parentCode,
      name_ko: nameKo,
      rationale,
      priority: Number.isFinite(priority) ? priority : 100,
      status: "active",
    });
    if (error) return;

    await logContentEvent({
      entityType: "crm_segment",
      entityId: code,
      event: "created",
      actorId: admin.id,
      actorKind: "human",
      meta: { parent_code: parentCode },
    });
    revalidatePath("/crm/segments");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageTitle
        title="세그먼트"
        sub="터치포인트 맵 A–N 클러스터 — 어떤 그룹에 어떤 명분·오퍼로 가는가."
      />

      <div>
        <SectionTitle>클러스터 ({clusters.length})</SectionTitle>
        {clusters.length === 0 ? (
          <Empty>등록된 클러스터가 없습니다.</Empty>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 12,
            }}
          >
            {clusters.map((c, i) => (
              <Link
                key={c.code}
                href={`/crm/segments/${c.code}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div style={{ ...card, height: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: "0.95rem" }}>
                      {c.code}. {c.name_ko}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      {c.status === "retired" ? <Badge text="은퇴" tone="var(--muted)" /> : null}
                      <Badge text={`P${c.priority ?? "—"}`} />
                    </div>
                  </div>
                  {c.rationale ? (
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.5 }}>{c.rationale}</div>
                  ) : null}
                  <div style={{ marginTop: "auto", fontSize: "0.76rem", color: "var(--muted)" }}>
                    컨택 <span style={{ color: "var(--ink)", fontWeight: 600 }}>{counts[i].toLocaleString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 그룹 추가 */}
      <div>
        <SectionTitle>그룹 추가</SectionTitle>
        <form action={addSegment} style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.74rem", color: "var(--muted)" }}>
              코드 (예: A1, O)
              <input
                name="code"
                required
                pattern="[A-Za-z]{1,2}\d{0,2}"
                placeholder="A1"
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
              상위 클러스터
              <select
                name="parent_code"
                style={{
                  padding: "0.4rem 0.6rem",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 5,
                  color: "var(--ink)",
                  fontSize: "0.85rem",
                }}
              >
                <option value="">(없음 — 새 클러스터)</option>
                {clusters.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}. {c.name_ko}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.74rem", color: "var(--muted)" }}>
              우선순위
              <input
                name="priority"
                type="number"
                defaultValue={100}
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
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.74rem", color: "var(--muted)" }}>
            이름 (한국어)
            <input
              name="name_ko"
              required
              placeholder="그룹 이름"
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
              placeholder="이 그룹에 왜 가는가"
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
          <div>
            <button type="submit" style={btn("var(--accent)")}>
              그룹 추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
