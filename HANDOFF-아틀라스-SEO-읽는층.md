# 종합 인수인계 — 아틀라스 SEO 읽는층 (촬영지 검색 표면)

> ⚠️ **리네임 (2026-07-12): "Atlas" → "Locations".** 이 문서 본문의 `/atlas`·`/film/atlas`·`/room/atlas`·나 "Atlas" 라벨은 모두 이제 `/locations`·`/film/locations`·`/room/locations`·"Locations"입니다(구 경로 308 리다이렉트). **단, DB결합 이름은 그대로 유지**: `atlas_country_json`/`atlas_eligibility_json`/`atlas_meta_json`/`atlas_city_candidates_json` RPC, `lib/atlas_cities.json`, `worker/atlas-cities-build.py`, `#df-atlas`/`#dr-atlas` 앵커. `lib/atlas.ts`는 `lib/locations.ts`로 이동. 전체 매핑: **`docs/RENAME-atlas-locations-map-network.md`**.

> 다른 AI/사람이 이 파일 하나로 현황·이력·파일위치·운영절차·불변식을 파악해 이어받기 위한 문서.
> 프로젝트 루트: `/Users/jerryje/Documents/MetaTake/` · Supabase: `kyniq` (id `jvgarcqrtsmgfimdcwgo`)
> 작성 2026-07-04 (전 작업 당일 완료). **데이터 수집 파이프라인은 별도 문서** — `HANDOFF-종합현황-지리촬영지.md`(이력·현황) + `GEO_운영-신규영화-증분처리.md`(신규 영화 처리). 이 문서는 그 데이터를 **검색엔진·AI가 읽는 페이지로 노출하는 층**을 다룬다.

---

## 0. TL;DR — 2026-07-04 기준 전 Phase 완료·라이브

`film_locations`(핀 25,035 / visible 위 17,312)는 원래 MapLibre 클라이언트 지도에만 있어 검색엔진에 빈 페이지였다. 하루에 걸쳐 "읽는 층(서버 HTML) + 노는 층(지도 임베드)" 공식(credits에서 검증)을 4개 표면으로 구축·배포·검증 완료:

| 표면 | URL | 규모 | 타깃 쿼리 |
|---|---|---|---|
| 필름 | `/film/atlas/[slug]` (2026-07-06 `/film/[slug]/locations`에서 이전 — 구 라우트 308 permanentRedirect) | 자격 1,714 (사이트맵 코호트 1,000) | "where was X filmed" |
| 감독 | `/director/[slug]/locations` | 331 | "where does X film" |
| 국가 | `/atlas/[slug]` | 73 | "movies filmed in Japan" |
| 도시·지역 | `/atlas/[slug]/[city]` | 511 (도시 439/지역 72) | "movies filmed in Paris/Manhattan" |

+ `/atlas` 인덱스(국가 그리드 + Dataset 스키마), `/methodology` 아틀라스 섹션, 사이트맵 자식 3개 신설(`locations.xml`·`atlas.xml`·`cities.xml` — 인덱스 18분할), IndexNow 총 1,918 URL 제출(전배치 200). 추가 비용 0(기존 DB 렌더만).

**설계 근거·실행 상세 로그는 `docs/PLAN-atlas-seo.md`** (Phase별 실행 로그 포함 — 이 핸드오프와 함께 읽으면 전체가 복원됨).

## 1. 파일 맵 (전체)

### 페이지 (app/ — 자동 배포 워처 대상)
| 파일 | 역할 |
|---|---|
| `app/film/atlas/[slug]/page.tsx` | 필름 읽는층 (구 라우트 `app/film/[slug]/locations/page.tsx`는 308 리다이렉트). film_geo RPC → 병합 → 국가별 목록 + 위치별 산문·출처링크 + FilmMap 임베드. ISR 86400, 캐시키 `film-locations2` |
| `app/director/[slug]/locations/page.tsx` | 감독 읽는층. director_geo → 필름별 그룹(포스터 썸네일) + 지리 시그니처 리드. 캐시키 `director-locations3` |
| `app/atlas/page.tsx` | 인덱스: 지도 + 국가 그리드(서버) + **Dataset JSON-LD**(1차 데이터셋 선언) |
| `app/atlas/[slug]/page.tsx` | 국가 허브: 리드 + 돌아오는 감독들 + 도시 그리드 + 랜드마크 + 연대별 필름(포스터) + 지도. 캐시키 `atlas-country2` |
| `app/atlas/[slug]/[city]/page.tsx` | 도시·지역 허브: 로스터(JSON)에서 찾고 멤버십은 라이브 계산. 캐시키 `atlas-city2` |
| `app/film/[slug]/page.tsx` | 별도 Locations 탭 없음(07-06 삭제) — Atlas 앵커 탭 + 섹션 내 필 버튼(◉ Where was X filmed?)이 /film/atlas/[slug]로 연결. geoCells(게이트)/geoMerged(표시) 분리. 캐시키 `film-load3` |
| `app/director/[slug]/page.tsx` | 동일 패턴. 캐시키 `director-load4` |
| `app/api/geo/route.ts` | `?country=` 파라미터 추가(country_geo RPC) — 국가/도시 지도 임베드용 |
| `app/methodology/page.tsx` | "The Atlas — location data" 섹션(수집·정밀도·confidence·교정 루프) |
| `app/sitemaps/{locations,atlas,cities}.xml/route.ts` | 신규 사이트맵 자식 3개 |
| `app/sitemap.xml/route.ts` | SECTIONS에 locations/atlas/cities 등록 (총 18) |

### 공용 로직 (lib/)
| 파일 | 역할 |
|---|---|
| `lib/atlas.ts` | **핵심 모듈.** 타입(GeoPin·AtlasCity 등), 게이트 상수(FILM_LOCATIONS_MIN=3 등), `mergeCells`(게이트 병합)/`mergePins`(표시 병합), `countrySlug`/`countryPhrase`(관사), `pinLocalityTerms`/`cityMemberPins`(도시 멤버십), 로더+캐시(`cachedAtlasEligibility`·`cachedAtlasMeta`·`cachedCountryGeo`) |
| `lib/atlas_cities.json` | 도시 로스터 **동결 아티팩트**(511 엔트리: slug·name·country·terms·중심좌표·scale) — 재빌드는 아래 worker |
| `lib/seo.ts` | `INDEX_COHORT_FILM_LOCATIONS=1000` + RELEASE LOG(증량 이력 — 갱신 필수) |
| `lib/sitemap-data.ts` | `filmLocationsEntries`/`atlasEntries`/`cityEntries` |

### 빌더·스크립트
| 파일 | 역할 |
|---|---|
| `worker/atlas-cities-build.py` | `atlas_city_candidates_json` RPC → 변형 병합(부분문자열+50km, 필름셋 0.9/0.9) → slug → 캡 1000 → `lib/atlas_cities.json`. **새 데이터 후 재실행하는 유일한 수동 빌드** |
| `scripts/indexnow-ping.mjs` | IndexNow 제출(키 `72623852f17d4eb341d4cd3755d3ba64`). node는 `~/.local/node/bin` |

### DB 객체 (Supabase 서버측 — 레포에 없음, 마이그레이션명으로 추적)
| RPC | 마이그레이션 | 용도 |
|---|---|---|
| `country_geo(p_slug)` jsonb | atlas_read_layer_rpcs → **atlas_meta_and_richer_pins**(최신: director/poster 포함) | 국가 핀 덤프(1000행 캡 우회) — /api/geo?country= + 도시 페이지 |
| `atlas_country_json(p_slug)` | 〃 (최신: per_film에 poster_path) | 국가 허브 본문 1call |
| `atlas_eligibility_json()` | atlas_read_layer_rpcs | 자격 로스터(필름 셀≥3 / 감독 ≥2편·≥6셀 / 국가 ≥3핀·≥3편) — 사이트맵·게이트의 원천 |
| `atlas_city_candidates_json()` | atlas_city_candidates_rpc | 도시 후보(지명 세그먼트, ≥3편, p90≤150km) — worker 전용 |
| `atlas_meta_json()` | atlas_meta_and_richer_pins | 데이터셋 실제 갱신일(max created_at)·규모 |
| (기존 재사용) `film_geo`·`director_geo`·`geo_bbox_json` | — | 필름/감독 핀, bbox 지도 |

## 2. 불변식 — 깨지면 사이트맵·페이지 불일치 또는 오염 (수정 시 반드시 확인)

1. **게이트 vs 표시 분리**: 자격 판정(404·robots·탭 노출·사이트맵)은 전부 `mergeCells`(좌표 0.001° 셀 병합) 기준 = `atlas_eligibility_json` SQL과 **동일 규칙**. `mergePins`(이름+2km 융합)는 표시 전용. 게이트를 mergePins로 바꾸면 경계 필름 ~28편이 사이트맵-페이지 불일치를 일으킴.
2. **도시 멤버십 동기**: `lib/atlas.ts pinLocalityTerms()` = `atlas_city_candidates_json` SQL의 추출 규칙(첫 세그먼트 제외 조건·국가 별칭 제외 목록 포함). 한쪽만 고치면 도시 페이지 필름 수가 로스터와 어긋남.
3. **countrySlug(TS) = SQL slug 규칙** (`lower + 비영숫자→'-' + trim`).
4. **캐시 키 범프**: unstable_cache payload 형태가 바뀌면 키 숫자를 올릴 것(Data Cache는 배포를 넘어 생존). 현재: film-load**3** / director-load**4** / film-locations**2** / director-locations**3** / atlas-country**2** / atlas-city**2** / country-pins**2** / atlas-eligibility / atlas-meta.
5. **날짜는 렌더 날짜 금지** — 푸터·dateModified는 `cachedAtlasMeta().updated`(실제 max created_at). 매일 바뀌는 날짜는 가짜 신선도.
6. **참인 표기만**: "verified" 금지, 출처는 있는 것만("where on file"), 도어웨이 금지(허브는 산문 동반), title에 "· Metatake" 붙이지 말 것(루트 템플릿이 부착).

## 3. ★ 상시 운영 — 새 영화/핀이 추가될 때 (연속성 절차)

**선행**: `GEO_운영-신규영화-증분처리.md`로 핀 수집·적재·지오코딩 (기존 파이프라인).

그 다음 이 층에서 할 일:

1. **자동 반영 (손대지 않음)**: 필름·감독 locations 페이지, 국가 허브, 자격 로스터, 탭 노출 — 전부 RPC 기반 ISR(24h)이라 데이터만 늘면 자동. 즉시 반영이 필요하면 재배포(빈 커밋)로 충분.
2. **도시 로스터 재빌드 (수동, 유일한 빌드 단계)**:
   ```bash
   python3 worker/atlas-cities-build.py   # lib/atlas_cities.json 갱신 → 워처가 자동 배포
   ```
   slug는 이름 기반이라 안정(append-friendly). 결과 요약이 stdout에 나옴 — 엔트리 수가 줄었다면 원인 확인 후 배포.
3. **코호트 증량 판단**: locations.xml은 `INDEX_COHORT_FILM_LOCATIONS`(현 1,000 / 자격 1,714) 캡. **GSC에서 색인·노출이 따라올 때만** lib/seo.ts에서 올리고 RELEASE LOG에 한 줄 기록(주간 규칙 — 파일 상단 규칙 참조).
4. **IndexNow 제출** (신규·갱신 URL):
   ```bash
   # zsh 함정: $URLS 직접 확장 금지(단일 인자化) — 파일 + xargs 사용
   curl -s "https://metatake.net/sitemaps/cities.xml" | grep -o '<loc>[^<]*' | sed 's/<loc>//' > /tmp/urls.txt
   xargs -n 500 env PATH="$HOME/.local/node/bin:$PATH" node scripts/indexnow-ping.mjs < /tmp/urls.txt
   ```
5. **검증 (라이브 curl)**: 캐시버스터 `?cb=$RANDOM` 필수(ISR 구 캐시 오진 방지). **RSC가 텍스트 노드 사이에 `<!-- -->`를 삽입**하므로 grep 패턴이 문구를 가로지르면 안 맞음(예: "Data updated <!-- -->2026-07-03"). 체크리스트: 대표 필름 3편 + 국가 1 + 도시 1 (title/리드/robots noindex 0/404 게이트/포스터/출처링크).

## 4. 이력 요약 (2026-07-04 하루, 상세는 docs/PLAN-atlas-seo.md 실행 로그)

1. **오전~오후(선행 세션들)**: 데이터 수집 파이프라인 완료(별도 핸드오프), 사이트맵 15분할 등.
2. **Phase 1+2+2.5** (저녁): RPC 3종 + lib/atlas.ts + 필름/감독 locations + 국가 허브 + 내비 + 사이트맵 2자식 + IndexNow 1,406. 중복 8.7% 발견 → 2단 병합(셀=게이트/이름융합=표시) 확립.
3. **Phase 3** (밤, 사용자 지시 "도시·지역·지구 1000개까지"): 지명 세그먼트+응집도 방식(geo_cache에 구조화 주소 없음이 확인돼 계획서의 name_norm 경로 폐기). 후보 555 → 병합 → **511 허브**. cities.xml + IndexNow 512.
4. **E-E-A-T 보강 + 시각** (밤): 출처 링크(sources 4,443핀 발견), 실제 갱신일(atlas_meta_json), Dataset 스키마, "돌아오는 감독들" 섹션, 포스터 썸네일, 푸터 표준화("researched, compiled and geolocated by Metatake · Data updated {date} · Corrections: methodology").

## 5. 현황·남은 일 (2026-07-04 밤 기준)

- **GSC**: 자식 사이트맵 개별 제출은 원우 몫 — 제출 직후 "가져올 수 없음"은 첫 크롤 전 정상 표시(서버는 200/유효 XML 검증 완료). 48~72h 대기 후 재확인.
- **증량 대기**: 필름 코호트 1,000→1,714 (GSC 증거 규칙). 도시 로스터는 데이터 늘면 재빌드로 자연 확장(캡 1000).
- **다음 카드(미착수)**: 도시 Wikidata QID `sameAs` + 현지어 `alternateName`(서울/東京 — theorist QID 매처 `worker/theorist-qid/match.mjs` 재사용 가능), 아웃리치(r/InternetIsBeautiful에는 /atlas 대신 국가 허브 딥링크), 잔여 수집 백로그(not-done 1,468편 등 — 수집 핸드오프 참조, 사용자 승인 필요).
- **성공 지표**: GSC에서 locations/atlas/cities 섹션별 색인률 + "where was * filmed" 클래스 노출.
