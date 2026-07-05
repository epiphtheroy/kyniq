# HANDOFF — 트로프·피겨·아키타입 순위 표면 (ranked read-layer)

*2026-07-05~06 구축. 이 문서 하나로 콜드스타트 가능해야 한다. 릴리스 요약은 `lib/seo.ts` 릴리스 로그(2026-07-05/06 항목), 디자인 시대 스펙은 `metatake-trope-detail-handoff.md`(참고용 — 순위 표면 이전의 목업 스펙). 트로프 레이어 자체의 내력은 `figure-page-KEPT.md` §J.*

## 0. 무엇 (3줄)

1. **/trope/[slug]가 리스티클형 순위 페이지** — 멤버(그 트로프를 나르는 각 영화의 독해)를 라이브 코사인(take↔trope 임베딩)으로 랭킹. 순번·포스터·"% match" 배지·rationale 발췌문(영화별 고유 텍스트). 타이틀 `"{title} — N films that stage this trope, ranked"`(N은 라이브 카운트). ItemList+FAQPage JSON-LD, coherence % 스탯, Article에 editor(Person).
2. **피겨 페이지**: H1 아래 가시 질문 H2("What does X mean in {Film}?" — FAQ JSON-LD와 문구 1:1 공유, `leadQuestion` 변수) + Type 라인 편수("(in N films)") + **nearest-figures 섹션**(`figure_neighbors` RPC, 교차영화만, % 배지) + FAQ 2번 질문(top 트로프 공유 영화들). **/catalog/[seg]/[slug]**: 이중브랜드 타이틀 버그 수정, `"{label} — {kind}: N film examples, ranked"`, 순번+confidence %, kindred sim %, Byline/Provenance, CollectionPage(날짜+editor), FAQPage. **필름 페이지 Tropes 섹션**: 트로프별 `READING {take_title} →` 라인(그 영화 자신의 독해, 나르는 피겨로 링크).
3. 모든 %·순위·카운트는 **렌더 시점 DB 파생**(베이크 없음) — 트로프 재구축·신규 영화에 자동 반영. 로직 설명 앵커는 **/methodology#rankings**(모든 % 배지가 이리로 링크).

## 1. 파일맵

| 층 | 위치 |
|---|---|
| 페이지 | `app/trope/[slug]/page.tsx` · `app/film/[slug]/figure/[figureSlug]/page.tsx` · `app/catalog/[seg]/[slug]/page.tsx` · `app/film/[slug]/page.tsx`(Tropes 섹션 df-ttl 라인) · `app/methodology/page.tsx`(#rankings 섹션) |
| SQL 정본 (DB 함수와 반드시 동기) | `supabase/rpc/trope_members_ranked.sql` — 라이브 적용 2026-07-05(migration `trope_members_ranked`) |
| CSS | `app/globals.css` — `tp-mrow/tp-rank/tp-mthumb/tp-match/tp-mexc/tp-mh3/tp-in` · `fg-qh/fg-type__n/fg-nblist/fg-nb__in` · `cat-gloss/cat-mrank/cat-mconf/cat-pill__sim` · `df-ttl/df-ttl__lab/df-ttl__arr` |

## 2. 데이터·RPC (★ = 재발견 비용이 큰 함정)

- **`trope_members_ranked(p_slug, p_limit=200)`** — 멤버십은 `takes.trope_id`(연결엔진 불변식 1: `takes.meta_take_id` 절대 금지). 순위 = `1-(take.embedding <=> trope.embedding)` desc, 타이브레이크 film title→take id(결정론). 반환: take/figure/film 필드 + `match` real.
- ★ **`figure_type_members.sim`은 트로프별 상수**(=`meta_takes.cohesion` 복사, 4,710 트로프 전부 멤버별 분산 0) — 멤버 랭킹에 못 쓴다. **피겨 임베딩은 표면축**(트로프와 코사인 0.3~0.5, 같은 영화끼리 뭉침) — 역시 못 쓴다. **take(rationale) 임베딩이 의미축**(멤버 0.8+) — 이것이 정답.
- **`figure_neighbors(p_figure, k, min)`** — slug를 반환하지 않음 → `figures` `.in()` 2차 조회로 링크 해석. **같은 영화 이웃 필터 필수**(표면축 특성상 동일 영화 피겨가 상위 점령; Falconetti 사례 12중 7이 같은 영화). 피겨 페이지 nearest 섹션이 사용(p_k 12, p_min 0.5, 표시 8).
- `catalog_node_members`는 **원래 confidence desc 정렬** — 페이지는 순번+% 노출만 추가. `catalog_node_kindred`도 `sim`을 원래 반환(미노출이었음). 카탈로그 날짜는 `taxonomy_nodes.created_at/updated_at` 직접 select(공개 read RLS 있음).
- `meta_takes.cohesion` → 트로프 페이지 "coherence %" 스탯(/methodology#rankings 링크).
- ★ **출판된 reading 허브 = 0건**(연결엔진 핸드오프 §5 "재출판 안 함" 확정) → `trope_readings`/`meta_take_tropes` RPC는 **항상 0행**. 페이지에서 호출하지 말 것(2026-07-05 한 번 넣었다가 확인 후 제거).
- 필름 페이지 독해 라인: 기존 takes 조회에 `trope_id`만 추가(추가 쿼리 0), 트로프별 최강 take(strength desc→take id) 1건.

## 3. 불변식

1. **순위·%·카운트 하드코딩/베이크 금지** — 전부 렌더 파생. 트로프 개편(trope-build --reset)·신규 영화 후 이 표면은 자동 갱신(별도 재빌드 없음).
2. **`trope_members_ranked` 수정 시 `supabase/rpc/` 사본 동기** — 연결엔진 핸드오프 불변식 3과 동일 규약(레포가 정본).
3. **FAQPage 질문 = 가시 콘텐츠 1:1** — 피겨는 `leadQuestion` 변수를 H2와 JSON-LD가 공유, 트로프/카탈로그는 멤버 리스트·thesis가 가시 근거. 가시 콘텐츠 없는 FAQ 추가 금지(리치결과 요건).
4. **결정론 정렬 유지**(`order by random()` 금지) — 같은 입력=같은 페이지=캐시 가능.
5. **타이틀 패턴**: 헤드텀 먼저 + 라이브 카운트 + (n≥4일 때만) ", ranked". 브랜드는 루트 템플릿(`%s · Metatake`)이 붙임 — **페이지 타이틀에 `| Metatake` 재도입 금지**(카탈로그 이중브랜드 버그를 2026-07-05 수정했음).
6. ISR 규약 유지: `revalidate = 300` + `generateStaticParams(){return[]}` (엣지 캐시 패턴).

## 4. 상황별 절차

- **트로프 개편 후** → 이 표면은 할 일 없음(라이브 파생). 연결엔진 a+b 재실행은 별도(그쪽 핸드오프 §4).
- **새 영화 인제스트 후** → 할 일 없음(멤버·순위·이웃·카운트 자동).
- **% 로직을 바꿀 때** → `/methodology#rankings` 문구도 함께 수정(사용자 대면 약속문).
- **`seo_phrase` 백필 시**(현재 4,710 트로프 전부 빈 값) → 트로프 타이틀이 `"{phrase} — N films, ranked"`로 자동 전환(코드 이미 대응, `generateMetadata` phrase 분기).

## 5. 남은 결정·확장 여지

- **seo_phrase 4,710건 백필** — 질문형/헤드텀형 문구 생성 배치(Message Batches). 타이틀 CTR 개선 여지 가장 큰 항목.
- 트로프 **"The Pair"**(목업 스펙 §5.2, ONE READING TWO FILMS) 미구현 — 필요 시 `trope_members_ranked` 상위 2로 즉시 구현 가능.
- 아키타입(카탈로그)엔 take가 없어 "독해 제목" 라인이 구조상 없음(정상 — 아키타입은 피겨 분류, 트로프는 take 묶음).
- 사이트맵/코호트는 이번 작업과 무관(온페이지만) — 코호트 리뷰는 7/16 규칙 그대로(`docs/HANDOFF-SEO-마스터.md`).
