# PLAN — 연결(Connections) 시스템 총점검·재건

*작성 2026-07-04. 원우 문제제기("연결이 적절한가 / 너무 부분적이지 않은가 / 로직·시각화·SEO 업그레이드")에 대한 전면 실측 진단 + 제안.*
*자매 문서: PLAN-atlas-seo.md(지리 아틀라스 — 별개), PLAN-seo-surface-expansion.md(원칙 재사용).*

---

## ✅ 실행 로그 (2026-07-04 저녁 — 전 Phase 완료, 원우 전체 승인 하에 실행)

| Phase | 결과 | 검증 |
|---|---|---|
| **0. 소생** | film_affinities **46,440행** 재건(RRF: 트롭 TF-IDF + film_taste_vector KNN top-30, 필름당 24). 재실행 파이프라인 = `worker/mt-recommend.py`(재작성) → 청크 RPC 4종(`conn_*`). movies-like reasons `kind='figure_type'`+`/trope/` 링크 수정. `map_ego` random() 제거(결정론). | 라이브: movies-like 24필름+이유 렌더+**noindex 해제**, 필름 페이지 Connected films 8, /api/map films 'like' 엣지 7, map_ego 동일입력=동일출력 |
| **1. 개념 정본화** | `concept_map` 4,756행(exact 1,227 + embed≥0.70 3,529; 빌더 `worker/concept-embed.py`, 캐시 `.concept_embed_cache.json`). 개념 조인 6함수(map_ego·map_overview·surprise_home·sm_concept_readings·concept_detail·home_v2_bundle) concept_map 경유로 기계 치환(마이그레이션 `concept_map_joins`). | 매칭 커버리지 **40%→62%**(9,789/15,830); 상위 개념 readings 147→159 등 |
| **2. 원장+counterpoint** | `entity_edges` 원장 신설. counterpoint = 같은 트롭 공유 + 트롭별 평균 독해벡터(`conn_film_trope_vec` 18,659행) 유사도 ≤0.45 쌍, 점수 (1−sim)·idf, 필름당 top-8 → **11,213엣지/1,872필름(97%)**. 읽기 RPC `film_counterpoints(slug,n)`. | 샘플: 화양연화↔가을소나타("끝에서만 명명되는 계절"), Idiocracy↔Wolfwalkers("The Grid Is The State Made Visible") |
| **3. Galaxy** | t-SNE(cosine, seed 42) 2D 좌표 `film_map_xy` 1,941 + KMeans 14클러스터 + 라벨(`film_map_clusters`: 장르쌍+대표트롭, RPC `galaxy_refresh_cluster_labels`). 빌더 `worker/galaxy-build.py`. API `/api/map/galaxy`(galaxy_json RPC, s-maxage 3600). UI `components/GalaxyMap.tsx`(캔버스, rAF 루프 없음—이벤트 드리븐) + /map 4번째 탭 "Galaxy"(`?m=galaxy` 딥링크). | 클러스터 분포 87~182 균형, 라벨 유의미("Crime · Thriller — Hopper's Lonely American Light") |
| **4. 산문+SEO** | 필름 페이지 **Counterpoints 섹션**(df-counterpoints, 탭 포함): 문장 안에 영화·트롭·양쪽 테이크(figure 페이지) 하이퍼링크, 전부 렌더 시 RPC 파생. Connected films 리드에 방법론 링크. movies-like 리드에 tropes·Counterpoints·methodology 인문장 링크. `/methodology#connections` "How connections are computed" 섹션 신설. | 트롭 페이지 Adjacent(trope_related n=9)는 기존재 확인 — 추가 불요 |

**원칙 준수 확인**: 모든 문장·수치는 DB에서 렌더 시점 파생(ISR 300~1800s) — 데이터가 바뀌면 페이지·문장·카운트 전부 자동 추종. 베이크된 산문 0.

**DB 위생**: 스테이징(conn_stage_*, conn_film_trope_vec) RLS 잠금(정책 없음=definer 전용), 재빌드 RPC는 service_role 전용, 공개 테이블(concept_map·entity_edges·film_map_xy·film_map_clusters)만 read 정책. 전 마이그레이션 레포 기록: `supabase/migrations/0034_connections_overhaul.sql`(색인) + `supabase/rpc/{conn_rebuild,map_ego,counterpoints,concept-surfaces}.sql`(정본 본문).

**재실행 절차**(데이터 갱신 후):
1. `python3 worker/mt-recommend.py` — film_affinities 재건 (트롭/테이크 변경 시)
2. `python3 worker/concept-embed.py` → 리포트 확인 → `--write 0.70` (새 개념 유입 시)
3. counterpoint 재빌드 — supabase/rpc/counterpoints.sql 주석의 2개 SQL 블록 실행
4. `python3 worker/galaxy-build.py` — 좌표+라벨 (분기 1회 정도; 좌표 전면 이동 = 새 판)

**후속 결정 4건 — 원우 위임으로 확정·실행 완료 (2026-07-04 밤)**:
1. **reading 허브 재출판: 안 함(확정)** — 트롭 개편으로 은퇴한 자산(5,818건, published 0). 그 역할(독해 수준 연결)은 counterpoint + concept_map이 대체. 재출판은 LLM 산문 5,818페이지 일괄 추가 = scaled-content 리스크만 큼. 데이터는 보존(삭제 안 함).
2. **film_next 미해결분: 백필 + 수요 큐(실행)** — tmdb_id가 카탈로그와 일치하는 3,577건 target_film_id 백필 → 내부 해결 **58%→79%**(13,423/17,095), Watch next 카드 3,577개가 외부 TMDB 링크→내부 링크로 전환. 잔여 3,672건은 `film_next_demand` 뷰(demanded_by 순 = 가장 많이 지목된 미보유 영화)로 인제스트 우선순위 큐 제공 — RUNBOOK-new-film-ingestion에서 `select * from film_next_demand order by demanded_by desc` 사용.
3. **Galaxy 라벨: 장르쌍 유지 + 중복만 3장르로 확장(실행)** — `galaxy_refresh_cluster_labels` 갱신(migration galaxy_labels_dedupe). 트롭 라벨은 호버 툴팁 유지.
4. **counterpoint /map 노출: 실행** — `map_film_ego`에 kind='counter' 엣지 top-4 추가(migration map_film_ego_counterpoints, 본문 supabase/rpc/map_film_ego.sql), EntityGraph 색(#E67E22) + films 모드 범례 "⇄ Counterpoint".

---

## 0. 실측 진단 (2026-07-04, DB 직접 조회 + 코드 전수 정찰)

### 0.1 연결 시스템 인벤토리 — 7계층이 세대별로 중첩

| 계층 | 규모 | 상태 |
|---|---|---|
| film_next / director_next (LLM watch-next, 이유 문장) | 17,095행/1,953필름 · 감독 1,019행 | 정상. 단 내부 해결(target_film_id) **58%**(9,846/17,095) |
| film_affinities (영화—영화 친족, TF-IDF) | **0행** | **사망** — §0.2 연쇄 장애의 진원 |
| figure_type_members (트롭 멤버십, sim 보유) | 19,186행 · 4,710트롭 · **1,932/1,935 visible 필름** | 건강 — 현재 연결의 실질 중추 |
| takes.concept → sm_concepts (아이디어 엣지) | 15,830건 중 **6,260 매칭(40%)** | exact 문자열 매칭(`name_l=lower(btrim())`)이라 60% 손실 |
| meta_take_edges | 19,765행, 전부 relation='similar'(≥0.68) | 단일 차원 |
| 임베딩 원본 (전부 text-embedding-3-small, 1536d) | figures 18,168(100%) · takes 73,478(100%) · tropes 35,508 · **film_taste_vector 1,941(visible 전수)** · director_embedding 873(전수) · theory_canon 2,587 | **커버리지 완벽한데 공개 표면에서 거의 미사용** |
| map_* / graph_* 에고 RPC (공동멤버십 조인) | 상한: figure 9 · figure당 트롭 2 · 트롭당 허브필름 2 · overview 상위 14필름 | "부분적" 체감의 구조적 원인 + `order by random()` 비결정성 |

### 0.2 죽은 연쇄 — 근본 원인은 하나

트롭 개편 때 데이터 모델이 `takes.meta_take_id`(43,426행 — 전부 **미출판** 허브 지목, kind='reading' published **0**) → `takes.trope_id`(19,590행)로 이행. 옛 컬럼을 읽는 엔진이 전부 조용히 죽음:

1. `worker/mt-recommend.py`(film_affinities 빌더)가 meta_take_id+published를 읽음 → 재실행해도 0쌍.
2. 영화 페이지 **"Connected films" 섹션**: 전 영화에서 빈 렌더 (`app/film/[slug]/page.tsx:110`).
3. **/movies-like/* 1,935페이지 전부 "0 similar films"** → recs≥3 게이트 미달 → 전량 noindex. **그런데 movies-like.xml 사이트맵은 1,935 URL을 광고 중** — "광고했는데 noindex" 신호가 GSC에 축적되는 음의 SEO 상태.
4. /map films 모드 'like'(임베딩 유사) 엣지: 범례에는 있으나 실제 **0개** (map_film_ego의 lik CTE가 film_affinities를 읽음).
5. `graph_film_neighbors` RPC: 항상 0행.
6. `graph_*_seed`의 reading 허브 브랜치: published reading 0으로 사망.
7. `figure_neighbors` RPC(임베딩 기반, 품질 좋음): 프론트 어디서도 안 부르는 고아.

### 0.3 반면 임베딩 신호 자체는 이미 우수 (직접 검증)

film_taste_vector cosine, In the Mood for Love 최근접:
`2046 0.897 · Summer Palace 0.895 · Days of Being Wild 0.891 · Comrades, Almost a Love Story 0.890 · Fallen Angels 0.890 · Spring in a Small Town 0.886 · Ashes of Time 0.884`
→ 왕가위 궤도 + 중화권 멜로 정전 + 계보적 조상(費穆)까지 정확. **이 신호가 현재 로그인 개인화(me_taste_neighbors)에만 쓰이고 공개 연결에는 미사용.**

### 0.4 거버넌스 리스크
- 벡터·맵·지오 RPC 본문(map_*, geo_*, ask_retrieve, trope_match_takes, bulk_set_embeddings…)이 **DB에만 존재, 레포 미버전**(마이그레이션 0033에서 정지).
- `.fuse_hidden*` 죽은 파일들이 app/·components/에 커밋돼 있음.
- `map_ego` 허브필름 `order by random()` → 렌더마다 그래프가 달라짐, 캐시 불가.

### 0.5 원우 문제제기에 대한 판정
- **"연결고리가 적절한가"** — 설계 방향(타입 있는 엣지 + 설명 가능한 이유)은 옳다. 문제는 로직이 아니라 **세대 분열**: 표면마다 다른(일부 죽은) 엔진을 읽는다.
- **"너무 부분적"** — 구조적으로 사실. 살아있는 엣지의 대부분이 '트롭 공유' 단일 축이고, 에고 그래프 상한이 미세하며, 전역 뷰(overview)는 상위 14필름 표본. 죽은 엣지 2종(like·reading) + 개념 60% 손실이 겹친 결과다.

---

## 1. 원칙 — "한 원장, 타입 있는 엣지, 설명 가능한 이유"

새 알고리즘 추가가 아니라 **통합**이 답이다. 모든 연결을 단일 물질화 원장으로 모으고, 모든 표면(페이지 섹션·그래프·SEO 산문)은 원장에서 읽기만 한다. 엣지는 반드시 (a) 타입, (b) 점수, (c) **사람이 읽을 이유**(components)를 갖는다 — 이유 문장이 메타테이크의 차별점이자 E-E-A-T 방어선.

## 2. Phase 0 — 죽은 연쇄 소생 (1~2일, 즉효 최대)

- `mt-recommend.py` 데이터 소스 교체: `takes.meta_take_id` → **`takes.trope_id`**(또는 figure_type_members 경유). TF-IDF 희소성 가중 로직(`mt_recommend_core.py`)은 그대로 유효.
- 점수를 하이브리드로: `score = 0.5·z(tfidf_shared_tropes) + 0.5·z(cosine(film_taste_vector))` — 이유(공유 트롭 id들)는 `shared_meta_take_ids` 컬럼 재사용(uuid[] 동일, 트롭도 meta_takes 행이므로 의미 정합).
- `/movies-like` 페이지의 reasons 조회 `kind='reading'` → `kind='figure_type'` 1줄 수정 (`app/movies-like/[slug]/page.tsx:41`).
- `map_ego`의 `order by random()` → 결정론 정렬(멤버십 sim desc, id asc)로 교체.
- **효과: 표면 4곳 동시 부활** — /movies-like 1,935페이지(게이트 자동 통과→index 회복), 영화 페이지 Connected films, /map films 'like' 엣지, graph_film_neighbors. 코드가 전부 기성이라 데이터만 꽂으면 됨.

## 3. Phase 1 — 아이디어 엣지 복구 (개념 정본화, 60%→90%+)

- `sm_concepts`(1,227행)에 embedding 컬럼 추가 + 임베딩(소규모=동기 원칙, 실시간 병렬, 비용 무시 가능).
- takes.concept 원문 10,797 변형을 정본에 **임베딩 최근접 매핑**(임계 ~0.75, 미달분은 미연결 유지) → `concept_map(raw_l, concept_id, sim)` 물질화.
- map_ego·영화 페이지의 아이디어 조인이 exact 매칭 대신 concept_map을 읽도록 교체.
- 부산물: /idea ↔ /concept 통합 결정(보류 중)의 매핑표 재료가 됨.

## 4. Phase 2 — 엣지 원장 통합 + 새 차원

- `entity_edges(src_type, src_id, dst_type, dst_id, kind, score, components jsonb, updated_at)` 물질화. kinds:
  - `kin` 임베딩 유사(film·director·figure) / `trope` 공유 트롭 / `idea` 공유 개념 / `next`·`recby` 편집 큐레이션 / `lineage` 리스트 동시수록 / `reading` (재출판 시) / **`counterpoint` 신규**.
- **counterpoint(대위) 엣지 — 메타테이크만 만들 수 있는 차원**: 같은 트롭을 공유하되 읽기 프레임워크가 상반된 필름 쌍. "형식은 친족, 의미는 대립" — 유사도 사이트들이 못 만드는, 이론 DB만의 연결. 구현: shared trope 쌍 중 takes.framework 계열이 상이+take 임베딩 원거리인 쌍 상위 추출.
- **시간·계보 축**: 연대 차 + film_lineage 동시수록 + film_next 방향성으로 `ancestors/descendants` 뷰(감독 페이지의 Who's Next가 이미 방향 그래프 — 영화에도 부여).
- 모든 RPC가 원장만 읽도록 재작성하면서 **본문을 레포에 수록**(supabase/migrations 재개) — §0.4 거버넌스 해소.
- 에고 그래프 상한 상향(figure 9→12, 트롭당 허브필름 2→4)은 원장화 후 비용이 싸짐(사전계산 조회).

## 5. Phase 3 — 시각화 업그레이드

- **에고 그래프(유지·수리)**: 죽은 엣지 복원 후 범례 진실화, 결정론 시드, 엣지 hover에 이유 문장("shares Doppelgänger · both read through Freud").
- **신규 Galaxy 모드(전역 뷰)**: film_taste_vector 1,935편을 **UMAP 2D 사전계산**(오프라인 파이썬 → `film_map_xy` 테이블) → /map 세 번째 모드. 캔버스 산점(포스터 썸네일 줌인) + 클러스터 자동 라벨(클러스터 지배 트롭/무브먼트) + 필름 딥링크. 좌표가 고정이라 캐시·URL 공유 가능 — 에고 그래프의 "부분성"을 전역 항공뷰로 보완. 1,935점이면 클라이언트 부담 없음.
- **강도 표기**: 숫자 대신 질적 밴드 3단("same blood / close kin / echoes") — "참인 표기만" 원칙과 일치, 유사도 수치의 과신 방지.
- 성능: 현 EntityGraph는 DOM 노드 + O(n²) 반발력 — 노드 수 늘리면 canvas 전환 검토.

## 6. Phase 4 — SEO·GEO 활용

- **최대 기회 = movies-like 부활 그 자체.** "movies like X"는 영화 검색 최상위 볼륨 패턴. 페이지·ItemList JSON-LD·게이트·사이트맵이 전부 기성 — Phase 0만으로 1,935페이지가 살아난다. 차별점은 이유 문장: "Both stage the doppelgänger trope — read here through Freud, there through Fei Mu." 어떤 유사영화 사이트에도 없는 층.
- **읽는 층 공식 재적용**(atlas 플랜 원칙): 그래프는 노는 층. 그 위에 서버 산문 리드 1~2문장 — 영화 페이지 Connected films에 "Nearest kin in Metatake's meaning-space: 2046 (same blood), Spring in a Small Town (ancestor)…".
- **connection fingerprint 산문**(결정론 생성, LLM 불요): "{title} shares 6 tropes with 43 films; closest kinship {X}; sharpest counterpoint {Y}." — AI 검색엔진(GEO)이 인용하기 좋은 자기완결 단문. 영화·감독·트롭 페이지 리드에.
- **허브 상호링크**: `trope_related` RPC(기성, 임베딩 기반) 표면화 — 트롭 페이지 하단 "Adjacent tropes" 서버 렌더.
- **/methodology에 "How connections are computed" 문단** — 임베딩+트롭+편집 큐레이션 3층 설명. "복제 불가 데이터" 증명(선언이 아니라 방법 공개로).
- 날짜 규율·JSON-LD·코호트는 PLAN-seo-surface-expansion 원칙 준수. movies-like.xml은 이미 광고 중이므로 별도 코호트 불요 — Phase 0 후 게이트가 자동으로 index 회복.

## 7. 원우 결정 필요

1. **reading 허브 재출판**(5,818건 존재, published 0) — 콘텐츠 판단. 재출판 시 reading 엣지·graph_seed 브랜치 자동 부활.
2. counterpoint 엣지의 노출 문구·톤(공격적 대비 vs 점잖은 "counterpoint").
3. film_next 미해결 42%(7,249건, 카탈로그 외부 지목): TMDB 매칭으로 신규 영화 편입 후보 큐로 쓸지.
4. Galaxy 모드 vs Atlas SEO Phase 1 착수 순서.

## 8. 검증 체크리스트 (Phase 0)

- [ ] `mt-recommend.py --dry`로 쌍 수 확인(예상 수만 쌍, 필름당 top-20)
- [ ] in-the-mood-for-love /movies-like: 왕가위 궤도 + 이유(트롭) 링크 렌더 확인
- [ ] 영화 페이지 Connected films 섹션 8건 렌더 + /map films 모드 'like' 엣지 출현
- [ ] recs≥3 필름의 robots가 index로 전환(라이브 감사는 캐시버스터 — memory 참조)
- [ ] map_ego 동일 입력 2회 호출 결과 동일(랜덤 제거 확인)
