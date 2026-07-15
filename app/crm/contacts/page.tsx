import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin";
import { card, Badge, Empty, relTime } from "@/lib/crm/ui";
import { STAGE_LABEL, STAGE_TONE, JURISDICTIONS, type Stage } from "@/lib/crm/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

const VERIFY_LABEL: Record<string, string> = {
  unverified: "미검증",
  valid: "유효",
  risky: "위험",
  bounced: "반송",
};

const inputStyle = {
  padding: "0.32rem 0.5rem",
  background: "#0b1712",
  color: "var(--ink)",
  border: "1px solid var(--hairline)",
  borderRadius: 5,
  fontSize: "0.76rem",
} as const;

interface ContactRow {
  id: number;
  org_name: string;
  name: string | null;
  segment_code: string | null;
  jurisdiction: string | null;
  stage: Stage;
  email: string | null;
  last_touch_at: string | null;
  next_action_at: string | null;
}

export default async function ContactsList({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | undefined }>;
}) {
  await requireAdmin();
  const supabase = createAdminClient();
  const sp = await searchParams;

  const seg = sp.seg?.trim() || "";
  const stage = sp.stage?.trim() || "";
  const jurisdiction = sp.jurisdiction?.trim() || "";
  const kr = sp.kr === "1";
  const verify = sp.verify?.trim() || "";
  const hasEmail = sp.hasEmail?.trim() || ""; // "1" 있음 · "0" 없음
  const tag = sp.tag?.trim() || "";
  const q = sp.q?.trim() || "";
  const due = sp.due === "1";

  const nowIso = new Date().toISOString();

  // Apply the same filter chain to both the data query and the count query.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilters = (query: any): any => {
    let qb = query;
    if (seg) {
      // 클러스터(1글자) → left(segment_code,1) 접두 매칭 · 그룹코드는 정확 일치
      qb = seg.length === 1 ? qb.like("segment_code", `${seg}%`) : qb.eq("segment_code", seg);
    }
    if (stage) qb = qb.eq("stage", stage);
    if (jurisdiction) qb = qb.eq("jurisdiction", jurisdiction);
    if (kr) qb = qb.eq("kr_law_flag", true);
    if (verify) qb = qb.eq("verify_status", verify);
    if (hasEmail === "1") qb = qb.not("email", "is", null);
    if (hasEmail === "0") qb = qb.is("email", null);
    if (tag) qb = qb.contains("tags", [tag]);
    if (q) qb = qb.or(`org_name.ilike.%${q}%,name.ilike.%${q}%,email.ilike.%${q}%`);
    if (due) qb = qb.not("next_action_at", "is", null).lte("next_action_at", nowIso);
    return qb;
  };

  const { count } = await applyFilters(
    supabase.from("crm_contacts").select("*", { count: "exact", head: true }),
  );

  let dataQuery = applyFilters(
    supabase
      .from("crm_contacts")
      .select("id, org_name, name, segment_code, jurisdiction, stage, email, last_touch_at, next_action_at"),
  );
  dataQuery = due
    ? dataQuery.order("next_action_at", { ascending: true })
    : dataQuery.order("updated_at", { ascending: false });
  const { data: rows } = await dataQuery.limit(100);
  const contacts = (rows ?? []) as ContactRow[];

  // 세그먼트 셀렉트용 — 클러스터별 그룹.
  const { data: segData } = await supabase
    .from("crm_segments")
    .select("code, parent_code, name_ko")
    .order("code", { ascending: true });
  const segments = segData ?? [];
  const clusters = segments.filter((s) => !s.parent_code);

  const jurTone = (j: string | null) => (j === "KR" || j === "CA" ? "var(--warn)" : "#8fb3a0");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "var(--ink)" }}>컨택 DB</h1>
        <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          {(count ?? 0).toLocaleString()}명 {contacts.length >= 100 ? "· 상위 100행 표시" : ""}
        </span>
      </div>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.2rem" }}>
        “다음에 누구에게 무엇을” — 필터 한 번으로 나오는 작업대.
      </p>

      {/* 필터 바 (GET) */}
      <form
        method="GET"
        action="/crm/contacts"
        style={{ ...card, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 18 }}
      >
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="조직·이름·이메일 검색"
          style={{ ...inputStyle, minWidth: 200, flex: 1 }}
        />

        <select name="seg" defaultValue={seg} style={inputStyle}>
          <option value="">세그먼트 전체</option>
          {clusters.map((c) => (
            <optgroup key={c.code} label={`${c.code}. ${c.name_ko}`}>
              <option value={c.code}>{c.code} 전체</option>
              {segments
                .filter((g) => g.parent_code === c.code)
                .map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.code} · {g.name_ko}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>

        <select name="stage" defaultValue={stage} style={inputStyle}>
          <option value="">단계 전체</option>
          {(Object.keys(STAGE_LABEL) as Stage[]).map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>

        <select name="jurisdiction" defaultValue={jurisdiction} style={inputStyle}>
          <option value="">관할권 전체</option>
          {JURISDICTIONS.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>

        <select name="verify" defaultValue={verify} style={inputStyle}>
          <option value="">검증 전체</option>
          {Object.keys(VERIFY_LABEL).map((v) => (
            <option key={v} value={v}>
              {VERIFY_LABEL[v]}
            </option>
          ))}
        </select>

        <select name="hasEmail" defaultValue={hasEmail} style={inputStyle}>
          <option value="">이메일 전체</option>
          <option value="1">이메일 있음</option>
          <option value="0">이메일 없음</option>
        </select>

        <input type="text" name="tag" defaultValue={tag} placeholder="태그" style={{ ...inputStyle, width: 96 }} />

        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.76rem", color: "var(--muted)" }}>
          <input type="checkbox" name="kr" value="1" defaultChecked={kr} /> KR법 대상
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.76rem", color: "var(--muted)" }}>
          <input type="checkbox" name="due" value="1" defaultChecked={due} /> 액션 예정
        </label>

        <button type="submit" style={{ ...inputStyle, cursor: "pointer", background: "var(--accent)", color: "#04140d", fontWeight: 700, border: "none" }}>
          필터
        </button>
        <a href="/crm/contacts" style={{ ...inputStyle, textDecoration: "none", color: "var(--muted)" }}>
          초기화
        </a>
      </form>

      {contacts.length === 0 ? (
        <Empty>조건에 맞는 컨택이 없습니다.</Empty>
      ) : (
        <div style={{ ...card, padding: 0, overflowX: "auto" }}>
          <table style={{ fontSize: "0.8rem", width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--hairline)", color: "var(--muted)", textAlign: "left" }}>
                <th style={{ padding: "8px 10px" }}>조직 · 이름</th>
                <th style={{ padding: "8px 10px" }}>세그먼트</th>
                <th style={{ padding: "8px 10px" }}>관할권</th>
                <th style={{ padding: "8px 10px" }}>단계</th>
                <th style={{ padding: "8px 10px" }}>이메일</th>
                <th style={{ padding: "8px 10px" }}>{due ? "예정" : "마지막 접촉"}</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
                  <td style={{ padding: "8px 10px" }}>
                    <Link href={`/crm/contacts/${c.id}`} style={{ color: "var(--ink)", textDecoration: "none" }}>
                      <span style={{ fontWeight: 600 }}>{c.org_name}</span>
                      {c.name ? <span style={{ color: "var(--muted)" }}> · {c.name}</span> : null}
                    </Link>
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    {c.segment_code ? <Badge text={c.segment_code} /> : <span style={{ color: "var(--muted)" }}>—</span>}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    {c.jurisdiction ? <Badge text={c.jurisdiction} tone={jurTone(c.jurisdiction)} /> : <span style={{ color: "var(--muted)" }}>—</span>}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <Badge text={STAGE_LABEL[c.stage] ?? c.stage} tone={STAGE_TONE[c.stage]} />
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    {c.email ? (
                      <span style={{ color: "var(--accent)" }}>있음</span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>없음</span>
                    )}
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--muted)" }}>
                    {relTime(due ? c.next_action_at : c.last_touch_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
