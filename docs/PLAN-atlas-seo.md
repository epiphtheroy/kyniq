# PLAN — Atlas SEO 읽는 층 구축 (촬영지 페이지)

**상태: 전 Phase 실행 완료 (2026-07-04 배포·라이브 검증) — Phase 3 도시·지역 허브 포함.**
작성 2026-07-03 · 갱신 2026-07-04 (재실측 → 당일 실행).
배경: `/atlas`·필름/감독 Atlas 탭은 MapLibre 클라이언트 렌더링이라 검색엔진에 빈 페이지. credits에서 검증한 "읽는 층(서버) + 노는 층(임베드)" 공식을 재적용한다.

## 실행 로그 (2026-07-04)

- **출시 표면**: `/film/[slug]/locations` (자격 1,714·코호트 1,000), `/director/[slug]/locations` (331), `/atlas/[slug]` 국가 허브 (73), `/atlas` 인덱스에 서버 국가 그리드.
- **DB**: RPC 3종 신설 — `country_geo`(jsonb, 1000행 캡 우회), `atlas_country_json`, `atlas_eligibility_json`. `/api/geo`에 `?country=` 추가.
- **공용 모듈 `lib/atlas.ts`** — 병합은 2단: ① 좌표 셀(0.001°) 병합 = **게이트 규칙**(사이트맵 SQL과 동일 — 자격·404·탭 노출 판정은 반드시 이것), ② 이름 첫 세그먼트+2km 융합 = **표시 규칙**(같은 주소를 두 수집기가 다르게 지오코딩한 행 흡수). 게이트를 ②로 하면 경계 필름 28편이 사이트맵-페이지 불일치를 일으켜 분리함.
- **내비**: 필름/감독 페이지에 Locations 탭(href)+Atlas 섹션 인라인 링크, locations→figure/국가허브/감독 순환 링크. unstable_cache 키 범프(film-load3/director-load4/…locations2).
- **사이트맵**: 자식 `locations.xml`(1,000)·`atlas.xml`(404 URL) + 인덱스 17분할. `INDEX_COHORT_FILM_LOCATIONS=1000`, lib/seo.ts RELEASE LOG 기록.
- **/methodology**에 "The Atlas — location data" 섹션 추가(수집·정밀도·confidence·교정 루프 — 참인 표기만).

## 실행 로그 — Phase 3 (2026-07-04 저녁, 사용자 지시 "1000개까지")

- **접근**: geo_cache에 구조화 주소 없음 → 핀 이름 콤마 세그먼트에서 지명 추출(venue 첫 세그먼트 제외, kind='city'는 포함) + 기하 응집도 검증. §5의 name_norm 경로는 폐기.
- **게이트**: 필름 ≥3 + p90 산포 ≤150km — "Washington"(p90 2,373km) 같은 모호어와 주(州) 단위가 자동 탈락. 결과 **511개**(도시 439/지역 72, 캡 1000 미달 — 게이트가 실질 상한).
- **파이프라인**: `atlas_city_candidates_json` RPC(SQL 추출·집계) → `worker/atlas-cities-build.py`(변형 병합: 부분문자열+50km 또는 필름셋 0.9/0.9 → "New York"+"New York City"=184편 통합; slug; 캡) → `lib/atlas_cities.json`(동결 아티팩트).
- **페이지** `/atlas/[country]/[city]`: 멤버십 = 지명 세그먼트 매칭(lib/atlas.ts `pinLocalityTerms` — RPC SQL과 동기 필수) + 중심 250km 이내(할리우드 FL 누출 차단) + 국가 일치. 데이터는 `cachedCountryGeo`(국가당 1회 캐시) 공유. 지도 임베드는 멤버 bbox로 `/api/geo?bbox=`.
- **연결**: 국가 허브에 "Cities & regions" 그리드, 도시→필름 locations(자격 필름만)·국가 허브 순환.
- **사이트맵**: 자식 `cities.xml`(511) — 인덱스 18분할. 코호트 없음(아티팩트가 릴리즈 셋).
- 지구(맨해튼·브루클린·버뱅크 등)는 상위 도시와 의도적으로 공존 — 검색 수요가 별개이고 필름셋이 충분히 다름(0.9 중첩만 병합).

## 실행 로그 — E-E-A-T 보강 + 시각 개선 (2026-07-04 밤)

- **출처 인용**: film_locations.sources에 실 URL 4,443핀(위키피디아·프레스킷 등) 확인 → 필름 locations 페이지가 위치별 "Source: en.wikipedia.org ↗" 링크 렌더(최대 2개, 있는 것만 — "where on file" 문구로 과장 없음).
- **날짜 정직화**: 모든 아틀라스 푸터/dateModified가 렌더 날짜 대신 `atlas_meta_json` RPC의 **실제 데이터 갱신일**(max created_at, 현재 2026-07-03) 사용 — 매 재생성마다 바뀌는 날짜는 가짜 신선도로 읽힘. `cachedAtlasMeta()`.
- **Dataset 스키마**: /atlas에 schema.org Dataset(1차 데이터셋 선언 — creator/publisher Org, 규모, dateModified). "우리가 고유 조사·편찬했다"의 공식 신호.
- **반카탈로그 편집 레이어**: 국가·도시 허브에 "The directors who keep coming back" 섹션(≥2편 감독, locations 페이지 링크) — 데이터에서 도출한 편집적 관찰 + 내부 링크.
- **썸네일**: 감독 locations(films 테이블 조회)·국가 허브(atlas_country_json에 poster_path 추가)·도시 허브(country_geo에 director/poster 추가) 필름 목록에 TMDB w92 포스터.
- **RPC 변경**: country_geo·atlas_country_json 본문 확장(jsonb라 시그니처 불변), atlas_meta_json 신설. 캐시 키 범프: country-pins2, atlas-city2, atlas-country2, director-locations3.
- 푸터 문구 통일: "Location data researched, compiled and geolocated by Metatake · Data updated {date} · Corrections: methodology".

---

## 0. 실측 현황 (2026-07-04 재실측 — 완료)

| 항목 | 값 |
|---|---|
| film_locations 총 핀 | **25,035** (7/3의 12k에서 2배+) |
| visible 필름 위 핀 | **17,312** |
| 자격 필름 (visible + ≥3핀) | **1,746** (visible 1,935 중 90%) |
| 필름당 핀 중앙값 / 최대 | 9 / 39 |
| narrative_setting 보유 | **25,006 (~100%)** — 읽는 층의 살 |
| layer=setting 핀 | **489 (2%)** — 469필름에 1개씩 수준, source='figure'와 일치 |
| 근접 중복 (같은 필름, lat/lng 3자리 동일) | **1,513 초과핀 (8.7%)** — agent-search(12,350)와 agent-filmed(4,443) 이중 수집 탓 |
| 국가 허브 자격 (≥3핀 & ≥3필름) | **73개국** — US 6,125핀/763필름, FR 1,494/200, UK 1,327/204, JP 1,250/151, IT 983/101, KR 442/67 |
| 감독 읽는 층 자격 (≥2필름 & ≥6핀) | **337명** (director_geo RPC 기존재) |
| 도시 표기 오염 | 확인됨: "Paris, France"(25) / "Paris"(17) / "Paris, Paris, France"(5) |

**설계에 미치는 영향 3가지:**
1. **setting 레이어는 이중 구조 헤드라인 감이 아니다** — 대부분 페이지에서 비어 있으므로 "The world it pretends to be" H2는 setting 핀 ≥1일 때만 조건부 렌더.
2. **렌더 시 중복 병합 필수** — 같은 필름 내 round(lat,3)+round(lng,3) 동일 핀은 confidence 최고 행 기준으로 병합(narrative/scene_role은 긴 쪽 유지). 8.7%를 그대로 노출하면 목록 신뢰도가 깨진다.
3. narrative_setting 커버리지 ~100%라 "핀 나열" 위험은 없음 — 전 핀에 산문 한 줄이 있다.

## 1. 코드 정찰 결과 (2026-07-04 — 재탐색 불요)

- **FilmMap** (`components/FilmMap.tsx:152`): props `endpoint, height, filmSlug, search, satelliteDefault, panelSide`. **bbox/초기 뷰포트 prop 없음**, 단 로드된 행에 auto-fit(fitRows) → 국가 허브 임베드는 `endpoint=/api/geo?bbox=…`로 그냥 동작 가능(국경 넘는 이웃 핀 포함이 싫으면 `?country=` 파라미터+RPC 추가가 정석).
- **/api/geo** (`app/api/geo/route.ts`): `?film=` → `film_geo` RPC, `?director=` → `director_geo` RPC, `?bbox=` → `geo_bbox_json`, 무파라미터 → `geo_overview_json`. RPC 본문은 Supabase 서버측(레포에 없음).
- **필름 페이지** (`app/film/[slug]/page.tsx`): Atlas 탭은 `geoCount>0`일 때 (`:561-583`), 탭이 `href` 지원(Gallery/Credits처럼) → "Locations" 링크 슬롯인 가능. 서버는 `film_geo`를 이미 호출하나 geoCount만 사용(`:195-196`).
- **감독 페이지** (`app/director/[slug]/page.tsx:532`): Atlas 탭 + `/api/geo?director=` 임베드 기존재, 서버 텍스트 없음 — 필름과 동일한 공백.
- **복제 템플릿**: 라우트 골격은 `app/film/[slug]/figure/[figureSlug]/page.tsx` (revalidate=300, generateStaticParams(){return[]}, pageRobots 게이트, 4단 Breadcrumb), 본문 구조는 `app/credits/[person]/page.tsx` (단일 load() 공유, 서버 산문 섹션, `#explorer` 앵커 → Suspense 임베드, 푸터 attribution).
- **JSON-LD**: 공용 빌더 없음, 페이지별 인라인. 관례: Organization `@id: https://metatake.net/#org`, editor Person "Wonwoo Yoon" `@id: https://metatake.net/editor#person`.
- **IndexNow**: `scripts/indexnow-ping.mjs` — URL 인자 배치(500개 단위) 또는 `--sitemap` 순회. 키 `72623852f17d4eb341d4cd3755d3ba64`.
- **사이트맵**: `app/sitemap.xml/route.ts` 인덱스 + `app/sitemaps/*.xml` 15개 자식 라이브. GSC에 인덱스 제출돼 있으므로 자식 추가는 자동 발견되나, 신규 자식은 GSC에 개별 제출도 해주면 섹션별 색인 리포트가 바로 잡힌다.

## 2. Phase 1 — 영화 중심: `/film/[slug]/locations`

**타깃 쿼리**: "where was X filmed", "[X] filming locations". 아트하우스·비영어권 공백이 우리 강점.

- **자격**: visible + 병합 후 위치 ≥3 (**1,746필름**). 미달 → `notFound()` (필름 페이지 Atlas 탭만 유지).
- **데이터**: 서버에서 `film_geo` RPC 재사용(필름 페이지가 이미 쓰는 것) → §0의 중복 병합 → filmed/setting 분리.
- **generateMetadata**:
  - title: `Where Was ${title} Filmed? — ${n} Locations, Mapped` (연도 포함, 루트 템플릿이 "· Metatake" 부착 — 이중 브랜딩 금지!)
  - description(결정론): `${title} (${year}) was filmed across ${filmedN} real locations in ${topCountries}.` + setting 있으면 ` — and set in ${settingSummary}.` filmed 0이면 setting 중심 폴백.
  - robots: `pageRobots(mergedN >= 3)` / canonical `/film/${slug}/locations`
- **본문 구조** (서버 렌더, 답 먼저):
  1. 리드 문단 2~3문장: 첫 문장이 질문에 직답(대표 도시/국가 + 수치). built_set 있으면 "N sets built" 언급.
  2. **Filmed locations** 목록: name + country + precision 뱃지 + narrative_setting/scene_role 산문 + (fig_slug 있으면 figure 페이지 링크 "read the place →"). confidence<0.6 행은 "reported" 같은 완곡 표기 또는 제외 — 참인 표기만.
  3. **The world it pretends to be** (setting 핀 ≥1일 때만 조건부 렌더 — §0.1).
  4. 하단 임베드: 기존 `FilmMap endpoint=/api/geo?film= filmSlug=` 재사용 — credits처럼 상단 앵커 버튼("◉ See them on the map ↓") + `id="map"`, Suspense 래핑.
  5. 푸터: `Metatake Editorial · Location data compiled by Metatake · Updated {date}` (사실인 것만 — credits 원칙).
- **JSON-LD**: Movie(필름 페이지 관례 복사) + `ItemList` of `Place`(name, geo lat/lng, address country) + BreadcrumbList(Home › Films › 필름 › Locations) + WebPage(author Org + editor Wonwoo Yoon, @id 관례 준수).
- **연결**: 필름 페이지 tabs 배열에 `href:/film/${slug}/locations` 탭(자격 필름만), Atlas 섹션 인트로에 "All N locations, mapped →". locations → 필름·figure·(Phase 2 후) 국가 허브.
- **OG 이미지**: `opengraph-image.tsx` 기존 패턴 복제(타이틀+핀 수 텍스트 카드면 충분, 지도 서버렌더 불요).
- **사이트맵**: 새 자식 `app/sitemaps/locations.xml` + 인덱스 등록. `INDEX_COHORT_FILM_LOCATIONS = 1000`으로 시작(자격 1,746 중), 정렬 안정(필름 slug asc), lib/seo.ts RELEASE LOG 기록, 주간 증량 규칙 동일. IndexNow 배치 제출 + GSC에 locations.xml 개별 제출(원우).

## 3. Phase 2 — 국가 허브: `/atlas/[countrySlug]`

**타깃 쿼리**: "movies filmed in Japan/Italy/Korea". 자격 **73개국**.

- 국가 필드는 깨끗함 — slug화(`united-states`, `south-korea`)만 필요.
- title: `Movies Filmed in ${country} — ${films} Films, ${locations} Locations`.
- 본문: 리드(에디토리얼 2~3문장 — 도어웨이 인상 방지의 핵심) + 필름 목록(연도·감독·대표 장소 1개, 필름/locations 링크) + 대표 랜드마크 목록 + 임베드 맵. 임베드는 1차로 `endpoint=/api/geo?bbox=국가bbox` (FilmMap 무개조 — auto-fit 활용), 이웃국 핀 혼입이 거슬리면 `?country=` 파라미터 + `country_geo` RPC 추가.
- /atlas 인덱스 페이지에 국가 허브 링크 그리드(서버 렌더) 추가 — /atlas 자체도 읽는 층을 얻음.
- 사이트맵: 국가 페이지 전체(73개, 코호트 불요), IndexNow.

## 4. Phase 2.5 — 감독 읽는 층: `/director/[slug]/locations` (신설)

**타깃 쿼리**: "where does ${director} film", "${director} filming locations". 자격 **337명** (≥2 located 필름 & ≥6핀). 감독 페이지에 이미 Atlas 탭+`director_geo` RPC가 있어 증분 비용이 가장 낮은 표면.

- 구조는 Phase 1 미러: 리드(감독의 지리적 시그니처 한 줄 — 예: "shoots almost entirely in …") + 필름별 그룹 목록 + `/api/geo?director=` 임베드.
- title: `Where Does ${name} Film? — ${films} Films, ${n} Locations, Mapped`.
- robots 게이트 ≥2필름 & ≥6핀. 사이트맵 자식 locations.xml에 합류(또는 directors.xml에 추가 — 실행 시 판단), RELEASE LOG 기록.
- 감독 허브 ↔ locations ↔ 필름 locations 3중 연결.

## 5. Phase 3 — 도시 허브 (정규화 후): `/atlas/[countrySlug]/[citySlug]`

- 도시 표기 오염(§0 표 참조 — Paris 3중 표기 실측 확인) → 정규화 파이프라인:
  1. `geo_cache.name_norm` 매칭 우선, 2) 미해결분은 lat/lng 반경 클러스터링(~25km) + 대표명 부여, 3) 결과를 `worker/atlas-city-normalize.py` → `lib/atlas_cities.json` (crew_index 패턴).
- 상위 ~50 도시만 (Paris, Tokyo, NYC, London, Seoul, Tehran, Taipei, HK…). title: `Movies Filmed in Tokyo — N Films on the Map`.
- 도시 페이지가 국가 허브·필름 locations 페이지와 3중 순환.

## 6. 원칙 (기존 결정 준수 — E-E-A-T 근거)

- **씬 컨텐츠 게이트**: 자격 미달 = 페이지 자체를 만들지 않거나 noindex. 코호트 공개 + GSC 확인 후 증량 (lib/seo.ts 로그 갱신 필수). 신생 도메인(색인 개시 2026-06-17)에 1,746+73+337 URL 일괄 광고는 scaled-content 패턴 — 코호트가 방어선.
- **답 먼저, 데이터는 산문으로**: 리드 첫 문장이 쿼리에 직답. 전 핀에 narrative_setting 산문이 있으므로 목록이 아니라 글로 읽힌다 — 경쟁 촬영지 사이트(핀 나열)와의 차별점이자 helpful-content 방어.
- **이중 브랜딩 금지**: title에 "· Metatake" 붙이지 말 것 (루트 템플릿이 부착).
- **읽는 층은 서버, 노는 층은 그 아래** — 임베드는 SEO 중립.
- **참인 표기만**: "verified" 배지 금지. 저신뢰(confidence<0.6) 행은 완곡 표기 또는 제외. Editorial·출처·Updated만. 1인 편집 체제의 E-E-A-T는 과장 없는 투명성이 전부다 — /methodology에 아틀라스 수집·검증 방법 문단 추가 권장.
- **도어웨이 방지**: 허브(국가·도시)는 링크 그리드만으로 출시 금지 — 에디토리얼 리드 + 랜드마크 등 고유 내용 동반.
- **IndexNow**: 새 URL 배치 제출 (`scripts/indexnow-ping.mjs`, 키 `72623852f17d4eb341d4cd3755d3ba64`) — Bing·Naver 계열 커버.
- 배포: app/lib은 자동 워처. 빌드 검증은 라이브 curl (로컬 node 없음 — memory 참조).

## 7. 검증 체크리스트 (실행 시)

- [ ] 대표 3편(대작 1·아트하우스 1·한국영화 1) locations 페이지: title/desc/JSON-LD/robots/임베드 확인
- [ ] **중복 병합 확인**: the-godfather-1972의 "110 Longfellow Avenue" 이중 행이 1행으로 합쳐지는지
- [ ] 핀 2개 필름 → 404 확인
- [ ] setting 핀 0 필름 → "pretends to be" 섹션 미출력 확인
- [ ] 필름 페이지 → locations 링크, locations → figure 링크 왕복
- [ ] 사이트맵 자식 신설 + 인덱스 등록 + 코호트 수 일치 + RELEASE LOG 기록
- [ ] IndexNow 200 / GSC 자식 사이트맵 제출(원우)
- [ ] 아웃리치 플랜의 r/InternetIsBeautiful 아이템에 /atlas 대신 국가 허브+맵 딥링크 사용 권고 반영
