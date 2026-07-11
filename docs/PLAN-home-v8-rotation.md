# PLAN — 홈 v8 "살아있는 진열장" (시드 로테이션 · TakeScore 카드 · Daily Exhibits)

**상태: 기획 확정, 실행 대기 (2026-07-11).** 이 문서는 실행 담당 AI를 위한 완결 사양서다.
여기 적힌 결정은 오너(원우)가 확정한 것이므로 재논의 없이 그대로 구현한다. 모호한 지점이
남으면 §12의 기본값을 따른다. 코드 사실관계(파일·라인·RPC·컬럼)는 2026-07-11에 라이브
코드/DB에서 직접 검증했다.

---

## 0. 배경과 문제 진단 (검증된 사실)

- 홈(`app/page.tsx`, 72줄)은 단일 RPC **`home_v2_bundle_v2()`** 결과를 `unstable_cache`
  (key `home-v2-bundle-v2`, tag `home-v2`, revalidate 3600)로 캐시해 렌더한다.
- **문제 1 — 프리징**: 내부 `home_v2_bundle()`의 모든 섹션이 결정론적 정렬이다
  (`order by fs.total_score desc`, `created_at desc`, `tc.films desc`, `sc.n desc` … + 고정
  `limit 36/30/16`). 난수·시드가 전혀 없어 **매시간 캐시가 갱신돼도 항상 같은 행**이 온다.
  → 사용자가 "매번 같은 영화" 라고 느끼는 원인. (DB 라이브 함수 정의에서 확인.)
- **문제 2 — 점수 부재**: `components/home2/FilmCard.tsx`는 포스터·제목·연도·감독·카테고리
  지표만 보여준다. TakeScore 포스터-오버레이 배지는 2026-07-05 사이트 전역에서 철거됐다
  (연결엔진 재건 때). **이번 요구는 오버레이 부활이 아니라 카드 하단 텍스트 라인**이다.
- **문제 3 — 콘텐츠 미반영**: 홈 v7 이후 보강된 층(리셉션 연대기, 미스리딩 기사층, curious
  질문, 아틀라스 표면, TakeScore 공개 페이지, counterpoint, Now Playing/Daily)이 홈에
  "예시로" 노출되지 않는다.
- 상단우측 내비에 `Ask metatake AI` 버튼(`components/home2/Nav.tsx` `.npro`)이 있다 — 제거 대상.
- 히어로 "Surprise me"(`HeroSurprise` → 공유 `SurpriseStage`, RPC `surprise_home` 20모드)는
  **구조 변경 금지**(오너 지시 "그대로 두겠습니다").

## 1. 목표 (이 순서가 우선순위다)

1. **재방문 다양성**: 같은 방문자가 다른 시간/다른 날 홈을 열면 **대부분의 카드가 다른
   영화**여야 한다(측정 가능: 시드가 시간당/일당 바뀌므로 구조적으로 보장).
2. **첫 방문 후킹**: 첫 화면에서 "이 사이트는 살아있고, 깊다"는 인상 — Surprise 클릭 유도
   + 아래로 스크롤할수록 서로 다른 종류의 콘텐츠가 계속 나오는 리듬.
3. **점수의 편재**: 홈의 모든 영화 카드 하단에 TakeScore™가 보인다 → 사이트 고유 자산의
   상시 노출 + `/takescore/film/*`로의 내부 링크 밀도 상승(SEO).
4. **콘텐츠 층 샘플링**: "오늘의 ○○" 패턴으로 각 층(질문·장소·리셉션 반전·미스리딩·
   counterpoint)을 매일 1개씩 진열 — 층 전체를 다 보여주는 게 아니라 **미끼 하나씩**.

**비목표(하지 말 것)**: Surprise 히어로 구조 변경, Essential Ten(top3/top10) 로테이션
(정전 성격이라 고정이 정체성), 서버 HTML 개인화(불변식), /ask-ai 라우트 삭제(버튼만 제거),
LLM 호출 추가(전부 LLM-0 조립).

## 2. 설계 원칙 (불변식 — 위반 시 회귀)

- **P1. 엣지캐시 호환 결정론**: 홈 SSR HTML은 캐시 엔트리당 결정론이어야 한다. 난수는
  ① 서버=시드 파라미터(캐시 키에 포함), ② 클라이언트=hydration 이후 `useEffect`에서만.
  렌더 중 `Math.random()` 금지(hydration mismatch).
- **P2. 서버 HTML 개인화 금지** (마이필름 렌즈 불변식 — 홈은 전원 공통 HTML).
- **P3. TakeScore 표기 규칙** (Now v3.1과 동일): 공개 점수 = **U** (`Math.round(card.u)`,
  `/takescore/film/[slug]`의 헤드라인 숫자와 동일 소스). **랭크 표기 금지**(홈 카드에선
  top-1000이어도 생략 — 공간·단순성). 어휘는 `lib/takescore_prose.ts`의
  `verdictSentence`/`BAND_WORDS` 계열만 재사용(복제 금지). 브랜딩 `Tm`(카드) /
  `TakeScore™`(풀네임 쓸 자리).
- **P4. cinecodex_card 루프 금지**: 다건 점수는 SQL 조인(`cinecodex.scores`) 또는
  `lib/takescore-bulk.ts`(`cinecodex_ranked` 페이지드)로만. N+1 RPC = DB 다운 전례.
- **P5. LLM-0**: 새 표면 전부 기존 데이터 조립. 문장 생성 없음.
- **P6. 기존 v2 RPC/캐시 보존**: v3는 **신규 함수**로 추가, `app/page.tsx`에서 스위치.
  롤백 = page.tsx 한 줄 되돌리기.

## 3. 아키텍처 — 3층 로테이션

```
[서버 · 시간 시드]  home_v2_bundle_v3(p_seed) — 레일 풀을 md5(seed||slug) 순서로 샘플
                    seed = to_char(now() at time zone 'utc','YYYYMMDDHH24') → 매시 다른 진열
                    unstable_cache 키에 seed 포함, tag 'home-v2' 유지, revalidate 3600
[서버 · 일 시드]    home_daily_exhibits(p_seed) — "Today at Metatake" 6타일
                    seed = YYYYMMDD → 하루 동안 고정(오늘의 ○○ 정체성, 공유 가능)
[클라이언트 · 방문 시드] 각 레일 시작 오프셋을 hydration 후 무작위 회전
                    → 같은 캐시 시간대라도 방문마다 첫 화면 카드가 다름
```

왜 이 구조인가: 홈은 미들웨어 스킵 + 엣지캐시가 성능 생명선(콜드 3s→0.2s 이력)이라
per-request 서버 난수는 불가. 시드를 캐시 키로 승격하면 "캐시 친화적 난수"가 된다.
시간 시드(레일)와 일 시드(오늘의 ○○)를 분리해 "지금 살아있음"과 "오늘의 큐레이션"
두 리듬을 다 얻는다.

## 4. 사양 A — `home_v2_bundle_v3(p_seed text)` (마이그레이션 0070)

**신규 SQL 함수.** v2를 감싸지 말고 v2의 섹션별 쿼리를 복제·수정해 독립 정의한다
(v2는 무수정 보존). `STABLE SECURITY DEFINER, set search_path=public, statement_timeout 30s`.
출력 = **v2와 동일 jsonb 형태의 상위집합**(기존 컴포넌트 무수정 호환) + 추가 필드.

### 4.1 시드 샘플링 패턴 (전 섹션 공통)

```sql
-- 기존:  order by <score> desc limit 36
-- 변경:  후보풀 상위 POOL_N을 <score>로 자른 뒤, md5(p_seed||slug)로 36장 샘플
with pool as (
  select ... from ... order by <기존 정렬> limit POOL_N        -- 품질 게이트 유지
)
select ... from pool order by md5(p_seed || slug) limit 36     -- 시드 셔플
```
`setseed()/random()`은 STABLE sql 함수에서 불가·비결정 — **반드시 md5 해시 정렬**.
같은 시드=같은 결과(캐시 정합), 시드 바뀌면 전체 재배열.

### 4.2 섹션별 POOL_N과 게이트

| 섹션 (jsonb 키) | 기존 | v3 후보풀 POOL_N | 게이트(유지+추가) |
|---|---|---|---|
| `picks` | shared desc 36 | **150** | visible, poster not null |
| `newly` | created_at desc 36 | **90일 윈도 전체**(상한 200) | 〃 |
| `canon` | lists desc 36 | **200** | lists ≥ 2 |
| `rhyme` | 고정 seed 영화 | **seed 영화 자체도 로테이션**: kin(친족) 상위 60편 중 md5(p_seed) 1편 → 그 영화의 rhyme 36 | seed는 is_analyzed |
| `concepts` | n desc 30 | **60** | backdrop not null 우선 |
| `tropes` | films desc 16 | **40** | 〃 |
| `lens.byFramework[*]` | reads desc 36 | 프레임워크별 **80** | 〃 |
| `directors` (카드) | (기존 정렬) | **80** | 이미지 있는 감독 우선 |
| `auteurs` | 〃 | **80** | 〃 |
| `directorSpots` | 고정 소수 | 상위 **40**명 중 md5로 **6**명 | readings ≥ 임계 |
| `top3`/`top10` | rnk 고정 | **변경 금지** (Essential Ten = 정전, §1 비목표) |
| `hero` | rnk 고정 | 그대로 (HeroSurprise가 대체해 미사용) |
| `stats`/`blog`/`graph`/`pairs` | — | 그대로 |

### 4.3 카드에 TakeScore 주입 (전 영화 행 공통)

모든 film-shape 행(`picks/newly/canon/rhyme/lens/hero`)에 3필드 추가:
```sql
'ts',  round(s.u),          -- 공개 TakeScore (U) — null이면 키 자체 생략 가능
'tsv', round(s.v),
'tsr', round(s.r)
-- from left join cinecodex.scores s on s.film_id = f.id
```
SECURITY DEFINER라 `cinecodex.scores` 직접 조인 가능(같은 패턴의 기존 함수
`cinecodex_ranked`가 선례). **left join** — 미채점(Tier-2 274편)은 null → 카드에서 미표기.
`tsv/tsr`는 클라이언트가 `verdictSentence` 쿼드런트 단어(hiV≥72, loR≤20)를 **기존 lib로
계산**하기 위한 원료다(SQL에 어휘 복제 금지 — 단일 소스 원칙).

### 4.4 배포 함정

- **create-or-replace 오버로드 함정**: 인자 시그니처가 다른 동명 함수가 남으면 PostgREST
  모호성 에러. v3는 신규 이름이라 안전하지만, 수정 반복 시 `drop function if exists
  public.home_v2_bundle_v3(text);` 후 재생성.
- 마이그레이션 번호 **0070** (현재 최신 0069, 0068 중복 존재 — 번호 충돌 주의).
- 적용 경로: Supabase MCP `apply_migration` 또는 `apply-sql.py`(sbp_ 토큰, 오너 `!` 실행).
  적용 후 `select home_v2_bundle_v3('2026071100')`으로 스모크(아래 §10 체크리스트).

## 5. 사양 B — `app/page.tsx` 스위치

```ts
// 시드: UTC 시간 단위 → 매시 새 진열. 캐시 키에 시드 포함이 핵심.
const seed = new Date().toISOString().slice(0, 13).replace(/[-T]/g, ""); // "2026071114"
const getCached = unstable_cache(
  () => fetchBundle(seed),
  ["home-v2-bundle-v3", seed],          // ← 시드가 키에 들어가야 시간별 엔트리 분리
  { revalidate: 3600, tags: ["home-v2"] }
);
```
- `fetchBundle`은 `rpc("home_v2_bundle_v3", { p_seed: seed })`로 교체. **기존 3-회 재시도 +
  빈결과 throw(null-포이즌 방지) 가드 그대로 유지** — 이 가드는 실전 사고의 산물이다.
- `unstable_cache`를 모듈 스코프 상수로 두면 시드가 고정되므로 **요청 핸들러 안에서
  시드 계산 후 키 배열에 넣어 생성**하는 팩토리 패턴으로. (Next Data Cache는 키 배열로
  엔트리를 분리하므로 시간당 1회만 RPC가 실제 호출된다.)
- 롤백: RPC 이름과 키만 v2로 되돌리면 끝.

## 6. 사양 C — FilmCard 점수 라인

`lib/home2.ts`의 `Film` 타입에 `ts?: number|null; tsv?: number|null; tsr?: number|null;` 추가.
`components/home2/FilmCard.tsx`의 `.rateline`(현재 카테고리 지표 + ☆)에 점수 칩 추가:

```
[Tm 67]  ← 클릭 시 /takescore/film/{slug}
```
- 표기: `Tm {ts}` (오너 확정 브랜딩 "Tm 느낌"). `ts == null`이면 렌더 안 함.
- `title` 속성(hover)에 쿼드런트 문구: `TakeScore™ {ts} — {quadrant}` — quadrant는
  `tsv/tsr`로 계산(`tsv>=72 && tsr<=20`→"a safe masterpiece", `tsv>=72`→"ambitious but
  divisive", `tsr<=20`→"a stable choice", 그 외 "approach with care"). 헬퍼는
  `components/home2/helpers.ts`에 5줄짜리 `tsQuadrant(v,r)`로 추가(임계값은
  `lib/takescore_prose.ts`와 동일해야 하며 주석으로 상호 참조 명시).
- **랭크·서브차원 표기 금지**(P3). 스타일: 기존 `.catnum`과 동급의 작은 모노스페이스 칩,
  금색 계열 강조는 과하지 않게(카드당 1개 포인트 컬러 원칙).
- FilmCard를 쓰는 모든 레일(Picked/Newly/Canon/Rhyme/LensRail/Fill)에 자동 적용됨 —
  개별 컴포넌트 수정 불필요(데이터만 흐르면 됨).

## 7. 사양 D — "Today at Metatake" 데일리 전시 밴드 (신규 섹션)

**위치**: `HomeV2.tsx`에서 `<NowPlaying />` 바로 아래, `<Picked />` 위. (뉴스[지금] →
오늘[큐레이션] → 상설[레일] 순서의 서사.)

**신규 RPC `home_daily_exhibits(p_seed text)`** (같은 0070 마이그레이션에 포함, 단일행
jsonb 반환 — PostgREST 1000행 캡 무관). 6종 타일, 각각 md5(p_seed||…) 1건:

| # | kind | 소스(전부 기존 테이블) | 타일 내용 | 링크 |
|---|---|---|---|---|
| 1 | `film` 오늘의 영화 | films (is_analyzed, poster, scores 있음) 상위 800 풀 | 포스터+제목+연도+감독+`Tm U`+피겨 라벨 1줄 | `/film/{slug}` |
| 2 | `question` 오늘의 질문 | questions (spoiler_level≠'major') | display_title | `/film/{fslug}/q/{qslug}` |
| 3 | `place` 오늘의 장소 | film_locations(+films) 정밀도 상위 | 장소명 + "in {film}" | `/film/atlas/{fslug}` |
| 4 | `reversal` 오늘의 재평가 | film_reception — 같은 영화에 review_year 격차 ≥5년인 쌍 | "{y1} {verdict1요약} → {y2}" 2칩 | `/film/{fslug}/reception` |
| 5 | `misreading` 오늘의 강한 오독 | 미스리딩 적격 영화(기사층 게이트와 동일 소스) | 트로프/프레임워크 라벨 | `/film/{fslug}/misreadings` |
| 6 | `counterpoint` 오늘의 반론 쌍 | v2 `pairs`와 동일 소스(트로프 1개·상반 독해 2편) | 두 포스터 + 트로프명 | `/trope/{slug}` |

- 각 kind의 풀이 비면 **타일 생략**(밴드는 4~6타일 가변). jsonb 빈 판정은
  `jsonb_typeof(x)='null'` 함정 주의.
- **신규 컴포넌트 `components/home2/TodayExhibits.tsx`** — 서버에서 받은 6타일을 한 줄
  가로 레일(모바일 스크롤)로. 각 타일에 kind 라벨("Film of the day" 등 영문)과 날짜 표기
  1회("Today · July 11"). 스타일은 홈 v7 기존 톤(라이트, .tp 계열)과 통일.
- 데이터 페치: `app/page.tsx`에서 두 번째 RPC로 병렬 호출, 일 시드
  `new Date().toISOString().slice(0,10).replace(/-/g,"")`, 캐시 키
  `["home-exhibits", daySeed]`, revalidate 3600, tag `home-v2`(같은 태그로 강제 갱신 동승).
- **오늘의 영화 타일이 밴드의 앵커**(2배 폭). 6타일 순서 고정: film → reversal →
  question → place → misreading → counterpoint.

## 8. 사양 E — 클라이언트 방문별 다양성 (hydration-safe)

- 신규 훅 `useVisitOffset(poolLen: number)`: `useState(0)` + `useEffect`에서
  `setOffset(Math.floor(Math.random()*poolLen))` — **SSR HTML은 offset 0으로 결정론**,
  hydration 후 회전. 레일 배열을 `pool.slice(off).concat(pool.slice(0,off))`로 재배열.
- 적용 대상: Picked, Newly, Canon, LensRail(현재 탭 내 배열), ConceptsRail, AuteursRow.
  Rhyme은 seed 서사가 있으니 제외. TodayExhibits 제외(오늘의 ○○는 순서 고정).
- 회전은 첫 페인트 직후 발생하므로 깜빡임 최소화를 위해 **레일 컨테이너의 scroll 위치
  이동이 아니라 배열 재배열**로 구현(트랜지션 없음, 리플로우 1회).

## 9. 사양 F — 내비 정리 + Surprise 첫방문 어포던스

- **제거**: `components/home2/Nav.tsx`
  - `navright`의 `.npro` 블록(`<Link className="npro" href="/ask-ai">…Ask metatake AI…</Link>`) 삭제.
  - "You" 드롭다운의 `{ t: "Ask metatake AI", h: "/ask-ai" }` 항목 삭제.
  - `/ask-ai` 라우트·BigSearch 칩·GlobalCmdK 항목은 **유지**(오너 범위 지정: 최상단 우측만).
  - `.npro` CSS가 고아가 되면 정리(선택).
- **Surprise 첫방문 어포던스 (P2, 구조 불변)**: `HeroSurprise` 내부 CTA에
  localStorage `mt_home_seen` 없을 때만 ① 버튼 pulse 애니메이션(2회 후 정지, CSS
  `prefers-reduced-motion` 존중) ② 버튼 옆 마이크로카피 1줄 "6,701 films · one draw"
  (숫자는 stats에서). SurpriseStage 자체·RPC·레이아웃은 무수정.

## 10. 실행 순서 + 수용 기준 (QA 체크리스트)

**Phase 0 (마이그레이션)** — 0070: `home_v2_bundle_v3` + `home_daily_exhibits`.
- [ ] `select jsonb_typeof(home_v2_bundle_v3('2026071100'))` = 'object'
- [ ] 같은 시드 2회 호출 결과 **동일**(md5 결정론), 다른 시드는 picks 첫 5장 **상이**
- [ ] picks 행에 `ts` 존재, 값이 `/takescore/film/{slug}` 헤드라인 숫자와 일치(표본 3편)
- [ ] 실행시간 < 3s (statement_timeout 30s 내 여유)

**Phase 1 (서버 스위치 + 카드 점수)** — page.tsx, lib/home2.ts, FilmCard, helpers.
- [ ] `npx tsc --noEmit` 신규 에러 0
- [ ] 홈 SSR HTML에 `Tm ` 칩 존재, 미채점 영화 카드엔 없음
- [ ] 시각이 다른 두 시간대(시드)에서 picks 구성이 달라짐(캐시버스터로 확인 —
      라이브 감사 ISR 캐시 함정: 배포 직후 구캐시 오진 주의, 코드 먼저·캐시버스터 필수)
- [ ] PLACEHOLDER 폴백 렌더 정상(ts 없음 → 칩 미렌더)

**Phase 2 (TodayExhibits + 방문 오프셋 + Nav)** —
- [ ] 6타일(또는 풀 부족 시 4~5) 렌더, 전 링크 200
- [ ] 하루 동안 타일 불변, 익일 변경
- [ ] hydration mismatch 콘솔 경고 0 (offset은 effect에서만)
- [ ] 상단우측에서 Ask metatake AI 소멸, Room·LensToggle 등 나머지 정상
- [ ] 모바일 375px에서 밴드 가로스크롤 정상, 본문 가로 오버플로 0

**Phase 3 (어포던스 + 계측)** —
- [ ] 첫방문 pulse 1회성(localStorage), reduced-motion 시 무동작
- [ ] mt_events로 측정 가능: 섹션별 클릭(기존 클릭 수집이 잡도록 각 신규 링크에
      의미있는 href 유지), `/admin/metrics`에서 홈 진입→내부 이동 흐름 확인

**성공 지표(2주 관찰, /admin/metrics + GSC)**: 홈 이탈률 하락, 홈→film/takescore/
misreadings 클릭 분산 증가(특정 상위 카드 쏠림 완화), Surprise 상호작용률 상승,
`/takescore/film/*` 내부 유입 증가.

## 11. 함정 대장 (실행 AI 필독 — 전부 실전 사고 이력)

1. **cinecodex_card 루프 = DB 다운** → 점수는 v3 SQL 조인 일괄. 절대 카드별 RPC 금지.
2. **unstable_cache null-포이즌** → fetchBundle의 throw-on-empty 가드 제거 금지.
3. **hydration mismatch** → 렌더 경로 Math.random 금지, effect에서만.
4. **create-or-replace 오버로드** → 시그니처 변경 시 drop 후 재생성.
5. **jsonb 빈-게이트** → `jsonb_typeof='null'`로 판정.
6. **PostgREST 1000행 캡** → 단일행 jsonb 반환 유지.
7. **라이브 감사 ISR 캐시 함정** → 검증은 코드→DB→캐시버스터 순서.
8. **워처 자동배포** → app/components/lib 저장 즉시 커밋·배포됨. 반쯤 고친 상태로
   두지 말 것(섹션 단위로 완결 저장). 마이그레이션·docs는 수동 커밋.
9. **React 주석 노드가 텍스트를 쪼갬** → 라이브 HTML grep 검증 시 오진 주의.
10. **Essential Ten은 건드리지 않는다** — 로테이션 대상 아님(정전 정체성).

## 12. 모호 시 기본값

- 시드 타임존: **UTC** (사이트 전체 UTC 관례).
- 카드 점수 칩 포맷 문자열: `Tm 67` (공백 1, 소수 없음).
- 풀 크기 숫자는 §4.2 표 값 그대로; 성능 문제 시에만 절반으로.
- TodayExhibits 카피는 영문(사이트 언어), 라벨은 "Film of the day" 계열 직서술.
- 신규 CSS는 `app/home2.css`에 `.hx-` 프리픽스로 추가(기존 클래스 오염 금지).

## 13. 파일 맵 (실행 AI가 만지는 전부)

| 파일 | 작업 |
|---|---|
| `supabase/migrations/0070_home_v8_rotation.sql` | 신규: v3 번들 + exhibits RPC |
| `app/page.tsx` | 시드 계산·RPC 스위치·exhibits 병렬 페치·캐시 키 |
| `lib/home2.ts` | Film에 ts/tsv/tsr, HomeV2에 exhibits 타입, PLACEHOLDER 보강 |
| `components/home2/FilmCard.tsx` | Tm 칩 |
| `components/home2/helpers.ts` | `tsQuadrant(v,r)` |
| `components/home2/TodayExhibits.tsx` | 신규 밴드 |
| `components/home2/HomeV2.tsx` | 밴드 삽입 위치 |
| `components/home2/Nav.tsx` | Ask AI 제거 2곳 |
| `components/home2/HeroSurprise.tsx` | P2 어포던스(최소) |
| Picked/Newly/Canon/LensRail/ConceptsRail/AuteursRow | `useVisitOffset` 적용 |
| `app/home2.css` | `.hx-*` 스타일 |

**등록**: 완료 시 `docs/00-INDEX.md` 이 항목의 상태를 SHIPPED로 바꾸고, 본 문서 상단
상태줄 갱신. 문제 발견 시 이 문서에 결정 로그를 덧붙일 것(별도 문서 만들지 말 것).
