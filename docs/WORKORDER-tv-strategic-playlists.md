# 작업 지시서 — METATAKE TV 전략 플레이리스트 체계 (다른 AI 실행용)

**상태: 대기 (원우 OK 후 실행). 이 문서만 보고 실행 가능하도록 작성됨.**
작성 2026-07-10 (Opus 기획). 배경: 루트 `HANDOFF-서프라이즈-v2채널-스트리밍.md` §C2·§C2-b (엔진·전 코퍼스 1,794편 빌드·film 히어로 교체·/tv/[slug] SEO 페이지 완료), `docs/WORKORDER-tv-corpus-build.md` (전 코퍼스 빌드 기록).

---

## 0. 전략 · 목표

**원칙(원우 지시): 새 카테고리를 발명하지 않는다.** 사이트가 이미 세분화해 둔 축 — 감독·리니지(수상/정전/무브먼트/국가/영화제)·이론가·트로프·지역·장르·연대 — 을 **그대로 플레이리스트로 미러링**한다. 각 세부 페이지에 이미 "영화 집합 + 그 영화들의 콘텐츠 카테고리(topic 세그먼트)"가 들어있으므로, 플레이리스트 = **기존 축 테이블 × tv_programs/tv_segments의 조인 결과**다.

각 플레이리스트 방송은:
1. **해당 세부 페이지 안에 임베드**된다 (감독 페이지 → 그 감독의 방송, 리니지 페이지 → 그 리스트의 방송).
2. **독립 slug를 받는다** — `/tv/list/[slug]` 정규 색인 페이지 (하나의 독립 콘텐츠).
3. **브리핑으로 시작한다** — 재생 첫 화면에서 제목·클리핑 기준·영화 수·챕터 수·총 길이를 방송 스타일로 고지.

**LLM 0회 · 랜덤 0회 유지.** 제목=템플릿×사실(tv_pick hashtext 결정론), 숫자=SQL 집계.

---

## 1. ⚠️ 서버 안전 수칙 (필독 — 이전 지시서와 동일, 실제 사고 2회 근거)

운영 중인 라이브 DB다. 과부하 → 커넥션 풀 고갈 → 사이트 전면 다운(2026-07-08, 07-10 실제 발생).

1. **광폭 멀티조인 집계 금지.** 카운트는 축당 1쿼리씩, 사이 3–5초 간격. (본 문서 §2의 실측 쿼리가 안전 형태의 견본.)
2. 모든 실행 단위에 `set local statement_timeout` (생성기 함수에 내장할 것; 배치 120s, 단건 60s).
3. **advisory lock `777002`** 로 플레이리스트 빌드 동시 실행 차단 (기존 컴파일 배치는 777001).
4. 중단 기준: `curl -s -o /dev/null -w '%{http_code} %{time_total}' https://metatake.net/api/surprise/home` 이 5s 초과 또는 200 아님 → 즉시 중지, 10분 후 재개.
5. 절대 금지: `compute_film_scores`, 풀테이블 인덱스 빌드, cinecodex_card 루프.
6. 실행 채널: Supabase 관리 API(DDL 가능) — `POST https://api.supabase.com/v1/projects/jvgarcqrtsmgfimdcwgo/database/query`, `Authorization: Bearer $SUPABASE_ACCESS_TOKEN`(.env.local). `worker/apply-sql.py`는 DDL 차단이므로 금지. PostgREST 결과는 1000행 캡 → 대량 결과는 jsonb_agg 단일행.

---

## 2. 실측 (2026-07-10, 방송 1,794편 기준) — 축별 수확량

각 축의 게이트(엔티티당 최소 방송 편수)와 그때의 수확량. **이 숫자가 수용 기준의 근거다.**

| 축 | 소스 (조인 경로) | 게이트 | 엔티티 수 | 슬롯 합 |
|---|---|---|---|---|
| **리니지** (award 56·movement 67·national 46·canon 18·festival 18·section 18·style 15·auteur 160) | `film_lineage.list_id → lineage_lists` × tv_programs | ≥6 | **89 리스트** | 3,399 |
| **감독** | `films.director_slug` × tv_programs | ≥3 | **192명** | 1,033 |
| **장르** | `unnest(films.genres)` × tv_programs | ≥8 | **18개** | 4,118 |
| **국가(로케이션)** | `film_locations.country`(lat 있음) × tv_programs | ≥8 | **45개국** | 2,274 |
| **연대** | `(films.year/10)*10` × tv_programs | ≥8 | **11개**(1920s–2020s) | 1,794 |
| **이론가** | `takes.theorist_id → figures.film_id` × tv_programs | ≥4 | **276명** | 10,265 |
| **트로프** ⭐강화 | `conn_film_trope_vec(film_id,trope_id)` × tv_programs | **≥3** | **2,859개** | 13,890 |
| **컨셉** ⭐강화 | `takes.concept`(slugify — concept_readings RPC와 동일 정규식) → figures → film × tv_programs | **≥3** | **588개** | 4,698 |
| **아키타입** ⭐강화 | `figure_taxonomy(figure_id,axis,node_id) → taxonomy_nodes` × figures × tv_programs | **≥3** | **1,535노드** (char_identity 514 · theme 500 · object 185 · location 184 · char_complex 136 · char_archetype 16) | 21,099 |
| **장르×주제 교차** | films.genres × `tv_segments.topic` | 표본: Action×locations | 223편/440세그 | — |

무브먼트는 별도 테이블이 아니라 **lineage_lists.facet='movement'** (67개)로 리니지 축에 탑승. `/movements/[slug]` 페이지도 이 리스트를 소비.
트로프 정본 멤버십 테이블은 **`conn_film_trope_vec`**(film_id, trope_id, v, n) — `frame_instances`는 존재하지 않음(과거 백업 `_bak_trope_ftm`만 있음).
**컨셉 멤버십의 정본 경로**는 `concept_readings` RPC가 실증: `takes.concept`(원문 텍스트)을 `regexp_replace(lower(regexp_replace(trim(concept),'[^a-z0-9]+','-','gi')),'^-+|-+$','','g')`로 슬러그화 — 생성기는 **반드시 동일 정규식**을 써야 `/concept/[slug]` 페이지와 키가 일치한다.
**아키타입 멤버십의 정본 경로**는 `film_catalog` RPC가 실증: `figure_taxonomy` 6축(object·location·char_archetype·char_identity·char_complex·theme) → `taxonomy_nodes(slug,label)`.

**규모 전망 (원우 지시로 트로프·컨셉·아키타입 ≥3 강화, 2026-07-10 재실측)**: 기타 축 ≈ 505개(리니지 89·감독 192·장르 18·국가 45·연대 11·이론가 상위 150) + **강화 3축 = 4,982개**(트로프 2,859·아키타입 1,535·컨셉 588) → **총 ≈ 5,500 플레이리스트**, `tv_playlist_items` ≈ 5만 행(트리비얼). 이 규모 때문에 §3b 디렉토리는 **페이징 필수**, §5 생성기는 **배치 루프 필수**다.

---

## 3. 스키마 — 마이그레이션 `supabase/migrations/0060_tv_playlist_engine.sql`

### 3a. tv_playlists 확장 (기존 행 보존; 컬럼 추가만 — 시그니처 변경 함정 없음)

```sql
alter table public.tv_playlists
  add column if not exists axis        text,          -- 'lineage'|'director'|'genre'|'country'|'decade'|'theorist'|'trope'|'genre_topic'|'manual'
  add column if not exists key         text,          -- 축 내 엔티티 식별자(slug 우선: lineage_lists.slug, director_slug, genre 원문, country 원문, decade '1990', theorist uuid, trope uuid, 'action:locations')
  add column if not exists cut         text not null default 'films',  -- 'films'(프로그램 통재생) | 'segments'(topic 슬라이스)
  add column if not exists intro       jsonb,         -- 브리핑 beats(§4c) — tv_segments.beats와 동일 스키마
  add column if not exists href        text,          -- 원본 세부 페이지 URL(백링크: /director/x, /lineage/x, /movements/x, /genre/x, /theorist/x, /trope/x; 국가·연대·교차는 null 허용)
  add column if not exists n_films     int,
  add column if not exists n_segments  int,
  add column if not exists total_ms    bigint,
  add column if not exists updated_at  timestamptz default now();
create unique index if not exists tv_playlists_axis_key_cut on public.tv_playlists(axis, key, cut) where axis is not null;
```

- **tv_segments 스키마 변경 없음.** 멤버십은 전부 축 테이블에서 오므로 세그먼트에 엔티티 태그가 필요 없다(films-cut은 film_id로, segments-cut은 film_id+topic으로 충분).
- 기존 행 백필: 장르 18개 → `axis='genre', key=<장르명>, href='/genre/'||slugify`, `palme-files` → `axis='lineage'`(해당 리스트 slug), `on-location` → `axis='manual'`.
- **RLS**: 0059가 tv_playlists/tv_playlist_items에 SELECT 정책을 이미 부여함. 새 테이블을 만들지 않으므로 추가 정책 불요. (신규 tv_* 테이블을 만들면 반드시 정책 동반 — 0059 함정 참조.)

### 3b. 디렉토리 RPC — **페이징 필수** (총 ~5,500개라 무페이징 jsonb_object_agg는 수 MB payload가 됨)

```sql
-- 축별 요약(브라우즈 UI의 탭 카운트)
create or replace function public.tv_directory_summary()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_agg(jsonb_build_object('axis',axis,'n',n) order by n desc)
  from (select coalesce(axis,'manual') axis, count(*) n from tv_playlists group by 1) s
$$;

-- 페이지 단위 목록(정렬·검색·축 필터 — 원우의 브라우즈 UI가 그대로 소비)
create or replace function public.tv_directory(p_axis text default null, p_q text default null,
                                               p_limit int default 60, p_offset int default 0)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'total', (select count(*) from tv_playlists
              where (p_axis is null or axis=p_axis) and (p_q is null or title ilike '%'||p_q||'%')),
    'lists', coalesce((select jsonb_agg(x) from (
       select jsonb_build_object('slug',slug,'title',title,'dek',dek,'kind',kind,'axis',axis,'cut',cut,
         'n_films',n_films,'n_segments',n_segments,'total_ms',total_ms,'href',href) x
       from tv_playlists
       where (p_axis is null or axis=p_axis) and (p_q is null or title ilike '%'||p_q||'%')
       order by n_films desc nulls last, title
       limit least(p_limit,120) offset greatest(p_offset,0)) s), '[]'::jsonb))
$$;
```

### 3c. tv_watch v3 — 브리핑 pseudo-엔트리 + 선반 캡

`tv_watch(p_list)` 분기에서, 엔트리 배열 **맨 앞에** 브리핑 엔트리를 삽입:

```
intro 엔트리 = jsonb_build_object(
  'slug', 'intro-'||pl.slug, 'title', pl.title, 'dek', pl.dek,
  'film', (첫 아이템 프로그램의 film jsonb — 백드롭·클립을 인트로 배경으로 재사용),
  'segments', jsonb_build_array(jsonb_build_object(
     'id','intro-'||pl.id, 'topic','intro', 'seq',0, 'title',pl.title,
     'kicker','A METATAKE TV Watch List', 'accent','#C8102E',
     'beats', pl.intro, 'duration_ms', (pl.intro의 hold 합))))
```

- `pl.intro is null`이면 삽입 생략(구 플레이리스트 호환). ⚠️ jsonb null 게이트: `pl.intro is not null and jsonb_typeof(pl.intro)='array'`.
- 플레이어(TVProgramPlayer)는 topic이 open/close가 아니면 그대로 순서 재생하므로 **프론트 변경 없이** 인트로가 나온다. samplePlan은 세그 1개짜리 엔트리에서 [0]을 반환 — 검증됨 패턴.
- **선반 캡**: (null,null) 분기의 playlists 집계가 현재 무제한 — 900개가 되면 선반 payload가 수백 KB로 커진다. `order by n_films desc nulls last limit 36` + `'n_playlists', (select count(*) from tv_playlists)` 필드 추가. 전체 목록은 §3b `tv_directory()`가 담당.
- **함정**: tv_watch는 CREATE OR REPLACE로 시그니처 유지(인자 추가 금지 — 오버로드 300 함정).

---

## 4. 제목·브리핑 템플릿 (핵심 — 전부 tv_pick 결정론, LLM 0)

### 4a. 제목 원칙

1. **선두 `The %s` 금지** — 리니지 라벨("The Criterion Collection")과 충돌해 "The The …"가 된다. 전 코퍼스 QA에서 214세그 실증·수정된 함정. `%s`는 항상 중간·끝에.
2. **숫자는 제목에 넣지 않는다** (멤버십이 재빌드마다 변해 제목이 stale해짐). 숫자는 dek과 인트로 브리핑에.
3. ScreenRant식 궁금증 유발 + 채널 정체성("Files/Dossier/Tapes/On the Record").

### 4b. 축별 템플릿 (tv_pick(array[...], axis||':'||key) 형태로 구현)

| 축 | 제목 후보 3종 | dek 형식 |
|---|---|---|
| lineage(award/festival) | `%s: The Complete Files` · `Every %s Film, Reopened` · `%s — All the Broadcasts` | `{n}편 · {m}챕터 · 총 {h}h {mm}m — 리스트 전 수록작 중 방송 보유분` |
| lineage(movement) | `%s, As a Broadcast` · `Inside %s: The Films` · `%s on METATAKE TV` | 동일 |
| lineage(canon/national/style/section/auteur) | `%s: The Watch List` · `%s, Film by Film` · `Reading Through %s` | 동일 |
| director | `%s: The Director's File` · `Every %s Film We've Read` · `%s, in Broadcast Order` | `{n}편 연대순` |
| genre | `%s Night on METATAKE TV` · `%s: The Channel` · `All Our %s Broadcasts` | `{n}편` |
| country | `Filmed in %s` · `On Location: %s` · `%s, On the Record` | `{n}편 · 현지 로케이션 지도 포함` |
| decade | `The %ss, Reopened` · `Cinema of the %ss` · `%ss: The Broadcast Archive` | `{n}편` |
| theorist | `Cinema According to %s` · `%s: The Reading List` · `Films That Answer to %s` | `{n}편 — 이 이론가의 렌즈가 걸린 영화들` |
| trope | `%s: A Pattern File` · `The Anatomy of %s` · `%s, Film After Film` | `{n}편에서 반복되는 패턴` |
| concept | `The Concept File: %s` · `%s, Across the Films` · `Thinking With %s` | `{n}편 — takes에서 이 개념이 걸린 영화들` |
| archetype(char_*) | `%s: A Recurring Figure` · `Every %s We've Catalogued` · `%s, Film by Film` | `{n}편 · {figures}명의 피겨` |
| archetype(object/location) | `%s: An Object File` / `%s: A Place That Recurs` · `The Films That Share %s` | 동일 |
| archetype(theme) | `%s: The Theme File` · `Films Built on %s` · `%s, Traced Across Cinema` | 동일 |
| genre_topic | locations: `Where %s Films Were Really Shot` / reception: `How %s Films Were Received` / honors: `The Prizes of %s` / misreading: `%s Films, Read Too Closely` | `{n}편 · {s}세그먼트 — {topic} 챕터만 잘라낸 컷` |

### 4c. 인트로 브리핑 beats (모든 플레이리스트 공통 구조; 생성기가 실수치 주입)

```
beats = [
 {zone:'top', kicker:'A METATAKE TV Watch List', text:<플레이리스트 제목>,
  sub:<클리핑 기준 1문장 — 예: 'Every Palme d'Or winner with a compiled broadcast'>, hold:tv_hold},
 {zone:'sub', kicker:'In this list', text:'{n_films} films · {n_chapters} chapters · {h}h {mm}m of readings', hold:...},
 {zone:'chips', chips:[상위 6편 제목(연도)], hold:...},
 {zone:'sub', kicker:'How it plays', text:'Each film gets its own broadcast; chapters are sampled fresh every visit.', hold:...}
]
```

클리핑 기준 문장은 축별 고정 템플릿(예: director → `'Every %s film with a compiled broadcast, in year order'`). tv_hold/tv_chunks는 0058의 기존 함수 재사용.

---

## 5. 생성기 — `tv_build_axis_playlists()` 패밀리 (0060에 포함)

### 5a. 공통 계약

- 각 함수는 `security definer`, `set local statement_timeout='120s'`, **advisory lock 777002** (try_lock 실패 시 `{"locked":true}` 반환).
- **멱등**: `(axis,key,cut)` upsert — 기존 플레이리스트면 title/dek/intro/카운트 갱신 + items delete→reinsert. slug는 최초 생성 시 확정 후 불변(색인 안정).
- slug 규칙: `{axis}-{key-slug}` (예: `lineage-palme-dor`, `director-bong-joon-ho`, `country-south-korea`, `x-action-locations`). 충돌 시 `-2` 접미.
- **아이템 순서**: 연대순(`films.year asc, title`) — 감독·리니지·연대에서 "여정" 서사. **캡 40개**(tv_watch limit 60 미만, payload ~550KB@46 실측 근거).
- films-cut: `tv_playlist_items(program_id)` / segments-cut: `(segment_id)` (topic 필터).
- 반환: `jsonb {built, updated, skipped}`.

### 5b. 축별 함수 명세 (게이트는 §2 실측 근거)

| 함수 | 소스 SQL 핵심 | 게이트/캡 | cut |
|---|---|---|---|
| `tv_build_lineage_playlists(p_min int default 6)` | `film_lineage fl join lineage_lists ll on ll.id=fl.list_id and coalesce(ll.status,'')<>'merged' join tv_programs p on p.film_id=fl.film_id and p.status='published'` group by 리스트 | ≥6 → 89개. **P1은 facet in ('award','canon','festival','movement') 우선**, 나머지 facet은 P2 | films |
| `tv_build_director_playlists(p_min int default 3)` | `films.director_slug` join tv_programs | ≥3 → 192개 | films |
| `tv_build_genre_playlists(p_min int default 8)` | `unnest(films.genres)` — **기존 18개를 upsert로 흡수**(axis/key 백필) | ≥8 → 18개 | films |
| `tv_build_country_playlists(p_min int default 8)` | `film_locations.country`(lat not null) join tv_programs, distinct film | ≥8 → 45개 | films (P2에서 segments 변형: topic in ('locations','map')) |
| `tv_build_decade_playlists(p_min int default 8)` | `(year/10)*10` | ≥8 → 11개 | films |
| `tv_build_theorist_playlists(p_min int default 5, p_top int default 150)` | `takes(status='published', theorist_id) join figures join tv_programs`, distinct film; 엔티티는 영화 수 상위 p_top | ≥5, 상위 150명 | films |
| `tv_build_trope_playlists(p_min int default 3, p_batch int default 300, p_offset int default 0)` ⭐ | `conn_film_trope_vec join tv_programs`, distinct film; `frames`에서 label/slug (`merged_into is null` 정상 행만); 아이템 순서 `v.n desc, year` | **≥3 → 2,859개** — 배치 필수 | films |
| `tv_build_concept_playlists(p_min int default 3, p_batch int default 300, p_offset int default 0)` ⭐ | `takes.concept` 슬러그화(§2의 정규식 그대로) join figures join tv_programs; key=cslug, label=`min(trim(concept))`, href=`/concept/{cslug}` | **≥3 → 588개** | films |
| `tv_build_archetype_playlists(p_min int default 3, p_batch int default 300, p_offset int default 0)` ⭐ | `figure_taxonomy join figures join tv_programs join taxonomy_nodes`; key=`{axis}:{node_slug}`, slug=`{axis(언더스코어→하이픈)}-{node_slug}`, href=`nodeHref` 규칙(lib/catalog.ts `kindMeta`의 axis→seg 매핑을 SQL CASE로 복제 — **실행자는 lib/catalog.ts에서 매핑을 확인 후 하드코딩**) | **≥3 → 1,535개** — 배치 필수 | films |
| `tv_build_genre_topic_playlists(p_min int default 12)` | `tv_segments s join films f on f.id=s.film_id`, topic in ('locations','reception','honors','misreading') × 장르 | 교차 영화 ≥12 | **segments** |
| `tv_build_all_playlists()` | 소형 축(리니지·감독·장르·국가·연대·이론가·교차)만 순차 호출(사이 `pg_sleep(2)`) — **대형 3축은 포함하지 말 것**(런타임 폭발), 별도 배치 러너(§5d)로 | — | — |

**⭐ 배치 계약(대형 3축 공통):** 엔티티를 `(슬롯수 desc, key)` 결정론 순서로 정렬해 `offset p_offset limit p_batch`만 처리하고 `{built, next_offset, remaining}`을 반환. 러너가 remaining=0까지 재호출. 한 배치 안에서도 인트로 집계는 엔티티당 O(멤버십)이므로 300개면 수 초 내 종료(실측 근거: 전체 멤버십 join이 5–15s 수준).

⚠️ **이론가·트로프의 segments-cut은 P1에서 금지.** 영화의 theorist 세그먼트는 "그 영화의 최강 테이크의 이론가"라서 플레이리스트 대상 이론가와 **다른 사람일 수 있다**(엔티티 불일치). segments-cut으로 승격하려면 컴파일러 v3에서 `tv_segments.meta`에 theorist_id를 스탬프하고 재컴파일해야 함 — P3 항목(§8).

### 5c. 실행 절차 (배치)

1. 0060 적용(스키마+함수). 적용 전 `select count(*) from tv_playlists;` 기록(현재 20).
2. `select tv_build_genre_playlists();` → 기존 18개가 axis 백필됐는지 확인.
3. 소형 축(리니지·감독·장르·국가·연대·이론가·교차) 1콜씩 순차 실행, **콜 사이 15초 대기 + 헬스체크**(§1-4).
4. **대형 3축 배치 러너**: 트로프(2,859)·아키타입(1,535)·컨셉(588)을 각각 `p_batch=300`으로 루프 — 트로프 ~10콜, 아키타입 ~6콜, 컨셉 2콜, **콜 사이 20초 대기 + 헬스체크**. 총 ~20콜, 예상 소요 15–20분. 중단 기준 발동 시 next_offset부터 재개(멱등이라 중복 안전).
5. `select tv_build_all_playlists();`는 이후 소형 축 갱신용 단일 진입점(신규 방송 컴파일 후 재실행). 대형 3축은 러너 스크립트를 재실행.

### 5d. 갱신 러너 (실행자 산출물)

`worker/tv-build-playlists.py` — 관리 API로 §5c의 3–4단계를 수행하는 단일 스크립트(헬스체크·슬립·재개 오프셋 내장). 이후 "방송 재컴파일 → 플레이리스트 리프레시"가 이 스크립트 1회 실행이 되도록.

---

## 6. 프론트 — 독립 slug 페이지 + 세부 페이지 임베드

### 6a. `/tv/list/[slug]` — 플레이리스트의 정규 색인 페이지 (독립 콘텐츠)

- `app/tv/list/[slug]/page.tsx` (ISR 300, `generateStaticParams(){return[]}`, per-slug lazy). Next 라우팅에서 정적 세그먼트 `list`가 동적 `/tv/[slug]`보다 우선하므로 충돌 없음.
- 데이터: `tv_watch(p_list=slug)` 1콜(인트로 포함) + `tv_playlists` 단행(메타).
- 본문: `/tv/watch`와 같은 가구 재사용 — 플레이어(인트로부터 자동 재생) + 아이템 그리드(각 영화 → `/tv/{film-slug}` 내부링크) + 원본 페이지 백링크(`href`).
- **SEO**: title = `{playlist.title} · METATAKE TV`(§4b 결과 그대로 — 제목이 곧 상품), description = dek+기준문장. JSON-LD: **CollectionPage + ItemList**(각 아이템 = `/tv/{film-slug}` URL, position) + BreadcrumbList(Home → METATAKE TV → 리스트). og:image = 첫 영화 백드롭 w1280. canonical `/tv/list/{slug}`.
- `/tv/watch?list=x`는 유지(재생 UI), `/tv/list/x`가 정규(색인) — watch 쪽은 이미 클라이언트 페이지라 색인 경쟁 없음.

### 6b. `PlaylistTVEmbed` — 세부 페이지 임베드 컴포넌트

- `components/PlaylistTVEmbed.tsx` (클라이언트): props `{slug, heading?}`. `/api/tv/watch?list={slug}` 페치 → 엔트리 있으면 `.df-tvhero`(기존 16:9 CSS 재사용) 안에 `TVProgramPlayer` + "Watch as a list ↗ /tv/list/{slug}" 링크. 404/빈 응답이면 **null 렌더**(페이지 무손상).
- 서버 게이트(권장): 각 페이지에서 `tv_playlists` exists 프로브(`axis`,`key`) 후 조건부 렌더 — FilmTVHero의 `filmHasProgram` 패턴 복제. 0059 정책으로 anon SELECT 가능.

### 6c. 임베드 삽입 지점 (P1 → P2 순)

| 페이지 | axis/key 매핑 | 비고 |
|---|---|---|
| `/director/[slug]` | director / director_slug | 감독 허브 RecordToc 아래 |
| `/lineage/[slug]` | lineage / list slug | 리스트 허브 상단부 |
| `/movements/[slug]` | lineage / (movement facet 리스트 slug) | 무브먼트=리니지 탑승 |
| `/genre/[slug]` | genre / 장르 원문(slugify 역변환 필요 — key에 원문 저장했으므로 페이지의 장르 원문으로 매칭) | |
| `/theorist/[slug]` | theorist / theorist uuid→slug 매핑(키를 **slug로 저장**할 것 — theorists.slug 존재 확인 후) | P2 |
| `/trope/[slug]` | trope / frames.slug | ⭐P1 승격(2,859개 — 최대 임베드 표면) |
| `/concept/[slug]` | concept / 슬러그화된 concept 텍스트(§2 정규식) | ⭐P1 |
| `/catalog/{seg}/[slug]` (아키타입 노드 페이지) | archetype / `{axis}:{node_slug}` — seg 매핑은 lib/catalog.ts `kindMeta` | ⭐P1 |
| 국가 페이지 | 현재 라우트 없음 → `/tv/list/country-*` 독립 페이지만 | 지도(/map) 연동은 후속 |

### 6d. 사이트맵 · 색인

- `lib/sitemap-data.ts`에 tv 자식 2개 추가: `tv-programs.xml`(1,794 — `/tv/{slug}`, lastmod=built_at), `tv-lists.xml`(**~5,500** — `/tv/list/{slug}`, lastmod=updated_at; 50k 한도 내라 단일 파일 가능하되 축별 2분할 권장: tv-lists-core.xml=소형 축+컨셉, tv-lists-patterns.xml=트로프+아키타입). 기존 17분할 인덱스에 등록.
- **tv-programs.xml은 비디오 사이트맵 확장으로**: 각 URL에 `<video:video>` 블록(thumbnail_loc=백드롭 w1280, title, description, player_loc=유튜브 embed, duration=Σseg초). `/tv/[slug]`의 VideoObject JSON-LD와 값 일치 필수(불일치는 리치결과 억제). ⚠️ 한계 인지: 방송 오버레이는 DOM 합성이라 "우리 영상 파일"이 아님 — 구글은 video를 유튜브 트레일러로 귀속할 수 있음. 진짜 자체 영상 인식은 ffmpeg 렌더 파이프라인(HANDOFF-metatake-tv.md) 이후의 일.
- IndexNow 재귀 스크립트로 신규 URL 핑. **GSC 제출은 원우 몫.**
- ⚠️ 사이트맵·미들웨어·lib 루트 파일은 워처가 커밋 안 함 — 수동 커밋.

---

## 7. QA · 수용 기준

```sql
-- 7-1 축별 개수 = §2 실측과 일치(±재컴파일 오차)
select axis, cut, count(*) from tv_playlists group by 1,2 order by 1;
-- 7-2 빈 플레이리스트 0
select count(*) from tv_playlists pl where not exists (select 1 from tv_playlist_items i where i.playlist_id=pl.id);
-- 7-3 인트로 누락 0 (신규 생성분)
select count(*) from tv_playlists where axis is not null and (intro is null or jsonb_typeof(intro)<>'array');
-- 7-4 제목 오염 0 (이중관사·미치환)
select count(*) from tv_playlists where title ~* 'the the |null' or title like '%\%s%';
-- 7-5 아이템 캡 준수 (≤40)
select max(n) from (select playlist_id, count(*) n from tv_playlist_items group by 1) s;
-- 7-6 피드 성능: 대형 리스트 1개 실측
explain analyze select tv_watch('lineage-palme-dor', null);   -- < 1.5s, payload < 700KB
```

- 라이브: `/tv/list/lineage-palme-dor`(예) 200 + CollectionPage/ItemList JSON-LD 존재, 인트로 브리핑이 첫 세그로 재생, `/director/bong-joon-ho`에 임베드 노출. 강화 축 표본: `/tv/list/theme-{node}` 1건 + `/tv/list/concept-{slug}` 1건 재생 스모크.
- 수용: 7-1이 §2 실측과 정합(트로프 ~2,859·아키타입 ~1,535·컨셉 ~588 — 재컴파일 오차 ±5% 허용), 7-2·7-3·7-4 = 0, 선반 payload < 200KB(캡 36 적용 후), `tv_directory(null,null,60,0)` < 300ms, 사이트 헬스 전 구간 정상.

## 8. 후속(P3, 이 지시서 범위 밖 — 기록만)

- **이론가·트로프 segments-cut**: 컴파일러 v3가 `tv_segments.meta`(jsonb)에 theorist_id·trope_id·country 스탬프 → 재컴파일(runbook은 WORKORDER-tv-corpus-build §5) → 진짜 엔티티 컷.
- 브라우즈 UI(`/tv/lists` 디렉토리 페이지: 정렬·검색·축 필터) — `tv_directory()` RPC가 준비됨.
- film 페이지 하단 "이 영화가 속한 워치리스트" 역링크 모듈.

## 9. 함정 모음 (이 저장소 실증 — 반드시 읽을 것)

- **RLS**: tv_*는 0059로 SELECT 정책 부여됨. **신규 tv_* 테이블을 만들면 정책 없이는 anon 0행**(조용한 실패 — 실제 사고).
- **선두 `The %s` 템플릿 금지**(이중관사 214세그 실증).
- **jsonb null 게이트**: `{"items":null}`은 `is null`에 안 걸림 → `jsonb_typeof(...)='array'`.
- **create-or-replace 오버로드**: 함수 인자 추가 금지. tv_watch는 시그니처 유지.
- **워처 범위**: app/components/lib만 자동 커밋. supabase/·docs/·루트는 수동.
- **배포 직후 라이브 감사**: ISR 구 캐시 오진 — 캐시버스터 + 코드 우선 확인.
- **unstable_cache null-포이즌**: exists 프로브 실패 시 false를 캐시하지 말고 throw(FilmTVHero 게이트 참조).
- lineage `status='merged'` 행 제외, `frames.merged_into is not null` 행 제외.
- theorists 복합표기 오염(단독 정본 부재 22.5%) — theorist 축은 **takes.theorist_id 기준**이라 영향 없지만, 표시 이름은 theorists.name 그대로 쓰고 정리하지 말 것(원우 결정 대기 사안).
