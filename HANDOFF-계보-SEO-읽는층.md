# 종합 인수인계 — 계보(Lineage) SEO 읽는층 (상·정전·국가별 정전·감독 계보)

> 다른 AI/사람이 이 파일 하나로 현황·이력·파일위치·운영절차·불변식을 파악해 이어받기 위한 문서.
> 프로젝트 루트: `/Users/jerryje/Documents/MetaTake/` · Supabase: `kyniq` (id `jvgarcqrtsmgfimdcwgo`)
> 작성 2026-07-05. 자매 문서: `HANDOFF-아틀라스-SEO-읽는층.md`(같은 공식의 촬영지판), `docs/HANDOFF-SEO-마스터.md`(SEO 전체 정본).

---

## 0. TL;DR — 2026-07-05 기준 라이브

lineage 데이터(리스트 398개 · **전량 출처 보유 멤버십 10,551건** · 위키데이터 QID 300개)는 콘텐츠 대비 노출이 0에 가까웠다: 상세 페이지가 사이트맵에 미등재, JSON-LD 없음, 제목이 비검색형("films in this lineage") + **이중 브랜딩 버그**("— Metatake · Metatake"), DB의 출처 필드는 프론트에서 미사용. 하루에 걸쳐:

| 표면 | 내용 | 규모 |
|---|---|---|
| `/lineage/[slug]` **업그레이드** | 검색형 제목("Palme d'Or Winners — the Complete List (1946–2025)"), robots 게이트(멤버 ≥3), 출처 블록(소스명+위키데이터 링크), ItemList(Movie) + CollectionPage(about.sameAs=QID) JSON-LD, 관련 리스트 섹션 | 자격 ~202 (전체 398 중) |
| `/film/lineage/[slug]` **신설** | 한 영화의 전체 수상·정전 기록 — 그룹별(수상/정전 랭킹/국가별 정전/감독 계보) + 행마다 출처 표기 + Movie.award JSON-LD | 자격 895 (**Tier-2 367편 포함** — 사용자 지시 "1,900편 한정 금지") |
| 사이트맵 | 자식 `lineage.xml`(~202) + `honors.xml`(코호트 500/895) — 인덱스 **20분할** | |
| 내비 | 필름 페이지 **Lineage 탭/섹션이 honors 콘텐츠 담당**(2026-07-06 사용자 결정 — 별도 Honors 탭 삭제): 섹션 자체가 국가별 정전 분리 + 행별 출처 태그로 교체, 하단 "complete record →" → /film/lineage/[slug] (Tier-2 템플릿 포함) | |

**핵심 판단**: honors 페이지는 `films.visible`에 게이트하지 않는다 — 수상·정전 멤버십은 편집물이 아니라 **사실**이라 ≥3-figures 승급제와 무관하게 자립한다. Tier-2 카탈로그 영화도 기록이 3건 이상이면 색인 가능한 페이지를 가진다.

## 1. 파일 맵

| 파일 | 역할 |
|---|---|
| `lib/lineage.ts` | **핵심 모듈.** 게이트 상수(LINEAGE_LIST_MIN=3·FILM_HONORS_MIN=3), 출처 코드→표시명 맵(`LINEAGE_SOURCES` — **lineage_sources 테이블은 빈 테이블(0행)이라 코드 내 맵이 정본**), `wikidataUrl`, 타입, `loadLineageListMeta`, `cachedLineageMeta`(실제 최종 인제스트일 = max created_at, 현재 2026-06-25), `cachedLineageEligibility`(사이트맵·링크 게이트의 원천 — film_lineage 실측 집계; **lineage_lists.film_count는 공식 리스트 크기지 우리 커버리지가 아님**, 절대 게이트에 쓰지 말 것) |
| `app/lineage/[slug]/page.tsx` | 리스트 읽는 페이지(업그레이드). 캐시키 `lineage3` · tag `lineage:{slug}` |
| `app/film/lineage/[slug]/page.tsx` | 필름 기록 페이지(신설; 2026-07-06 /film/[slug]/honors에서 이전 — 구 라우트는 `app/film/[slug]/honors/page.tsx`가 308 permanentRedirect) · 캐시키 `film-honors` · tag `film:{slug}` |
| `components/FilmLineageSection.tsx` | **honors 방식으로 교체됨(07-06)**: 그룹 4종(수상/정전 랭킹/국가별 정전/감독 계보) + 행별 SourceTag(listMeta prop) + ≥3이면 /film/lineage/[slug] 링크. HONORS_MIN=3 은 lib와 동기 |
| `app/film/[slug]/page.tsx` | 별도 Honors 탭 없음(07-06 삭제) — Lineage 앵커 탭이 담당. 두 템플릿(풀·Tier-2) 모두 slug+listMeta(`loadLineageListMeta`) 전달. 캐시키 film-load4 |
| `app/sitemaps/{lineage,honors}.xml/route.ts` + `app/sitemap.xml/route.ts` | 자식 2개 신설, SECTIONS 20 |
| `lib/sitemap-data.ts` | `lineageEntries`/`honorsEntries` |
| `lib/seo.ts` | `INDEX_COHORT_FILM_HONORS=500` + RELEASE LOG(2026-07-05 항목) |
| (기존) `lib/lineageBodies.ts` | 수여 기관명·엠블럼 파생(honors 페이지도 재사용) |

**DB (레포 밖, 변경 없음 — 이번 작업은 읽기 전용)**: `lineage_lists`(398 — facet 8종: auteur 160·movement 67·award 56·national 46·festival 18·canon 18·section 18·style 15; `source` 코드 29종, `external_ref.wikidata` 300개), `film_lineage`(10,551 — result: won 4,953/listed 5,191, rank 2,768), `lineage_editions`(4,735 — 미노출, 차후 카드), `lineage_sources`(**빈 테이블**). RPC 재사용: `lineage_list_films(p_slug)`(멤버+visible 플래그), `film_lineage_for(p_film_id)`, `lineage_index`.

## 2. 불변식

1. **게이트 = film_lineage 실측 행 수** (`cachedLineageEligibility`) — `lineage_lists.film_count` 금지(공식 크기≠커버리지: tspdt film_count=100, 실멤버 994).
2. `FILM_HONORS_MIN`(lib/lineage.ts) = `HONORS_MIN`(FilmLineageSection) = 필름 페이지 탭 조건(≥3) — 세 곳 동기. 사이트맵 honors도 같은 규칙이라 광고 URL은 404 불가.
3. **honors는 visible 게이트 없음** (의도 — §0). 리스트 페이지의 hidden 멤버는 카드로 노출하되 그 필름 페이지는 noindex 유지(기존 Tier-2 규칙).
4. 출처는 **있는 것만**: 소스 코드가 맵에 없으면 코드 그대로 표시(창작 금지), URL은 확실한 것만. 날짜는 렌더 날짜 금지 — `cachedLineageMeta().updated`.
5. 제목에 "· Metatake" 하드코딩 금지(이번에 고친 버그가 바로 그것).
6. 캐시 키: lineage3 / film-honors / lineage-eligibility / lineage-meta — payload 형태 변경 시 범프.

## 3. ★ 상시 운영 — 새 영화·새 리스트·새 멤버십이 들어올 때

lineage 인제스트 파이프라인(수집)은 별도 세션 소관. 이 층은 **전부 자동 반영**:
- 새 멤버십 → 필름 honors 페이지·리스트 페이지·양쪽 사이트맵 자격이 ISR(24h/30m) + eligibility 캐시(1h)로 따라옴. 즉시 반영은 재배포.
- **수동은 두 가지뿐**: ① honors 코호트 증량(현 500/895 — GSC 증거 규칙, lib/seo.ts RELEASE LOG 기록) ② IndexNow 배치(`HANDOFF-아틀라스-SEO-읽는층.md` §3의 xargs 예시 그대로, sitemaps/lineage.xml·honors.xml 대상).
- 새 소스 코드가 생기면 `lib/lineage.ts LINEAGE_SOURCES`에 표시명 추가(없어도 코드 폴백으로 동작).
- 검증: 캐시버스터 curl + RSC 주석 함정(아틀라스 핸드오프 §3.5와 동일). 체크: 팔므도르(제목·출처 블록·noindex 0)·visible 필름 honors·**Tier-2 필름 honors**(예: paper-moon-1973)·소regexp 리스트(auteur-* 멤버<3 → noindex).

## 3.5 스펙 3종 적용 (2026-07-06 — site_content/ 폴더)

원우가 가져온 외부 스펙 3파일을 검증 후 적용:
- **`site_content/AWARD_QID_BACKFILL.csv`**: QID 20건 위키데이터 API 전수 검증(20/20 정합, Critics' Choice=Q922299 확정) — **DB에는 이미 백필돼 있었음**(별도 세션). cph-dox는 QID 없음(정상).
- **`site_content/SEO_LINEAGE_SPEC.md`** 적용: ① bare wikidata.org 인용 버그 수정(LINEAGE_SOURCES에서 wikidata/wikipedia url 제거 — QID 링크만, 없으면 평문) ② 리스트 페이지 인용 단일 링크화 + "resolved to TMDb identities" 문구 ③ Movie 노드 정합(양쪽 @id 동일: full ISO datePublished + sameAs[wikidata,tmdb,imdb] + award[]=honorText(), 필름 페이지에도 award 추가) ④ Breadcrumb에 감독 크럼(가시 트레일과 일치) ⑤ ItemList를 CollectionPage.mainEntity로 중첩 + itemListOrder + numberOfItems=진짜 길이 ⑥ /lineage 인덱스에 Dataset(#dataset, 라이브 카운트) ⑦ 완전성 노트: `KNOWN_TRUE_SIZE`(lib/lineage.ts — **정의상 크기만**: tspdt-1000=1000, 1001-movies=1001; film_count 사용 금지) 기준 "N of M matched" 공개. 캐시 범프: film-honors2.
- **`site_content/METHODOLOGY_LINEAGE_SECTION.md`**: 수치 검증 후 수정 게재(/methodology Atlas 뒤) — 원문 "~6,700편"→실측 5,977이라 "nearly six thousand"로, "a few hidden"→실제 1건이라 "occasional"로, 사이즈 검증 주장은 "known published length가 있는 경우"로 완화. 통계 타일 "lineage memberships"(라이브) 추가. 미적용 잔여: 멤버 Movie의 sameAs(리스트 페이지 ItemList 내 — 필름별 QID/tmdb 조인 필요, 백로그).

## 4. 남은 카드 (미착수)

- **lineage_editions 노출**(4,735 연도별 에디션 — "Cannes 2019" 같은 쿼리; 씬 리스크 검토 후 별도 결정).
- **플래그십 정전 꼬리 수복**(SEO_LINEAGE_SPEC §4b): TSPDT +6, NFR +11 미매칭 타이틀의 수동 대조(제목/연도 변형이 원인) — 매칭되면 N-of-M 노트가 자동 소멸. 1001 Movies(159/1001)는 인제스트 지속 사안.
- **리스트 멤버 Movie sameAs**(ItemList 내 필름별 wikidata/tmdb) — 필름 조인 추가 필요, 소규모.
- lineage_sources 테이블 채우기(현재 빈 테이블; 코드 맵으로 충분하나 데이터 사업 관점에선 테이블 정본화가 나음 — 원우 결정).
- /lineage 인덱스의 ItemList가 /movements 허브를 가리키는 구조(의도된 하이브리드) — 리스트 그리드의 서버 렌더 강화는 차후.
- GSC: lineage.xml·honors.xml 자식 제출(원우), 주간 색인 관찰 후 honors 코호트 500→895.
