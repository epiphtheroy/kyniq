# HANDOFF — 임베딩 판타지아 · SQL 문장층 (정본)

**이 문서가 문장층(film_sentences)과 Embedding Fantasia 표면 전체의 단일 정본 인수인계다.**
작성 2026-07-09~11 (설계→대량생산→표면 전개 전 과정), 전부 프로덕션 라이브·검증 완료.
운영 세부(재생성 SQL·게이트)는 `sentence-engine/MASS-PRODUCTION.md`, 실행 로그(Phase 1~1.8)는 `docs/WORKORDER-sentence-surfaces.md`. **문장층/판타지아 세션은 이 문서에서 시작.**

---

## 0. 한 줄 정의

**LLM 없이 Postgres `format()`만으로** 카탈로그 전체에서 46만+ 개의 사실 문장을 생성해 두고(전 값 엔티티 FK), 그것을 **"Embedding Fantasia"**라는 브랜드로 사이트 전역(엔티티 페이지 7종·티커 2곳·/map 레일·그래프 가중치)에 렌더하는 층. 목적: **쿼리 없이는 아무도 알 수 없는 영화 간 연결을 문장으로 명시화**해 환기(engagement)와 SEO 내부링크 메시를 동시에 얻는다.

## 1. DB 자산 (kyniq `jvgarcqrtsmgfimdcwgo`, 전부 RLS on + public read)

| 자산 | 규모 | 역할 |
|---|---|---|
| `film_sentences` | **466,974행 · 13패턴 · 6,713편(96%)** | 문장 본체. 모든 언급 값이 엔티티 컬럼: `other_film_id`·`meta_take_ids[]`·`figure_id`·`take_id`·`theorist_id`·`location_id`·`lineage_list_id` + `theorist_name/concept/framework` 텍스트키 + `nums` jsonb + `kin`·`salience` |
| `film_kinship` | 27,593쌍 | **kin 지수 0~100** = cos·40 + tfidf·25 + 공유노드 희귀도·35. 죽은 `film_affinities.score` 대체. 그래프 엣지 가중·연관 랭킹용 |
| `sentence_node_stats` | 4,689 | 해석노드별 카탈로그 팬아웃(희귀도) |
| `sentence_concept_stats` | 7,801 | (이론가,개념)별 팬아웃 + 최초 보유 영화 |

**13패턴**: A_affinity·B_bridge·C_reading·D_award·E_rank·F_compare·G_theorist_twin·H_dense·I_lens_twin·J_location·L_trope·M_frame·**N_question**(질문 훅 12,419). K_counterpoint는 테이블 부재로 미구현.

**RPC 5종** (전부 함수레벨 `set statement_timeout='8s'` — anon 기본 3s 우회):
- `film_sentences_for(slug, limit, patterns, per_pattern)` — film 페이지 풀(48행/패턴6). ⚠️ 0066에서 구 3-인자 시그니처 DROP됨
- `sentences_for_entity(type, key, key2, limit)` — 엔티티별 언급 문장(앵커 영화 포함). 타입: film·director·theorist·trope/idea·figure·lineage·genre (+take는 사문)
- `sentences_ticker(n)` — UTC 시간시드 결정론 샘플(패턴 9종+N_question)
- `sentences_sample(patterns, n)` — /map 뷰별 샘플러(시간시드·salience≥15·패턴당 9)
- `map_film_ego` / `map_film_overview` — like 엣지에 `w`=kin. ⚠️ overview는 0-인자 레거시 오버로드 존재: 제로인자 SQL 호출 모호, API는 named 3인자라 안전. **오버로드 추가 금지**

## 2. 표면 지도 (어디에 무엇이 렌더되나)

| 표면 | 컴포넌트 | 내용 |
|---|---|---|
| `/film/[slug]` df-know 섹션+탭 (양 분기) | `FilmSentences.tsx` (SSR) | Embedding Fantasia 모듈: 주제 필 8종 네비, 48행 풀 전체가 HTML에(SEO), 링크 칩 |
| director·theorist·trope·figure·lineage·genre 페이지 | `EntityFantasia.tsx` + `EntityFantasiaServer.tsx`(fail-soft) | 동일 모듈, 행마다 앵커 영화 칩, selfHref 자기참조 제외. director는 탭도 등록 |
| 홈(manifesto)·/room 대시보드 | `SentenceTicker.tsx` | 재난방송 띠(마퀴+reduced-motion/모바일 로테이터, hover 정지, CLS 0) |
| film df-map 우측 + /map 4뷰 우측 | `SentenceLexicon.tsx` (+`ConnectionDesk.tsx`) | 아틀라스풍 회전 레일(4셀·3.4s 스태거), **모든 엔티티명=리센터 버튼**, ‹/⌂/↗. /map 오버뷰는 뷰별 샘플(films=A/B/H·directors=F/E·grouped=C/G/I/L/M·galaxy=E/D/J), 노드 다이브 시 엔티티 중심 |
| /map Films 그래프 | `EntityGraph.tsx` | like 엣지 굵기 = kin (ego+overview) |
| API | `/api/sentences/{for,ticker,entity,sample}` | s-maxage 캐시, tv/reel 패턴 준수 |

**주제 8종 명명(개념 고정)**: Kinships(A/H/B) · Readings(C) · Twin Lenses(G/I) · Tropes & Frames(L/M) · The Record(D/E) · Filmography(F) · Locations(J) · Questions(N).

## 3. 불변식 (위반 금지)

1. **LLM 0 · random() 0.** 문장은 100% SQL `format()` 무편집. 회전·샘플은 전부 md5(UTC시간) 시드 결정론(엣지캐시 보호).
2. **v1 사실형 = 정본** (원우 2026-07-11). v2 WOW 수사체는 참조 문서일 뿐. 문체 변경 금지.
3. **브랜드 계약**: 모듈 키커의 설계자 명기(`a data fantasia by Wonwoo Yoon`)와 **"Not AI-written … independent of the filmmakers' intent" 디스클레이머는 계약의 일부 — 제거 금지.** 레일·푸터에도 반복.
4. **제목 선두(앵커링)** — 모든 문장은 대상 영화 제목(또는 소유격)으로 시작.
5. `takes.status='published'` 게이트 (retired 46,503 누출 금지).
6. 링크는 `lib/urls.ts` 헬퍼만 (lineageUrl 포함). 문장 본문 내 substring 링크화 금지(칩 방식 유지).
7. 로더는 에러 throw(unstable_cache null-포이즌 방지); EntityFantasiaServer만 페이지 보호용 fail-soft null.

## 4. 함정 장부 (재작업 시 필독)

- **MCP execute_sql 타임아웃 ≠ 롤백**: 커밋된 적도, 롤백된 적도 있음 — 반드시 count로 확인.
- **대형 셀프조인**(G/I급 13만행): unlogged 스크래치 물질화+인덱스 후 `film_id::text` hex 버킷(<'8','8'-'c','≥c') 분할.
- **create-or-replace 오버로드**: 인자 추가 시 구 시그니처 DROP 필수(0066에서 실행). map_film_overview 0-인자 레거시 잔존.
- **s-끝 제목 소유격** 이중 적용 버그(E에서 수정) · **"top 0%"→1%** 후처리 · 라벨 끝 마침표 **`.’` 스트립 2~3회 반복**.
- **dfk-\* CSS는 globals.css** (film 전용 read.css에 두면 다른 페이지에서 안 먹음 — 이관 완료).
- **미들웨어 blocklist fetch는 1.5s abort 유지** (무타임아웃이면 사이트 전역 산발 504 — 2026-07-11 실사고·수리).
- 워처는 app/components/lib만 스테이징: **supabase/migrations·docs·루트 파일은 수동 커밋**. 리베이스 autostash가 워처 이벤트를 삼킬 수 있음 — 푸시 후 `git status` 확인.
- H_dense는 평점 있는 영화만 · B 글로스 rtrim('.') · film/figure 중심 풀은 앵커 고정이라 per-anchor 캡 해제(0064b).

## 5. 신규 영화 인제스트 접점 (멱등)

새 영화가 파이프라인을 통과한 뒤 이 순서로 재실행(전부 `ON CONFLICT` 멱등, SQL은 MASS-PRODUCTION.md):
① `sentence_node_stats` upsert → ② `sentence_concept_stats` upsert → ③ `film_kinship` upsert → ④ 13패턴 INSERT(신규분만 들어감). 문장 원본이 삭제되면 FK CASCADE로 자동 소거; 제목 변경 등 텍스트 드리프트는 패턴 delete 후 재INSERT.

## 6. 확정 종결 장부 (재검토 불필요 — 중복작업 방지)

| 항목 | 판정 | 근거(실측) |
|---|---|---|
| concept 페이지 판타지아 | **불가** | takes.concept 자유텍스트 vs 레지스트리 매칭 8/7,733 |
| frame 페이지 판타지아 | **불가** | frames 테이블=질문 프레임층, SM 14 아님(SM 키는 lib/frameworks.ts에만) |
| /take 페이지 복원 | **OBSOLETE** | published reading 노드 0개 = 은퇴 구모델 라우트(클러스터 take 43,426 전원 retired). "재건 금지" 원칙. 정보가치는 A/B/H·G/I가 대체. 0067 take 분기는 사문 |
| MapExplorer 캡션(구 보류) | **대체 종결** | SentenceLexicon 레일이 상위 호환 |
| K_counterpoint 패턴 | 미구현 | counterpoint 테이블 실존하지 않음(메모리 기록과 불일치 — 생기면 추가) |

## 7. 파킹된 아이디어 (Tier 2 — 지시 있을 때만)

OG 공유카드 훅 문장 · Surprise 21번째 모드 · TV lower-third 자막(ffmpeg 대기) · 모서리 빼꼼 애니메이션(비추천 판정) · v2 WOW 수사체 활용.

## 8. 마이그레이션·파일 맵

**마이그레이션(전부 적용+커밋)**: `supabase/migrations/0061_sentence_engine.sql`(테이블 4종+RLS) · `0062_sentence_rpcs.sql` · `0063_map_kin_weights.sql` · `0064_sentence_entity_lookup.sql`(+GIN·부분 인덱스) · `0065_sentences_sample.sql` · `0066_film_sentences_for_topics.sql`(구 시그니처 DROP) · `0067_sentence_entity_take_fix.sql`(사문+take_id 인덱스) · `0068_overview_kin_and_hub_branches.sql` · `0069_n_question_pattern.sql`(DML 마커).

**컴포넌트**: FilmSentences · EntityFantasia · EntityFantasiaServer · SentenceTicker · SentenceLexicon · ConnectionDesk · GraphCaptions(현재 미사용, 보존) · EntityGraph(w 굵기) · EntityMap(onCenter 콜백).
**lib**: fantasia.ts(로더) · urls.ts(+lineageUrl).
**API**: app/api/sentences/{for,ticker,entity,sample}/route.ts.
**번들 문서**: `sentence-engine/README.md`(엔진 진입점) · `MASS-PRODUCTION.md`(운영 정본) · 템플릿 EN/KR · WOW v2(참조).
**미들웨어**: middleware.ts blocklist fetch 1.5s abort(루트 파일).
