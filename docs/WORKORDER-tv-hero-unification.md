# 작업 지시서 — 전 엔티티 페이지 영상 히어로 통일 (METATAKE TV Hero Unification)

**상태: 대기 (원우 OK 후 실행). 이 문서만 보고 실행 가능하도록 작성됨.**
작성 2026-07-11 (Opus 기획). 배경: 루트 `HANDOFF-서프라이즈-v2채널-스트리밍.md` §C2~C2-c (방송 1,794편 + 전략 플레이리스트 5,559개 라이브), `docs/WORKORDER-tv-strategic-playlists.md`(완료).

---

## 0. 목표 (원우 지시 원문 기준)

> "모든 페이지를 영상으로 시작하는 페이지로 통일합니다. … 상단 영상은 이번에 만든 영상이 있으면 넣고 없으면 그냥 일반 해당 영화 영상을 랜덤플레이 하면 됩니다."

film 페이지처럼 **모든 엔티티 페이지가 상단 블랙 16:9 영상으로 시작**한다. 우선순위 폴백 체인:

1. **컴파일된 플레이리스트 방송**이 있으면 그것을 재생 (`/api/tv/watch?list=…` → TVProgramPlayer, 인트로 브리핑부터).
2. 없으면 **해당 엔티티 영화들의 일반 트레일러를 랜덤 플레이** (플레인 릴, 오버레이 없음 — 클라이언트에서 셔플).
3. 트레일러도 없으면 히어로 생략(페이지 무손상 — 지금 모양 유지).

부수 원칙 (이미 라이브에 반영된 것 포함):
- **SEO 헤딩 규칙**: "Watch this as a METATAKE TV list" 같은 제네릭 문구 금지. 헤딩·타이틀은 반드시 **엔티티를 특정**해야 한다("Palme d'Or on METATAKE TV — every listed film as a broadcast"). 이 규칙은 2026-07-11에 PlaylistTVEmbed 호출부 4곳+컴포넌트 폴백(페치된 플레이리스트 제목)으로 이미 수정됨 — 신규 히어로도 동일 규칙.
- H1·본문 텍스트는 유지(순서: 크럼 → **영상 히어로** → H1/데크 → 본문). film 페이지와 동일한 "영상 먼저, 텍스트 다음" 리듬.
- CLS 방지: 히어로는 aspect-ratio 16/9 고정 박스(`.df-tvhero` 재사용) — 로딩 중에도 자리 확보.

---

## 1. ⚠️ 이 저장소의 함정 (필독 — 전부 실사고 근거)

1. **anon 3초 statement_timeout**: 무거운 anon RPC는 함수레벨 `set statement_timeout to '12s'` 필수(tv_watch에 적용됨). 신규 RPC(`tv_reel`)도 동일하게.
2. **RLS**: tv_*는 0059로 SELECT 정책 있음. `media`/`films` 등 기존 테이블은 이미 anon 읽기 가능(현 film 페이지가 사용 중) — 신규 테이블 만들지 말 것.
3. **create-or-replace 오버로드**: 함수 시그니처 변경 금지(신규 함수는 자유).
4. **unstable_cache null-포이즌**: 로더 실패 시 null 캐시 금지 — throw.
5. **워처 범위**: app/components/lib만 자동 커밋. supabase/·docs/는 수동 커밋.
6. **배포 직후 라이브 감사**: ISR 구캐시 오진 — 캐시버스터 + 코드 우선.
7. **자동화 탭 검증**: `document.hidden=true`면 유튜브 muted-autoplay가 게이팅되어 검게 보임(정상). 렌더 강제(스크린샷) 후 판정.
8. 서버 안전: 광폭 멀티조인 금지. 이 작업의 신규 쿼리는 전부 단일 인덱스 조회 수준.

---

## 2. 신규 부품 (마이그 0061 + 컴포넌트 2개)

### 2a. RPC `tv_reel(p_slugs text[], p_cap int default 10)` — 폴백 트레일러 릴

영화 slug 배열 → 클린 트레일러 유튜브 ID 목록(영화당 1개, 결정론 순서). **0058 게이트와 동일한 클린 필터** 사용:

```sql
create or replace function public.tv_reel(p_slugs text[], p_cap int default 10)
returns jsonb
language sql stable security definer set search_path to 'public' set statement_timeout to '8s'
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', ext, 'title', t) order by ord), '[]'::jsonb)
  from (
    select distinct on (f.id)
      md.external_id ext, coalesce(md.title, f.title) t, hashtext(f.slug) ord
    from unnest(p_slugs) s(slug)
    join films f on f.slug = s.slug
    join media md on md.entity_type='film' and md.entity_id=f.id and md.kind='video'
      and md.title ~* 'trailer|teaser'
      and md.title !~* 'explain|featurette|behind the scenes|interview|review|breakdown|react|making of|commentary'
    order by f.id, (md.title !~* 'trailer'), md.position nulls last
    limit 200
  ) q
  order by ord
  limit greatest(1, least(p_cap, 20))
$$;
```

주의: `limit 200`은 입력 slug 폭주 방어(호출부도 slug ≤ 60으로 자를 것). 호출은 각 페이지의 **기존 unstable_cache 로더 안**에서(페이지 캐시에 동승 — 추가 캐시 키 불필요).

### 2b. `components/EntityTVHero.tsx` (클라이언트) — 통일 히어로

```tsx
export default function EntityTVHero({ playlist, reel, label, listHref, backdrop }: {
  playlist?: string;                    // tv_playlists.slug (없으면 릴 전용)
  reel: { id: string; title: string }[]; // tv_reel 결과(서버에서 전달)
  label: string;                        // 엔티티명 — 접근성 라벨·타이틀에 사용
  listHref?: string;                    // "/tv/list/{slug}" 링크(플레이리스트 있을 때)
  backdrop?: string | null;             // 로딩 리본 배경(TMDB path)
})
```

동작(= FilmTVHero의 일반화 — FilmTVHero 로직을 복제하되 film 특수부 제거):
1. `playlist` 있으면 `/api/tv/watch?list=` 페치 → entries>0 → `TVProgramPlayer`(entries, entryIdx 상태, onEntryEnd로 다음 엔트리, 인트로부터 자동).
2. entries 0/에러 또는 playlist 미지정 → `reel`을 **클라이언트에서 셔플**해 FilmHeroReel 방식 재생(간단 구현: youtube-nocookie iframe + `playlist=` 체인 + loop, FloatingTrailerDock의 src 패턴 재사용 — YT API 불필요. 음소거 토글은 postMessage).
3. reel도 비면 `null` 반환(페이지가 히어로 없이 지금 모양 유지).
- 래퍼: `<section className="df-tvhero ehero">` (aspect 16/9, 기존 CSS 재사용) + 우상단 "Watch as a list ↗"(listHref, 플레이리스트 재생 중일 때만).
- 로딩 중: backdrop + "● Tuning in…" 리본(`.df-tvhero--load` 재사용) — 유튜브 이중로드 방지.
- **SEO**: 헤딩은 히어로 안에 넣지 않는다(페이지 H1이 이미 엔티티 특정). `aria-label={label + " — video"}`만.

### 2c. CSS

기존 `.df-tvhero` 계열 재사용 + `.ehero{margin:10px 0 18px}` 정도. 모바일에서 높이 과대 방지: `.ehero{max-height:min(62vh,560px)}` + 내부 letterbox(aspect 유지, `margin:auto`).

---

## 3. 적용 대상 전수 (라우트 조사 완료 — 2026-07-11 기준)

### P1 — 플레이리스트 축이 존재하는 페이지 (히어로=방송, 폴백=릴)

| 페이지 | playlist slug | 폴백 릴 소스(로더가 이미 로드) | 삽입 위치 | 기존 하단 임베드 |
|---|---|---|---|---|
| `/director/[slug]` | `director-{slug}` | filmography `films[].slug` | dr-crumb 다음, dr-head 앞 | **제거**(히어로로 대체) |
| `/lineage/[slug]` | `lineage-{slug}` | `lineage_list_films` → film_slug (visible 우선 상위 40) | lh-crumb/브레드크럼 다음, H1 앞 | **제거** |
| `/movements/[slug]` | `lineage-{slug}` | `d.films[].slug` | lh-crumb 다음, MovementHubClient 앞 | **제거** |
| `/genre/[slug]` | `genre-{slug}` | `inGenre[].slug` 상위 40 | H1 앞 | **제거** |
| `/trope/[slug]` | `trope-{slug}` | members `film_slug` distinct | rd-hero(다크 히어로) **안이 아니라 위** — crumb 다음 | **제거** |
| `/concept/[slug]` | `concept-{slug}` | readings/topFilms `film_slug` | 각 분기 H1 앞(두 분기 모두) | **제거** |
| `/theorist/[slug]` | `theorist-{slug}` (150명만 존재 — 없으면 자동 릴 폴백) | `filmArr[].slug` | rd-hero 위 | (임베드 없음 — 신규) |
| `/catalog/[seg]/[slug]` (아키타입 노드) | `arch-{axis(_→-)}-{slug}` — axis는 `kindBySeg(seg).kind` | `catalog_node_members` → film_slug distinct | 헤더 다음 | (신규) |
| `/atlas/[slug]` (국가 허브) | `country-{slug}` ⚠️ 키 매핑 검증 필요(아래 §4) | `c.films[].slug` | 인트로 문장 아래, 지도 위 | (신규) |

### P2 — 플레이리스트 축이 없는 페이지 (릴 전용)

| 페이지 | 릴 소스 | 비고 |
|---|---|---|
| `/credits/[person]` | `catalogFilms()` 결과 slug (visible 우선) 상위 40 | 크루엔 축 없음 — 릴 전용. (후속: crew 축 플레이리스트 = P3) |
| `/atlas/[slug]/[city]` | 도시 멤버 films | 국가 허브 완료 후 |
| `/tradition/[slug]` (학파) | theory_school_detail의 대표 영화들(로더 확인 필요) | 영화 집합이 빈약하면 스킵 판정 |

### 스킵 (근거 명시)

- `/film/[slug]` 계열, `/tv/*`: 이미 영상 시작.
- `/movies-like/[slug]`, `/whereto/[slug]`, `/takescore/film/[slug]`: 단일 영화 유틸 페이지 — film 페이지가 정본 히어로 보유, 중복 유튜브 로드만 늘림.
- `/frame/[slug]`(질문 프레임 26개), `/blog/*`, `/now/*`, `/take/[slug]`, `/u/*`, `/room/*`: 영화-집합 페이지가 아니거나 뉴스/개인 표면.
- `/concept/domain/[domain]`, `/catalog/[seg]`(색인): 집계 색인 — P3에서 판단.

### 국가별 "필요 텍스트" (원우 지시 항목)

`/atlas/[slug]`엔 이미 규칙 문장("N films … shot on location in X — P mapped places")이 있음. 추가로 히어로 아래 **방송 라인** 1줄(LLM-0):
> `{k} of these films have METATAKE TV broadcasts — watch them as one list.` (k = 플레이리스트 n_films, listHref 링크)
national 무브먼트 허브·lineage national 리스트도 동일 라인 삽입(플레이리스트 존재 시). 데이터는 EntityTVHero가 페치한 payload의 `playlist.n_films`를 그대로 사용(클라이언트 렌더 — 서버 텍스트가 필요하면 tv_playlists 단행 조회를 로더에 추가).

---

## 4. 사전 검증 (실행자가 코딩 전에 확인)

1. **atlas 국가 slug ↔ country 플레이리스트 key**: `select slug from tv_playlists where axis='country' limit 45` vs lib/atlas의 국가 slug 생성 규칙 대조. 불일치 국가는 매핑 테이블(soft: `country-`+slug 시도 → 실패 시 릴 폴백이라 치명적이지 않음).
2. **catalog axis→slug**: `arch-` slug는 `replace(axis,'_','-')` — `kindBySeg`로 seg→kind 역변환 후 조립, 실제 존재 여부는 히어로가 자동 폴백하므로 안전.
3. `tv_reel` 스모크: Spielberg filmography로 8–10개 ID 반환, ~수십 ms 확인.

---

## 5. 실행 순서

1. 마이그 0061(`tv_reel`) 적용 → 스모크.
2. `EntityTVHero` + CSS. FilmTVHero는 **그대로 두되**(film 전용 폴백 체계 상이) 내부 릴 재생부를 EntityTVHero와 공용 함수로 뽑아도 좋음(선택).
3. P1 9개 페이지: 로더에 `tv_reel` 호출 추가(기존 unstable_cache 안, slug ≤ 60 캡) → 히어로 삽입 → 하단 PlaylistTVEmbed 제거.
4. P2 3개 페이지.
5. tsc(신규 파일 0 에러 기준 — 베이스라인 오염 있음) → 커밋(워처가 app/components 자동, supabase/docs 수동) → 배포 → 라이브 스모크.

## 6. QA · 수용 기준

- P1 각 축 대표 1페이지: 방송 재생(인트로 → 챕터), "Watch as a list ↗" 링크, H1 순서 유지.
- 플레이리스트 없는 케이스(예: 이론가 151위 밖, 아키타입 소수 노드): 릴 랜덤 재생 확인.
- 릴도 없는 케이스: 히어로 미출현 + 레이아웃 무손상.
- 모바일 375px: 히어로 높이 ≤62vh, CLS 0(고정 aspect).
- 성능: 페이지당 유튜브 iframe ≤1(하단 임베드 제거 확인), `/api/tv/watch` 캐시 히트(2회째 <300ms).
- SEO: 각 페이지 소스에 제네릭 문구 0(grep 'Watch this as a METATAKE'), H1 앞 텍스트는 크럼뿐.

## 7. 후속(P3, 범위 밖 기록)

- crew 축 플레이리스트(`credits/[person]` 방송) — 사람별 filmography가 소스, tv_build_crew_playlists.
- `/catalog/[seg]` 색인·domain 허브 히어로.
- 이론가·트로프 segments-cut(컴파일러 v3 meta 스탬프) — 기존 미착수 항목과 동일.
