# HANDOFF — 통합 검색 엔진 (Unified Search: 어휘 + 시맨틱 하이브리드)

*2026-07-06 구축. 이 문서 하나로 콜드스타트 가능해야 한다. 설계 배경·8앵글 코드리뷰 이력은 이 문서 §7, RPC 정본 SQL은 `supabase/migrations/0040_search_v3.sql` + `0041_search_v3_fixes.sql`(레포가 정본 — 라이브 전용 RPC 아님). 인덱스 빌드 운영요령은 auto-memory `pgvector-hnsw-build-ops`.*

## 0. 이게 무엇인가 (3줄)

1. 사이트의 모든 검색(전역 `/search`, 내비 타이프어헤드, 전역 ⌘K 팔레트, 홈 히어로, 맵 검색)은 **단일 엔진 `lib/search.ts` → `/api/search`** 하나만 쓴다. 이전의 4계통 파편화(`search_site`·`film_search`·`map_search`·`readings_suggest` + raw `.ilike`)는 은퇴.
2. 엔진은 3레그 **병렬 실행 후 RRF 융합**: ① 어휘 `search_all`(12종 엔티티, Tier-2 포함) ② 시맨틱 `search_semantic`(질의를 OpenAI text-embedding-3-small로 임베딩 → pgvector 6레그) ③ 로컬(아틀라스 도시·국가·장르 인메모리). 시맨틱이 이 사이트의 무기 — 27,000개 비평문을 **의미로** 검색하고 **한국어 질의로 영어 콘텐츠**를 찾는다(교차언어).
3. 결과는 `SearchHit` 계약(`lib/search-shared.ts`) 하나로 통일 — 전 표면이 `hit.href`(사전계산)로 이동하고 `match`(`text`/`meaning`/`both`) 배지, `is_catalog`(Tier-2) 칩을 공유.

## 1. 파일맵 (검색 서브시스템 = 이 파일들. 여기 없으면 검색과 무관)

| 층 | 위치 | 역할 |
|---|---|---|
| **SQL 정본** (DB 함수와 반드시 동기) | `supabase/migrations/0040_search_v3.sql` | `search_all`·`search_semantic`·`film_search` v2 생성, trgm 인덱스 |
| | `supabase/migrations/0041_search_v3_fixes.sql` | 리뷰 수정: 시맨틱 필름 레그 stub 제외·`films.director` trgm 인덱스·RPC grants |
| **공유 계약** (isomorphic, 무의존) | `lib/search-shared.ts` | `SearchKind`·`SearchHit` 타입, `KIND_LABEL`, `tmdbUrl()` — **라벨/타입 단일 출처** |
| **엔진** (서버) | `lib/search.ts` | `runSearch()`: 3레그 병렬 + RRF 융합 + 적응형 시맨틱 하한 + 질의단위 캐시(10분) + `hrefOf()` |
| **클라이언트 훅** | `lib/useSearch.ts` | `useSearchTypeahead()`: 2단계(lex→hybrid) 점진 페치, req-id 가드, abort, IME 안전 |
| **HTTP 엔드포인트** | `app/api/search/route.ts` | 전 표면 공용. `?q=&limit=&mode=hybrid|lex&kinds=`; 엣지 캐시 s-maxage=300; IP 레이트리밋(240/분, 키캡 5000) |
| **표면 — 전역 결과** | `app/search/page.tsx` | SSR 발견 페이지: 포스터 카드·인물 행·리딩 썸네일·meaning 배지·"Search deeper" 세일즈 밴드·제로결과 코칭 |
| **표면 — 타이프어헤드** | `components/SearchBox.tsx` | 내비/히어로 공용 드롭다운 + `SearchHitRow`(공유 행 컴포넌트) |
| **표면 — 홈 히어로** | `components/home2/BigSearch.tsx` | 홈 라이브 타이프어헤드 (히어로 승격 후보) |
| **표면 — 전역 팔레트** | `components/GlobalCmdK.tsx` | ⌘K/Ctrl+K 사이트 전역(`/room` 제외); 페이지 바로가기·최근검색·Ask/See-all 액션 |
| **표면 — 맵** | `components/MapExplorer.tsx` | `/api/search?mode=lex&kinds=film,director,trope,idea,theorist,figure` → jumpTo 재중심 |
| **마운트** | `app/layout.tsx` | `<GlobalCmdK/>` 전역 마운트 |
| **내비 트리거** | `components/home2/Nav.tsx` | 검색폼 → 팔레트 트리거(`metatake:cmdk` 이벤트) + `<noscript>` GET 폴백; IA 편입(Movements·Methodology) |
| **소비자 (패치됨)** | `components/room/CmdK.tsx`·`QuickRate.tsx`·`WriteWorkspace.tsx` | `film_search` v2가 Tier-2 반환 → **is_catalog 필터 필수**(불변식 §3.1) |
| | `components/FilmMap.tsx` | 아틀라스 필름 타이프어헤드(`film_search`); 무핀 카탈로그 무반응은 미해결 TODO §8 |
| **Tier-2 아웃링크** | `app/film/[slug]/page.tsx` | 카탈로그(minimal) 브랜치에 "Explore from here"(감독·장르·유사검색) |
| **CSS** | `app/globals.css` | `.srp-*`(결과 페이지)·`.sb-*`(타이프어헤드) 블록. masthead 죽은 CSS ~180줄 제거 |
| | `app/home2.css` | `.navsearch--cmdk`·`.megasearch` |
| **삭제됨** | ~~`app/api/map/search/route.ts`~~ ~~`components/Header.tsx`~~ ~~`components/Masthead.tsx`~~ ~~`components/UserMenu.tsx`~~ | 데드코드 |

## 2. DB 객체 (읽기 전 이것만 알면 됨)

- **`search_all(p_q text, p_limit int)`** — 어휘. 12 UNION 브랜치: film(제목+`original_title`+감독, Tier-2 0.8 감점)·director·trope·reading·figure·theorist·idea·tradition·lineage·movement·archetype. `pg_trgm` 유사도 + prefix 부스트. 반환행 `score>0.12`. ~200ms.
- **`search_semantic(p_qvec text, p_limit int)`** — 시맨틱. `p_qvec`는 API 레이어가 임베딩한 `[...]` 문자열, 내부 `::vector(1536)` 캐스팅. 6레그(takes 리딩·meta_takes 트로프·film_taste_vector·director_embedding·theory_canon·taxonomy_nodes) cosine. `score>0.15`. **HNSW 인덱스 후 웜 130ms**(콜드 2.5s).
- **`film_search(p_q, p_limit)` v2** — 반환에 `is_catalog` 추가, `original_title` 매칭, Tier-2 포함. **호출부 4곳**(room CmdK/QuickRate/WriteWorkspace, FilmMap)이 이 시그니처에 의존.
- **인덱스**: `idx_takes_pub_emb_hnsw`(부분 HNSW, `where status='published' and embedding is not null` — 풀테이블 빌드는 메모리 초과, `pgvector-hnsw-build-ops` 참조) · `idx_films_original_title_trgm` · `idx_takes_take_title_trgm` · `idx_films_director_trgm`.
- **잔존(드롭 안 함, UI 미사용)**: `map_search` RPC(맵이 /api/search로 이동), `search_site` v2 RPC(search_all로 대체), `idx_takes_emb_ivf`(published 외 행용 IVFFlat 유지). 정리는 안전하나 급하지 않음.
- **확장**: `vector` 0.8.0(pgvector), `pg_trgm`, `unaccent`(설치됨·미사용), `pgroonga`(설치 가능·미설치 — 콘텐츠 영어+다국어 임베딩으로 현재 불필요).

## 3. 불변식 (어기면 조용히 죽는다)

1. **`film_search`는 이제 Tier-2 카탈로그를 반환한다(is_catalog).** room 표면(CmdK·QuickRate·WriteWorkspace)은 **반드시 `is_catalog !== true` 필터** — 무점수 카탈로그 274편은 `/room/film/{slug}`에서 404난다. (film_search v2 배포 시 실제 회귀했던 버그.)
2. **시맨틱 하한선은 어휘(RPC) 결과 수에만 게이트한다.** 로컬(도시·장르) 히트는 카운트 금지 — 안 그러면 "몸의 공포"가 도시명을 스쳐 strict 0.35가 걸려 교차언어 폴백(0.27)이 죽는다. 상수는 `lib/search.ts` `SEM_FLOOR_STRICT/FALLBACK`, **SQL에 세 번째 floor 0.15** 별도 존재. **EMBED_MODEL 바꾸면 셋 다 재측정**(코사인 분포가 이동한다).
3. **kinds 필터는 limit truncate *전에* 적용**(`runSearch` 내 `shape()`). 캐시는 **질의 단위**(FUSE_MAX=120 풀 저장, 호출자별 limit/kinds는 사후 shaping) — 내비(9)·팔레트(10)·`/search`(60)가 한 번의 임베딩+RPC를 공유.
4. **모든 검색 keydown 핸들러에 IME 가드**(`e.nativeEvent.isComposing || e.keyCode === 229`) — 없으면 한글 조합 확정 Enter가 팔레트/드롭다운을 오작동시킨다(한국어를 셀링포인트로 내세우는 기능에 치명).
5. **`film_slug` 컬럼은 kind별로 의미가 다르다**: figure/reading=부모 필름, archetype=taxonomy kind(`nodeHref` 매핑용), city=국가 slug. 절대 일률적 필름 참조로 쓰지 말 것 — **항상 `hit.href`(사전계산) 사용**.
6. **SQL 정본은 레포다**(0040/0041). 옛 map_search·search_site처럼 라이브 전용으로 두지 말 것. DB 함수 수정 시 마이그레이션 파일 동기.
7. **HNSW 부분 인덱스는 쿼리 WHERE가 인덱스 술어를 함의해야 사용된다** — search_semantic/ask_retrieve 모두 `status='published'` 포함 필수.

## 4. 상황별 절차

- **새 엔티티 종류 추가** → ① `search_all`+`search_semantic`에 UNION 브랜치(0040/0041 재적용) ② `lib/search-shared.ts`에 `SearchKind`+`KIND_LABEL` ③ `lib/search.ts` `hrefOf()`에 라우팅. 세 곳 전부 안 하면 타입/렌더 불일치.
- **임베딩 모델 교체** → 불변식 §2의 3개 floor 재측정 + HNSW 재빌드(`pgvector-hnsw-build-ops`).
- **새 영화 배치 후** → 어휘(search_all)는 자동 반영. 시맨틱은 `film_taste_vector`/`takes.embedding` 필요 — 기존 파이프라인 `worker/mt-embed.py`가 채움(별도 재빌드 불필요).
- **검색이 이상해 보일 때** → ISR/엣지 캐시 함정 먼저(s-maxage=300 + 인프로세스 10분, 캐시버스터로 확인) → RPC 행수 직접 확인 → 시맨틱이면 HNSW 인덱스 유효성(`pg_stat_user_indexes`).
- **레이트리밋 429** → `/api/search`는 IP당 240/분(2단계 타이프어헤드가 키스트로크당 2요청). dev/사내 NAT 공유 IP 주의.

## 5. 데이터 규모 (2026-07-06 실측)

films 6,975(visible 1,935 / Tier-2 카탈로그 5,040) · takes 73,478(published 26,975, **전량 임베딩**) · figures 18,168 · meta_takes 11,974 · directors 862 · theorists 1,840 · sm_concepts 1,227 · theory_canon 2,587 · taxonomy_nodes 2,928 · 아틀라스 도시 511/국가 73 · lineage 리스트 398 · film_taste_vector 1,941 · director_embedding 873.

## 6. 검증 상태 (2026-07-06 라이브)

타입체크(변경 파일 0오류)·프로덕션 빌드·라이브 E2E(metatake.net) 통과: `parasite`(정확일치 1위)·`몸의 공포`(교차언어 meaning 매칭)·`the ethics of watching`(개념 both-매칭)·`paris`(장소→아틀라스)·`/search` SSR(포스터·배지·밴드·한국어 칩)·`/map`·웜 레이턴시 142ms. 커밋 `6805d85`(구현) + `8573797`(리뷰 수정).

## 7. 8앵글 코드리뷰 결과 (17건 발견 / 13건 수정 / 4건 보류)

수정 완료: IME 가드(4표면)·room Tier-2 404·kinds truncate 순서·팔레트 무한 스피너+중복 로직(useSearchTypeahead로 통합)·레이트리미터 메모리 누수·질의단위 캐시·하이브리드 게이팅(len≥4 +320ms, mid-word 임베딩 낭비 제거)·맵 stale-response 가드·시맨틱 stub 제외·director trgm 인덱스·라벨/이미지URL/slugify 중복 제거·no-JS 폴백.

## 8. 남은 결정·TODO (중복작업 방지 — 여기 없는 건 안 한 것)

- **`/concept` ↔ `/idea` 통합** — 보류. `/concept`이 사이트맵 인덱싱 정본, `/idea`는 noindex. 리다이렉트하면 SEO 깨짐. **원우 결정 필요**(어느 쪽을 정본으로).
- **`embed()` 3중화** — `lib/search.ts`·`app/api/ask/route.ts`·`app/api/readings/route.ts`에 동일 OpenAI 임베딩 POST. 모델 교체 시 3곳 동기 필요 → `lib/search.ts` `embedQuery` 하나로 통합 권고(라이브 ask/readings 라우트 건드리므로 후속).
- **아틀라스 무핀 카탈로그** — `FilmMap` 타이프어헤드가 위치 없는 Tier-2를 고르면 무반응. 빈 상태 메시지 필요.
- **BigSearch 드롭다운 셸** — SearchBox와 열림/키보드 로직 중복(SearchHitRow는 공유). 후속 dedupe 여지.
- **홈 히어로 승격** — BigSearch가 이미 같은 엔진 라이브 타이프어헤드 보유. 히어로 승격은 레이아웃 작업만 남음(원우 관심사항).
- **잔존 RPC/인덱스 정리** — map_search·search_site v2 RPC, idx_takes_emb_ivf 드롭 가능(안전하나 급하지 않음).
