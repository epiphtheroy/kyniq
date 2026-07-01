# Strong Misreading — 신규 최상단 카테고리 기획

작성: 2026-06-23 · 대상 리포지토리: `metatake` (Next.js App Router + Supabase)

---

## 0. 한 문장 요약

`takes.framework`에 이미 존재하는 **14개 프레임워크**를, 기존 `/tropes`(허브) + `/trope/[slug]`(태그 페이지) 패턴을 변형해
**1개 평면 그리드 허브 + 13~14개 태그 페이지**로 노출한다. 각 태그 페이지의 핵심은
**정보가 꽉 찬 목록 + 전문(키워드/퍼지) 검색 + 유사(의미) 검색**이며, 두 검색 인프라는 이미 DB에 깔려 있다.

---

## 1. 지금 코드베이스에 이미 있는 것 (맨바닥이 아님)

| 필요한 것 | 이미 있는 자산 | 위치 |
|---|---|---|
| 14개 세부 태그 정의 | `FRAMEWORKS` (13 + INVITATION), 5개 family, 라벨·한줄설명·색상 | `lib/frameworks.ts` |
| "카테고리 허브" UI 패턴 | `IndexPattern` (featured + 카탈로그 + 필터 + 정렬) | `components/IndexPattern.tsx` |
| "태그 페이지" UI 패턴 | `/trope/[slug]` (헤더+스탯+그래프+검색 목록) | `app/trope/[slug]/page.tsx` |
| 페이지 내 즉시 검색(클라) | `ListFilter` | `components/ListFilter.tsx` |
| **전문 검색**(키워드+오타허용) | `pg_trgm` GIN 인덱스 + `search_site` RPC | `supabase/migrations/0019_site_search.sql` |
| **유사 검색**(의미) | `takes.embedding vector(1536)` + IVFFlat/HNSW 코사인 | `0013_metatake.sql`, `build-takes-hnsw.sql` |
| 데이터(읽을거리) | published `takes` ≈ 18,000개, 각 take = figure→film, framework, rationale | `takes` 테이블 |
| 상단 네비 | `MetatakeNav` | `components/MetatakeNav.tsx` |
| 그래프 맵 | `EntityGraphLoader` | `components/EntityGraphLoader.tsx` |

핵심: **신규 기능은 사실상 "기존 RPC 2개 변형 + 페이지 2종 추가"** 수준이다. 검색 백엔드(전문/유사)는 새로 만들 필요가 거의 없다.

---

## 2. 데이터 구조 (기획의 토대)

```
films ──< figures ──< takes
                         ├─ framework  (14개 키 중 하나, 예: "PSYCHOANALYTIC")
                         ├─ take_title (그 영화가 얻어낸 한 줄짜리 대담한 독해)
                         ├─ rationale  (본문 — 미리보기로 보여줄 내용)
                         ├─ embedding  (vector 1536 — 유사검색용)
                         └─ status='published'
```

- 한 태그 페이지 = `WHERE takes.framework = '<KEY>'`로 묶인 readings의 목록.
- 평균 규모: 18,000 / 14 ≈ **태그당 약 1,200개** → 목록만으로는 못 훑는다 → **검색·정렬·필터가 필수**(사용자 요구와 정확히 일치).

---

## 3. 13개? 14개? — INVITATION 처리 권고

`INVITATION`은 "주제/렌즈"가 아니라 **모든 영화 페이지에 붙는 스포일러 없는 입구(lead)**다. 성격이 다르다.

**권고:** 그리드에는 **13개 주제 프레임워크**만 카드로 노출하고, `INVITATION`은
허브 상단의 "여기서 시작하세요(스포일러 없는 입구)" 특별 항목 1개로 분리하거나 그리드에서 제외한다.
→ 결과적으로 사용자가 말한 "13개(14개?)"의 답: **13개 태그 페이지 + INVITATION(별도 취급) = 14**.

---

## 4. 정보구조(IA) · 라우팅

기존 컨벤션(`/tropes` 복수형 허브, `/trope/[slug]` 단수형 페이지)을 그대로 따른다.

| 화면 | 라우트 | 비고 |
|---|---|---|
| 허브(카테고리 랜딩) | `/strong-misreadings` | 14개 평면 그리드 |
| 태그 페이지 | `/strong-misreading/[slug]` | slug = framework 키의 kebab (예: `psychoanalytic`, `phenomenon-noumenon`) |

- 더 짧은 대안: 허브 `/lenses`, 태그 `/lens/[slug]`. 길이·SEO 취향 문제이므로 결정만 하면 됨. (본 기획은 `/strong-misreadings` 기준.)
- **상단 네비 최상단 추가:** `MetatakeNav`에서 brand 바로 다음, `Chat` 앞에 `Strong Misreadings` 항목을 넣는다.

```tsx
// MetatakeNav.tsx — nav 첫 항목으로
{item("strong", "/strong-misreadings", "Strong Misreadings")}
```

active 타입 유니온에 `"strong"` 추가.

---

## 5. 허브 페이지 `/strong-misreadings` (14개 평면 그리드)

목적: "내가 관심 있는 렌즈 하나"로 빠르게 진입.

구성(위→아래):
1. **H1 + 정의 한 단락** — `app/about/page.tsx`의 Strong Misreading 매니페스토에서 발췌·압축.
2. **(선택) 전역 검색창** — 모든 readings를 전문/유사로 검색해 결과로 점프. 메인 요구는 페이지별 검색이므로 허브 검색은 옵션.
3. **14개 카드 평면 그리드** — `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))` (미디어쿼리 없이 반응형).
   - 카드 내용: **프레임워크 라벨** · 한 줄 설명(`short`) · **readings 수 / films 수** · family 라벨(작은 칩) · 좌측 4px 컬러바(`frameworks.ts`의 family 색).
   - family로 *그룹핑하진 않되* 색으로 한눈에 군집이 보이게(평면 + 색 신호).
   - 클릭 → 태그 페이지.

데이터: 신규 RPC `frameworks_catalogue()` 하나 — framework별 `{key, n_readings, n_films}` 집계(아래 7장).

> 구현 노트: `IndexPattern`을 그대로 써도 되지만, 항목이 14개로 고정·소수라 **전용 그리드가 더 단순·명확**하다. (IndexPattern은 수백 개 카탈로그용.)

---

## 6. 태그 페이지 `/strong-misreading/[slug]` — 핵심 화면

설계 원칙(사용자 요구 직역): **"목록이 나오되 정보가 최대한 많이, 전문 검색 + 유사 검색."**

### 6.1 레이아웃 (위→아래)

1. **브레드크럼**: `Strong Misreadings ›`
2. **헤더 블록**
   - 좌측 컬러바(family 색) + 프레임워크 라벨(대제목, PT Serif)
   - family 칩(예: "Mind, ethics & politics") + 한 줄 설명(`short`)
   - 2~3문장 "이 렌즈가 하는 일" 짧은 해설(에디토리얼 최소량 — 목록 중심 유지)
   - **스탯 바**: `N readings · M films · K directors`
3. **이중 검색 바 (이 페이지의 심장)** — 6.2 참조
4. **정렬·필터 컨트롤** — 6.3 참조
5. **정보 풍부한 목록(rows)** — 6.4 참조
6. **페이지네이션 / 무한스크롤** (태그당 ~1,200개)
7. **관련 렌즈(같은 family의 형제 프레임워크)** 카드 — 교차 이동
8. (선택) **그래프 맵** — `EntityGraphLoader` 재사용. 목록 중심이면 접어두기(toggle).

### 6.2 이중 검색 바 — 전문 + 유사

하나의 입력창 + **2-모드 토글**:

| 모드 | 라벨(제안) | 동작 | 백엔드 |
|---|---|---|---|
| 전문 | **"정확히 일치"** | 키워드·구절·오타허용. 제목/본문/영화명/figure 라벨에서 일치 | `pg_trgm` ILIKE/`%` (기존 `search_site` 방식 재사용) |
| 유사 | **"비슷한 의미"** | 키워드가 안 겹쳐도 *의미가 가까운* readings | `embedding <=> query_embedding` 코사인 (이 framework로 스코프) |

- **기본값: 하이브리드** (전문 결과 우선 + 유사 결과 보강, RRF/가중합으로 병합). 토글로 한 모드 고정 가능.
- 각 결과 행에 **매칭 이유** 배지: "제목 일치" / "본문 일치" / "의미 유사 0.86".
- 빈 검색 = 기본 목록(정렬 기준대로 전체).
- 즉시성: 첫 화면에 로드된 행은 `ListFilter`로 클라이언트 즉시 필터, 더 깊은 검색은 서버 RPC.

### 6.3 정렬 · 필터

- **정렬**: 영화 제목 A–Z / 개봉연도 / 감독 / confidence / 최신.
- **필터**: 십년대(decade) · 장르(`meta_takes.genres` 또는 film 장르) · 감독.
- 컨트롤은 헤더 바로 아래 한 줄(칩/드롭다운). 모바일에선 접이식.

### 6.4 정보 풍부한 행(row) — "정보 최대한 많이"

각 행이 담는 것(클릭 → figure/take 상세):

- **읽기 제목**(`take_title`) — 그 영화가 얻어낸 대담한 독해(굵게)
- **무엇을(figure)** + **어느 영화**(제목·연도) + **감독**
- **본문 미리보기**(`rationale` 1~2줄 발췌) ← "내용도 어느 정도 본다"는 요구 충족
- **프레임워크 칩**(family 색) · confidence/maturity · 출처(있으면)
- (선택) 영화 포스터 썸네일
- **인라인 펼치기**: 행 클릭 시 그 자리에서 rationale 전체를 펼쳐 페이지 이탈 없이 읽기(아코디언). "여기서 보기 쉽다"는 느낌의 핵심.

> 밀도 옵션 2단계 제공 권장: **Comfortable**(미리보기 2줄 + 썸네일) / **Compact**(제목+영화만 한 줄). 토글로 전환.

---

## 7. 데이터 · RPC 설계 (Supabase)

신규 RPC 4개 + 인덱스 1세트. 모두 기존 패턴(`security definer`, `anon/authenticated` grant) 답습.

### 7.1 인덱스 (전문 검색 가속) — 신규 마이그레이션
```sql
-- takes 본문/제목 트라이그램 인덱스 (전문/퍼지 검색용)
create index if not exists idx_takes_title_trgm     on public.takes using gin (take_title gin_trgm_ops);
create index if not exists idx_takes_rationale_trgm on public.takes using gin (rationale  gin_trgm_ops);
-- framework 필터 가속
create index if not exists idx_takes_framework      on public.takes (framework) where status='published';
-- 유사검색: takes.embedding HNSW 는 build-takes-hnsw.sql 로 이미 준비됨
```

### 7.2 `frameworks_catalogue()` — 허브 카드용 집계
```sql
-- framework별 readings 수 / 고유 film 수
returns table(framework text, n_readings int, n_films int)
  select t.framework,
         count(*)::int,
         count(distinct f.film_id)::int
  from takes t join figures f on f.id=t.figure_id
  where t.status='published' and t.framework is not null
  group by t.framework;
```
(라벨·색·family·slug 는 프런트의 `frameworks.ts`와 조인.)

### 7.3 `framework_readings(p_framework, p_sort, p_limit, p_offset, ...filters)` — 기본 목록
- `WHERE t.framework = p_framework AND t.status='published'`
- 반환: take_id, take_title, rationale_snippet, figure(label, slug), film(title, slug, year), director, confidence.
- 정렬·페이지네이션 파라미터화.

### 7.4 `framework_search_text(p_framework, p_q, p_limit)` — 전문 검색
- `search_site`의 trgm 점수 로직을 **takes로 확장**하고 framework로 스코프.
- `take_title % p_q OR rationale ILIKE '%q%' OR film.title ILIKE ... OR figure.label ILIKE ...`
- `score = greatest(similarity(take_title), 0.6*similarity(rationale), ...)`, `score > 0.08` 정렬.

### 7.5 `framework_search_semantic(p_framework, p_embedding vector(1536), p_limit)` — 유사 검색
```sql
select ..., 1 - (t.embedding <=> p_embedding) as sim
from takes t join figures f on f.id=t.figure_id ...
where t.framework = p_framework and t.status='published' and t.embedding is not null
order by t.embedding <=> p_embedding
limit p_limit;
```
- **쿼리 임베딩**은 서버에서 생성(기존 `/ask` 파이프라인의 임베딩 호출 재사용 — `ask_retrieve` 참고).
- HNSW + framework 필터로 충분히 빠름(수십 ms).

### 7.6 하이브리드
- 전문·유사 결과를 RRF(Reciprocal Rank Fusion) 또는 가중합으로 병합. `ask_retrieve`가 이미 유사 검색을 수행하므로 그 병합 로직을 참고/재사용.

---

## 8. 재사용 컴포넌트 매핑

| 새 화면 요소 | 재사용 | 신규/수정 |
|---|---|---|
| 상단 네비 항목 | `MetatakeNav` | `"strong"` 항목·타입 추가(소규모) |
| 허브 그리드 | (신규) `FrameworkGrid` | 작게 신규 — 또는 `IndexPattern` 전용 variant |
| 페이지 내 즉시 필터 | `ListFilter` | 그대로 |
| 검색 입력+모드토글 | `SearchBox` 확장 | 듀얼 모드 prop 추가 |
| 행/카드 스타일 | `.tp-mlist`, `.idx-*` 클래스 | 재사용 + `sm-` 프리픽스 신규 약간 |
| 그래프 맵 | `EntityGraphLoader` | 그대로(선택) |
| 액션(핀/공유) | `EntityActions` | 그대로 |
| SEO/robots | `lib/seo.ts` `pageRobots` | 그대로 |

---

## 9. SEO / 접근성

- 두 페이지 모두 **인덱싱 허용**(콘텐츠 풍부 → thin-content 아님). `pageRobots(true)`.
- 허브: `schema.org` `CollectionPage` + `ItemList`(14개). 태그: `CollectionPage` + breadcrumb + 대표 readings `ItemList`.
- 태그 페이지 메타: `"<라벨> — N readings across M films"`, description = 렌즈 한줄 해설.
- 키보드: 검색창 포커스 단축키, 행 펼치기 Enter/Space, 모드 토글 탭 이동.
- 모바일 우선(디자인시스템 v4): 그리드는 `auto-fit minmax`, 폰트는 `--fs-*`, 거터는 `--wrap-x`.

---

## 10. 구현 단계 (체크리스트)

- **Phase 0 — 데이터/인덱스**: 7.1 마이그레이션 적용, `takes.embedding` 채워짐 확인, HNSW 유효성 확인.
- **Phase 1 — RPC**: `frameworks_catalogue`, `framework_readings`, `framework_search_text`, `framework_search_semantic`(+하이브리드). SQL Editor로 배포·grant.
- **Phase 2 — 허브**: `/strong-misreadings` 페이지 + `MetatakeNav` 최상단 항목 + 카드 그리드.
- **Phase 3 — 태그 페이지**: `/strong-misreading/[slug]` — 헤더·스탯·**이중 검색**·정렬/필터·정보 풍부 목록·페이지네이션·인라인 펼치기.
- **Phase 4 — 교차링크/SEO**: 관련 렌즈, schema.org, sitemap(`app/sitemap.ts`)에 14개 추가, about 매니페스토에서 링크.
- **Phase 5 — QA**: 360/600/900/1180 반응형, 빈 검색·오타·유사검색 정확도, 대용량(1,200행) 성능, 빈 framework 가드.

---

## 11. 결정이 필요한 미결정 사항

1. **라우트 네이밍**: `/strong-misreadings` + `/strong-misreading/[slug]` vs 짧은 `/lenses` + `/lens/[slug]`.
2. **INVITATION**: 그리드 제외(권고) vs 14번째 카드로 포함.
3. **검색 기본 모드**: 하이브리드(권고) vs 전문 기본·유사 토글.
4. **그래프 맵**: 태그 페이지에 포함(접이식) vs 제외(순수 목록).
5. **행 밀도 기본값**: Comfortable(미리보기+썸네일, 권고) vs Compact.

---

## 부록 A — 14개 프레임워크 (`lib/frameworks.ts`)

| family | 프레임워크 | 한 줄 |
|---|---|---|
| Reading from within | Phenomenon → Noumenon | 표면 디테일에서 그것이 누설하는 사물 자체로 |
| Reading from within | Noumenon | 영화가 은밀히 실재로 여기는 숨은 존재론 |
| Reading from within | Signifier → Signified | 기호를, 그것이 나르는 의미로 읽기 |
| Reading from within | Enigma | 풀리길 거부하는 디테일을 단서로 |
| Form, making & context | Process | 만들어진 방식을 의미로 |
| Form, making & context | Location | 실제 장소, 그곳에서 찍는다는 것 |
| Form, making & context | Context | 그것을 빚은 제작 환경 |
| Form, making & context | Metacritic | 그 수용사, 그리고 그것이 된 논쟁 |
| Mind, ethics & politics | Psychoanalytic | 욕망·억압·영화의 무의식 |
| Mind, ethics & politics | Ethical–Philosophical | 그것이 거는 도덕·철학적 내기 |
| Mind, ethics & politics | Ethico-Political | 그것이 드러내는 정치적 판돈 |
| Existential parallels | Persona Parallel | 한 인물을 실재 인물 곁에 |
| Existential parallels | Juxtaposition | 영화를, 결코 호명하지 않는 실제 삶 곁에 |
| Title & invitation | Title | 제목을, 그것이 숨긴 뉘앙스로 |
| (입구/별도) | Invitation | 스포일러 없는 입구 |
