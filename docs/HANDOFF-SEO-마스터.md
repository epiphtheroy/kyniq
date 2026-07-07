# HANDOFF — SEO 운영 마스터 (정본)

*작성 2026-07-04 · **갱신 2026-07-06** (계보 층 + 필름 하위 URL 체계 확정 반영). 새 영화 추가·표면 개방·개명 등 변경 작업 전에 반드시 이 문서의 런북부터 확인할 것. 기획 상세: `docs/PLAN-seo-surface-expansion.md`, 지도 표면: `docs/PLAN-atlas-seo.md`. 층별 정본: 아틀라스=`HANDOFF-아틀라스-SEO-읽는층.md`, 계보=`HANDOFF-계보-SEO-읽는층.md`, 순위표면=`HANDOFF-트로프피겨아키타입-순위표면.md`, 연결=`HANDOFF-연결엔진-커넥션.md`.*

---

## 0. 한눈에 — 지금 검색엔진이 보는 사이트

- **sitemap**: `/sitemap.xml` = 인덱스, 자식 **20개**(`/sitemaps/*.xml` — 07-05에 lineage·honors 합류). 총 ~13,700+ URL. GSC가 **섹션별 색인률**을 따로 보고 → 코호트 증량·후퇴 판단의 계기판.
- **영화 6,975편** = Tier-1(공개·정독) 1,935 + Tier-2(noindex, 데이터 페이지) 5,040. Tier-2도 TMDB 백필로 원제·감독·장르·개봉일 보유.
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
| Tier-2 템플릿 | `app/film/[slug]/page.tsx`의 Tier-2 분기 | noindex 유지 원칙. Tier-1 분기와 분리 |
| 컬렉션 "not yet read closely" | lineage/genre/director/movements `[slug]/page.tsx` | movements는 RPC `movement_hidden_films`(curation.film_hub) |
| **CineCodex 공개층** | 레지스트리 `lib/cinecodex_dims.ts` · 앵커 `lib/cinecodex_anchors.ts` · 페이지 `app/takescore/[dim]/` · 패널 `components/CinecodexPanel.tsx` | RPC `cinecodex_dimension_top`(+v/c/r), `cinecodex_film_subscores`(백분위). **cinecodex_for는 bank를 "Bankruptcy"로 반환 — 패널에서 매핑** |
| **아틀라스 층** | `lib/atlas.ts`(병합·게이트·도시 멤버십) + `lib/atlas_cities.json` + `worker/atlas-cities-build.py` | 정본: `HANDOFF-아틀라스-SEO-읽는층.md` — 게이트=mergeCells 불변식 |
| **계보 층** | `lib/lineage.ts`(출처맵·게이트·KNOWN_TRUE_SIZE·honorText) | 정본: `HANDOFF-계보-SEO-읽는층.md` — film_count 게이트 금지, lineage_sources 테이블은 빈 테이블 |
| 이론가 QID | `lib/theorist_qid.json`(검증 299) + `worker/theorist-qid/match.mjs` | 미해결 59명 CSV는 세션 스크래치에 있었음 — 재생성 가능(스크립트 재실행) |
| 스키마 공통 | 각 페이지 인라인 JSON-LD(트로프 페이지 패턴) | 포털=CollectionPage+ItemList+Breadcrumb, 노드=DefinedTerm, film=Movie(@id·sameAs wikidata·review) |
| **figure 질문 title 레이어** | `lib/figureSeo.ts`(ruleFigureQuestion·messyFigureTitle) → figure 페이지 `<title>`·리드 H2(fg-qh)·film 페이지 figure 앵커 | **18,168页 전량 렌더 타임 규칙 — DB·LLM 불요.** 불변식: H1·상호참조·JSON-LD headline은 label(엔티티) 유지, 질문은 title·부제에만. 정본: `Outputs/figure_seo/RUNBOOK.md` |

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
- **라우트 패턴 전체 이전**(사례 2건, 2026-07-06: /film/x/locations→/film/atlas/x, /film/x/honors→/film/lineage/x): 구 라우트의 page.tsx를 `permanentRedirect()` 한 줄 컴포넌트로 교체 — slug_aliases 불요. 체크리스트: 새 페이지 canonical/breadcrumb/JSON-LD url 갱신 → 내부 링크 전수 grep(`/구경로\``) → sitemap entries 함수 URL 갱신 → 배포 후 구 308/신 200 확인 → IndexNow에 새 URL 전량 재제출. GSC 자식 사이트맵 파일 주소는 불변이라 재제출 불요.

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

## 4. GSC 판독 로그 (추기식)

- **2026-07-04**: 노출 46·클릭 2. 트로프 헤드텀 8종 44~63위 진입. 인명 롱테일 지속(뉴스 연동 확인: eisenberg polish citizenship). 영화 제목 쿼리 첫 등장(inside the yellow cocoon shell).

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
