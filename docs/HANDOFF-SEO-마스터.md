# HANDOFF — SEO 운영 마스터 (정본)

> ⚠️ **리네임 2026-07-12:** 이 문서의 `/atlas`→`/locations`, `/map`→`/network`(라벨 "Connections" 유지), `sitemaps/atlas.xml`→`sitemaps/location-hubs.xml`. 구 경로 전부 308(쿼리 보존)·sitemap은 신 URL만·IndexNow 재제출 완료. 전체 매핑·유지항목: `docs/RENAME-atlas-locations-map-network.md`.

*작성 2026-07-04 · **갱신 2026-07-06** (계보 층 + 필름 하위 URL 체계 확정 반영). 새 영화 추가·표면 개방·개명 등 변경 작업 전에 반드시 이 문서의 런북부터 확인할 것. 기획 상세: `docs/PLAN-seo-surface-expansion.md`, 지도 표면: `docs/PLAN-atlas-seo.md`. 층별 정본: 아틀라스=`HANDOFF-아틀라스-SEO-읽는층.md`, 계보=`HANDOFF-계보-SEO-읽는층.md`, 순위표면=`HANDOFF-트로프피겨아키타입-순위표면.md`, 연결=`HANDOFF-연결엔진-커넥션.md`.*

> ## ⭐ §3e — 갱신 2026-07-14~15 (SEO 스타터가이드 감사 + Tier-2 통합, SHIPPED)
> **정본: `HANDOFF-SEO-스타터가이드-작업지시서.md`(§2 게이트·§3~5 TakeScore/구조화데이터) + `HANDOFF-Tier2-메인통합.md`(메인 실속화). 게이트 코드 SSOT: `lib/seo.ts filmIndexBar` · `lib/filmGate.ts` · `lib/directorGate.ts` · 마이그 0097.**
> 이 배너가 아래 본문의 **"Tier-2 전원 noindex 유지"·"7/16 코호트 동결"·"Track B 대기" 프레이밍을 전부 대체**한다:
> - **통합 색인 게이트(Track B 실행됨)**: 얇은 서브페이지 3종(takescore/reception/lineage)이 게이트를 우회해 ~6,800p 노출하던 누수를 닫고, **Tier-2 카탈로그 1,105편을 색인 승격**(reception≥3 OR lineage≥3 OR wd_honors≥3 AND provider≥1 AND NOT tmdb-스텁; **`hold`은 게이트 입력 아님**). 색인 메인 1,959→~3,064. 서브 불변식 `filmMainIndexable && ownBar`·사이트맵 미러·신규 코호트 `INDEX_COHORT_FILMS_T2=300`. **`visible`은 색인 경계가 아님**(figures≥3 트리거). **"honours are facts"(계보 무게이트) 결정 번복.**
> - **감독 허브 robots 게이트 신설**: `lib/directorGate.ts directorIndexBar` — 858→**678 색인/180 noindex**. directorEntries 미러.
> - **Tier-2 메인 실속화(5e8f507)**: 승격 영화 메인=수상/개봉/학술 다이제스트+StillHero, 감독 허브=카탈로그 TakeScore+press/수상/가용성/촬영지 다이제스트. 캐시키 film-load8·director-load6·director-press-digest-1·read-plates-3.
> - **TakeScore/구조화데이터 정리**: 음수 0클램프(displayTs, 표시·스키마만)·"flagged/n=1" 문구 전삭·Review author=Organization·**FAQPage 제거**(figure/catalog/trope)·QAPage→Article·이중브랜드 제목 ~40·genre 고유 설명·alt ~35컴포넌트.
> - ⚠️ 운영: GSC 커넥터 `mt_gsc_daily` 07-10 정체(재가동 필요). 롤아웃 pace·잔여 백로그 = `HANDOFF-Tier2-메인통합.md §6` + `BACKLOG.md`.
> **→ 이 문서 §3b-8·§5-5·§12의 "7/16 리뷰·Tier-2 noindex·Track B" 항목은 위로 대체됨(역사 기록으로만).**

---

## 0. 한눈에 — 지금 검색엔진이 보는 사이트

- **sitemap**: `/sitemap.xml` = 인덱스, 자식 **20개**(`/sitemaps/*.xml` — 07-05에 lineage·honors 합류). 총 ~13,700+ URL. GSC가 **섹션별 색인률**을 따로 보고 → 코호트 증량·후퇴 판단의 계기판.
- **영화 6,978편** = Tier-1(figures≥3, visible) 1,959 + Tier-2 4,997. **색인 메인 ~3,064**(Tier-1 + 승격 Tier-2 1,105 — 07-14 게이트 §3e). Tier-2도 TMDB 백필로 원제·감독·장르·개봉일 보유. ⚠️ "Tier-2 전원 noindex"는 07-14 번복(§3e).
- **필름 하위 읽는층 URL 체계 (2026-07-06 확정)**: 촬영지=`/film/atlas/[slug]`(1,000/적격 1,714) · 수상·정전=`/film/lineage/[slug]`(500/적격 895, **Tier-2 367편 포함**). 구 경로(`/film/x/locations`·`/film/x/honors`)는 라우트 파일 permanentRedirect로 전 패턴 308. 필름 페이지에 별도 탭 없음 — Atlas 섹션 필 버튼 / Lineage 섹션 링크가 진입로.
- **엔티티 표면**: 감독 870+생애 208 · 크루 1,065 · 이론가 358(QID 299) · 아키타입 노드 500/917 · 컨셉 516 · 장르 18 · 위치(Atlas) 1,000+국가 73+도시 511 · **계보 리스트 202**(QID 320+, Dataset 스키마).
- **CineCodex**: 13차원 랜딩 13장(/takescore/{slug}) + film 페이지 링크 격자 + Movie.review 스키마.
- **오프페이지**: IndexNow 가동, sameAs 3프로필(Substack·Letterboxd·X) 상호 역링크.

## 1. 시스템과 파일 위치 (변경 시 여기부터)

| 시스템 | 파일 | 비고 |
|---|---|---|
| **sitemap 데이터** | `lib/sitemap-data.ts` | 섹션당 함수 1개. 1000행 캡은 fetchAll로 우회. lastmod는 정확할 때만 |
| sitemap 라우트 | `app/sitemap.xml/route.ts`(인덱스·SECTIONS 배열) + `app/sitemaps/{섹션}.xml/route.ts` | 새 섹션 = 함수+라우트+SECTIONS 3곳 |
| **코호트 캡·릴리즈 로그** | `lib/seo.ts` | INDEX_COHORT_* 상수 + 날짜별 릴리즈 로그(반드시 추기). SOCIAL_PROFILES도 여기 |
| **IndexNow** | `scripts/indexnow-ping.mjs` (`--sitemap`=전량, URL 인자=개별) · 키 `public/72623852….txt` | sitemapindex 재귀 지원 |
| **URL 영속성** | DB `public.slug_aliases` + `lib/aliases.ts` resolveAlias() | 개명·병합 = INSERT 1줄. 라우트 miss 경로가 조회 후 308 |
| URL 생성 | `lib/urls.ts` | 새 코드는 반드시 이 헬퍼로 링크 생성 |
| **관련 박스 모듈** | `lib/related.ts` + `components/RelatedBoxes.tsx` | figure/trope/take/Q&A + Tier-2 film. 관계형 제목, 결정론 선택. **그래프는 takes.trope_id**(meta_take_id는 0행) |
| **Tier-2 백필** | `worker/tier2-backfill/backfill.mjs` | TMDB fill-only·멱등·visible=true 불가침. `--dry-run --limit N` 후 본실행 |
| Tier-2 템플릿 | `app/film/[slug]/page.tsx`의 Tier-2(minimal) 분기 | ⚠️ **더 이상 "noindex 유지"가 아님**(§3e): `filmMainIndexable`로 게이트 → 승격 1,105편은 index + 실속 다이제스트(HANDOFF-Tier2 §3) 렌더. Tier-1 분기와 분리 |
| 컬렉션 "not yet read closely" | lineage/genre/director/movements `[slug]/page.tsx` | movements는 RPC `movement_hidden_films`(curation.film_hub) |
| **CineCodex 공개층** | 레지스트리 `lib/cinecodex_dims.ts` · 앵커 `lib/cinecodex_anchors.ts` · 페이지 `app/takescore/[dim]/` · 패널 `components/CinecodexPanel.tsx` | RPC `cinecodex_dimension_top`(+v/c/r), `cinecodex_film_subscores`(백분위). **cinecodex_for는 bank를 "Bankruptcy"로 반환 — 패널에서 매핑** |
| **아틀라스 층** | `lib/atlas.ts`(병합·게이트·도시 멤버십) + `lib/atlas_cities.json` + `worker/atlas-cities-build.py` | 정본: `HANDOFF-아틀라스-SEO-읽는층.md` — 게이트=mergeCells 불변식 |
| **계보 층** | `lib/lineage.ts`(출처맵·게이트·KNOWN_TRUE_SIZE·honorText) | 정본: `HANDOFF-계보-SEO-읽는층.md` — film_count 게이트 금지, lineage_sources 테이블은 빈 테이블 |
| 이론가 QID | `lib/theorist_qid.json`(검증 299) + `worker/theorist-qid/match.mjs` | 미해결 59명 CSV는 세션 스크래치에 있었음 — 재생성 가능(스크립트 재실행) |
| 스키마 공통 | 각 페이지 인라인 JSON-LD(트로프 페이지 패턴) | 포털=CollectionPage+ItemList+Breadcrumb, 노드=DefinedTerm, film=Movie(@id·sameAs wikidata·review) |
| **figure 질문 title 레이어** | `lib/figureSeo.ts`(ruleFigureQuestion·messyFigureTitle) → figure 페이지 `<title>`·리드 H2(fg-qh)·film 페이지 figure 앵커 | **18,168页 전량 렌더 타임 규칙 — DB·LLM 불요.** 불변식: H1·상호참조·JSON-LD headline은 label(엔티티) 유지, 질문은 title·부제에만. 정본: `Outputs/figure_seo/RUNBOOK.md` |
| **Quick Answers(인텐트 커버리지)** | 공용 `components/read/QuickAnswers.tsx` → 전 콘텐츠 유형 페이지가 리드 아래 마운트(LLM-0, 추가 페치 0) · 1층 탐지기 `mt_intent_scan()`(마이그 0079/0080) · 큐 `intent_queue` | **SHIPPED 전유형 라이브 2026-07-11.** GSC 쿼리→데이터로 답하는 Q&A. 정본: `docs/PLAN-intent-coverage.md`(헌장 6불변식·유형별 진단·웨이브 로그). 불변식: 답 없는 질문 금지·"best"는 실랭킹만·tradition "What is" 금지·lineage edition_year≠film_year. **신규 Q 추가·유형 확장 전 정본 §0·§5 필독** |

DB 마이그레이션(supabase/migrations로 관리됨): `slug_aliases`, `movement_hidden_films`, `cinecodex_dimension_top`, `cinecodex_film_subscores` — 전부 2026-07-04. **주의: `0035_figures_seo_fields.sql`은 파일만 커밋되고 프로덕션 미적용**(2단계 LLM 폴리싱 전용 컬럼 — 적용 전까지 어떤 코드도 seo_question/seo_short_label을 select하면 안 됨).

## 2. 런북 — 상황별 절차

### A. 새 영화가 추가될 때 (가장 빈번)
1. 파이프라인이 films에 행 추가(visible=false) → **Tier-2 페이지 자동 생성**(noindex), 컬렉션 "not yet read closely"에 자동 등장.
2. `node worker/tier2-backfill/backfill.mjs` 재실행(멱등) → 원제·감독·장르·시청처 채움. 완료 후 커밋(worker/는 워처 밖 — 수동 커밋).
3. 정독 완료(figures ≥3, visible=true) 시 → films.xml·whereto.xml·모듈·CineCodex 노출 **전부 자동 편입**. 할 일 없음.
4. 대량 추가 후: `node scripts/indexnow-ping.mjs --sitemap`.
5. **아틀라스(촬영지) 층**: 핀 수집(`GEO_운영-신규영화-증분처리.md`) 후 필름/감독 locations·국가 허브·사이트맵 자격은 **자동**(RPC+ISR). 수동 2가지 — ① `python3 worker/atlas-cities-build.py`(도시 로스터 재빌드, lib/는 자동 배포), ② locations 코호트 캡은 B 규칙. 전체 파일맵·불변식(게이트=mergeCells 등): `HANDOFF-아틀라스-SEO-읽는층.md` §2~3.
6. **계보(lineage) 층**: 새 멤버십이 들어오면 /lineage/[slug]·/film/x/honors·사이트맵(lineage.xml/honors.xml) 전부 **자동**. 수동은 honors 코호트 캡(B 규칙)뿐. 불변식(lineage_lists.film_count로 게이트 금지 — 공식 크기≠커버리지, honors는 visible 무관): `HANDOFF-계보-SEO-읽는층.md` §2~3.

### B. 코호트 캡을 올릴 때 (주간 규칙)
1. GSC에서 섹션별 색인 수·노출이 **전 스텝 이후 계속 상승**했는지 확인 (다음 리뷰일: lib/seo.ts 릴리즈 로그 참조 — 현재 2026-07-16).
2. `lib/seo.ts`의 해당 INDEX_COHORT_* 상향(주간 ×1.5~2) + 릴리즈 로그 추기.
3. 특정 섹션에서 "크롤링됨-미색인"이 쌓이면 → `app/sitemap.xml/route.ts` SECTIONS에서 그 자식만 제거(후퇴, 무손실). noindex는 절대 붙이지 않음.

### C. 새 표면(섹션)을 열 때
1. 페이지 게이트 확정(non-thin 기준 — 사이트 관례는 ≥3) → 페이지에 스키마 선탑재(DefinedTerm/CollectionPage 등).
2. `lib/sitemap-data.ts`에 entries 함수 + `app/sitemaps/{이름}.xml/route.ts` + SECTIONS 추가. 필요시 코호트 상수.
3. 배포 검증 → GSC sitemap.xml 재제출(선택) + IndexNow. 섹션 계기판 관찰.

### D. URL을 바꾸거나 병합할 때
- **개별 slug 개명·병합**: `insert into slug_aliases(old_path,new_path,reason) values(...)` — 이것만 하면 옛 링크 영구 308. sitemap에 old_path 절대 금지. 라우트가 신설 라우트면 miss 경로에 resolveAlias 배선 확인(`lib/aliases.ts` 패턴, take/trope/whereto/film 참조). 대량 사례: 2026-07-06 stub 274편 일괄 개명(aliases 548건, SQL은 `docs/PLAN-tier2-almanac.md` §7).
- **라우트 패턴 전체 이전**(사례 2건, 2026-07-06: /film/x/locations→/film/atlas/x, /film/x/honors→/film/lineage/x): 구 라우트의 page.tsx를 `permanentRedirect()` 한 줄 컴포넌트로 교체 — slug_aliases 불요. ⚠️**모바일 앱도 이 경로를 하드코딩한다**(웹뷰 리더 목록·딥링크 인터셉트). 리다이렉트가 있어 즉시 깨지진 않지만 앱은 308을 한 번 더 타고, 허브 패턴이면 네이티브 가로채기가 어긋난다 — `mobile/app/film/[slug].tsx`(readMore)·`mobile/app/director/[slug].tsx`(readMore)·`mobile/app/read.tsx`(허브 정규식) **3파일 동기**. 근거·목록: `HANDOFF-모바일앱-프리워치.md` §16.5. 체크리스트: 새 페이지 canonical/breadcrumb/JSON-LD url 갱신 → 내부 링크 전수 grep(`/구경로\``) → **앱 3파일 grep** → sitemap entries 함수 URL 갱신 → 배포 후 구 308/신 200 확인 → IndexNow에 새 URL 전량 재제출. GSC 자식 사이트맵 파일 주소는 불변이라 재제출 불요.

### E. 제목 규칙 (반복 실수 — 하루에 7건 발견)
페이지 title에 **"· Metatake"나 "| Metatake"를 절대 하드코딩하지 말 것.** 루트 레이아웃 템플릿이 붙인다. 위반 시 "… · Metatake · Metatake" 중복.

### F. 배포·검증 함정 2개
- **워처 연속 푸시**(40초 내 3연속) 시 Vercel 웹훅이 마지막 커밋을 놓칠 수 있음. 증상: origin에 코드는 있는데 deployment 레코드 없음 → 빈 커밋 재푸시.
- **ISR 캐시 오진**: 배포 직후 라이브 HTML로 "없다" 판정 금지 — 코드(HEAD) 먼저, 캐시버스터는 동적 페이지에만 유효(정적/ISR엔 무효), revalidate 주기 대기.

### G. 주간 GSC 관찰 (매주)
섹션별 색인률(계기판) · 노출·클릭·쿼리 클래스(인명/헤드텀/제목) · "크롤링됨-미색인" 비율(섹션별) · www→apex 대표 URL 상태. 판독 이력은 이 문서 §4에 추기.

## 3. 2026-07-04 작업 이력 (시간순)

1. **GSC 첫 판독**: 색인 3/미색인 4 → 원인 = www 리디렉션 307(임시) → 원우가 Vercel에서 308로 수정. /trope soft-404, 유틸 noindex 공백 발견.
2. **sitemap 대개편**: 단일 9,965 URL → 인덱스+자식 11개, lastmod 정확화(new Date() 제거, films=last_processed_at), /director 허브·블로그 글 추가. IndexNow 스크립트 인덱스 재귀 패치 + 전량 푸시.
3. **기초 수리**: 유틸 15라우트 noindex(/editor는 창립자 페이지라 제외), trope soft-404→404, 브레드크럼 완성(film/figure/director), 포스터 width/height+fetchPriority, WebSite 스키마·RSS 링크는 기존재 확인(ISR 캐시 오진이었음).
4. **sameAs**: Substack·Letterboxd·X 3프로필 배선 + 각 프로필에서 역링크(첫 백링크).
5. **관련 박스 모듈 시스템**: 관계형 제목 테마 섹션(cards/rows/posters), figure 8섹션/32박스까지. 배치는 무한 피드 위.
6. **포털 9종 표준화**: 전 허브 CollectionPage+ItemList+Breadcrumb, /takescore 랭킹 500 서버 렌더, /catalog canonical, /credits h1+A–Z(1,065), 제목 중복 수정. /idea↔/concept 중복 발견(→§5).
7. **헤드텀 랜딩**: GSC에 "movie tropes" 클러스터 44~63위 확인 → /tropes "Film Tropes—…"+정의 섹션, /catalog "Film Archetypes—…" 쌍으로.
8. **theorists.xml**(358, QID 299) + **catalog.xml Phase A**(504) + whereto.xml(1,934)·genres.xml(18).
9. **Tier-2 전략**: TMDB 백필 3라운드(원제 2,531·감독 5,021·장르 4,962 등), Tier-2 템플릿 재구축(noindex 깔때기), 컬렉션 4종 "not yet read closely"(+genre 1,000행 캡 버그 수정: 드라마 695→1,331).
10. **Atlas 읽는 층**(병행 세션): locations/atlas/cities.xml — 자식 18개 도달.
11. **CineCodex 노출층**: 13차원 랜딩(에세이+앵커 8편 자+Top25 포스터+하트+TS·V·C·R 보조점수+Wonwoo Yoon 바이라인+Article/DefinedTerm), film 패널 링크 격자+백분위+? 버튼+Movie.review, 허브 그리드 기본 펼침+툴팁, about 연결.
12. **GSC 추이**: 7/3 노출 14 → 7/4 노출 46·첫 클릭 2. 쿼리 3클래스(인명→트로프 헤드텀→영화 제목).

## 3b. 2026-07-05~07 작업 이력 (층별 정본 문서에 상세 — 여기는 색인)

1. **Atlas 마무리**(07-04 밤~05): 도시·지역 허브 511(cities.xml), E-E-A-T 보강(위치별 출처 링크·실제 갱신일·/atlas Dataset·돌아오는 감독들·포스터) → `HANDOFF-아틀라스-SEO-읽는층.md`.
2. **연결 엔진 재건**(07-05, 별도 세션): 친족·counterpoint·개념·갤럭시 → `HANDOFF-연결엔진-커넥션.md`.
3. **트로프·피겨·아키타입 순위 표면**(07-05~06, 별도 세션): 라이브 랭킹·% match·FAQ → `HANDOFF-트로프피겨아키타입-순위표면.md`.
4. **계보(Lineage) 읽는층**(07-05): /lineage/[slug] 업그레이드(검색형 제목·이중브랜딩 수정·robots ≥3·출처+QID·ItemList) + 필름 기록 페이지 신설(Tier-2 포함 895) + lineage.xml(202)·honors.xml(500) → 자식 20개 → `HANDOFF-계보-SEO-읽는층.md`.
5. **필름 하위 URL 체계 확정**(07-06, 원우 결정): 기록 페이지→`/film/lineage/[slug]`, 촬영지→`/film/atlas/[slug]` — 구 경로 전 패턴 308(런북 D-2), 필름 페이지 별도 탭 제거(Atlas 필 버튼/Lineage 섹션이 진입로), 양방향 내비 보강.
6. **site_content/ 스펙 팩 적용**(07-06): QID 20건 검증(전부 기 백필 확인), bare-wikidata 인용 버그 수정, Movie 노드 정합(@id 공유 페이지 간 date/sameAs/award 일치), /lineage Dataset, "N of M matched" 완전성 노트(KNOWN_TRUE_SIZE — 정의상 크기만), /methodology Lineage 섹션(수치 검증 후 게재).
7. **My Films 렌즈**(07-06, 별도 세션): 3단 개인화 오버레이 → `HANDOFF-마이필름-렌즈.md`.
8. **Tier-2 개방 배치**(07-06, 별도 세션): Tier-2 페이지 **Editor's digest**(DB 결정론 조합, 바이라인 Wonwoo Yoon+실데이터 갱신일, WebPage LD dateModified/editor, About 격하, 캐시 키 film-load5) + Atlas 미니맵 · 검색 `search_site` v2(Tier-2 포함, is_catalog+0.8 디스카운트, "catalog" 칩) · /film Full catalogue 뷰 · credits 인물 페이지 Tier-2 링크 승격 · **/whereto robots 게이트 명시**(visible만 색인 — 기존 무게이트 우연 상태 종료) · Atlas 표시 RPC 6종 핀 개방(17,307→25,029, 자격 게이트 불변) · director_slug 백필 22→1,022 · **stub slug 274편 일괄 개명**(aliases 548, /film miss 경로 resolveAlias 신설 배선) → 정본 `docs/PLAN-tier2-almanac.md` §7. **robots/색인 코호트 변화 없음**(Tier-2 전원 noindex 유지, Track B는 7/16 리뷰 대기).
9. **figure 질문 title 레이어**(07-07): figure 18,168页 `<title>` 전량 질문형 전환 — **전부 렌더 타임 규칙, LLM·DB 무사용/$0** (`lib/figureSeo.ts`). 깨끗한 라벨 57%=완전 질문형("Who is Monsieur Merde in Holy Motors (2012)?"), 지저분한 43%=대시-suffix("{label} in {film} — what does it mean?", 원우 아이디어). 부수 수정: 끝마침표 title 깨짐 1,333页·라벨 내 영화명 중복 2,353页. film 페이지 figure 카드 "Open →"→질문 앵커(깨끗한 라벨만). **불변식: H1·상호참조·JSON-LD headline은 label(엔티티) 유지 — 질문은 title·리드 H2(fg-qh)·앵커에만**(원우 확정). LLM 파이프라인(파일럿 30/30 합격, 배치는 큐 적체 24h 0건으로 취소)은 `Outputs/figure_seo/RUNBOOK.md`에 보존 — 2단계 폴리싱은 §5-7. URL·색인 정책 변화 없음.

## 3c. 2026-07-08~09 작업 이력 (정본: 루트 `HANDOFF-감독읽는층-리셉션-SEO.md`)

**대규모 SEO 표면 확장 — 상세·함정·남은 일은 반드시 루트 `HANDOFF-감독읽는층-리셉션-SEO.md`에서 시작.** 여기는 색인:

10. **리셉션/애프터라이프 층**(07-08): `/film/[slug]/reception` 1,957편(연도 타임라인, 4소스 결합) + 마이그레이션 0048(dek_lead·review_year·film_release_events·film_wd_honors) + 필름 Lineage/Reception 탭 record 문법 개편(캐시 film-load6). 사이트맵 film-reception.xml(1,894).
11. **감독 기사층**(07-09): 8개 서브페이지(start·next·life·misreadings·takescore·honors·reception·theory) + `/curious/directors` 색인(필터/정렬) + 허브 개편(The records 섹션·필모그래피 재편·2단 스포일러 탭). 사이트맵 6자식(director-start/next/misreadings/takescore/honors/reception/theory). 적격성 `directorLayerEligibility()`.
12. **누락 색인 4종**(07-08): movements(25)·essays-ko(293)·concept-domains(14)·frames(12) 자식 추가.
13. **이론층 문장화**(07-08): concept/theorist/trope/archetype에 "spelled out"+ReadingLedger+Figures칩 — auto-memory `engine-room-curious-integration.md`.
14. **스포일러-존 탭바**(07-09): FilmTabBar twoRow를 스포일러프리(상단)/스포일러(하단)로 의미 분할 + 좌측 라벨. 필름·감독 양쪽.
15. **⚠️ 운영 함정 3종**(루트 문서 §6): cinecodex_card 루프=DB다운(→벌크캐시 lib/takescore-bulk.ts), null-poison 404(loader 에러-throw), DB 과부하 나선(자동배포 churn+home_v2_bundle_v2 25초).

**신규 사이트맵 자식(GSC 개별 등록 필요)**: film-reception, movements, essays-ko, concept-domains, frames, director-{start,next,misreadings,takescore,honors,reception,theory}.

## 3d. 2026-07-11 작업 이력 (정본: `docs/PLAN-intent-coverage.md`)

**인텐트 커버리지 / Quick Answers 층 — 전유형 SHIPPED·라이브검증.** 상세·유형별 진단·함정·남은 일은 정본 문서에서 시작. 여기는 색인:

16. **Quick Answers 블록**(전 콘텐츠 유형): GSC 실측 쿼리를 "데이터로 답하는 질문+답"으로 커버. 공용 `components/read/QuickAnswers.tsx`, LLM-0·추가 페치 0. 웨이브: atlas(촬영지, +leadText 국가→도시)·movies-like·film-lineage·lineage정전·reception·credits·whereto·감독허브/life·trope("is it a cliché"=maturity)·concept(sm/theory분기)·theorist·credits인물·genre·movements·frame·catalog·atlas국가/도시·tradition.
17. **1층 미커버-인텐트 탐지기**: `mt_intent_scan()`(마이그 0079, v2 봇노이즈필터 0080) → `intent_queue`, 인사이트 30분 크론 편승. 발단이던 "idiocracy skyline"류가 실제로 큐에 잡히고 데이터 없어 미생성됨(설계대로).
18. **⚠️ 불변식(신규 Q 추가 시 필독, 정본 §0·§5.8)**: 답 없는 질문 금지·엔티티 불변·변형어 최대2회·"best"는 실랭킹필드만(genre/atlas/catalog 금지)·lineage 영화단위(인물 노미네이션 금지)·edition_year≠film_year·tradition "What is" 금지(정의필드 없음)·misreadings 해석프레이밍만·reception 집계점수 없음.
19. **⚠️ 배포 CHURN 함정(§F 보강)**: 워처가 파일별 커밋→2분새 다중 배포→각 빌드가 sitemap XML을 DB서 동시생성→과부하→일부 빌드 ERROR(`Export encountered an error on /sitemaps/*.xml`). 최종 배포가 ERROR면 변경 미반영. **해법: 웨이브 후 Vercel `list_deployments`로 최신 state 확인→ERROR면 빈 커밋 재푸시로 단일 클린빌드.** dynamic 라우트(generateStaticParams()[])는 로컬빌드가 실렌더 안 하니 라이브 curl로 런타임 검증 필수.

## 3f. 2026-07-16 작업 이력 (정본: 루트 `HANDOFF-필름페이지-보강-작업지시서.md`)

**영화 세부페이지 실질성 보강 — 기획 완료·구현 대기(다른 AI 수행).** 상세·함정·남은 일은 정본 문서에서 시작. 여기는 색인:

20. **섹션 리드 결정론 재작성(14항목)**: 필름 메인(Tier-2/Tier-1)의 섹션별 리드 보일러플레이트를 이미 로드된 공장 산출 행으로 **영화별 결정론 문장 조립(LLM-0)** — Editor's digest(§3b-8) 기법을 TakeScore·Lineage·Locations·Where-to-watch·Sources 박스로 확장. 신규 페치 0·신규 LLM 스테이지 0. **색인/robots/사이트맵 불변**(`lib/seo.ts filmIndexBar`·`filmMainIndexable`·`INDEX_COHORT_FILMS_T2`·`factory/coupling-map.json` 무변경).
21. **자기부정 금지(원칙 C, 07-14 정책 승계)**: `pending`/`no awards recorded`/`No streaming data yet` 류 첫화면 문구 삭제 — 데이터 부재 시 **섹션 부재**(gate on presence)로 강등, 자기부정 문장 렌더 금지. Tier-2 공장 정직성 원칙("37%는 실제 수상 없음 — 못 만드는 한계")과 정합.
22. **⚠️ 오너 결정 2건(§5로 이관)**: ⓐ #10 Embedding Fantasia 면책 압축은 `FilmSentences`/`EntityFantasia` doc-comment의 "keep it" 불변식과 충돌 → 오너 확인 후 doc-comment 동시 수정. ⓑ #12 "몇 번째 협업" 집계는 이미 render-time SHIP(`lib/film-credits-data.ts`, TMDB `/person/{id}/movie_credits`)이라 신규 RPC는 리던던트 — DB precompute(마이그 `0105`+신규 테이블+전코퍼스 백필)는 오너 명시 요청 시에만. #7 `sonnet-n1`/#10 모델·패널명 노출은 `/methodology`로만 라우팅(투명성 페이지가 manifest 스테이지 모델 S40 sonnet·S19 sonnet+Tavily·S28 LLM-0을 정확히 미러).

## 4. GSC 판독 로그 (추기식)

- **2026-07-04**: 노출 46·클릭 2. 트로프 헤드텀 8종 44~63위 진입. 인명 롱테일 지속(뉴스 연동 확인: eisenberg polish citizenship). 영화 제목 쿼리 첫 등장(inside the yellow cocoon shell).
- **2026-07-11**: 누적 노출 218·클릭 3·평균 19.5위(제출 후 48h). film-atlas 9.1위·movies-like 8.8위=초기 승자, tropes 헤드텀 40~70위(장기). 수동조치·보안문제 0. 조치: robots.ts에 /search?*·/ask-ai 차단(전 봇그룹 상속), 깨진 중복 sitemap 삭제. **Quick Answers 층 배포 → 유형별 CTR before/after 판독은 +1~2주 후(정본 §8에 추기).**

## 5. 대기 중인 결정 (원우)

1. **/idea ↔ /concept 통합** — slug 매핑표 작성 후 slug_aliases로 308 통합 (현재 /idea noindex,follow 임시 상태).
2. **theorist QID 미해결 59명** — `worker/theorist-qid/match.mjs` 재실행으로 CSV 재생성 가능; 검토분은 lib/theorist_qid.json에 수동 추가.
3. **catalog Phase B** — tier 분류류 ≥5멤버 +~590 URL (Phase A GSC 검증 후).
4. **CineCodex 근거 텍스트 배치** — 영화별 13차원 근거 1줄은 DB에 없음(스펙만). 생성 시 Tier-1 1,935편 Message Batches ~$100-150.
5. **7/16 코호트 리뷰** — 전 캡 동결 해제 여부 + Tier-2 수요 기반 승급 루프 부착. 증량 후보: locations 1,000→1,714 · honors 500→895.
6. **GSC 자식 제출**(원우) — locations/atlas/cities/lineage/honors.xml 5개. 제출 직후 "가져올 수 없음"은 첫 크롤 전 정상.
7. **figure LLM 폴리싱 2단계(순수 선택)** — 지저분한 라벨 7,862건의 압축 질문+short_label(축소 배치 ~$20). 선행: ① GSC에서 07-07 title 레이어 효과 2~4주 관찰 ② Supabase MCP 재연결 후 0035 적용. 재개 절차·폴백 체인은 `Outputs/figure_seo/RUNBOOK.md`. **18k 전량 배치 재제출 금지**(57%는 규칙으로 이미 커버 — 낭비).
7. **계보 데이터 카드**(별도 결정): lineage_editions 4,735 노출 여부 · lineage_sources 테이블 채우기 · 플래그십 정전 꼬리 수복(TSPDT+6, NFR+11) · films.wikidata_id 백필(Movie sameAs 자동 강화, theorist QID 매처 재사용).
8. **도시 엔티티 앵커**: 도시 허브에 Wikidata QID sameAs + 현지어 alternateName(서울/東京).

9. **필름 세부페이지 보강 오너 결정 2건**(정본: 루트 `HANDOFF-필름페이지-보강-작업지시서.md` §9): ⓐ #10 Embedding Fantasia 면책 압축 — `FilmSentences`/`EntityFantasia` doc-comment의 "keep it" 불변식과 충돌하므로, 압축 승인 시 doc-comment도 동시 수정(불변식이 조용히 모순되지 않게). ⓑ #12 "몇 번째 협업" 집계 — 이미 render-time SHIP(TMDB, `lib/film-credits-data.ts`)이므로 **신규 RPC 미생성이 기본**; DB-native precompute(마이그 `0105`+신규 `film_credit_pairs` 테이블+워커 백필)는 오너가 명시적으로 원할 때만(="RPC 1개"가 아니라 새 테이블+스테이지 규모). 둘 다 render-only·색인 게이트 불변.
