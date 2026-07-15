/**
 * CRM shared types + label maps. Server + client safe (no imports).
 * Schema source of truth: supabase/migrations/0101_crm_core.sql.
 */

export type Stage =
  | "none" | "first_sent" | "followup" | "replied" | "negotiating"
  | "won" | "parked" | "unsubscribed" | "bounced";

// UI labels (Korean) — DB stores English codes (운영설계 §5 매핑).
export const STAGE_LABEL: Record<Stage, string> = {
  none: "미발송",
  first_sent: "1차발송",
  followup: "팔로업",
  replied: "응답",
  negotiating: "협상",
  won: "성사",
  parked: "보류",
  unsubscribed: "수신거부",
  bounced: "반송",
};

export const STAGE_TONE: Record<Stage, string> = {
  none: "#8fb3a0",
  first_sent: "#60a5fa",
  followup: "#a78bfa",
  replied: "#34d399",
  negotiating: "#fbbf24",
  won: "#22c55e",
  parked: "#94a3b8",
  unsubscribed: "#f87171",
  bounced: "#ef4444",
};

// Funnel display order.
export const FUNNEL_ORDER: Stage[] = [
  "none", "first_sent", "followup", "replied", "negotiating", "won", "parked", "unsubscribed", "bounced",
];

export type Jurisdiction = "EU" | "UK" | "US" | "CA" | "KR" | "OTHER";
export const JURISDICTIONS: Jurisdiction[] = ["EU", "UK", "US", "CA", "KR", "OTHER"];

export type OfferDepth = "deep" | "mid" | "light";
export const DEPTH_LABEL: Record<OfferDepth, string> = { deep: "깊은 결합", mid: "중간", light: "얕은" };
export const DEPTH_TONE: Record<OfferDepth, string> = { deep: "#34d399", mid: "#60a5fa", light: "#94a3b8" };

export const DRAFT_STATUS_LABEL: Record<string, string> = {
  proposed: "검토 대기",
  approved: "승인됨(Gmail 초안)",
  queued: "발송 대기",
  sent: "발송됨",
  rejected: "거부됨",
  failed: "실패",
};

export const INBOUND_CLASS_LABEL: Record<string, string> = {
  positive: "긍정",
  question: "질문",
  negative: "거절",
  unsubscribe: "수신거부",
  bounce: "반송",
  auto_ooo: "부재중 자동응답",
  unmatched: "미매칭",
};

// A jurisdiction that needs consent before a first cold send (§10-3).
export function needsConsent(jurisdiction: string | null, krFlag?: boolean): boolean {
  return jurisdiction === "KR" || jurisdiction === "CA" || !!krFlag;
}

// LIA evidence complete enough to allow draft creation (§10-4).
export function liaOk(row: { source_url?: string | null; collected_at?: string | null; legal_basis?: string | null }): boolean {
  return !!row.source_url && !!row.collected_at && !!row.legal_basis && row.legal_basis !== "기타";
}

export interface CrmSettings {
  daily_send_cap: number;
  weekly_send_cap: number;
  per_cron_send_cap: number;
  system_send_enabled: boolean;
  kr_window: { start: number; end: number; tz: string };
  followup_max: number;
  bounce_rate_threshold: number;
  bounce_rate_window: number;
  gmail_account: string | null;
  gmail_sync_cursor: string | null;
  gmail_token_error?: boolean;
  physical_address: string | null;
  lia_doc_path: string | null;
  unsubscribe_line: { en: string; ko: string };
}

export const DEFAULT_SETTINGS: CrmSettings = {
  daily_send_cap: 20,
  weekly_send_cap: 10,
  per_cron_send_cap: 5,
  system_send_enabled: false,
  kr_window: { start: 8, end: 21, tz: "Asia/Seoul" },
  followup_max: 2,
  bounce_rate_threshold: 0.05,
  bounce_rate_window: 50,
  gmail_account: null,
  gmail_sync_cursor: null,
  gmail_token_error: false,
  physical_address: null,
  lia_doc_path: null,
  unsubscribe_line: {
    en: 'If you prefer not to hear from us, just reply with "unsubscribe" and we will never email you again.',
    ko: '수신을 원치 않으시면 "수신거부"라고 회신해 주세요. 즉시 그리고 영구히 중단합니다.',
  },
};
