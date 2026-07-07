-- figure 페이지 검색어 정렬 레이어 (2026-07-06)
-- seo_question: 검색 문형 질문 (title/H1용), seo_short_label: 반복 헤딩용 축약 표시명
-- 생성: outputs/figure_seo 파이프라인 (Opus 4.8 batch), 본문 콘텐츠 불변, NULL이면 기존 label 폴백
alter table public.figures
  add column if not exists seo_question text,
  add column if not exists seo_short_label text;
