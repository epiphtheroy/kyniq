/**
 * lib/crm/importPresets.ts — column→field mappings + segment rules for the four
 * known contact sources (§5-4-B), plus the freemail blocklist (§5-4-C) and
 * normalizers. Pure data + helpers; the /api/crm/import route applies them.
 */

export const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.co.jp",
  "outlook.com", "hotmail.com", "live.com", "msn.com", "aol.com",
  "naver.com", "daum.net", "hanmail.net", "protonmail.com", "proton.me",
  "icloud.com", "me.com", "gmx.com", "mail.com", "yandex.com", "qq.com", "163.com",
]);

export type ContactDraft = {
  name?: string | null;
  org_name: string;
  role_title?: string | null;
  country?: string | null;
  jurisdiction: "EU" | "UK" | "US" | "CA" | "KR" | "OTHER";
  kr_law_flag: boolean;
  email?: string | null;
  alt_emails?: string[];
  channel_type: "email" | "form" | "dm";
  contact_url?: string | null;
  source_url?: string | null;
  collected_at?: string | null;
  legal_basis?: string | null;
  segment_code?: string | null;
  _category?: string | null; // for reporting only
};

export interface Preset {
  id: string;
  label: string;
  description: string;
}

export const PRESETS: Preset[] = [
  { id: "academia", label: "학계·평론가 DB (1,394)", description: "Metatake_학계_평론가_DB.xlsx · 시트 학계_평론가_개인" },
  { id: "trade", label: "트레이드매체 DB (641)", description: "Metatake_트레이드매체_DB.xlsx · 시트 트레이드매체" },
  { id: "magazine", label: "매거진 컨택 (288)", description: "data/sources/magazine-contacts.csv" },
  { id: "contactdb", label: "컨택DB 템플릿 (61)", description: "Metatake_컨택DB_템플릿.xlsx · 시트 컨택DB" },
];

// ── segment rules (source category → crm_segments code) ──────────────────────
const SEG_ACADEMIA: Record<string, string> = {
  "학계": "E1", "대학원": "E1", "사서": "E2", "학회/저널": "E3", "학술지": "E3",
  "영화교육": "G1", "Substack": "D1", "블로거": "D1", "크리에이터": "D2",
  "평론가": "C1", "에디터": "C1", "영화제프로그래밍": "K3", "시네마테크/극장": "K4",
  "미디어아트/협동조합": "K4", "필름커미션": "F2", "영화기관": "F1",
  "시네클럽": "D5", "시네필커뮤니티": "D5", "영상번역/자막": "H2",
};
const SEG_TRADE: Record<string, string> = {
  "트레이드": "C1", "온라인매체": "C1", "일간지문화부": "C1", "잡지": "C1",
  "리뷰비평": "C1", "방송": "M1", "팟캐스트유튜브": "D3",
};
const SEG_MAGAZINE: Record<string, string> = {
  editorial: "C1", press: "C1", general: "C1", advertising: "C1", marketing: "C1",
  partnerships: "C2", syndication: "C2", licensing: "C2",
};
const SEG_CONTACTDB: Record<string, string> = {
  "영화제": "K3", "트레이드매체/기자": "C1", "배급/제작사": "K2",
};

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

export function normalizeEmail(raw: string): string | null {
  const v = (raw || "").trim().toLowerCase();
  if (!v || v === "unknown" || v === "n/a" || v === "-") return null;
  return v.includes("@") ? v : null;
}

export function normalizeJurisdiction(raw: string): { jurisdiction: ContactDraft["jurisdiction"]; kr: boolean } {
  const v = (raw || "").toLowerCase();
  if (/한국|korea|\bkr\b/.test(v)) return { jurisdiction: "KR", kr: true };
  if (/미국|united states|\bus\b|usa/.test(v)) return { jurisdiction: "US", kr: false };
  if (/영국|united kingdom|\buk\b|britain/.test(v)) return { jurisdiction: "UK", kr: false };
  if (/캐나다|canada|\bca\b/.test(v)) return { jurisdiction: "CA", kr: false };
  if (/eu|유럽|europe|영국|germany|france|italy|spain|독일|프랑스/.test(v)) return { jurisdiction: "EU", kr: false };
  return { jurisdiction: "OTHER", kr: false };
}

function truthy(raw: string): boolean {
  return /^(y|yes|true|1|o|예|✓)$/i.test((raw || "").trim());
}

export function isFreemailDomain(email: string | null | undefined): boolean {
  if (!email || !email.includes("@")) return true; // no usable domain
  return FREEMAIL.has(email.split("@")[1].toLowerCase());
}

/** Map one parsed source row → a ContactDraft (or null to skip). */
export function mapRow(presetId: string, row: Record<string, unknown>): ContactDraft | null {
  if (presetId === "academia") {
    const org = pick(row, ["소속/플랫폼", "이름/매체", "org_name"]);
    if (!org) return null;
    const cat = pick(row, ["카테고리", "category"]);
    const jur = normalizeJurisdiction(pick(row, ["관할권", "jurisdiction", "국가", "country"]));
    return {
      name: pick(row, ["이름/매체", "name"]) || null,
      org_name: org,
      country: pick(row, ["국가", "country"]) || null,
      jurisdiction: jur.jurisdiction,
      kr_law_flag: jur.kr || truthy(pick(row, ["KR법유의", "kr_law_flag"])),
      email: normalizeEmail(pick(row, ["공개이메일", "email"])),
      channel_type: "email",
      source_url: pick(row, ["공식/프로필URL", "공식/프로필 URL", "source_url"]) || null,
      legal_basis: "문의용",
      segment_code: SEG_ACADEMIA[cat] ?? null,
      _category: cat || null,
    };
  }

  if (presetId === "trade") {
    const org = pick(row, ["기관/매체", "org_name"]);
    if (!org) return null;
    const cat = pick(row, ["매체유형", "category"]);
    const emails = pick(row, ["공개이메일", "email"]).split(";").map((e) => normalizeEmail(e)).filter(Boolean) as string[];
    const jur = normalizeJurisdiction(pick(row, ["관할권", "jurisdiction", "국가", "country"]));
    return {
      org_name: org,
      country: pick(row, ["국가", "country"]) || null,
      jurisdiction: jur.jurisdiction,
      kr_law_flag: jur.kr || truthy(pick(row, ["KR법유의", "kr_law_flag"])),
      email: emails[0] ?? null,
      alt_emails: emails.slice(1),
      channel_type: "email",
      source_url: pick(row, ["공식페이지URL", "공식페이지 URL", "source_url"]) || null,
      legal_basis: "공개프레스",
      segment_code: SEG_TRADE[cat] ?? "C1",
      _category: cat || null,
    };
  }

  if (presetId === "magazine") {
    const org = pick(row, ["outlet_name", "org_name"]);
    if (!org) return null;
    const cat = pick(row, ["contact_type", "category"]).toLowerCase();
    return {
      name: pick(row, ["person_name", "name"]) || null,
      org_name: org,
      role_title: pick(row, ["person_title", "role_title"]) || null,
      jurisdiction: "OTHER",
      kr_law_flag: false,
      email: normalizeEmail(pick(row, ["email"])),
      channel_type: "email",
      source_url: pick(row, ["source_url", "profile_url"]) || null,
      collected_at: pick(row, ["last_verified", "collected_at"]) || null,
      legal_basis: cat === "advertising" || cat === "marketing" ? "비즈니스문의" : "공개프레스",
      segment_code: SEG_MAGAZINE[cat] ?? "C1",
      _category: cat || null,
    };
  }

  if (presetId === "contactdb") {
    const org = pick(row, ["이름/매체명", "org_name"]);
    if (!org) return null;
    const cat = pick(row, ["세그먼트", "category"]);
    const channelRaw = pick(row, ["채널유형", "channel_type"]).toLowerCase();
    const channel: ContactDraft["channel_type"] = channelRaw.includes("폼") || channelRaw.includes("form") ? "form" : channelRaw.includes("dm") ? "dm" : "email";
    const jur = normalizeJurisdiction(pick(row, ["관할권", "jurisdiction", "국가/지역"]));
    return {
      org_name: org,
      role_title: pick(row, ["역할/부서", "role_title"]) || null,
      country: pick(row, ["국가/지역", "country"]) || null,
      jurisdiction: jur.jurisdiction,
      kr_law_flag: jur.kr,
      email: channel === "email" ? normalizeEmail(pick(row, ["이메일/문의채널", "email"])) : null,
      contact_url: channel !== "email" ? pick(row, ["이메일/문의채널", "contact_url"]) || null : null,
      channel_type: channel,
      source_url: pick(row, ["출처URL", "출처 URL", "source_url"]) || null,
      collected_at: pick(row, ["수집일", "collected_at"]) || null,
      legal_basis: pick(row, ["법적근거", "legal_basis"]) || "문의용",
      segment_code: SEG_CONTACTDB[cat] ?? null,
      _category: cat || null,
    };
  }

  return null;
}
