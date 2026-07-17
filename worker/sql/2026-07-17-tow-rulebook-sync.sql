-- to.W rulebook ↔ surface sync (AI-credit overhaul, D2).
-- HANDOFF-AI집필크레딧-표기개편.md §6 calls this the pass's only DB follow-up: when the
-- letter's sign-off changes, curation.rule must change with it or the rulebook and the
-- page disagree. Two facts were stale here, not one — the sender (D2, today) and the
-- recipient (renamed to "WY. Heo" back in 46bd2b0, never propagated to the rulebook).
--
-- Data-only UPDATE of one text column; no DDL, no schema change. Safe to re-run.
-- Verify after: select value from curation.rule where key = 'comment.language';

update curation.rule
set value = 'rationale 언어 = 영어 단일본(to.W). 2026-07-11 개정: (a) 저점 정전작 canon 명명 회피=comment.lowscore, (b) optional 겸손 문구=comment.optional, (c) Fahrenheit 9/11 manual_override(popular_not_cinephile) 유지. '
  || '2026-07-17 개정(AI 집필 크레딧 개편 D2): 표면 편지 형식 = 수신 "to. WY. Heo"(시네필 입문자, 실존 인물 — 신원 상세 표기 금지), 발신 "from. Metatake AI Editorial" + 서명행 "directed by W. Yoon"(구: "from. W. Yoon"). '
  || '정본 3분할 서술: 발신 주체=데스크 · 판정 데이터=AI 산출 TakeScore · 문장 조립=규칙(LLM-0, 언어모델 미사용). /methodology/why-a-film-is-in-the-index와 동기 유지할 것. '
  || '호칭·서명은 여전히 DB 미포함(표면에서 렌더). W. Yoon=제원우(필명).'
where key = 'comment.language';
