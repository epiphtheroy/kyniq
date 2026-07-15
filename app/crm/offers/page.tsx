import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, getAdminUser, logContentEvent } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { card, btn, PageTitle, SectionTitle, Badge, Empty } from "@/lib/crm/ui";
import { DEPTH_LABEL, DEPTH_TONE } from "@/lib/crm/types";
import type { OfferDepth } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

const DRAFT_TONE: Record<string, string> = { active: "#34d399", draft: "#fbbf24", retired: "#94a3b8" };
const STATUS_LABEL: Record<string, string> = { active: "활성", draft: "초안", retired: "은퇴" };

async function addOffer(formData: FormData) {
  "use server";
  const admin = await getAdminUser();
  if (!admin) return;
  const segment_code = String(formData.get("segment_code") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const coupling = String(formData.get("coupling") || "").trim();
  const depth = String(formData.get("depth") || "mid").trim();
  const sortRaw = String(formData.get("sort") || "").trim();
  const sort = sortRaw ? Number(sortRaw) : 0;
  if (!segment_code || !title || !coupling) return;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("crm_offers")
    .insert({ segment_code, title, coupling, depth, sort, status: "active" })
    .select("id")
    .maybeSingle();
  if (error) return;
  await logContentEvent({
    entityType: "crm_offer",
    entityId: String(data?.id ?? ""),
    event: "offer_created",
    actorId: admin.id,
    actorKind: "human",
    meta: { segment_code, title, depth },
  });
  revalidatePath("/crm/offers");
}

async function retireOffer(formData: FormData) {
  "use server";
  const admin = await getAdminUser();
  if (!admin) return;
  const id = String(formData.get("id") || "").trim();
  if (!id) return;
  const supabase = createAdminClient();
  const { error } = await supabase.from("crm_offers").update({ status: "retired" }).eq("id", id);
  if (error) return;
  await logContentEvent({
    entityType: "crm_offer",
    entityId: id,
    event: "offer_retired",
    actorId: admin.id,
    actorKind: "human",
    meta: {},
  });
  revalidatePath("/crm/offers");
}

async function restoreOffer(formData: FormData) {
  "use server";
  const admin = await getAdminUser();
  if (!admin) return;
  const id = String(formData.get("id") || "").trim();
  if (!id) return;
  const supabase = createAdminClient();
  const { error } = await supabase.from("crm_offers").update({ status: "active" }).eq("id", id);
  if (error) return;
  await logContentEvent({
    entityType: "crm_offer",
    entityId: id,
    event: "offer_restored",
    actorId: admin.id,
    actorKind: "human",
    meta: {},
  });
  revalidatePath("/crm/offers");
}

interface OfferRow {
  id: number;
  segment_code: string;
  title: string;
  coupling: string;
  depth: string;
  status: string;
  sort: number;
}

interface SegRow {
  code: string;
  name_ko: string;
  name_en: string | null;
  parent_code: string | null;
  status: string;
}

export default async function OffersPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: offersData } = await supabase
    .from("crm_offers")
    .select("id, segment_code, title, coupling, depth, status, sort")
    .order("segment_code", { ascending: true })
    .order("sort", { ascending: true });
  const offers = (offersData ?? []) as OfferRow[];

  const { data: segData } = await supabase
    .from("crm_segments")
    .select("code, name_ko, name_en, parent_code, status")
    .order("code", { ascending: true });
  const segments = (segData ?? []) as SegRow[];
  const segMap = new Map<string, SegRow>(segments.map((s) => [s.code, s]));

  // group offers by segment_code preserving segment order
  const groups: { code: string; rows: OfferRow[] }[] = [];
  const groupIndex = new Map<string, number>();
  for (const o of offers) {
    let idx = groupIndex.get(o.segment_code);
    if (idx === undefined) {
      idx = groups.length;
      groupIndex.set(o.segment_code, idx);
      groups.push({ code: o.segment_code, rows: [] });
    }
    groups[idx].rows.push(o);
  }

  const inputStyle: React.CSSProperties = {
    background: "#0b1712",
    border: "1px solid var(--hairline)",
    borderRadius: 6,
    color: "var(--ink)",
    padding: "6px 8px",
    fontSize: "0.82rem",
    width: "100%",
  };
  const labelStyle: React.CSSProperties = { fontSize: "0.72rem", color: "var(--muted)", marginBottom: 3, display: "block" };

  return (
    <div>
      <PageTitle title="오퍼 라이브러리" sub="세그먼트별 한 줄 제안 + 존재이유 결합점. 오퍼는 소프트 삭제(은퇴)만 — 과거 이력이 참조합니다." />

      {/* add offer */}
      <SectionTitle>오퍼 추가</SectionTitle>
      <form action={addOffer} style={{ ...card, marginBottom: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <div>
            <label style={labelStyle}>세그먼트</label>
            <select name="segment_code" required style={inputStyle} defaultValue="">
              <option value="" disabled>선택…</option>
              {segments.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code}. {s.name_ko}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>깊이</label>
            <select name="depth" style={inputStyle} defaultValue="mid">
              <option value="deep">{DEPTH_LABEL.deep} (deep)</option>
              <option value="mid">{DEPTH_LABEL.mid} (mid)</option>
              <option value="light">{DEPTH_LABEL.light} (light)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>정렬(sort)</label>
            <input name="sort" type="number" defaultValue={0} style={inputStyle} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>오퍼 (한 줄 제안)</label>
          <input name="title" required style={inputStyle} placeholder="한 줄 오퍼" />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>결합점 (왜 상대의 이익인가)</label>
          <textarea name="coupling" required rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} placeholder="존재이유 결합점" />
        </div>
        <div style={{ marginTop: 14 }}>
          <button type="submit" style={btn("var(--accent)")}>오퍼 추가</button>
        </div>
      </form>

      {/* offer list grouped by segment */}
      <SectionTitle>오퍼 목록 ({offers.length})</SectionTitle>
      {groups.length === 0 ? (
        <Empty>아직 등록된 오퍼가 없습니다.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {groups.map((g) => {
            const seg = segMap.get(g.code);
            return (
              <div key={g.code} style={card}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                  <Link href={`/crm/segments/${g.code}`} style={{ fontWeight: 600, color: "var(--ink)" }}>
                    {g.code}
                  </Link>
                  <span style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{seg?.name_ko ?? "(알 수 없는 세그먼트)"}</span>
                  {seg?.name_en ? <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{seg.name_en}</span> : null}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {g.rows.map((o) => (
                    <div
                      key={o.id}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        paddingTop: 8,
                        borderTop: "1px solid var(--hairline)",
                        opacity: o.status === "retired" ? 0.55 : 1,
                      }}
                    >
                      <div style={{ flexShrink: 0, width: 72 }}>
                        <Badge text={DEPTH_LABEL[o.depth as OfferDepth] ?? o.depth} tone={DEPTH_TONE[o.depth as OfferDepth] ?? "var(--muted)"} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.85rem", color: "var(--ink)", textDecoration: o.status === "retired" ? "line-through" : "none" }}>{o.title}</div>
                        <div style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: 3 }}>{o.coupling}</div>
                      </div>
                      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <Badge text={STATUS_LABEL[o.status] ?? o.status} tone={DRAFT_TONE[o.status] ?? "var(--muted)"} />
                        {o.status === "retired" ? (
                          <form action={restoreOffer}>
                            <input type="hidden" name="id" value={o.id} />
                            <button type="submit" style={{ ...btn("transparent"), border: "1px solid var(--hairline)", color: "var(--muted)", fontSize: "0.72rem", padding: "3px 8px" }}>복원</button>
                          </form>
                        ) : (
                          <form action={retireOffer}>
                            <input type="hidden" name="id" value={o.id} />
                            <button type="submit" style={{ ...btn("transparent"), border: "1px solid var(--hairline)", color: "var(--muted)", fontSize: "0.72rem", padding: "3px 8px" }}>은퇴</button>
                          </form>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
