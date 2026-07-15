import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, getAdminUser, logContentEvent } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { card, btn, PageTitle, SectionTitle, Badge, Warn, Empty, relTime } from "@/lib/crm/ui";
import { JURISDICTIONS } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  scout: "스카우트",
  radar: "레이더",
  research: "리서치",
  manual: "수동",
};
const SOURCE_TONE: Record<string, string> = {
  scout: "#a78bfa",
  radar: "#60a5fa",
  research: "#34d399",
  manual: "#8fb3a0",
};
const STATUS_LABEL: Record<string, string> = {
  active: "활성",
  paused: "일시정지",
  dead: "은퇴",
};
const STATUS_TONE: Record<string, string> = {
  active: "#34d399",
  paused: "#fbbf24",
  dead: "#f87171",
};

interface Seg {
  code: string;
  parent_code: string | null;
  name_ko: string;
}

function isKrHost(url: string, country: string | null): boolean {
  const c = (country ?? "").trim();
  if (c.includes("한국") || /\bKR\b/i.test(c)) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.endsWith(".kr") || host.endsWith(".co.kr") || host.endsWith(".or.kr");
  } catch {
    return false;
  }
}

export default async function CrmResearch() {
  await requireAdmin();
  const supabase = createAdminClient();

  const [{ data: candidates }, { data: sources }, { data: segs }] = await Promise.all([
    supabase
      .from("crm_candidates")
      .select("id, source, segment_guess, name, org_name, country, email_found, contact_url, evidence_url, evidence_snippet, found_at")
      .eq("status", "new")
      .order("found_at", { ascending: false })
      .limit(100),
    supabase
      .from("crm_sources")
      .select("id, url, org_name, segment_code, country, is_kr, robots_ok, last_scanned_at, fail_count, status")
      .order("status", { ascending: true })
      .order("last_scanned_at", { ascending: false, nullsFirst: false }),
    supabase.from("crm_segments").select("code, parent_code, name_ko").order("code", { ascending: true }),
  ]);

  const allSegs = (segs ?? []) as Seg[];
  const groupSegs = allSegs.filter((s) => s.parent_code !== null);

  // ── server actions ──────────────────────────────────────────────
  async function approveCandidate(formData: FormData) {
    "use server";
    const admin = await getAdminUser();
    if (!admin) return;
    const id = Number(formData.get("id"));
    const seg = String(formData.get("segment") ?? "").trim();
    if (!id || !seg) return;
    const sb = createAdminClient();
    const { data: newId, error } = await sb.rpc("crm_promote_candidate", { p_id: id, p_segment: seg });
    // best effort — 실패해도 조용히
    await logContentEvent({
      entityType: "crm_candidate",
      entityId: String(id),
      event: error ? "promote_failed" : "promoted",
      actorId: admin.id,
      actorKind: "human",
      meta: { segment: seg, contact_id: newId ?? null, error: error?.message ?? null },
    });
    revalidatePath("/crm/research");
  }

  async function rejectCandidate(formData: FormData) {
    "use server";
    const admin = await getAdminUser();
    if (!admin) return;
    const id = Number(formData.get("id"));
    if (!id) return;
    const sb = createAdminClient();
    await sb.from("crm_candidates").update({ status: "rejected" }).eq("id", id);
    await logContentEvent({
      entityType: "crm_candidate",
      entityId: String(id),
      event: "rejected",
      actorId: admin.id,
      actorKind: "human",
      meta: {},
    });
    revalidatePath("/crm/research");
  }

  async function addManualCandidate(formData: FormData) {
    "use server";
    const admin = await getAdminUser();
    if (!admin) return;
    const org_name = String(formData.get("org_name") ?? "").trim();
    const evidence_url = String(formData.get("evidence_url") ?? "").trim();
    if (!org_name || !evidence_url) return;
    const name = String(formData.get("name") ?? "").trim() || null;
    const email_found = String(formData.get("email_found") ?? "").trim() || null;
    const segment_guess = String(formData.get("segment_guess") ?? "").trim() || null;
    const sb = createAdminClient();
    const { data: inserted } = await sb
      .from("crm_candidates")
      .insert({ source: "manual", status: "new", org_name, name, email_found, evidence_url, segment_guess })
      .select("id")
      .maybeSingle();
    await logContentEvent({
      entityType: "crm_candidate",
      entityId: String(inserted?.id ?? "manual"),
      event: "manual_added",
      actorId: admin.id,
      actorKind: "human",
      meta: { org_name, segment_guess },
    });
    revalidatePath("/crm/research");
  }

  async function addSource(formData: FormData) {
    "use server";
    const admin = await getAdminUser();
    if (!admin) return;
    const url = String(formData.get("url") ?? "").trim();
    if (!url) return;
    const org_name = String(formData.get("org_name") ?? "").trim() || null;
    const segment_code = String(formData.get("segment_code") ?? "").trim() || null;
    const country = String(formData.get("country") ?? "").trim() || null;
    const is_kr = isKrHost(url, country);
    const sb = createAdminClient();
    const { data: inserted, error } = await sb
      .from("crm_sources")
      .insert({ url, org_name, segment_code, country, is_kr, status: "active" })
      .select("id")
      .maybeSingle();
    await logContentEvent({
      entityType: "crm_source",
      entityId: String(inserted?.id ?? url),
      event: error ? "add_failed" : "added",
      actorId: admin.id,
      actorKind: "human",
      meta: { url, is_kr, error: error?.message ?? null },
    });
    revalidatePath("/crm/research");
  }

  async function toggleSource(formData: FormData) {
    "use server";
    const admin = await getAdminUser();
    if (!admin) return;
    const id = Number(formData.get("id"));
    const next = String(formData.get("next") ?? "").trim();
    if (!id || (next !== "active" && next !== "paused")) return;
    const sb = createAdminClient();
    await sb.from("crm_sources").update({ status: next }).eq("id", id);
    await logContentEvent({
      entityType: "crm_source",
      entityId: String(id),
      event: next === "paused" ? "paused" : "resumed",
      actorId: admin.id,
      actorKind: "human",
      meta: {},
    });
    revalidatePath("/crm/research");
  }

  async function retireSource(formData: FormData) {
    "use server";
    const admin = await getAdminUser();
    if (!admin) return;
    const id = Number(formData.get("id"));
    if (!id) return;
    const sb = createAdminClient();
    await sb.from("crm_sources").update({ status: "dead" }).eq("id", id);
    await logContentEvent({
      entityType: "crm_source",
      entityId: String(id),
      event: "retired",
      actorId: admin.id,
      actorKind: "human",
      meta: {},
    });
    revalidatePath("/crm/research");
  }

  const inputStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid var(--hairline)",
    borderRadius: 5,
    color: "var(--ink)",
    padding: "0.35rem 0.5rem",
    fontSize: "0.78rem",
  } as const;
  const cands = (candidates ?? []);
  const srcs = (sources ?? []);

  return (
    <div>
      <PageTitle title="서치 봇" sub="봇이 찾아온 접점 후보를 한 건씩 심사하고, 봇의 사냥터(소스)를 관리합니다. 승인해야만 컨택이 됩니다 — 일괄 승인 없음." />

      {/* ── ① 후보 심사 큐 ───────────────────────────────── */}
      <SectionTitle>후보 심사 큐 ({cands.length}건)</SectionTitle>
      <div style={{ marginBottom: 12 }}>
        <Warn>한 건씩 사람 눈이 닿는 것 자체가 컴플라이언스 장치입니다. 증거 링크(공개 게시처)를 반드시 확인한 뒤 세그먼트를 지정해 승인하세요.</Warn>
      </div>

      {cands.length === 0 ? (
        <Empty>심사 대기 중인 후보가 없습니다.</Empty>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12, marginBottom: 28 }}>
          {cands.map((c) => (
            <div key={c.id} style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Badge text={SOURCE_LABEL[c.source] ?? c.source} tone={SOURCE_TONE[c.source] ?? "#8fb3a0"} />
                {c.segment_guess ? <Badge text={`추정 ${c.segment_guess}`} tone="#fbbf24" /> : null}
                {c.country ? <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{c.country}</span> : null}
                <span style={{ fontSize: "0.68rem", color: "var(--muted)", marginLeft: "auto" }}>{relTime(c.found_at)}</span>
              </div>

              <div>
                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--ink)" }}>{c.org_name}</div>
                {c.name ? <div style={{ fontSize: "0.8rem", color: "var(--ink)" }}>{c.name}</div> : null}
                {c.email_found ? (
                  <div style={{ fontSize: "0.78rem", color: "var(--accent)", wordBreak: "break-all" }}>{c.email_found}</div>
                ) : (
                  <div style={{ fontSize: "0.74rem", color: "var(--muted)" }}>이메일 미발견</div>
                )}
              </div>

              {c.evidence_snippet ? (
                <div style={{ fontSize: "0.74rem", color: "var(--muted)", lineHeight: 1.5, borderLeft: "2px solid var(--hairline)", paddingLeft: 8 }}>
                  {c.evidence_snippet}
                </div>
              ) : null}

              <a href={c.evidence_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.74rem", color: "var(--accent)", wordBreak: "break-all" }}>
                증거 링크 ↗ {c.evidence_url}
              </a>
              {c.contact_url ? (
                <a href={c.contact_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.72rem", color: "var(--muted)", wordBreak: "break-all" }}>
                  문의처 ↗ {c.contact_url}
                </a>
              ) : null}

              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
                <form action={approveCandidate} style={{ display: "flex", gap: 6, alignItems: "center", flex: 1, minWidth: 0 }}>
                  <input type="hidden" name="id" value={c.id} />
                  <select name="segment" required defaultValue={c.segment_guess ?? ""} style={{ ...inputStyle, flex: 1, minWidth: 0 }}>
                    <option value="" disabled>세그먼트 선택…</option>
                    {groupSegs.map((s) => (
                      <option key={s.code} value={s.code}>{s.code} · {s.name_ko}</option>
                    ))}
                  </select>
                  <button type="submit" style={btn("#34d399")}>승인</button>
                </form>
                <form action={rejectCandidate}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" style={btn("#f87171")}>거부</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 수동 후보 추가 ──────────────────────────────── */}
      <SectionTitle>수동 후보 추가 (N-클러스터 영화 관계자 등)</SectionTitle>
      <div style={{ ...card, marginBottom: 28 }}>
        <p style={{ fontSize: "0.76rem", color: "var(--muted)", marginBottom: 10 }}>
          자동화 금지 레인 — 크레딧 인물의 연락처는 오너의 건별 수동 리서치로만 등록합니다. 증거 URL(공개 게시처)은 필수입니다.
        </p>
        <form action={addManualCandidate} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.72rem", color: "var(--muted)" }}>
            소속/조직 (필수)
            <input name="org_name" required style={inputStyle} placeholder="예: Freelance DP" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.72rem", color: "var(--muted)" }}>
            이름
            <input name="name" style={inputStyle} placeholder="예: Jane Roe" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.72rem", color: "var(--muted)" }}>
            발견 이메일
            <input name="email_found" type="email" style={inputStyle} placeholder="contact@example.com" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.72rem", color: "var(--muted)" }}>
            세그먼트 추정
            <select name="segment_guess" defaultValue="" style={inputStyle}>
              <option value="">— 미지정 —</option>
              {groupSegs.map((s) => (
                <option key={s.code} value={s.code}>{s.code} · {s.name_ko}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.72rem", color: "var(--muted)" }}>
            증거 URL (필수)
            <input name="evidence_url" type="url" required style={inputStyle} placeholder="https://…" />
          </label>
          <button type="submit" style={{ ...btn("#a78bfa"), padding: "0.5rem 0.9rem" }}>후보 추가</button>
        </form>
      </div>

      {/* ── ② 소스 레지스트리 관리 ───────────────────────── */}
      <SectionTitle>소스 레지스트리 관리 ({srcs.length})</SectionTitle>
      <div style={{ marginBottom: 12 }}>
        <Warn tone="#60a5fa">
          스캔은 Mac에서 실행됩니다 — <code>run-crm-scout.command</code>(더블클릭)로 워커가 큐를 집어갑니다. Vercel에서는 실행하지 않습니다(장시간·외부 fetch). 한국 도메인(is_kr)은 자동 수집에서 제외됩니다.
        </Warn>
      </div>

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>소스 추가</div>
        <form action={addSource} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.72rem", color: "var(--muted)" }}>
            URL (필수)
            <input name="url" type="url" required style={inputStyle} placeholder="https://festival.example/contact" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.72rem", color: "var(--muted)" }}>
            조직명
            <input name="org_name" style={inputStyle} placeholder="예: Example Film Festival" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.72rem", color: "var(--muted)" }}>
            세그먼트
            <select name="segment_code" defaultValue="" style={inputStyle}>
              <option value="">— 미지정 —</option>
              {groupSegs.map((s) => (
                <option key={s.code} value={s.code}>{s.code} · {s.name_ko}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.72rem", color: "var(--muted)" }}>
            국가
            <input name="country" list="crm-src-countries" style={inputStyle} placeholder="예: US" />
            <datalist id="crm-src-countries">
              {JURISDICTIONS.map((j) => (
                <option key={j} value={j} />
              ))}
              <option value="한국" />
            </datalist>
          </label>
          <button type="submit" style={{ ...btn("#34d399"), padding: "0.5rem 0.9rem" }}>소스 추가</button>
        </form>
        <p style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: 8 }}>
          is_kr은 URL 호스트가 .kr/.co.kr/.or.kr로 끝나거나 국가가 한국/KR이면 자동으로 설정됩니다.
        </p>
      </div>

      {srcs.length === 0 ? (
        <Empty>등록된 소스가 없습니다.</Empty>
      ) : (
        <div style={{ ...card, overflowX: "auto" }}>
          <table style={{ fontSize: "0.78rem", width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--hairline)", textAlign: "left" }}>
                <th style={{ padding: "5px 8px" }}>URL</th>
                <th style={{ padding: "5px 8px" }}>조직</th>
                <th style={{ padding: "5px 8px" }}>세그먼트</th>
                <th style={{ padding: "5px 8px" }}>KR</th>
                <th style={{ padding: "5px 8px" }}>robots</th>
                <th style={{ padding: "5px 8px", textAlign: "right" }}>실패</th>
                <th style={{ padding: "5px 8px" }}>마지막 스캔</th>
                <th style={{ padding: "5px 8px" }}>상태</th>
                <th style={{ padding: "5px 8px" }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {srcs.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
                  <td style={{ padding: "5px 8px", maxWidth: 240 }}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", wordBreak: "break-all" }}>{s.url}</a>
                  </td>
                  <td style={{ padding: "5px 8px", color: "var(--ink)" }}>{s.org_name ?? "—"}</td>
                  <td style={{ padding: "5px 8px", color: "var(--muted)" }}>{s.segment_code ?? "—"}</td>
                  <td style={{ padding: "5px 8px" }}>
                    {s.is_kr ? <Badge text="KR 제외" tone="#f87171" /> : <span style={{ color: "var(--muted)" }}>—</span>}
                  </td>
                  <td style={{ padding: "5px 8px" }}>
                    {s.robots_ok === null || s.robots_ok === undefined ? (
                      <span style={{ color: "var(--muted)" }}>미확인</span>
                    ) : s.robots_ok ? (
                      <Badge text="허용" tone="#34d399" />
                    ) : (
                      <Badge text="불허" tone="#f87171" />
                    )}
                  </td>
                  <td style={{ padding: "5px 8px", textAlign: "right", color: (s.fail_count ?? 0) >= 3 ? "var(--bad)" : "var(--muted)" }}>{s.fail_count ?? 0}</td>
                  <td style={{ padding: "5px 8px", color: "var(--muted)" }}>{relTime(s.last_scanned_at)}</td>
                  <td style={{ padding: "5px 8px" }}>
                    <Badge text={STATUS_LABEL[s.status] ?? s.status} tone={STATUS_TONE[s.status] ?? "#8fb3a0"} />
                  </td>
                  <td style={{ padding: "5px 8px" }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      {s.status !== "dead" ? (
                        <form action={toggleSource}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="next" value={s.status === "paused" ? "active" : "paused"} />
                          <button type="submit" style={btn(s.status === "paused" ? "#34d399" : "#fbbf24")}>
                            {s.status === "paused" ? "재개" : "일시정지"}
                          </button>
                        </form>
                      ) : null}
                      {s.status !== "dead" ? (
                        <form action={retireSource}>
                          <input type="hidden" name="id" value={s.id} />
                          <button type="submit" style={btn("#f87171")}>은퇴</button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Link href="/crm" style={{ fontSize: "0.8rem", color: "var(--muted)" }}>← 대시보드</Link>
      </div>
    </div>
  );
}
