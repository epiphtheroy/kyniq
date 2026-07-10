# 작업 지시서 — METATAKE TV 전 코퍼스 DB 구축 (다른 AI 실행용)

**상태: 대기 (원우 OK 후 실행). 이 문서만 보고 실행 가능하도록 작성됨.**
작성 2026-07-10. 배경 지식: 루트 `HANDOFF-서프라이즈-v2채널-스트리밍.md` §C2 (엔진 v1 설계·10편 파일럿 완료).

---

## 0. 목표 · 산출물

영화별 TV 프로그램(방송)을 **SQL로, LLM 0회로** 전 코퍼스에 대해 컴파일한다.
- 산출: `tv_programs`(적격 영화당 1행) + `tv_segments`(영화×주제 모듈, beats 사전조립) + 장르/주제 플레이리스트.
- 빈약한 영화는 **게이트로 제외**하되 skip 사유를 기록(재프로브 방지).
- 완료 후 `/tv/watch`가 전 코퍼스를 즉시 서빙(프론트 변경 불필요 — 플레이어는 topic-불문 zone 렌더).

**모든 SQL은 이미 작성 완료**: `supabase/migrations/0058_tv_engine_v2.sql` (미적용). 실행자는 이 파일을 적용하고 배치를 돌리기만 하면 된다.

---

## 1. ⚠️ 서버 안전 수칙 (필독 — 실제 사고 2회에서 나온 규칙)

이 DB는 **운영 중인 라이브 서비스**다. 과부하 시 커넥션 풀 고갈 → Vercel 함수 재시도 폭주 → 사이트 API 전면 다운(2026-07-08, 2026-07-10 두 차례 실제 발생).

1. **광폭 멀티조인 집계 금지.** `films × 10+ left join(각 테이블 group by)` 같은 한 방 쿼리가 2026-07-10 다운의 트리거였다. 카운트가 필요하면 **테이블당 1쿼리씩, 사이 5초 간격**으로.
2. **모든 실행 단위에 `set local statement_timeout`** (0058의 함수들에 이미 내장: batch 120s, playlists 60s).
3. **배치 사이 슬립 필수.** 한 관리-API 호출 = `tv_compile_batch(20)` 1회(≈5–15s 작업). **호출 사이 20초 이상 대기.**
4. **advisory lock**(777001)이 동시 실행을 차단한다 — `{"locked":true}`가 오면 다른 런이 도는 중이니 기다릴 것.
5. **중단 기준(하나라도 해당하면 즉시 중지, 10분 후 재개):**
   - `curl -s -o /dev/null -w '%{http_code} %{time_total}' https://metatake.net/api/surprise/home` 가 5초 초과 또는 200 아님
   - 관리 API가 544/timeout 반환
6. **실행 시간대**: 아무 때나 가능하되, 시작 전에 위 헬스체크가 정상(≤1s)인지 확인. 다른 대량 작업(OpenAlex 워커 등)과 동시 실행 금지.
7. 절대 금지: `compute_film_scores`(전역 delete), cinecodex_card 루프 호출, 풀테이블 인덱스 빌드.

**실행 채널**: Supabase 관리 API (DDL 가능)
```
POST https://api.supabase.com/v1/projects/jvgarcqrtsmgfimdcwgo/database/query
Authorization: Bearer $SUPABASE_ACCESS_TOKEN   # .env.local의 SUPABASE_ACCESS_TOKEN
Content-Type: application/json
Body: {"query": "<SQL>"}
```
(참고: `worker/apply-sql.py`는 DDL을 막으므로 사용하지 말 것. PostgREST는 1000행 캡이 있으니 카운트는 count(*)로.)

---

## 2. 사전 점검 (Phase 0 — 읽기 전용, 샤드 방식)

각 쿼리를 **한 번에 하나씩**, 사이 5초 간격으로 실행. 전부 ≤2s에 끝나야 정상.

```sql
-- 0-1 헬스
select 1;
-- 0-2 엔진 v1 존재 확인 (0056/0057 적용 상태)
select count(*) programs, (select count(*) from tv_segments) segments from tv_programs;
-- 기대: programs=10, segments≈128 (파일럿). tv_programs가 없으면 0056부터 적용.
-- 0-3 코호트 상한
select count(*) from films where visible and coalesce(is_analyzed,true);
-- 0-4 ~ 0-7 (개별 실행) 데이터 패밀리 커버리지 감:
select count(distinct entity_id) from media where entity_type='film' and kind='video' and title ~* 'trailer|teaser';
select count(distinct g.film_id) from takes t join figures g on g.id=t.figure_id where t.status='published' and t.take_title is not null;
select count(distinct film_id) from film_reception where dek_lead is not null;
select count(distinct film_id) from film_locations where lat is not null;
-- 0-8 디스크 여유
select pg_size_pretty(pg_database_size(current_database()));
```

**용량 추정**: 세그먼트당 beats ≈ 2–4KB. 적격 ~1,500–2,500편 × ~15세그 × 3KB ≈ **70–120MB** — 문제 없음. 0-8 결과와 함께 기록만 해둘 것.

---

## 3. 적격성 게이트 (빈약 영화 제외 — 세부 로직)

`tv_eligible(film_id, p_min_rich)` (0058에 구현):

```
제외:  not visible OR not is_analyzed
제외:  깨끗한 트레일러/티저 없음
       (media.kind='video' AND title ~* 'trailer|teaser'
        AND title !~* 'explain|featurette|behind the scenes|interview|review|breakdown|react|making of|commentary')
제외:  제목 있는 published 테이크 < 3   (미스리딩 백본)
제외:  rich < p_min_rich (기본 4)
       rich = 다음 10개 패밀리 중 존재하는 수:
         figures≥4 · reception≥1 · lineage≥1 · locations(geo)≥1 · affinities≥1
         · film_next≥1 · questions≥1 · film_asset(why-watch)≥1
         · theorist-take≥1 · invitation-take≥1
```
- 모든 프로브는 film_id 인덱스 단건 조회 (O(1)/편). 광폭 조인 없음.
- 게이트 탈락 영화는 `tv_programs`에 **status='skipped' + meta.skip(사유)** 로 스탬프 → 매 배치 재프로브 방지. (skipped 행은 tv_watch에서 자동 제외 — status='published'만 서빙.)
- **p_min_rich 튜닝**: 기본 4로 시작. Phase 2 첫 배치 후 `compiled vs skipped` 비율을 보고, skipped가 90%+면 3으로 낮추는 판단 가능(원우 컨펌 후).

---

## 4. 추가 추출원 감사 결과 (v2에 반영/보류/제외)

| 소스 | 판정 | 근거 |
|---|---|---|
| theorist 테이크 (takes.theorist_id) | ✅ v2 포함 (`theorist` 토픽) | ~1,932편. 미스리딩 3개와 중복 안 되게 used_takes 제외 로직 포함 |
| why-watch (film_asset lenses) | ✅ v2 포함 (`why_watch`) | 렌즈 포인트 스택. 편집 카피 품질 높음 |
| Curious 질문 (questions) | ✅ v2 포함 (`question`) | ~266편. title_spoiler면 safe_hook/display_title, 없으면 생략 |
| watch-next (film_next) | ✅ v2 포함 (`watch_next`) | 17k행, 손으로 쓴 reason이 있어 kindred(코사인)와 별개 가치 |
| invitation 테이크 | ✅ v2 포함 (`invitation`) | 1,934행. take_title 없음 → rationale 사용 (함정 주의) |
| TakeScore (cinecodex.scores) | 🟡 보류 — 원우 결정 | 데이터는 전 6,701편 존재·읽기만이라 부하 없음. 단 점수 노출 정책 결정 필요. 포함 시 `'takescore'` 토픽 1세그(1비트) 추가는 5분 작업 |
| Daily/뉴스 헤드라인 | ❌ 제외 | 시효성 — 정적 프로그램에 넣으면 썩음 |
| counterpoints | ❌ 이번 제외 | 정본 테이블명 미확정(film_counterpoints 부재 확인됨) |
| credits 인물 사진 | ❌ 제외 | crew_index.json(파일) — SQL 밖 |
| movements | ❌ 제외 | 라벨 소스 오염(슬러그만) |
| director_facts | ❌ 제외 | 208행뿐 |

→ **v2 컴파일러의 챕터(최대 18)**: open · misreading×3 · theorist · figures · ideas · why_watch · reception · question · honors · canon · locations · map · kindred · watch_next · invitation · close. 플레이어가 온에어 시 랜덤 샘플(≤170s)하므로 길어도 무방 — 모듈은 전부 저장된다.

---

## 5. 실행 절차

### Phase 1 — 마이그레이션 적용 (1회)
`supabase/migrations/0058_tv_engine_v2.sql` 전문을 관리 API로 1회 실행.
- 시그니처 동일한 함수만 교체(오버로드 함정 없음). 실패 시 에러 그대로 보고하고 중단.
- 적용 후 스모크(각각 개별 실행):
```sql
select tv_eligible((select id from films where slug='pulp-fiction-1994'));      -- {"ok":true,...}
select tv_compile_film((select id from films where slug='pulp-fiction-1994'));  -- segments 15±3
select jsonb_array_length(tv_watch(null,null)->'programs');                     -- ≥1, 빠름(<1s)
```

### Phase 2 — 배치 컴파일 (메인)
러너 루프(파이썬/셸 무엇이든, 관리 API 호출):
```
반복:
  1) 헬스체크 (§1-5). 불합격 → 10분 대기 후 재시도
  2) POST {"query":"select tv_compile_batch(20, 4)"}
  3) 응답 기록: {"compiled":n,"skipped":m,"remaining":r} — 로그 파일에 append
  4) r == 0 이면 종료
  5) 20초 대기
```
- 예상 규모: 후보 ~7,000편(visible+analyzed) 중 게이트 통과 대략 1,000–2,500 추정(파일럿 표본 기준). 배치당 20편 컴파일+수십 skip ≈ 5–15s → **총 1–3시간**(슬립 포함).
- `{"locked":true}` 응답 → 60초 대기 후 재시도.
- 중간 중단해도 안전: 재실행하면 미처리분만 이어서 처리(멱등).

### Phase 3 — 플레이리스트 생성 (1회)
```sql
select tv_build_playlists(8, 40);
```
- 장르별(프로그램 ≥8개 장르) `genre-<slug>` 리스트 + `on-location` 글로벌 컷 갱신.
- 기존 수동 3종(palme-files·thriller-files·on-location) 중 on-location은 대체됨. palme/thriller-files는 유지.

### Phase 4 — 검증 (QA)
```sql
-- 4-1 분포
select status, count(*) from tv_programs group by 1;
select topic, count(*) from tv_segments group by 1 order by 2 desc;
-- 4-2 빈 beats/제로 duration 없어야 함
select count(*) from tv_segments where jsonb_array_length(beats)=0 or duration_ms<=0;  -- 0
-- 4-3 헤드라인 오염 스팟체크 (The The, null 등)
select title from tv_programs where title ~* 'the the |null|%s' limit 10;              -- 0행
select title from tv_segments where title ~* 'the the |null|%s' limit 10;              -- 0행
-- 4-4 피드 성능
explain analyze select tv_watch(null,null);   -- < 500ms 목표
```
- 라이브: `https://metatake.net/tv/watch` 에서 All programs 개수 확인(피드 상한 120), 임의 프로그램 2–3편 재생 스모크.
- **수용 기준**: skipped 사유 분포가 합리적(no clean trailer / takes<3 / rich<4), 4-2·4-3 = 0, tv_watch(null,null) < 1s, 사이트 API 헬스 전 구간 정상 유지.

### Phase 5 — 마무리
- `analyze tv_programs; analyze tv_segments;` (별도 호출)
- 이 문서 상단 상태를 "완료(날짜, compiled/skipped 수)"로 갱신, 루트 핸드오프 §C2에 결과 1줄 추가.
- `supabase/migrations/0058*.sql` 커밋은 이미 되어 있음(적용 여부만 문서에 기록).

---

## 6. 롤백

- 특정 영화만: `select tv_compile_film('<film_id>');` (delete+rebuild 멱등)
- v2 전체 취소: `delete from tv_programs where meta->>'engine'='v2';` → 파일럿 10편은 사라지므로 0056 시점 재컴파일 필요(§5 스모크 3콜). 테이블/함수 drop은 하지 말 것(프론트가 참조).

## 7. 함정 모음 (이 저장소 실증)

- **jsonb 빈-게이트**: `jsonb_build_object('items', <빈 agg>)`→`{"items":null}`은 `is null`로 안 걸림. 0058은 `jsonb_array_length(beats)>0` 패턴으로 회피됨 — 수정 시 유지할 것.
- **create-or-replace 오버로드**: 시그니처 바꾸면 새 오버로드가 생겨 PostgREST 300. 함수 시그니처 변경 금지(변경 필요 시 구 시그니처 drop 동반).
- **PostgREST 1000행 캡**: 대량 결과는 jsonb_agg 단일행으로.
- **invitation 테이크는 take_title이 없다** — rationale 사용(0058 반영).
- **Amélie slug = `am-lie-2001`** (악센트 슬러그 주의 — 게이트가 알아서 처리하므로 특별 조치 불요).
- 워처는 supabase/·docs/ 파일을 커밋하지 않음 → 문서 갱신은 수동 커밋.
