# PLAN — Atlas SEO 읽는 층 구축 (촬영지 페이지)

**상태: 대기 — 지도 데이터 업데이트 완료 후 사용자 큐사인에 실행.**
작성 2026-07-03. 배경: `/atlas`·필름 Atlas 탭은 MapLibre 클라이언트 렌더링이라 검색엔진에 빈 페이지. credits에서 검증한 "읽는 층(서버) + 노는 층(임베드)" 공식을 재적용한다. 실행 담당 AI는 이 문서만으로 착수 가능해야 한다.

---

## 0. 실행 전 체크 (큐사인 받은 직후)

1. **데이터 재실측** — 분포가 바뀌었을 것:
   ```sql
   SELECT count(*) FROM film_locations;                     -- 2026-07-03: 12,000+
   -- 필름별 핀 수 분포 (≥3 자격 필름 수): 2026-07-03: 1,851
   -- 국가 분포: US 4,777 / UK 1,198 / FR 756 / IT 604 / JP 475 ...
   ```
   (PostgREST 집계 비활성 — python REST 페이지네이션 tally, `worker/crew-index-build.py`의 sb_films 패턴 참조)
2. `film_geo` RPC 반환 형태 확인 (필름 페이지 Atlas 탭이 쓰는 것 재사용 가능한지).
3. lib/seo.ts RELEASE LOG의 동결 조건 확인 — 코호트 증량 규칙 준수.

## 1. 데이터 (확인 완료, 2026-07-03 기준)

`film_locations` 컬럼: `name, lat, lng, layer(filmed|setting), kind(city|landmark|…), precision, country, narrative_setting(산문), scene_role, built_set, set_host, figure_id, confidence, source`.
- **filmed vs setting 구분**과 **narrative_setting 한 줄 산문**이 차별화 재료 — 핀 나열이 아니라 정보로 보이게 하는 열쇠.
- `figure_id` → figures → 리딩 연결 가능 (경쟁 촬영지 사이트에 없는 층).
- `geo_cache.name_norm` — 도시 정규화 재료 (Phase 3).

## 2. Phase 1 — 영화 중심: `/film/[slug]/locations`

**타깃 쿼리**: "where was X filmed", "[X] filming locations". 아트하우스·비영어권 공백이 우리 강점.

- **자격**: 위치 ≥3 (layer 무관) + film.visible. 미달 필름 → 페이지 없음(필름 페이지 Atlas 탭만).
- **generateMetadata**:
  - title: `Where Was ${title} Filmed? — ${n} Locations, Mapped` (연도 포함, 템플릿이 "· Metatake" 부착 — 이중 브랜딩 금지!)
  - description(결정론): `${title} (${year}) was filmed across ${filmedN} real locations in ${topCountries} — and set in ${settingSummary}.` filmed 0이면 setting 중심 문구로 폴백.
  - robots: `pageRobots(n >= 3)` / canonical `/film/${slug}/locations`
- **본문 구조** (서버 렌더):
  1. 리드 문단: filmed/setting 수치 + 대표 국가 + (built_set 있으면 "N sets built" 언급)
  2. **Filmed locations** 목록: name + country + precision 뱃지 + narrative_setting/scene_role 한 줄 + (figure_id 있으면 해당 figure 페이지 링크 "read the place →")
  3. **The world it pretends to be** (setting layer 목록, 같은 형식) — 이 이중 구조가 차별점이므로 소제목으로 명시
  4. 하단 임베드: 기존 `FilmMap` 컴포넌트 재사용 (`/api/geo` ← `film_geo`) — credits 임베드처럼 상단 앵커 버튼("◉ See them on the map ↓") + `id="map"`
  5. 푸터: `Metatake Editorial · Location data compiled by Metatake · Updated {date}` (사실인 것만 — credits 원칙)
- **JSON-LD**: Movie(기존 필름 페이지 패턴) + `ItemList` of `Place`(name, geo lat/lng, address country) + BreadcrumbList(Films › 필름 › Locations). author Organization + editor Wonwoo Yoon(@id 통일).
- **연결**: 필름 페이지 Atlas 탭/섹션에 "All N locations, mapped →" 링크 추가. locations 페이지 → 필름 페이지·figure 페이지·(Phase 2 후) 국가 허브.
- **사이트맵**: `INDEX_COHORT_FILM_LOCATIONS = 1000`으로 시작 (자격 ~1,851 중), 정렬 안정(필름 slug asc), lib/seo.ts RELEASE LOG에 기록, 주간 증량 규칙 동일. IndexNow 통지.

## 3. Phase 2 — 국가 허브: `/atlas/[countrySlug]`

**타깃 쿼리**: "movies filmed in Japan/Italy/Korea".

- 국가 필드는 깨끗함 — slug화(`united-states`, `south-korea`)만 필요. 자격: 위치 ≥3핀 & 필름 ≥3편인 국가(~40개 예상).
- title: `Movies Filmed in ${country} — ${films}편 ${locations} Locations, Mapped` (영어로: `Movies Filmed in Japan — 87 Films, 475 Locations`).
- 본문: 리드 + 필름 목록(연도·감독·대표 장소 1개, 필름/locations 페이지 링크) + 대표 랜드마크 목록 + 임베드 맵(국가 bbox로 초기화 — FilmMap이 bbox 파라미터 지원하는지 확인, 없으면 소규모 개조).
- /atlas 인덱스 페이지에 국가 허브 링크 그리드(서버 렌더) 추가 — /atlas 자체도 읽는 층을 얻음.
- 사이트맵: 국가 페이지 전체(소수라 코호트 불요), IndexNow.

## 4. Phase 3 — 도시 허브 (정규화 후): `/atlas/[countrySlug]/[citySlug]`

- 도시 표기 오염("Paris"/"Paris, France"/"Paris, Paris, France") → 정규화 파이프라인:
  1. `geo_cache.name_norm` 매칭 우선, 2) 미해결분은 lat/lng 반경 클러스터링(~25km) + 대표명 부여, 3) 결과를 `worker/atlas-city-normalize.py` → `lib/atlas_cities.json` (crew_index 패턴).
- 상위 ~50 도시만 (Paris, Tokyo, NYC, London, Seoul, Tehran, Taipei, HK…). title: `Movies Filmed in Tokyo — N Films on the Map`.
- 도시 페이지가 국가 허브·필름 locations 페이지와 3중 순환.

## 5. 원칙 (기존 결정 준수)

- **씬 컨텐츠 게이트**: 자격 미달 = 페이지 자체를 만들지 않거나 noindex. 코호트 공개 + GSC 확인 후 증량 (lib/seo.ts 로그 갱신 필수).
- **이중 브랜딩 금지**: title에 "· Metatake" 붙이지 말 것 (루트 템플릿이 부착).
- **읽는 층은 서버, 노는 층은 그 아래** — 임베드는 SEO 중립.
- **참인 표기만**: "reviewed" 배지 금지, Editorial·출처·Updated만.
- **IndexNow**: 새 URL 배치 제출 (python 원라이너, 키 `72623852f17d4eb341d4cd3755d3ba64`).
- 배포: app/lib은 자동 워처. 빌드 검증은 라이브 curl (로컬 node 없음 — memory 참조).

## 6. 검증 체크리스트 (실행 시)

- [ ] 대표 3편(대작 1·아트하우스 1·한국영화 1) locations 페이지: title/desc/JSON-LD/robots/임베드 확인
- [ ] 핀 2개 필름 → 페이지 404 또는 noindex 확인
- [ ] 필름 페이지 → locations 링크, locations → figure 링크 왕복
- [ ] 사이트맵 증분 + 코호트 수 일치 + RELEASE LOG 기록
- [ ] IndexNow 200
- [ ] 아웃리치 플랜의 r/InternetIsBeautiful 아이템에 /atlas 대신 국가 허브+맵 딥링크 사용 권고 반영
