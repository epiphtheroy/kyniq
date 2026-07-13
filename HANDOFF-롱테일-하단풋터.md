# 종합 인수인계 — 롱테일 페이지 하단 "더 읽을거리 + 유도" 풋터 (ReadPlates · DirectorPlates · HubExplore)

> 다른 AI/사람이 이 파일 하나로 현황·이력·파일위치·운영절차·불변식을 파악해 이어받기 위한 문서.
> 프로젝트 루트: `/Users/jerryje/Documents/MetaTake/` · Supabase: `kyniq` (id `jvgarcqrtsmgfimdcwgo`, Tokyo)
> 작성 2026-07-13(3라운드 모두 SHIPPED·라이브검증). 자매 문서: `HANDOFF-왓투와치-스트리밍결정.md`·`HANDOFF-테이크스코어-스크리너.md`·`docs/HANDOFF-SEO-마스터.md`(SEO 전체 정본).
> auto-memory: `readplates-film-footer-reinforced.md`(회상 인덱스 — 상세는 이 파일이 정본).

---

## 0. TL;DR — 무엇을 왜 했나

**문제(오너 제보):** 응급하게 SQL 텍스트로 찍어낸 롱테일 페이지들이 하단이 앙상하고, 유입된 영화의 메인페이지로 가는 "바로가기 버튼"조차 없었다. 요구: ①유입 영화 메인으로 유도(링크 + 소개 + 방문 CTA), ②우리가 만든 "플레이트 전략"을 더 보강, ③하단을 풍성하게(다양한 슬레이트), ④맨 하단에 **각 영화 자기** TV 방송 직행 링크, ⑤SEO 불리 금지(중복 콘텐츠 오해 회피).

**핵심 발견:** "플레이트 전략"의 실체는 이미 있던 `components/read/ReadPlates.tsx`(다크 "More on {film}" 카드 행)였고 8개 페이지에만 붙어 있었으며, 빈틈이 컸다(플레이트 5종 누락·CTA 부재·미커버 3~4페이지). → **병렬 시스템 신설 금지, 기존 계통을 보강**하는 방향으로 진행(파일럿으로 만든 `filmFooterData`/`FilmFooter`는 되돌려 단일 계통 유지).

**3라운드 전부 SHIPPED·라이브검증(commit):**
| 라운드 | 계통 | commit | 대상 |
|---|---|---|---|
| ① 단일 영화 | `ReadPlates` 보강 | `fd1bc60` | 메인페이지 CTA버튼 + 자기 TV방송 링크 + 플레이트 5종 추가, 미커버 4페이지 배선 |
| ② figure + 감독 | `ReadPlates`(figure)·`DirectorPlates`(CTA) | `c7b236e` | figure 페이지에 ReadPlates, DirectorPlates에 "About this director" CTA, director/locations 배선 |
| ③ 엔티티 허브 | `HubExplore` 신설 | `06cdb4e` | genre·lineage·frame·tradition·movement·person에 "Keep exploring" |

결과: 사이트의 **모든 롱테일 페이지 계열**이 하단에서 해당 영화/감독/카테고리로 풍성하게 유도한다.

---

## 1. 파일 맵

| 파일 | 역할 |
|---|---|
| `components/read/ReadPlates.tsx` | **단일-영화** 풋터. CTA 배너("About this film" + 메인 유도 버튼 + 자기 TV 버튼) + "More on {film}" 플레이트 그리드. `<ReadPlates slug={filmSlug} exclude="..." artPaths={?} />` |
| `components/read/DirectorPlates.tsx` | **감독** 풋터(ReadPlates의 감독판). "About this director" CTA + "More on {director}" 그리드. `<DirectorPlates slug={directorSlug} exclude="..." />` |
| `components/HubExplore.tsx` | **엔티티/카테고리 허브** 풋터. "Keep exploring" = 형제 엔티티 + 인덱스 + 인접 레이어. `<HubExplore kind="..." slug={...} />` |
| `lib/hubExplore.ts` | HubExplore 데이터 계층(형제 소스 kind별 + 캐시 + 게이트) |
| `lib/urls.ts` | 필름 서브표면 URL 헬퍼(receptionUrl·misreadingsFilmUrl·filmLocationsUrl·filmLineageUrl·takescoreFilmUrl·filmCreditsUrl·filmGalleryUrl·tvUrl) — 단일 소스 |
| `app/curious/curious.css` | `.cur .rd-cta*` 스타일(다크 플레이트 팔레트 스코프) — ReadPlates/DirectorPlates CTA 배너용 |
| `components/curious/ui.tsx` | `Card`·`SectionHead`(플레이트 카드 UI, 손 안 댐) |
| `components/RelatedBoxes.tsx` + `lib/related.ts` | **별도 계통**(figure/q/take/trope/tier2-catalog). 손대지 않음. figure·q 페이지는 ReadPlates와 **둘 다** 스택 |

**배선된 페이지(호출부):**
- 단일영화(ReadPlates): `/film/[slug]/{[desk],[desk]/ko,credits,gallery,misreadings,reception,q/[..],figure/[..]}` · `/film/locations/[slug]` · `/film/lineage/[slug]` · `/movies-like/[slug]` · `/takescore/film/[slug]` · `/whereto/[slug]`
- 감독(DirectorPlates): `/director/[slug]` 및 `/{life,start,next,locations,honors,reception,misreadings,takescore,theory}`
- 허브(HubExplore): `/genre/[slug]` · `/lineage/[slug]` · `/frame/[slug]` · `/tradition/[slug]` · `/movements/[slug]` · `/credits/[person]`

---

## 2. 아키텍처 — 3계통

### 2.1 단일 영화 = `ReadPlates`
- **로더** `loadPlates(slug)`: `unstable_cache(["read-plates-2", slug], 1h, tags:[film:slug])`. 필름 행(+overview/director) + questions/essays(desk)/posts(daily) + **게이트 배치**(takescore/reception/movies-like/tv). `film.visible=false`면 null(Tier-2는 풋터 없음 — 안전).
- **CTA 배너**: 포스터→`/film/[slug]`, overview 리드(없으면 폴백 문장), "Read the full Metatake analysis of {title} →" 버튼, 방송 있으면 "▶ Watch on Metatake TV →"(그 영화 `/tv/[slug]`).
- **플레이트(게이트, 우선순위순, cap 14)**: TakeScore·Reception·Misreadings·Locations·Lineage·Movies-like·Where to watch·**Metatake TV**·Credits·Gallery·Questions·Desk essays·Daily. 기존 "hub" 플레이트는 제거(CTA가 대체).

### 2.2 감독 = `DirectorPlates`
- 로더 `["director-plates-1", slug]` 24h. 감독 films + director surface 카운트.
- CTA 배너: 톱 필름 포스터→`/director/[slug]`, 결정적 리드, "Explore everything on {director} →". (감독 단일 TV 방송은 없어 TV 버튼 생략.)
- 플레이트: life·start·next·locations·honors·reception·misreadings·takescore·theory + 톱 필름 카드(cap 12). hub 플레이트 제거.

### 2.3 엔티티 허브 = `HubExplore`
- 허브는 카테고리/인물 → 단일영화 CTA 부적합. **가로(동종 형제) + 세로(인덱스·인접 레이어)** 탐색.
- `hubExploreData(kind, slug)` `["hub-explore-1", kind, slug]` 24h → `{ intro, siblings, browse, crossLinks }`.
- **형제 소스(kind별)**:
  - `genre`: **공출현 그래프** `cachedGenreGraph()`(전체 `films.genres` 1회 페이징·캐시·전 장르 공유) — 같은 영화에 함께 붙는 장르 상위 12.
  - `lineage`: `lineage_lists` 같은 `facet`, `film_count` 내림차순.
  - `frame`: `frames` 같은 `dimension`, `merged_into is null`.
  - `tradition`: `theory_schools_index()` RPC(`{slug,name,films}`).
  - `movement`·`person`: 값싼 형제 소스 없음 → browse + crossLinks만.
- 전역 `df-*` 스타일이라 페이지별 CSS import 불필요.

---

## 3. 불변식 · 함정 (⚠️ 필독)

1. **인덱싱 가능한 타깃만 링크(noindex/404 금지).** 모든 표면 플레이트는 그 페이지의 발행 게이트를 미러한다:
   - takescore = `takescore_for_slugs([slug])` 결과 비어있지 않음 (**`.data`가 배열 직접** — `{slug,ts}[]`; movies-like 페이지 용법과 동일).
   - reception = `film_wd_honors` **OR** `film_reception` count>0.
   - misreadings = `misreadingsEligibleSlugs()` set.
   - locations = `cachedLocationsEligibility().films`.
   - lineage = `cachedLineageEligibility().films`(≥`FILM_HONORS_MIN`).
   - movies-like = `film_affinities` count≥3.
   - tv = `tv_programs`(status=published, **slug=필름슬러그**) count>0.
   - gallery = `poster_path`, credits = `tmdb_id`.
2. **`exclude` 키 규약** — 자기 페이지를 자기 풋터에 링크하지 않도록. ReadPlates: `"takescore"|"reception"|"misreadings"|"locations"|"lineage"|"movies-like"|"whereto"|"tv"|"credits"|"gallery"|"desk:<key>"|"q:<slug>"`. 새 단일영화 표면 추가 시 그 표면 exclude를 **반드시** 전달. (reception 페이지는 이미 `exclude="reception"` 전달 중.)
3. **`curious.css`는 전역이 아니다(per-page import).** globals.css에 나온 건 주석. ReadPlates/DirectorPlates를 쓰는 페이지는 `import "@/app/curious/curious.css"` 필수(`.cur`·`.cur-grid`·`.cur-card`·`.rd-cta`). **HubExplore는 전역 `df-*`만 쓰므로 curious.css 불필요.**
4. **`.rd-plates.cur` 블록 스타일은 ReadPlates/DirectorPlates가 인라인으로도 셋한다**(`border-top: var(--cur-accent)` 등) → curious.css만 있으면 렌더됨(read.css 의존 제거). read.css에도 같은 규칙 있으나 무해(동일값).
5. **로컬 turbopack `dev`는 전 페이지 500** — `app/globals.css:415`의 뒤늦은 `@import url(fonts…)`를 turbopack CSS 파서가 거부(기존 알려진 dev-전용 함정). **prod `next build`(webpack/turbopack-build)는 warning만·정상.** → 로컬 라이브 렌더 검증 불가. `next build` + **라이브 HTTP 검증**으로 확인. globals.css는 건드리지 말 것(오너가 이 quirk를 알고 유지).
6. **movements 슬러그** = `movements_index()` RPC(예 `country-us`) — facet-prefix 슬러그(`national-…`)가 아님. /movements 인덱스는 클라이언트 로드라 HTML에 슬러그가 안 보임.
7. **frame** 페이지는 `frame_rankings`가 있어야 렌더(없으면 404). tradition·frame은 라이트 `.mt`/`.page` 테마라 `df-*`(ink-on-light) 정상.
8. **캐시 공유**: 한 필름의 모든 롱테일 풋터가 `read-plates-2:slug` 한 빌드를 공유. `genre-graph-1`은 전 장르 페이지가 공유. 데이터 형상 바꾸면 캐시 키 bump.
9. **SEO — 중복 콘텐츠 아님**: 필름/엔티티별로 달라지는 짧은 링크카드(본문 복제 아님) + 페이지 고유 본문 **아래** + self 제외 + href 중복 제거. 내부링크·관련콘텐츠 패턴은 크롤 깊이·PageRank 분산·체류시간에 유리. `lib/related.ts`가 인코딩한 규율과 동일.

---

## 4. 상시 운영 — 새 페이지에 풋터 붙일 때

- **새 단일-영화 페이지**: `import ReadPlates from "@/components/read/ReadPlates"` + `import "@/app/curious/curious.css"` → 콘텐츠 래퍼 닫힘 **직후**(full-width) `<ReadPlates slug={film.slug} exclude="<이 표면>" />`. 이 표면이 플레이트로 존재하면 그 exclude 키를 ReadPlates 코드에도 추가(안 그러면 자기 자신 링크).
- **새 감독 서브페이지**: `import DirectorPlates` + curious.css → `<DirectorPlates slug={slug} exclude="<이 표면>" />`.
- **새 엔티티 허브**: `import HubExplore` → `<HubExplore kind="<kind>" slug={slug} />`. 새 kind면 `lib/hubExplore.ts`의 `KIND_META`(intro/browse/crossLinks) + `siblingsFor()` switch에 케이스 추가.
- 배선 후 반드시: `~/.local/node/bin/npx tsc --noEmit`(내 파일 클린 확인) → `rm -rf .next && next build`(prod 컴파일 확인) → 배포 후 라이브 HTTP로 마커 확인.

---

## 5. 검증 방식(이력)

매 라운드: ①`tsc --noEmit` 내 파일 0 에러(기존 20 에러는 무관 파일) ②prod `next build` "Compiled successfully" + 전 라우트 SSG ③실데이터 게이트 확인(Supabase MCP — 분석영화 전부 reception/affinity/TV/gallery 켜짐, Pan's Labyrinth=14 honors·8 lineage 등) ④**라이브 HTTP 검증**(배포 후 metatake.net 실제 HTML에서 CTA/TV/플레이트 마커). 라운드3은 genre·lineage·tradition·frame·movement·person 6종 전부 200+"Keep exploring" 확인.

---

## 6. 남은 카드 (미착수 — 저가치·특수)
- 엔티티 허브 중 미착수: `/concept/domain/[domain]`·`/now/[slug]`(뉴스)·`/tv/[slug]`·`/tv/list/[slug]`·`/strong-misreadings/[fw]`·`/takescore/[dim]`·`/u/[username]`(프로필)·`/catalog/[seg]/[slug]`(taxonomy). 필요 시 `HubExplore`에 kind 추가 or 별도 처리.
- 이미 관련 섹션 보유(손댈 필요 없음): `/trope`·`/take`(relatedForMetaTake) · `/concept`·`/theorist`(자체 Keep-exploring).
- 개선 여지: person(`/credits/[person]`) 형제를 "빈번한 협업자"로(현재 browse+crosslinks만) — cast/crew 데이터 필요. movement 형제 소스(`movements_index` 그룹) 연결 가능.

---

## 7. 결정 로그
- **2026-07-13** 파일럿 `filmFooterData`+`FilmFooter`(lib/related.ts) 신설했다가 **되돌림** — 오너의 "우리 플레이트 전략 보강" 지시에 맞춰 기존 `ReadPlates` 단일 계통으로 통합(병렬 시스템 회피). `lib/urls.ts` 헬퍼는 유지(단일 소스 원칙).
- **2026-07-13** hub 풋터는 단일영화 CTA가 아니라 "형제+인덱스+인접레이어" 탐색으로 결정 — 허브는 한 영화가 아니라 카테고리이므로.
- **TV**: 오너 명시("각 영화/요소에 해당하는 tv") → 랜덤 릴이 아니라 그 영화 **자기** 발행 방송(`tv_programs`)만.
