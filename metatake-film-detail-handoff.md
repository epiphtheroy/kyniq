# Metatake — 영화 상세 페이지 인수인계 문서 (Film Detail Spec)

> 대상 목업: **`metatake-film-detail-mockup.html`** (예시 데이터: *Au Hasard Balthazar* — 실데이터)
> 이 문서 + 목업 HTML만 보고 `/film/{slug}` 페이지를 그대로 구현할 수 있도록 작성.
> 홈과 **공유하는 디자인 토큰·네비·푸터**는 `metatake-home-handoff.md`(§4·§5)를 기준으로 하고, 여기서는 **영화 상세 고유의 구조·데이터·메커니즘**을 다룬다.
> 작성: 2026-06-26 · 프로젝트: Supabase `kyniq`(ref `jvgarcqrtsmgfimdcwgo`) / Vercel.

---

## 0. 한눈에 보기 (TL;DR)

- **무엇:** 모든 카드가 도착하는 **핵심 데스티네이션**. IMDb '타이틀 페이지'의 IA(마스트헤드 + 스티키 서브네비 + 길게 이어지는 섹션)를 가져오되, metatake의 비평 콘텐츠(Strong Misreadings·Figures·Tropes·Lineage)를 본문으로 채운다.
- **별점:** `film_ratings`에 **IMDb·Metascore·RT가 실제로** 있으니 그대로 노출. metatake 고유 헤드라인 지표는 **FIGURES · STRONG MISREADINGS · TROPES · CONNECTED FILMS** 스탯 스트립.
- **본문 데이터는 전부 실제 테이블에서 온다** (아래 §5 매핑). 목업의 이미지(포스터/백드롭)만 TMDB 자리 placeholder.
- **14개 섹션** 순서·앵커는 라이브 페이지와 1:1. 스티키 서브네비 + 스크롤스파이로 이동.

---

## 1. 파일 링크

작업 폴더 `/Users/jerryje/Documents/MetaTake/`

| 파일 | 역할 |
|---|---|
| **`metatake-film-detail-mockup.html`** | 이 문서의 구현 기준 (영화 상세) |
| `metatake-film-detail-handoff.md` | 이 문서 |
| `metatake-home-handoff.md` | 홈 인수인계 — **공유 디자인 토큰/네비/푸터의 단일 출처** |
| `metatake-home-mockup-v7.html` | 홈 최종 목업 (네비·푸터·카드 시스템 참조원) |

---

## 2. 의도 (왜 이렇게)

1. **영화가 종착지다.** 홈의 모든 레일·카드는 결국 `/film/{slug}`로 온다. 따라서 이 페이지는 "한 편을 깊게 읽는 경험"의 정점이어야 한다.
2. **IMDb 타이틀 페이지 문법을 차용:** 큰 마스트헤드(포스터+평점+액션) → 스티키 서브네비 → 길게 이어지는 콘텐츠 섹션. 단, IMDb의 출연/박스오피스 대신 metatake의 **비평 본문**을 채운다.
3. **신뢰는 외부 평점 + 구조 지표로:** 유저 활동이 적으므로(홈 문서 §2.3) 사용자 평점/조회수 대신 **IMDb/Meta/RT(외부)** 와 **figures/readings/tropes/connected(구조)** 로 권위를 만든다.
4. **Strong Misreadings가 주인공:** 이 페이지의 핵심 차별점. 14개 비평 프레임워크의 "대담한 오독 + THE LEAP"을 가장 공들여 디자인한다.
5. **스포일러 정책:** 상단 Invitation/Why watch는 **spoiler-free**, 그 아래 Strong Misreadings부터는 "do not hold back"(결말 포함). 페이지가 이 경계를 시각적으로 표시한다.

---

## 3. 정보구조 (섹션 순서 · 앵커 id)

마스트헤드(dark) → **스티키 서브네비**(dark) → 본문(밝음/paper-2/다크 교차).

| # | 섹션 | 앵커 id | 밴드 |
|---|---|---|---|
| — | 상단 네비 (홈과 동일) | — | dark |
| — | **마스트헤드** (백드롭·포스터·평점·스탯·CTA) | — | dark |
| — | **스티키 서브네비** (12 앵커 + 스크롤스파이) | — | dark |
| 1 | An Invitation (에디토리얼 인트로, spoiler-free) | `#invitation` | paper |
| 2 | Why watch (렌즈 카드) | `#why` | paper-2 |
| 3 | **Strong Misreadings** (14 프레임워크, 그룹) | `#readings` | paper |
| 4 | Figures (그룹 그리드) | `#figures` | paper-2 |
| 5 | Connection map (라이브 노드 그래프) | `#map` | dark |
| 6 | Tropes (instantiates) | `#tropes` | paper |
| 7 | Archetype (카탈로그 칩) | `#archetype` | paper-2 |
| 8 | Lineage — canons & lists | `#lineage` | paper |
| 9 | Recommended by (역추천) | `#recby` | paper-2 |
| 10 | Reception (리뷰 카드) | `#reception` | paper |
| 11 | Watch next (9 큐레이션) | `#watchnext` | paper-2 |
| 12 | Films most connected + Prev/Index/Next + 출처 | `#connected` | paper |
| — | 푸터 (홈과 동일) | — | dark |

> 서브네비 앵커 12개 = 본문 섹션 12개. 순서를 바꾸면 스크롤스파이 매핑도 함께 유지할 것.

---

## 4. 디자인 시스템

### 4.1 공유 토큰 (홈과 동일 — `metatake-home-handoff.md` §4 참조)
색 변수(`--paper`, `--ink`, `--red #C8102E`, `--gold #E8A100`, `--dark #100D0A` …), 폰트(Newsreader/Spectral/Inter), 섹션 헤더(`.shead` + 크림슨 4px 세로바), 밴드(`.band`/`.p2`/`.dark`), 네비·푸터는 **홈과 100% 동일**하게 재사용.

### 4.2 이 페이지 고유 컴포넌트 & 크기
| 요소 | 사양 |
|---|---|
| 컨테이너 | max 1280px / 좌우 26px (공통) |
| 마스트헤드 그리드 | `212px / 1fr`, gap 30px. 포스터 2/3, 반경 10px, ＋리본 |
| 백드롭 | 풀블리드 그라데이션 오버레이(좌→우 어둡게). 실구현 TMDB `backdrop_path` |
| 제목 | 50px / 600 세리프 (≤1020:38px, ≤680:32px), 연도는 300 weight |
| 메타 칩 | 장르·러닝타임·등급·국가, 12px/600, 보더 pill |
| 평점 박스 | IMDb(★ gold + votes), **Metascore**(녹색 박스), **RT**(빨강 박스) |
| 스탯 스트립 | 4칸(Figures·Strong Misreadings·Tropes·Connected films), 값 26px, max-width 560px |
| CTA | `▶ Watch trailer`(크림슨 primary) · `＋ Add to Shelf`(ghost) · `▦ Where to stream`(ghost) |
| 스티키 서브네비 | `position:sticky; top:60px`(네비 높이만큼), 높이 48px, 가로 스크롤, 활성=흰색+크림슨 밑줄 |
| Invitation | max-width 820px, 본문 18px/1.62, **드롭캡 62px 크림슨**, 하단 spoiler 노트 |
| Why watch 카드 | 2열 그리드, `.whycard`(렌즈 라벨 + 2포인트: label + desc) |
| **Reading 카드** | 2열 그리드, `.rcard`: 상단 [프레임워크 칩 + via 피규어] · 제목 21px · 본문 14.5px · **THE LEAP**(크림슨 좌측 3px 보더 + 이탤릭) |
| Reading 그룹 헤더 | `.rgroup-h` 대문자 라벨 + 하단 hairline (매크로 그룹 구분) |
| Figure 카드 | 3열, `.figcard`(이름 + 2줄 설명 + "N readings / Open →") |
| Connection map | 높이 420px, viewBox 1180×420. 중심=영화(크림슨 r13), 링=figure(빈 원 + red-soft 링 r7), 외곽=reading(크림슨 r5). 4.2초마다 재배치 |
| Tropes | 2열 행 리스트, 우측 영화수 배지(크림슨 pill) |
| Archetype | 그룹별 칩(테마/정체성/장소/오브젝트), 반복수 배지 |
| Lineage | 행 리스트 + 랭크 배지(ink 박스 `#25`) + 연도 + 국기 |
| Recommended by | 리드 문장 + 영화 칩(연도 작게) + "+N more" |
| Reception | 2열, `.revcard`(헤드라인 + 출처·연도 + verbatim 인용) |
| Watch next | 3열, `.wncard`(큰 번호 + 제목/감독 + bridge 이유 + "not yet on metatake·TMDB") |
| Films connected | 가로 레일, `.cfilm` 156px 포스터 2/3 |
| Film nav | Prev / Index(감독) / Next 3분할 + 편집 출처(이탤릭) |
| 반응형 | 1020px(마스트헤드·그리드 1열화), 680px(추가 축소) |

---

## 5. 섹션별 상세 스펙 (데이터 매핑 · 라우트 · 메커니즘)

> 표기: **소스** = Supabase 테이블.컬럼. 모두 `films.id` 기준 조인.

### 5.0 마스트헤드
- **소스:** `films`(title, year, director, director_slug, **backdrop_path, poster_path**, runtime, certification, genres, tagline, tmdb_id, imdb_id) + `film_ratings`(imdb_rating, imdb_votes, metascore, rt_tomatometer).
- **스탯 스트립:** Figures = `count(figures where film_id)`; **Strong Misreadings** = `count(takes where ...)`; Tropes = `count(distinct takes.meta_take_id)`; Connected films = `count(film_next where source_film_id)` 또는 임베딩 이웃 수.
- **이미지:** 포스터 `https://image.tmdb.org/t/p/w500{poster_path}`, 백드롭 `…/w1280{backdrop_path}`.
- **▶ 트레일러:** TMDB videos(`films.tmdb_id`의 YouTube key). `figures.youtube_query`도 보조.
- **Where to stream:** JustWatch via TMDB watch/providers (국가 선택). 라이브 고지문 그대로: "Source: JustWatch · via TMDB."
- **라우트:** 감독명 → `/director/{director_slug}`. "Movies like" → 동일 페이지 #connected 또는 추천.

### 5.1 An Invitation
- **의도:** 스포일러 없이 "왜 이 영화가 지도에 있는가"를 에디토리얼 한 단락으로. 드롭캡으로 잡지 느낌.
- **소스:** 편집 인트로 텍스트(에디토리얼 메서드 생성). ⚠️ **저장 위치 확인 필요** — `film_asset` 또는 films-레벨 intro 컬럼/별도 테이블. (목업은 라이브 문구 사용.)
- **카피:** 하단에 "○ Spoiler-free. The readings below do not hold back." — 스포일러 경계 표시.

### 5.2 Why watch ✅소스 확정
- **소스:** **`film_asset.lenses`** (jsonb 배열). 각 원소 `{ "key": "...", "points": [ {"label","text"}, {"label","text"} ] }`.
- **렌즈 key(8):** `auteur_vision, aesthetic_innovation, technical_mastery, philosophical_inquiry, cinematic_lineage, spatial_aesthetics, critical_reception, context_&_discourse`.
- **표시:** 카드 1개 = 렌즈 1개(라벨 대문자) + 2포인트(label 굵게 + text). 목업은 4개 노출 + "+4 more lenses".
- **스포일러:** spoiler-free 영역.

### 5.3 Strong Misreadings ★핵심
- **의도:** metatake의 차별점. "대담한 오독 + 그 도약(THE LEAP)". 프레임워크별 1개씩, 영화당 보통 14개.
- **소스:** `takes`(rationale = 본문, **framework**, **leap**, take_title 또는 생성 제목, status, strength, upvotes) JOIN `figures`(label → "via …", slug) JOIN `meta_takes`(연결 트로프). `films.id`로 필터.
- **14개 프레임워크:** Subtext, Ontology, Semiotics, Enigma, Production, Location, Context, Reception, Psychoanalysis, Ethics, Politics, Counterpart, Parallel, Title (`takes.framework`).
- **UI 그룹(매크로):** Reading from within(Subtext/Ontology/Semiotics/Enigma) · Form, making & context(Production/Location/Context/Reception) · Mind, ethics & politics(Psychoanalysis/Ethics/Politics) · Existential parallels(Counterpart/Parallel) · Title & invitation(Title). *그룹핑은 프론트 매핑 상수*.
- **카드:** 프레임워크 칩 + via 피규어(이탤릭) + 제목 + 본문 + **THE LEAP**(`takes.leap`).
- **라우트:** 각 reading 상세(있다면) 또는 피규어/트로프로. via 피규어 → 피규어 상세.

### 5.4 Figures
- **소스:** `figures`(label, description, kind, slug) + 리딩 수 = `count(takes where figure_id)`. `kind`로 그룹(CHARACTERS / OBJECTS & SYMBOLS / LOCATIONS / FORM & TECHNIQUE).
- **표시:** 이름 + 2줄 설명 + "N readings · Open →".
- **라우트:** 피규어 상세(`figures.slug`).

### 5.5 Connection map
- **의도:** "이 영화 = 중심, 피규어 = 링, 리딩 = 외곽"의 라이브 지도.
- **소스:** `figures`(이 영화) + `takes`(리딩) + `meta_take_edges`(a,b,similarity)로 인접. 임베딩 기반.
- **메커니즘:** 중심 노드 1 + 피규어 링(원형 배치) + 리딩 외곽. `setInterval 4200ms` 재배치 + fade. 노드 클릭 = 진입(영화/피규어/트로프 라우트).

### 5.6 Tropes (instantiates)
- **소스:** 이 영화의 `takes` → `meta_takes`(title, slug, **film_count**) distinct. via = 그 take의 `figures.label`. 배지 = `meta_takes.film_count`(전 영화 공유 수).
- **라우트:** 트로프 상세 → `meta_takes.slug`. ⚠️ 경로 미확정(홈 문서 §9.3, `/tropes/{slug}` 404) — 코드에서 확정.

### 5.7 Archetype
- **소스:** 이 영화 figures의 아키타입 분류(아키타입 카탈로그). 그룹: THEME / IDENTITY / COMPLEX / PLACE / OBJECT. 반복수 배지.
- **라우트:** 각 칩 → Archetype 카탈로그.
- ⚠️ 아키타입 카탈로그 테이블/뷰명 코드 확인(피규어 kind 또는 별도 archetype 매핑).

### 5.8 Lineage — canons & lists ✅소스 확정
- **소스:** `film_lineage`(film_id, list_id, edition_id, **rank**, result, facet) JOIN `lineage_lists`(label, country) JOIN `lineage_editions`(year).
- **표시:** 랭크 배지(`#25`) + 리스트명 + "of N · 연도" + 국기. (예: Sight & Sound Critics' #25/100 2022 GB …)
- **라우트:** 리스트 → `/lineage/{list slug}`.

### 5.9 Recommended by (역추천) ✅로직 확정
- **의도:** "이 영화를 *다른 영화들이* 자기 Watch next에 넣은" 횟수 — 이웃 영화의 추천(클릭 아님).
- **소스:** `film_next` 역방향 — `count(* where target_film_id = 이 영화)` 및 그 source 영화 목록. (예: 43편.)
- **표시:** 리드 문장("These 43 films name it among their nine Watch next picks") + 영화 칩 + "+N more".
- **라우트:** 칩 → `/film/{slug}`.
- **주의:** 홈의 "Recommended by"(캐논/감독)와는 다른 의미 — 카피로 구분.

### 5.10 Reception ✅소스 확정 + 인용 규칙
- **소스:** `film_reception`(kind, outlet, critic, year, tier, headline, comment, verdict, **verbatim**, url, position).
- **인용 규칙(중요):** **`verbatim = true`인 행만 짧은 인용문 노출 가능**(예: Slant, tier='verdict'). 나머지(tier='title', verbatim=false)는 **헤드라인 + 출처 + 연도 + 링크만**. 라이브 고지: "Headlines & ≤10-word quotes from publishers' link previews. No article text is stored." — 저작권 안전선 유지.
- **표시:** 카드(헤드라인 + 출처·연도 + (verbatim 시)인용). url로 외부 링크.

### 5.11 Watch next ✅소스 확정
- **소스:** `film_next`(position, rec_title, rec_year, rec_director, **reason**, target_film_id, poster_path). "Curated, not algorithmic."
- **표시:** 번호 + 제목/연도/감독 + bridge 이유. `target_film_id`가 null이면 **"not yet on metatake · TMDB ↗"**(TMDB로 외부 링크).
- **라우트:** target 있으면 `/film/{slug}`, 없으면 TMDB.

### 5.12 Films most connected · Prev/Next · 출처
- **most connected:** 임베딩 최근접(`meta_take_edges`/유사도). 포스터 레일.
- **Prev/Index/Next:** 같은 감독 필모그래피 내 인접(연도순). Index → `/director/{director_slug}`.
- **출처:** "Generated by the metatake editorial method (AI-drafted) · created {created_at} · editor {name}".

---

## 6. 데이터 레이어 — 이 페이지가 쓰는 테이블

```
films            id, title, year, director, director_slug, poster_path, backdrop_path,
                 runtime, certification, genres, tagline, tmdb_id, imdb_id, slug, visible
film_ratings     imdb_rating, imdb_votes, metascore, rt_tomatometer            (마스트헤드 평점)
film_asset       lenses(jsonb [{key,points:[{label,text}]}])                   (Why watch)
takes            figure_id, meta_take_id, rationale, framework, leap,
                 take_title, strength, upvotes, status                          (Strong Misreadings)
figures          film_id, label, description, kind, slug                        (Figures / via)
meta_takes       slug, title, film_count                                        (Tropes)
meta_take_edges  a, b, similarity                                               (Connection map / connected)
film_lineage     film_id, list_id, edition_id, rank, result, facet              (Lineage)
lineage_lists    label, country, …   lineage_editions: year                     (Lineage 메타)
film_next        source_film_id, target_film_id, position, rec_title,
                 rec_year, rec_director, reason, poster_path                     (Watch next / Recommended by 역방향)
film_reception   kind, outlet, critic, year, tier, headline, comment,
                 verdict, verbatim, url, position                                (Reception)
```

### 6.1 섹션별 예시 SQL (한 영화 기준; `:id` = films.id)
```sql
-- 마스트헤드 평점
select imdb_rating,imdb_votes,metascore,rt_tomatometer from film_ratings where film_id=:id;

-- 스탯
select (select count(*) from figures where film_id=:id)                       as figures,
       (select count(*) from takes t join figures f on f.id=t.figure_id
          where f.film_id=:id)                                                as strong_misreadings,
       (select count(distinct t.meta_take_id) from takes t join figures f
          on f.id=t.figure_id where f.film_id=:id)                            as tropes,
       (select count(*) from film_next where source_film_id=:id)              as connected;

-- Why watch
select lenses from film_asset where film_id=:id;

-- Strong Misreadings (그룹은 프론트에서 framework→macro 매핑)
select t.framework, t.take_title, t.rationale, t.leap, f.label as via_figure, f.slug
from takes t join figures f on f.id=t.figure_id
where f.film_id=:id and t.status='published' order by t.framework;

-- Lineage
select ll.label, le.year, ll.country, fl.rank
from film_lineage fl join lineage_lists ll on ll.id=fl.list_id
left join lineage_editions le on le.id=fl.edition_id
where fl.film_id=:id order by fl.rank;

-- Recommended by (역추천 수 + 목록)
select count(*) from film_next where target_film_id=:id;

-- Watch next
select position,rec_title,rec_year,rec_director,reason,target_film_id
from film_next where source_film_id=:id order by position;

-- Reception (verbatim 규칙 주의)
select outlet,critic,year,tier,headline,comment,verbatim,url
from film_reception where film_id=:id order by position;
```

### 6.2 "진짜 vs placeholder"
| 항목 | 상태 |
|---|---|
| IMDb·Metascore·RT, figures/readings/tropes/connected 카운트 | **실데이터** |
| Why watch 렌즈, Strong Misreadings 본문·LEAP, Figures, Tropes, Lineage, Watch next, Reception | **실데이터** |
| 포스터/백드롭/트레일러 | placeholder → **TMDB 교체** |
| An Invitation 저장 필드 | **확인 필요**(§5.1) |
| 아키타입 카탈로그 소스 | **확인 필요**(§5.7) |
| 트로프 상세 라우트 | **확인 필요**(홈 문서 §9.3) |

---

## 7. 라우팅 & 연결 (Vercel/Next.js)

- **경로:** `/film/[slug]` (App Router 동적 라우트). `films.slug`로 fetch, 없으면 404.
- **렌더:** SSG + ISR 권장(`generateStaticParams`로 `visible=true` 영화 prebuild, `revalidate`). 페이지 데이터는 §6.1 쿼리들을 서버에서 1회 묶어 fetch(또는 `film_page` 캐시 뷰/RPC).
- **이미지:** `next/image`, `image.tmdb.org` 허용. 포스터 w500 / 백드롭 w1280 / 인물 w342.
- **외부 링크:** Reception `url`, Watch next의 미수록작 TMDB, JustWatch providers.
- **내부 링크:** 감독 `/director/{director_slug}`, 피규어 `/figure/{slug}`(확인), 트로프 `meta_takes.slug`(경로 확인), 캐논 `/lineage/...`, 인접작 `/film/{slug}`.
- **env:** 홈과 동일(`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, 서버용 service role).

---

## 8. 메커니즘 (인터랙션)

| 메커니즘 | 동작 |
|---|---|
| 스티키 서브네비 | `position:sticky; top:60px`(네비 높이). 가로 스크롤, 스크롤바 숨김. |
| 스크롤스파이 | `IntersectionObserver`(rootMargin `-120px 0 -65% 0`)로 현재 섹션 링크에 `.on` 토글. |
| Connection map | 중심 1 + 피규어 링 + 리딩 외곽, `setInterval(4200ms)` 재배치 + `.gfade`. 노드 `<a>` 클릭 진입. |
| 앵커 이동 | 서브네비 클릭 → `scroll-behavior:smooth`로 섹션 이동(스티키 오프셋 고려해 `scroll-margin-top` 권장). |
| 스포일러 경계 | Invitation/Why watch는 spoiler-free 표기, 이후 섹션은 결말 포함. |

> 구현 팁: 각 `section[id]`에 `scroll-margin-top:112px`(네비 60 + 서브네비 48 + 여유)를 줘서 앵커 점프 시 제목이 서브네비에 가리지 않게 한다.

---

## 9. 구현 체크리스트

- [ ] `/film/[slug]` 동적 라우트 + SSG/ISR, 404 처리.
- [ ] 마스트헤드: 백드롭/포스터(TMDB) + IMDb/Meta/RT(film_ratings) + 스탯 스트립 4개(카운트 쿼리) + CTA.
- [ ] 스티키 서브네비(top:60px) + 스크롤스파이 + `scroll-margin-top`.
- [ ] An Invitation(저장 필드 확정) + spoiler-free 표기.
- [ ] Why watch: `film_asset.lenses` 렌더(8 렌즈, 2포인트).
- [ ] Strong Misreadings: `takes`+`figures`+`meta_takes`, framework→매크로 그룹 매핑, THE LEAP.
- [ ] Figures: kind 그룹 + 리딩 수.
- [ ] Connection map: 임베딩 이웃, 재배치 애니메이션, 클릭 라우팅.
- [ ] Tropes(film_count 배지) / Archetype(카탈로그) / Lineage(랭크 배지).
- [ ] Recommended by: `film_next` **역방향** 카운트+목록.
- [ ] Reception: `film_reception` — **verbatim=true만 인용**, 나머지 헤드라인+링크.
- [ ] Watch next: `film_next` 정방향, 미수록작 TMDB 링크.
- [ ] Films connected 레일 + Prev/Index/Next(감독 필모) + 편집 출처.
- [ ] 공유 네비/푸터/토큰은 홈과 단일 컴포넌트로.
- [ ] 반응형(1020/680).

## 10. 미해결 (Open questions)
1. **An Invitation** 텍스트 저장 위치(필드/테이블) 확정.
2. **Archetype 카탈로그** 소스 테이블/뷰 확정.
3. **트로프/피규어 상세 라우트** 확정(홈 문서 §9.3).
4. Strong Misreadings **노출 정렬/상한**(전부 vs strength 상위) 정책.
5. 스포일러 레벨(`figures.spoiler_level`)로 본문 토글 제공 여부.

---

## 11. 부록 — 이 페이지 CSS 클래스 글로서리
```
.masthead/.mast-bg/.mast-grid/.crumb/.poster      마스트헤드
.mtitle/.mdir/.mmeta/.movieslike                  제목·메타
.ratings/.rb/.meta-box/.rt-box                    IMDb/Meta/RT 평점
.statstrip/.s                                     metatake 스탯(4)
.mcta/.b(.primary/.ghost)                         CTA 버튼
.subnav (a.on)                                    스티키 서브네비 + 활성
.band(.p2/.dark) / .shead                         섹션 프레임(홈과 공유)
.invite/.drop/.spoiler                            Invitation(드롭캡)
.whygrid/.whycard/.cat/.pt                        Why watch 렌즈 카드
.rgroup-h / .readings / .rcard/.fw/.via/.rt/.body/.leap   Strong Misreadings
.figgroup/.figgrid/.figcard                       Figures
.graphbox/#graph/.gnode/.gedge/.gfade             Connection map
.tropelist/.troperow/.cnt                         Tropes
.archgroup/.archchips/.c/.b                        Archetype
.canonlist/.canonrow/.rank/.flag                  Lineage
.recby/.recchips                                  Recommended by
.revgrid/.revcard                                 Reception
.wngrid/.wncard/.no/.wr/.tmdb                      Watch next
.rail/.cfilm                                      Films connected
.filmnav/.prov                                    Prev·Next·출처
footer/.fgrid/.fbrand/.fbar/.tmdb                 푸터(홈과 공유)
```

---
*문서 끝. 디자인 의도 §2, 구조 §3, 크기 §4, 데이터·SQL §5/§6, 라우트 §7, 인터랙션 §8. 공유 토큰은 `metatake-home-handoff.md` 기준. 구현은 이 문서 + `metatake-film-detail-mockup.html`을 1:1로 따라가면 됩니다.*
