# Metatake — 감독 상세 페이지 인수인계 문서 (Director Detail Spec)

> 대상 목업: **`metatake-director-detail-mockup.html`** (예시 데이터: *Stanley Kubrick* — 실데이터)
> 이 문서 + 목업 HTML만 보고 `/director/{slug}` 페이지를 그대로 구현할 수 있도록 작성.
> 공유 디자인 토큰·네비·푸터·`.band`/`.shead`·마스트헤드·스티키 서브네비·스크롤스파이는 **영화 상세(`metatake-film-detail-mockup.html`)와 100% 동일**하게 재사용한다.
> 작성: 2026-06-26 · 프로젝트: Supabase `kyniq`(ref `jvgarcqrtsmgfimdcwgo`) / Vercel.

---

## 0. 한눈에 보기 (TL;DR)

- **무엇:** 한 감독을 "필모그래피 전체를 가로질러 읽는" 데스티네이션. 영화 상세(`/film/{slug}`)의 마스트헤드 + 스티키 서브네비 + 길게 이어지는 섹션 IA를 그대로 가져오되, 본문을 **감독 단위로 집계된 비평 콘텐츠**(Strong Misreadings·Signature Tropes·Archetype)와 **인물 자체**(Portrait·The Life)로 채운다.
- **헤드라인 지표:** 마스트헤드 스탯 스트립 = **FILMS · READINGS · TROPES** (영화 상세의 4칸 대신 3칸). Kubrick = 10 · 143 · 87.
- **본문 데이터는 전부 실제 테이블에서 온다** (아래 §5 매핑). 인물 사진/포스터만 TMDB 자리 placeholder.
- **8개 섹션** 순서·앵커는 스티키 서브네비와 1:1. IntersectionObserver 스크롤스파이로 이동.
- **감독 전용 테이블은 이미 존재한다:** `director_facts`, `director_portrait`, `director_picks`, `director_next` (Kubrick 행 확인됨, facts 21개).

---

## 1. 파일 링크

작업 폴더 `/Users/jerryje/Documents/MetaTake/`

| 파일 | 역할 |
|---|---|
| **`metatake-director-detail-mockup.html`** | 이 문서의 구현 기준 (감독 상세) |
| `metatake-director-detail-handoff.md` | 이 문서 |
| `metatake-film-detail-mockup.html` | **공유 디자인 시스템의 단일 출처** — 토큰/네비/푸터/마스트헤드/서브네비/스크롤스파이/그래프 JS |
| `metatake-film-detail-handoff.md` | 영화 상세 인수인계 — 본 문서가 미러링한 구조 |
| `metatake-home-mockup-v7.html` | 홈 최종 목업 (네비·푸터·카드 시스템 참조원) |

---

## 2. 의도 (왜 이렇게)

1. **감독은 필모그래피를 묶는 렌즈다.** 영화 상세의 `/film/{slug}` 페이지에서 감독 이름·인덱스를 누르면 여기로 온다. 따라서 이 페이지는 "한 작가의 강박을 통째로 읽는 경험"이어야 한다.
2. **영화 상세의 문법을 그대로 차용:** 큰 마스트헤드(인물+스탯+CTA) → 스티키 서브네비 → 길게 이어지는 섹션. 단, 영화 1편의 figures/reception/lineage 대신 **감독 단위 집계**(필모 전체에서 가장 강한 misreadings, 반복되는 tropes/archetype)와 **전기적 콘텐츠**(Portrait 에세이, The Life 팩트)를 둔다.
3. **신뢰는 구조 지표 + 검증된 팩트로:** 유저 활동이 적으므로(홈/영화 문서와 동일 전제) 평점/조회수 대신 **films/readings/tropes 카운트**와 **라이브 웹 소스로 검증된 The Life 팩트**로 권위를 만든다.
4. **Strong Misreadings가 주인공:** 영화 상세와 동일하게 핵심 차별점. 단 여기서는 **영화당 최대 2개**로 추려, 감독 전체에서 가장 강한 readings만 노출(143개 중 ~6개 미리보기).
5. **큐레이션 강조:** Who's Next / Where to Start 모두 "curated, not algorithmic" — 알고리즘 추천이 아니라 편집된 친연(kinship) 경로임을 카피로 명시.

---

## 3. 정보구조 (섹션 순서 · 앵커 id)

마스트헤드(dark) → **스티키 서브네비**(dark) → 본문(밝음/paper-2/다크 교차).

| # | 섹션 | 앵커 id | 밴드 |
|---|---|---|---|
| — | 상단 네비 (영화/홈과 동일) | — | dark |
| — | **마스트헤드** (인물·이름·생몰·스탯·CTA) | — | dark |
| — | **스티키 서브네비** (8 앵커 + 스크롤스파이) | — | dark |
| 1 | **Portrait** (에디토리얼 에세이 bio, 드롭캡) | `#portrait` | paper |
| 2 | **Strong Misreadings** (영화당 ≤2, 프레임워크 그룹) | `#readings` | paper-2 |
| 3 | Signature Tropes (반복 figure-type ×count) | `#tropes` | paper |
| 4 | Archetype (THEME/CHARACTER/IDENTITY/PLACE 칩) | `#archetype` | paper-2 |
| 5 | The Life (팩트 카드 + source ↗) | `#life` | paper |
| 6 | Who's Next (감독 5명, kinship 이유) | `#next` | dark |
| 7 | Filmography (10 영화 카드, Shelf 토글·★·readings) | `#filmography` | paper |
| 8 | Where to Start (가이드 패스 카드) | `#start` | paper-2 |
| — | 푸터 (영화/홈과 동일) | — | dark |

> 서브네비 앵커 8개 = 본문 섹션 8개. 순서를 바꾸면 스크롤스파이 매핑도 함께 유지할 것.
> 각 `section[id]`에 `scroll-margin-top:112px`(네비 60 + 서브네비 48 + 여유)을 줘 앵커 점프 시 제목이 서브네비에 가리지 않게 함.

---

## 4. 디자인 시스템

### 4.1 공유 토큰 (영화 상세와 동일)
색 변수(`--paper:#FCFBF7`, `--ink:#1A1714`, `--red:#C8102E`, `--gold:#E8A100`, `--dark:#100D0A`, `--paper-2`, `--ink-soft`, `--line`, `--dline` …), 폰트(Newsreader 세리프 디스플레이 / Spectral 본문 / Inter UI), 섹션 헤더(`.shead` + 크림슨 4px 세로바), 밴드(`.band`/`.p2`/`.dark`), 네비(다크 스티키, Meta/take 빨강 박스 로고, ≡ Menu, 검색, Ask AI, Shelf, ＋아바타, EN), 푸터(TMDB 고지문 포함)는 **영화 상세 HTML에서 그대로 복사**.

### 4.2 이 페이지 고유 컴포넌트 & 크기
| 요소 | 사양 |
|---|---|
| 컨테이너 | max 1280px / 좌우 26px (공통) |
| 마스트헤드 그리드 | `212px / 1fr`, gap 30px. **인물 프레임은 3/4 비율**(영화의 포스터 2/3와 구분), 반경 10px |
| 인물 프레임 | `.portrait-fr` 3/4, dark 그라데이션 + 이니셜(SK) placeholder. 실구현 TMDB `profile_path` → `image.tmdb.org/t/p/w342` |
| 라벨 | `.mlabel` "DIRECTOR", 10px/700, red-soft, letter-spacing .18em |
| 이름(제목) | `.mtitle` 50px / 600 세리프 (≤1020:38px, ≤680:32px) |
| 생몰·이름뜻 | `.mdir` "Born July 26, 1928 · New York City…" + `.meaning`(이탤릭, name_meaning) |
| 즐겨찾기 | `.fav` "♡ Add to favorites", red-soft |
| 스탯 스트립 | **3칸**(FILMS·READINGS·TROPES), 값 26px, max-width 460px (영화는 4칸/560px) |
| CTA | `＋ Follow`(크림슨 primary) · `▦ Filmography`(ghost, `#filmography` 점프) |
| 스티키 서브네비 | `position:sticky; top:60px`, 높이 48px, 가로 스크롤, 활성=흰색+크림슨 밑줄 (영화와 동일 클래스 `.subnav`) |
| Portrait | `.invite` max-width 820px, 본문 18px/1.62, **드롭캡 62px 크림슨**, 하단 "editorial method (AI-drafted)" 노트 |
| **Reading 카드** | `.rcard` 2열 그리드: 상단 [프레임워크 칩 + **영화·연도**(`.fm`) + via 피규어(`.via`)] · 제목 21px · 본문 14.5px · **THE LEAP**(크림슨 좌 3px 보더 + 이탤릭). *영화 상세 대비 추가된 것은 `.fm`(영화·연도) — 감독 페이지는 readings가 여러 영화에 걸치므로 출처 영화 명시.* |
| Reading 그룹 헤더 | `.rgroup-h` 대문자 라벨 + 하단 hairline |
| Signature Tropes | `.tropelist` 2열 행 리스트, 우측 **×count 배지**(크림슨 pill) |
| Archetype | `.archgroup` 그룹별 칩(THEME/CHARACTER/IDENTITY/PLACE) + count 배지(`.b`) |
| **The Life** | `.lifegrid` 2열, `.factcard`(번호 + 팩트 텍스트 + `source ↗` 링크). 하단 "Each fact verified against a live web source." |
| **Who's Next** | dark 밴드, `.wngrid` 3열, `.wncard`(원형 이니셜 아바타 + 이름 + kinship 이유 + "Open director →"). `/director/{slug}`로 링크 |
| **Filmography** | `.fgrid` 5열, `.fcard`(포스터 2/3 + **Shelf 토글**(＋↔✓) + ★ gold rating + 제목(연도) + "N readings"). `/film/{slug}`로 링크 |
| **Where to Start** | paper-2, `.apath-row` 4열 그리드, `.apk`(label + 영화 + 연도 + 1–2문장 이유). `/film/{slug}`로 링크 |
| 출처 노트 | `.prov` 이탤릭 중앙정렬 (editorial method · facts verified · TMDB) |
| 반응형 | 1020px(마스트헤드 1열, readings/tropes/life 1열, who's-next 2열, filmo 3열, path 2열), 680px(추가 축소) |

> **그래프 JS는 그대로 이식되어 있으나(`graph()` + `setInterval(4200)`)**, 본 IA에는 connection-map 섹션이 없어 `if(!GSVG)return;` 가드로 안전하게 no-op 처리. connection-map을 추가하려면 영화 상세의 `<section id="map">` + `<svg id="graph">` 블록을 붙이면 즉시 동작한다.

---

## 5. 섹션별 상세 스펙 (데이터 매핑 · 라우트 · 메커니즘)

> 표기: **소스** = Supabase 테이블.컬럼. 감독 단위는 `director_slug`, 영화 단위는 `films.id`/`films.director_slug` 기준.

### 5.0 마스트헤드
- **이름·생몰·이름뜻:** `director_facts`(director_slug, **name_meaning**, intro, facts). 생년월일은 **`facts` jsonb 또는 TMDB person**에서. (Kubrick: slug `stanley-kubrick`, name_meaning 있음, facts 21개 — 확인됨.)
- **인물 사진:** TMDB person `profile_path` → `image.tmdb.org/t/p/w342{profile_path}`. 저장 위치는 `director_next.profile_path`/`tmdb_person_id`가 다른 감독용이므로, 본 감독 person 이미지는 **TMDB person fetch 또는 별도 컬럼 확인 필요**(아래 §10).
- **스탯 스트립(3):**
  - FILMS = `count(*) from films where director_slug=:slug`
  - READINGS = `count(*) from takes t join figures f on f.id=t.figure_id join films fi on fi.id=f.film_id where fi.director_slug=:slug`
  - TROPES = `count(distinct t.meta_take_id)` 위와 동일 조인 (또는 감독에 걸친 반복 meta_take 수)
- **CTA:** `＋ Follow`(팔로우 토글), `▦ Filmography`(`#filmography` 앵커).
- **라우트:** breadcrumb "Directors" → `/directors`.

### 5.1 Portrait
- **의도:** 인물 한 명을 에세이 한 단락으로. 드롭캡으로 잡지 느낌. 영화 상세의 An Invitation과 동일 컴포넌트(`.invite/.drop`).
- **소스:** **`director_portrait`**(director_slug, **body**, source) — body = 에세이 본문. 또는 `director_facts.intro`(짧은 인트로). 목업은 라이브 에디토리얼 문구 사용.
- **카피:** 하단 "○ Metatake editorial method (AI-drafted)."

### 5.2 Strong Misreadings ★핵심
- **의도:** 감독 전체에서 가장 강한 "대담한 오독 + THE LEAP". 영화당 최대 2개로 추려 143개 중 ~6개 미리보기 + "See all 143 →".
- **소스:** `takes`(rationale=본문, **framework**, **leap**, take_title, **strength**, status) JOIN `figures`(label→"via …", slug) JOIN `films`(director_slug 필터). 영화당 `strength` 상위 ≤2.
- **카드 구성(감독 전용):** 프레임워크 칩 + **영화·연도**(`.fm` — 어느 영화의 reading인지) + via 피규어(이탤릭) + 제목 + 본문 + **THE LEAP**(`takes.leap`).
- **그룹(매크로):** 영화 상세와 동일한 framework→매크로 매핑 상수(Reading from within / Context, reception & title / …). 목업은 2그룹 예시.
- **라우트:** 각 reading 상세(있다면) 또는 출처 영화 `/film/{slug}` / via 피규어 `/figure/{slug}`.

```sql
-- 감독의 강한 readings (영화당 최대 2)
select * from (
  select t.framework, t.take_title, t.rationale, t.leap, t.strength,
         fi.title as film_title, fi.year as film_year, fi.slug as film_slug,
         f.label as via_figure, f.slug as figure_slug,
         row_number() over (partition by fi.id order by t.strength desc) as rn
  from takes t
  join figures f on f.id = t.figure_id
  join films  fi on fi.id = f.film_id
  where fi.director_slug = :slug and t.status = 'published'
) x where rn <= 2 order by strength desc;
```

### 5.3 Signature Tropes
- **의도:** 감독이 반복하는 figure-type. ×count = 그의 필모 중 몇 편에서 나타나는지.
- **소스:** `meta_takes`(title, slug) — 감독의 `takes` → `meta_take_id`를 distinct 후, 같은 meta_take이 그 감독의 **여러 영화**에 걸쳐 등장하는 수를 카운트. 반복(≥2) 상위 노출.
- **표시:** `.troperow`(이름 + 부연 + ×N 배지). 라우트: 트로프 상세 → `meta_takes.slug`(경로 미확정 — §10).

```sql
select mt.title, mt.slug, count(distinct fi.id) as film_count
from takes t
join figures f on f.id = t.figure_id
join films  fi on fi.id = f.film_id
join meta_takes mt on mt.id = t.meta_take_id
where fi.director_slug = :slug
group by mt.id, mt.title, mt.slug
having count(distinct fi.id) >= 2
order by film_count desc;
```

### 5.4 Archetype
- **의도:** 감독의 figures를 카탈로그 아키타입으로 분류, 그룹별(THEME/CHARACTER/IDENTITY/PLACE) 반복수 칩.
- **소스:** 감독 figures의 아키타입 분류 — `figure_taxonomy` / `taxonomy_nodes`(2,928행) / `figure_type_members`. 그룹 축(theme/character/identity/place)으로 묶고 count.
- **라우트:** 각 칩 → Archetype 카탈로그.
- ⚠️ 카탈로그 그룹 축의 정확한 컬럼명은 `taxonomy_nodes` 스키마로 확정(§10).

### 5.5 The Life ✅소스 확정
- **의도:** "인물 그 자체". 검증된 전기적 팩트 카드.
- **소스:** **`director_facts.facts`** (jsonb 배열). Kubrick = **21개 확인됨**. 각 원소는 `{fact, source_url}` 형태(필드명은 jsonb 내부 확인 — `fact`/`source`/`url` 중). 목업은 ~13개 노출 + "All 21 facts →".
- **표시:** `.factcard`(번호 + `fact` 텍스트 + `source ↗`=source_url 외부 링크). 하단 "Each fact verified against a live web source."

```sql
select facts from director_facts where director_slug = :slug;
-- facts: jsonb array, e.g. [{"fact":"...","source_url":"https://..."}, ...]
```

### 5.6 Who's Next ✅소스 확정
- **의도:** "다음에 볼 감독 5명" — kinship(친연) 이유 첨부. 알고리즘 아님.
- **소스:** **`director_next`**(director_slug, **pos**, **rec_name**, **reason**, **target_slug**, tmdb_person_id, profile_path). pos 순.
- **표시:** `.wncard`(원형 아바타=profile_path 또는 이니셜 + rec_name + reason + "Open director →"). 아바타 이미지 `image.tmdb.org/t/p/w185{profile_path}`.
- **라우트:** `target_slug` → `/director/{target_slug}`.

```sql
select pos, rec_name, reason, target_slug, profile_path
from director_next where director_slug = :slug order by pos;
```

### 5.7 Filmography
- **소스:** `films`(id, title, year, slug, poster_path) where `director_slug=:slug`, 연도순. ★ = `film_ratings.imdb_rating`. "N readings" = 그 영화의 Strong Misreadings 수 = `count(takes) join figures(film_id)`.
- **표시:** `.fcard`(포스터 2/3 = `image.tmdb.org/t/p/w500{poster_path}` + **Shelf 토글** + ★ rating + 제목(연도) + "N readings"). 노트: "readings count = number of Strong Misreadings · Bio & images via TMDB."
- **라우트:** `/film/{slug}`.

```sql
select fi.title, fi.year, fi.slug, fi.poster_path,
       r.imdb_rating,
       (select count(*) from takes t join figures f on f.id=t.figure_id
          where f.film_id = fi.id and t.status='published') as readings
from films fi
left join film_ratings r on r.film_id = fi.id
where fi.director_slug = :slug
order by fi.year;
```

### 5.8 Where to Start ✅소스 확정
- **의도:** 필모를 처음 접하는 사람을 위한 가이드 패스(읽는 순서 + 이유).
- **소스:** **`director_picks`**(director_slug, **pos**, film_id, **film_slug**, film_title, film_year, **label**, **reason**). pos 순. label = "Start here / The peak / Deep cut" 등.
- **표시:** `.apk`(label 대문자 크림슨 + film_title + film_year + reason).
- **라우트:** `film_slug` → `/film/{film_slug}`.

```sql
select pos, label, film_title, film_year, film_slug, reason
from director_picks where director_slug = :slug order by pos;
```

---

## 6. 데이터 레이어 — 이 페이지가 쓰는 테이블

```
films            id, title, year, director, director_slug, poster_path, slug      (마스트헤드/필모)
film_ratings     film_id, imdb_rating, imdb_votes, metascore, rt_tomatometer      (필모 ★)
director_facts   director_slug, name_meaning, intro, facts(jsonb)                 (헤더/이름뜻/The Life)
director_portrait director_slug, body, source                                     (Portrait 에세이)
director_picks   director_slug, pos, film_id, film_slug, film_title, film_year,
                 label, reason                                                    (Where to Start)
director_next    director_slug, pos, rec_name, reason, target_slug,
                 tmdb_person_id, profile_path                                     (Who's Next)
takes            figure_id, meta_take_id, rationale, framework, leap,
                 take_title, strength, status                                     (Strong Misreadings)
figures          id, film_id, label, description, kind, slug, status              (via 피규어 / Archetype)
meta_takes       id, slug, title                                                  (Signature Tropes)
taxonomy_nodes / figure_taxonomy / figure_type_members                            (Archetype 분류)
```

### 6.1 "진짜 vs placeholder"
| 항목 | 상태 |
|---|---|
| FILMS/READINGS/TROPES 카운트 | **실데이터** (counts over films+takes) |
| Portrait 에세이, name_meaning | **실데이터** (`director_portrait.body` / `director_facts`) |
| Strong Misreadings 본문·LEAP·framework | **실데이터** (`takes`, 영화당 strength 상위 ≤2) |
| The Life 팩트 + source | **실데이터** (`director_facts.facts` jsonb, 21개) |
| Who's Next (감독 + 이유) | **실데이터** (`director_next`) |
| Filmography + ★ + readings 수 | **실데이터** (`films`+`film_ratings`+`takes`) |
| Where to Start (label + 영화 + 이유) | **실데이터** (`director_picks`) |
| Signature Tropes ×count | **실데이터** (`meta_takes` 집계) — 목업 수치는 예시 |
| Archetype 그룹/count | 분류 축 컬럼 **확인 필요**(§10) — 목업 수치는 예시 |
| 인물 사진 / 영화 포스터 | placeholder → **TMDB 교체** |
| 생년월일 정확 위치 | facts/TMDB person **확인 필요** |

---

## 7. 라우팅 & 연결 (Vercel/Next.js)

- **경로:** `/director/[slug]` (App Router 동적 라우트). `director_facts.director_slug`(또는 `films.director_slug` distinct)로 fetch, 없으면 404.
- **렌더:** **SSG + ISR** 권장. `generateStaticParams`로 readings가 있는 감독 prebuild, `revalidate`. 페이지 데이터는 §5 쿼리들을 서버에서 1회 묶어 fetch(또는 `director_page` 캐시 뷰/RPC).
- **이미지:** `next/image`, `image.tmdb.org` 허용. 인물 w342(마스트헤드)/w185(Who's Next), 포스터 w500(필모).
- **내부 링크:** Filmography·Where to Start 영화 → `/film/{slug}`; Who's Next → `/director/{target_slug}`; 피규어 `/figure/{slug}`(확인); 트로프 `meta_takes.slug`(경로 확인); Archetype 칩 → 카탈로그.
- **외부 링크:** The Life의 `source ↗`(검증 웹 소스 url).
- **env:** 홈/영화와 동일(`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, 서버용 service role).

---

## 8. 메커니즘 (인터랙션)

| 메커니즘 | 동작 |
|---|---|
| 스티키 서브네비 | `position:sticky; top:60px`(네비 높이). 가로 스크롤, 스크롤바 숨김. (영화와 동일 `.subnav`) |
| 스크롤스파이 | `IntersectionObserver`(rootMargin `-120px 0 -65% 0`)로 현재 섹션 링크에 `.on` 토글. (영화와 동일 코드) |
| 앵커 이동 | 서브네비/CTA 클릭 → `scroll-behavior:smooth`. `section[id] { scroll-margin-top:112px }`로 제목이 서브네비에 안 가리게. |
| Filmography Shelf 토글 | `.fcard .shelf` 클릭 → `.on` 토글, 텍스트 ＋↔✓ (목업 JS). 실구현은 `user_movies`/`user_saves`에 upsert. |
| Signature-map(선택) | 그래프 JS는 이식돼 있으나 `#graph` 미존재 시 no-op. connection-map 섹션을 붙이면 중심=감독, 링=films, 외곽=tropes로 즉시 동작. |

---

## 9. 구현 체크리스트

- [ ] `/director/[slug]` 동적 라우트 + SSG/ISR, 404 처리.
- [ ] 마스트헤드: 인물(TMDB profile) + 생몰/이름뜻(`director_facts`) + 스탯 3칸(FILMS/READINGS/TROPES 카운트 쿼리) + CTA(Follow / Filmography 앵커).
- [ ] 스티키 서브네비(top:60px, 8앵커) + 스크롤스파이 + `scroll-margin-top`.
- [ ] Portrait: `director_portrait.body` 드롭캡 에세이 + "AI-drafted" 노트.
- [ ] Strong Misreadings: `takes`+`figures`+`films`, **영화당 strength 상위 ≤2**, framework→매크로 그룹, `.fm`(영화·연도) + THE LEAP, "See all 143".
- [ ] Signature Tropes: `meta_takes` 감독 집계, ×count 배지.
- [ ] Archetype: figures 분류(`taxonomy_nodes`/`figure_taxonomy`) 그룹별 칩 + count.
- [ ] The Life: `director_facts.facts` jsonb 카드 + `source ↗` + "verified" 노트.
- [ ] Who's Next: `director_next`(pos 순) 5장, profile 아바타, `/director/{target_slug}`.
- [ ] Filmography: `films`(연도순) + `film_ratings`★ + readings 수 + Shelf 토글, `/film/{slug}`.
- [ ] Where to Start: `director_picks`(pos 순) label+영화+이유, `/film/{film_slug}`.
- [ ] 공유 네비/푸터/토큰은 영화 상세와 단일 컴포넌트로.
- [ ] 반응형(1020/680).

## 10. 미해결 (Open questions)
1. **생년월일** 정확 저장 위치 — `director_facts.facts` 내부 vs TMDB person fetch.
2. **본 감독 인물 사진** 저장 컬럼 — `director_next.profile_path`는 추천 감독용. 본인 profile_path 컬럼/뷰 또는 TMDB person fetch 확정.
3. **`director_facts.facts` jsonb 내부 필드명** — `fact`/`source`/`source_url`/`url` 중 무엇인지 한 행 샘플로 확정.
4. **Archetype 분류 축** — `taxonomy_nodes`의 THEME/CHARACTER/IDENTITY/PLACE 그룹 컬럼명 확정.
5. **트로프/피규어 상세 라우트** 확정(영화 문서 §10과 공유 이슈).
6. **Signature Tropes 집계 정의** — "여러 영화에 걸친 반복" 기준(≥2) 및 ×count 의미 확정.

---

## 11. 부록 — 이 페이지 CSS 클래스 글로서리
```
.masthead/.mast-bg/.mast-grid/.crumb               마스트헤드(영화와 공유)
.portrait-fr/.ini                                   인물 프레임(3/4) + 이니셜
.mlabel/.mtitle/.mdir/.meaning/.fav                 라벨·이름·생몰·이름뜻·즐겨찾기
.statstrip/.s                                       스탯(3): FILMS/READINGS/TROPES
.mcta/.b(.primary/.ghost)                           CTA(Follow / Filmography)
.subnav (a.on)                                      스티키 서브네비 + 활성(영화와 공유)
.band(.p2/.dark) / .shead                           섹션 프레임(영화/홈과 공유)
.invite/.drop/.spoiler                              Portrait 에세이(드롭캡)
.rgroup-h/.readings/.rcard/.fw/.fm/.via/.rt/.body/.leap   Strong Misreadings (.fm=영화·연도 추가)
.tropelist/.troperow/.tn/.tv/.cnt                   Signature Tropes (×count)
.archgroup/.archchips/.c/.b                         Archetype 칩
.lifegrid/.factcard/.no/.ft/.src/.lifenote          The Life 팩트 카드
.wngrid/.wncard/.av/.ii/.wt/.wr/.wo                 Who's Next (dark)
.fgrid/.fcard/.pos/.shelf/.rate/.nm/.rd/.fnote      Filmography
.apath-row/.apk/.lab/.ti/.yr/.rs                    Where to Start (가이드 패스)
.graphbox/#graph/.gnode/.gedge/.gfade               (선택) Signature-map 그래프
.prov                                               출처 노트
footer/.ffgrid/.fbrand/.fbar/.tmdb                  푸터(영화/홈과 공유)
```

---
*문서 끝. 디자인 의도 §2, 구조 §3, 크기 §4, 데이터·SQL §5/§6, 라우트 §7, 인터랙션 §8. 공유 토큰·네비·푸터·마스트헤드·서브네비·스크롤스파이·그래프 JS는 `metatake-film-detail-mockup.html` 기준. 구현은 이 문서 + `metatake-director-detail-mockup.html`을 1:1로 따라가면 됩니다.*
