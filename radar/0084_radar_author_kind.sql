-- 0084_radar_author_kind.sql — 개인 창작자 발굴 전환 (정본: HANDOFF-키워드레이더.md)
-- radar_items에 author_kind(individual|institution|unknown) 추가. 기본 피드는
-- institution(대형 매체/뉴스)을 숨기고 개인만 보여준다. 분류는 radar/common.py
-- classify_author (도메인 블록리스트 + 플랫폼 + 작성자 패턴).

alter table radar_items add column if not exists author_kind text not null default 'individual';
create index if not exists radar_items_kind_disc on radar_items(author_kind, discovered_at desc);
create index if not exists radar_items_kind_plat_pub on radar_items(author_kind, platform, published_at desc nulls last);
