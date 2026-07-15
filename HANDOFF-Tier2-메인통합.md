# HANDOFF — Tier-2 메인 통합: 필름·감독 메인의 thin 탈피 작업지시서 (정본)

> **✅ SHIPPED + 라이브 검증 완료 2026-07-15 (commit `5e8f507`).** 필름 C1~C5 + 감독 D1~D6 전량 배포·확인. D6 게이트 실측 858→678/180(§8). 캐시키 실제값: film-load8·director-load6·director-press-digest-1·**read-plates-3**(§3 C5의 "read-plates-2 검토"는 -3으로 확정). 아래는 그 정본 스펙(구현 완료분).
>
> **⭐ 크롬 패리티 픽스(2026-07-15, commit `4a22c33`)**: `app/film/[slug]/page.tsx`는 **두 렌더 블록**
> — Tier-2(`is_analyzed===false`, ~879~1290) / Tier-1(~1301~1900). Tier-1만 최근 크롬(EntityActions·
> SeqNav·Provenance·팩/MCP)을 받아 Tier-2가 "옛 포맷"으로 뒤처져 있던 것을 픽스: Tier-2 블록에
> **EntityActions·SeqNav·Provenance** 이식(id/recordUpdated만 사용). Byline은 제외("Drafted by
> Editorial" = 규칙-조립 카탈로그엔 과장). 팩/MCP는 `packVisible=visible!==false`라 Tier-2 자연 제외(제품 결정).
> **팩/MCP도 Tier-2에 붙임(commit `e272a8a`)**: `film_context_pack` RPC(마이그 0103)가 is_analyzed=false도
> 서빙(카탈로그 섹션만 — takescore·standing·honors·locations; 분석 섹션은 자연 빔 → 유출0)+다운로드 라우트
> 게이트 완화+히어로 DownloadPackModal·McpConnectButton(t2PackSecs 게이트). 실측 the-turning-point=takescore+수상4+촬영지10.
> **불변식: 두 블록은 크롬 패리티 유지 — Tier-1에 크롬 추가 시 Tier-2에도 back-port**(정보량만 다르고 포맷 동일).
>
> **작성 2026-07-15** · `HANDOFF-SEO-스타터가이드-작업지시서.md` §2.4e fast-follow의 확장 정본.
> 전 수정 지점을 프로덕션 DB 실측(2026-07-15) + 코드 검증 파일:라인으로 지정.

---

## §0. 목적과 의도 (수행자는 이 절을 기준으로 모든 판단을 내릴 것)

**목적:** 2026-07-15 배포로 색인 승격된 Tier-2 영화 1,105편의 메인 페이지와, 감독 허브 858개 중
얇은 645개가 **페이지 자체로 실속(substance)을 갖게** 만든다.

**의도 — 왜 이것이 필요한가:**
1. **구글의 thin/scaled 판정은 페이지 단위다.** 링크 너머의 콘텐츠는 그 페이지의 실속으로 인정되지 않는다.
   지금 승격된 Tier-2 메인은 데이터가 *존재*하는데도 헤드카운트 배지·탭 링크·문(door) 카드로만 걸어두고
   본문에서는 렌더하지 않는다 — "가진 것을 안 보여주는" 상태.
2. **약속-이행 원칙:** 게이트가 "이 영화는 수상 기록·리셉션·가용성이 있어 색인할 가치가 있다"고 판정해 놓고,
   방문자가 도착한 메인에 그 근거가 안 보이면 게이트의 논리가 페이지에서 배신당한다.
   게이트를 통과시킨 신호(wd_honors·release·reception·score)가 곧 통합 대상이다.
3. **동일 로직의 감독판:** 감독 허브는 robots 게이트가 아예 없고(전 858개 색인), 645개가 편집층
   (portrait/facts/picks/next) 0인 채로 색인 중이다. 반면 그 감독 영화들의 리셉션·수상·점수는 DB에
   있는데 허브는 카운트 문패만 단다. 같은 "통합 + 게이트" 처방을 적용한다.
4. **중복 금지가 통합의 제약이다:** 직전 작업이 크로스페이지 바이트 중복(verdict·to.W)을 의도적으로
   제거했다. 통합은 반드시 **다이제스트 계약**(§2 R-D)을 따른다 — 서브페이지의 복사가 아니라
   부분집합+다른 문장 프레임+전문 링크.

**성공 기준:** 승격 Tier-2 메인이 "점수+큐레이터 평+수상 다이제스트+개봉 연혁+스틸+가용성"을 페이지 안에서
답하고, 얇은 감독 허브가 "전 작품 점수+언론/수상 다이제스트+가용성"을 갖거나, 그것마저 없으면 noindex된다.

---

## §1. 실측 요약 (2026-07-15 프로덕션, kyniq — 이 표가 작업의 우선순위표다)

### 1a. 승격 Tier-2 1,105편 — 메인에 통합 가능한 소스 (커버리지 순)

| 소스 | 커버리지 | 현재 상태 | 처방 |
|---|---|---|---|
| film_release_events | **1,105 (100%)**, 평균 18.8행 | 로더가 아예 안 읽음 — /reception 전용 | **C2** 다이제스트 |
| imdb_rating | 1,105 (100%) | ✅ digest prose+패널 칩 — 갭 아님 | — |
| tow_comment | 1,091 (98.7%) | ✅ short variant 마운트됨 | — |
| cinecodex 13차원 | 1,084 (98.1%, 전 차원 non-null) | ✅ subscores 배선됨(직전 배포) | — |
| media 이미지 | 1,098 (≥5장 861) | 메인은 백드롭 1장 — Tier-1은 StillHero 4장+Strip 3장 | **C4** 패리티 |
| film_sentences | 1,082 (평균 7.9문장) | ✅ 마운트됨 | — |
| **film_wd_honors** | **1,043 (94%)**, 평균 7.4행 (승 2,882·후보 4,823) | **헤드카운트만**(:222) — 탭 배지 전용, 본문 0 | **C1** 최우선 |
| film_provider_index | 1,105 (100%) | ✅ AccessSummary | — |
| film_reception | **25편뿐**(전부 academic) | 헤드카운트만 | **C3** (해당 25편) |

### 1b. 통합 **불가능** — 시도 금지 (실측 근거)

| 소스 | 실측 | 함의 |
|---|---|---|
| film_affinities (kindred) | 승격 1,105편 전부 **0행** | 킨드레드 스트립 금지. t2Sections 셸(:965-967)이 대체 중. 원장 재구축은 §6 백로그 |
| tv_programs published | **0편** | TV 카드/플레이트 배선 금지 |
| criticism 리셉션 | **0행** (8,908행 전부 Tier-1) — 코호트 리셉션은 100% academic | "What critics said" 카피 사용 금지 → **scholarship 프레이밍** |
| 트레일러 iframe | media video 955편 있지만 | GSC watch-page 플래그 재유입 — **iframe 절대 금지**(14ec2d0 스윕 보존) |

### 1c. 감독 허브 — 전제 정정 (중요)

- **"Tier-2 전용 감독의 메인"은 존재하지 않는다**: 허브는 `visible=true` 영화 ≥1이 존재 조건
  (`app/director/[slug]/page.tsx:57-64` → :427 notFound). 승격 1,105편의 감독 중 슬러그 보유 164명은
  **전원** visible 영화 보유(허브 있음). 773편은 director_slug가 NULL.
- **진짜 문제 = 기존 858 허브 중 얇은 645개**(portrait/facts/picks/next 전무; 그중 단일작 506).
  robots 게이트 없음 → 전부 색인 중. 렌더 실측: 얇은 허브의 고유 프로즈 ≈ 100~200단어.
- 얇은 645 허브가 가진 미통합 데이터: 자기 영화들 리셉션≥3 **511개** · 수상≥3 **343개** ·
  스트리밍 가용 **639개** · TakeScore(카탈로그 영화 포함)는 이미 메모리에 로드되고 버려짐(§4 D1).
- 리셉션 백필 상태: 성장 중 아님(7/12 일괄 적재 완료분·재실행 프로세스 없음). OpenAlex 재시도만이
  얇은 영화 리셉션의 현실적 증분 경로(§6).

---

## §2. 규칙·함정 (전 항목 공통 — SEO 작업지시서 §1의 R1~R9 승계 + 신규)

| # | 규칙 |
|---|---|
| R-D | **다이제스트 계약(중복 금지의 실행형):** 메인에 올리는 것은 ①부분집합(상한 명시) ②서브페이지와 **다른 문장 프레임** ③전문 링크 동반. 서브페이지의 문장 템플릿("Won the {label} on {date}." 등)을 메인에서 재사용 금지. 숫자 스코어카드(TakeScore)는 정본 사실이라 예외(중복 아님) |
| R-K1 | **캐시키 bump**: 필름 minimal 페이로드 shape 변경 → `"film-load7"`→`"film-load8"`(`app/film/[slug]/page.tsx:444`, 이력 주석 :439-444에 v8 줄 추가). **로더+렌더+bump는 한 커밋** — bump 없이 렌더만 배포되면 stale 페이로드 destructure로 500 |
| R-K2 | 감독 로더 shape 변경(D4만 해당) → `"director-load5"`→`"director-load6"`(:207-214). D1/D2/D3/D5는 로더 밖에서 처리해 bump 회피 |
| R-C | 코호트 리셉션=100% academic — UI 카피는 scholarship. `FilmReceptionSection.tsx:64` "N reviews" 칩은 reviews>0 게이트, :97 RecordToc 키커 papers-인지형으로 — **컴포넌트 수정과 소비자는 같은 커밋**(워처 레이스) |
| R-B | **TMDB bio 렌더 금지**(감독): `page.tsx:521-523`의 의도적 드롭 결정 보존 — 수천 미러에 색인된 제3자 보일러플레이트=정확히 싸우고 있는 thin/중복 신호. 라우트 디렉터리의 `.fuse_hidden*` 구버전 아티팩트는 **삭제** |
| R-V | 배포 후 검증: 캐시버스터 필수(ISR 300s+태그) · React 주석 노드가 보간 텍스트 쪼갬 — 라이브 HTML에서 문장 전체 grep 금지(단어·속성 단위로) |
| R-Q | RPC 루프 금지(cinecodex_card 기아 트랩 `director/[slug]/page.tsx:458-459`) — 다이제스트는 `.in(filmIds)` 플레인 셀렉트로. film_locations는 anon RLS 0 — film_geo/director_geo RPC 경유만 |
| R-L | LLM-0 유지: 모든 다이제스트는 결정론적 조립. 신규 저술 없음 |

---

## §3. P1 — 필름 메인 통합 (`app/film/[slug]/page.tsx` minimal 분기)

로더 변경 총괄: Promise.all(:185-198)에서 **헤드카운트 2개(:221-224)를 풀 로우 셀렉트로 교체** +
release_events 1쿼리 추가 = 왕복 11→12(+1). 전부 per-slug Data Cache(revalidate 300) 내부. → R-K1 bump.

### C1 — Wikidata 수상 다이제스트 (1,043/1,105페이지 — 최우선)
- **쿼리**(리셉션 서브페이지 :61-63 미러): `from("film_wd_honors").select("kind, label, event_date, year_only").eq("film_id", film.id).order("event_date")` — :222 헤드카운트 대체(`afterlifeHonors = rows.length` 유지).
- **렌더**: EDITOR'S DIGEST 섹션(:837-884)의 lineage/ratings 문단 뒤(:850 앵커)에 결정론 문단 1개:
  `"Wikidata's award record holds {N} honors for {title} — {W} wins and {M} nominations, including the {label1}, {label2} and {label3}."` + `The year-by-year record →` 링크(/film/x/reception).
  선별: kind='award' 승 우선→일자 있는 것 우선, **top-3 라벨을 joinProse(:137-140) 관용구로**.
- **중복 회피(R-D)**: 서브페이지 템플릿("Won the … on …", :298-301) 금지 — 집계 문장 1개+라벨 3개.
  같은 페이지 안에서 digestNotableHonors(:154-172)의 lineage 픽과 **normWords 단어중복 규칙**(reception/page.tsx:124, :294-297)으로 dedupe(같은 상이 두 번 안 찍히게).
- 게이트: `wdHonors.length>0`. `hasDigest`(:701)에 `|| wdHonors.length>0` 추가. 새 탭 불필요(기존 Afterlife href 탭 유지).
- (선택) df-digest__chips 관용구(:874-877)로 승 라벨 최대 5개 칩.

### C2 — 개봉 연혁 다이제스트 (1,105/1,105페이지)
- **쿼리**(신규 +1): `from("film_release_events").select("country, event_type, event_date, note").eq("film_id", film.id).order("event_date")`.
- **렌더**: 같은 df-digest에 문단 1개 — 첫 프리미어(국가+일자; 673편) 또는 첫 극장 개봉, 이어 집계:
  `"TMDB's ledger dates {N} release events across {M} countries and territories, from its {country} premiere ({Month D, YYYY}) to {latest_type} in {latest_year}."` + 타임라인 링크.
- **중복 회피**: 서브페이지는 연도별 문장(:266-273)+Q&A 표현(:147-159) — 메인은 **한 문장 집계**(서브 어디에도 없는 형태). "premiered in" 동사구 재사용 금지 — "its {country} premiere ({date})" 종속절로.
- 게이트: `events.length>0`. mTabs 추가 없음(df-digest 내부).

### C3 — Scholarship 섹션 (25페이지 — 리셉션으로 승격된 20편의 약속 이행)
- **쿼리**(full 분기 :249-251 그대로 미러): `from("film_reception").select("kind, outlet, critic, year, tier, headline, comment, verdict, url, dek_lead, review_year").eq("film_id", film.id).order("position")` — :223 헤드카운트 대체.
- **마운트**: `<FilmReceptionSection title={f.title} slug={f.slug} reviews={reviews} papers={papers} quotes={t2Quotes} afterlife={t2Afterlife} />` — FilmRecommendedBy(:889)와 FilmSentences(:892) 사이.
  - `t2Quotes` = full 분기 quotePool 레시피(:982-997) **cap 2**(dek_lead 우선; 서브페이지가 다수 보유 유지 — linQuotes/rcpQuotes 분할 전례 :998-999). tier 필터가 kind='criticism'을 가정하지 않게 주의(코호트는 전부 academic).
  - `t2Afterlife` = `{ reviews, papers, releases, honors, y0, y1 }` — RecordToc 문(FilmReceptionSection.tsx:92-108)이 /reception 퍼널을 렌더.
- **컴포넌트 수정(같은 커밋, R-C)**: :64 "N reviews" 칩 → `reviews.length>0` 게이트 · :97 RecordToc 제목 papers-인지형("What critics said"는 reviews=0에서 오문).
- mTabs: `reception.length ? { id:"df-reception", label:"Reception", badge } : null` (Tier-1 :1061과 동일 id).

### C4 — 이미지 패리티: StillHero + StillStrip (~1,099페이지 · **Supabase 쿼리 0 · bump 무관**)
- 렌더 본문에서(캐시 로더 밖): `const heroGallery = await filmBackdropPaths(f.tmdb_id)`(lib/read-media.ts:17-36, TMDB fetch-cache 86400 — Tier-1 :1038과 동일).
- 단일 `<img>` 히어로(:777-780) → Tier-1 StillHero 패턴(:1174-1182, `pickStills(heroGallery, `${f.slug}:hero`, 4)`, 폴백 `[f.backdrop_path]`, **watchHref 없음** — 코호트 tv 0).
- Credits 섹션(:939) 뒤에 `StillStrip`(`pickStills(..., `${f.slug}:strip`, 3)`, disclaim={false}, 패턴 :1371-1373).
- 게이트: stills.length. **iframe 금지(§1b)**.

### C5 — 마무리 배선
- `hasDigest`(:701)에 wd/events 항 추가 · title 공식(:560)은 **불변**(SERP churn 방지) · description(:562-568)에 수치 추가는 선택(전례 :593).
- **인접 수정(같은 PR 권장)**: `components/read/ReadPlates.tsx:84-85`가 `visible=false`에서 null →
  **승격 Tier-2의 전 서브페이지에 하단 퍼널 플레이트가 안 뜨는 중**. 게이트를 visible 대신
  `filmMainIndexable` 결과(또는 is_analyzed 무관 조건)로 교체 + 자체 캐시키 `read-plates-2`(:144) bump 검토.

---

## §4. P2 — 감독 허브 통합 (`app/director/[slug]/page.tsx`)

### D1 — 카탈로그 영화 TakeScore (최고 가치·비용 0 — 라이브 모순 수정)
- **현상**: `cachedRankedScores()`(:461, 전 채점작 6,704편 메모리 보유 — cinecodex_ranked는 visible 필터 없음 검증됨)를 허브가 이미 호출하고도 **버린다**: catFilms `score: null` 하드코딩(:727) → 카탈로그 행 전부 "not yet scored"(:752). **같은 영화의 /film 페이지는 점수를 보여주는 자기모순.**
- **수정**: :726-727에서 `score: bulkScores[f.slug] ? {u,v,c,r,tier:null} : null`. scoredN(:729)·gloss(:735)는 자동 갱신. 행 단위 폴백 유지(미채점 21편 커버).
- 쿼리 0 · bump 0(페이지 본문 계산). 점수는 정본 사실 — R-D 예외.

### D2 — 언론/학술 다이제스트 "the press, in brief" (얇은 645 중 511 허브)
- **쿼리**: `from("film_reception").select("film_id,outlet,critic,headline,verdict,review_year").in("film_id", filmIds).order("tier").limit(30)` → 영화당 ≤1행, **cap 3-4**.
- **신규 캐시 로더**: `["director-press-digest-1", slug]`(rev 3600, tag director:<slug>)에 D2+D3+D5 셀렉트 3개를 묶는다 — director-load5 bump 회피(R-K2).
- **마운트**: The records 섹션(:921-964) 문 카드들 위. 감독 레벨 리드 문장(실측 카운트 포함:
  `"Across {N} films, {M} pieces of press and scholarship on the record — the sharpest lines:"`) +
  `outlet · year · headline`(~140자 절단, 절단 패턴 :772 미러) 각각 /film/[slug]/reception 링크.
  기존 RecordToc 문(:944-952)은 "full record" 링크로 유지.
- **중복 회피(R-D)**: 허브는 영화당 1행·fragment만. dek_lead+verdict 동시 렌더 금지(서브페이지 소유).
- 게이트: 기존 `receptionN>=3`(:171).

### D3 — 수상 한 줄 (343 허브)
- 같은 신규 로더에서 film_wd_honors 상위+film_lineage 리스트명 `.in(filmIds)` limit ~6.
- The records 섹션의 honors 문(:935-943) 위에 한 문장: `"{name}'s films carry {K} awards and sit in {M} canons — {top3 names}."` 이름+카운트만(카운트 테이블은 서브페이지 소유).

### D4 — 촬영지 텍스트 다이제스트 (지도는 크롤 텍스트 0인 현상 수정)
- **현상**: director_geo 핀을 매 로드마다 fetch 후 카운트만 남기고 **버림**(:190-199); 지도(:984-1004)는 클라 전용.
- **수정**: loadUncached가 topPins(mergePins 상위 6)+국가 분포도 반환 → **R-K2 bump director-load6**.
  지도 옆 리스트형 라인: `"Shot and set in: {place} ({film}) · …"` — 각 장소 /film/locations/[slug] 또는 국가 허브 링크.
- **중복 회피**: /locations 서브페이지 leadText 템플릿(locations/page.tsx:86-99)과 다른 문장형(리스트형·영화 앵커). merge 규칙은 lib/locations.ts의 mergeCells/mergePins만 사용(사이트맵·SQL 패리티 불변식).

### D5 — 가용성 집계 한 줄 (639 허브)
- 같은 신규 로더: `film_provider_index`에서 `.in(filmIds)` + kind NOT IN ('rent','buy') distinct film 카운트.
- Filmography gloss(:733-736)에 1문장: `"{N} of them are streaming somewhere right now — each film's page lists where."`

### D6 — 감독 허브 robots 게이트 (신규 — 통합의 쌍둥이)
- **현상 검증**: generateMetadata(:316-334)에 robots 키 없음·pageRobots 미임포트 — 858 허브 전부 색인,
  단일작·편집층 0 허브 506개 포함. 사이트맵 directorEntries(lib/sitemap-data.ts:808-836)도 무기준
  (visible 영화 있는 전 슬러그 광고).
- ⚠️ "영화 게이트 미러"는 **공허**함(허브 존재 조건이 이미 visible 영화 ⊃ 색인) — 허브 **자체의 실속 기준** 필요.
- **처방**: 신규 `lib/directorGate.ts` — `directorIndexBar(d)`:
  `total>=2 || !!portrait || (facts>=4) || picks>=3 || next>=3 || (receptionN+honorsN)>=6`
  (마지막 항은 D2/D3가 실제로 그 기록을 본문에 렌더하기에 정당 — **D2/D3와 같은 배포에서만 유효**).
- **코드 지점**: ①:327-333 반환 객체에 `robots: pageRobots(directorIndexBar(data))`(입력 전부 캐시 페이로드에 이미 존재 — 쿼리 0) ②directorEntries에 **동일 술어** 필터(페이지·사이트맵 드리프트 금지 — filmGate 패턴 미러).
- **선행 의무**: 배포 전 SQL로 술어를 돌려 **정확한 noindex 전환 수를 산출·기록**(예상 ≤506, records 항 구제분 차감). robots+사이트맵은 **같은 배포**. `follow:true` 유지(pageRobots 기본). 감독 8서브페이지는 각자 실속 바 보유 — 변경 불필요이나 "noindex 허브+색인 서브"의 정합 논리(각 서브가 자체 바 통과)를 오너 보고에 명기.
- **오너 고지**: GSC 감독 허브 noindex 물결 = 의도된 정상.

---

## §5. 하지 말 것 (실측·결정 근거 — 위반은 회귀)

1. **킨드레드/movies-like 스트립**(film_affinities=0) · 2. **TV 카드**(tv_programs=0) · 3. **트레일러/영상 iframe**(GSC 플래그) · 4. **TMDB bio 렌더**(R-B — 의도적 드롭 보존; `.fuse_hidden*` 삭제) · 5. **"What critics said" 카피를 Tier-2에**(전부 academic) · 6. **허브 404 게이트 완화**(`:58`의 `.eq("visible", true)` 제거 금지 — 빈 페이지 신규 발행이 됨) · 7. **verdictShort/to.W 재출력**(직전에 죽인 패턴) · 8. **hidden-film 레이어 캡(24)·이름 매칭(:76) 확장** — 다이제스트 용도로는 현상 유지, 한계만 문서화.

## §6. 후속 데이터 백로그 (이 지시서 범위 밖 — 별도 세션)

| 항목 | 내용 | 효과 |
|---|---|---|
| affinity 원장 Tier-2 확장 | film_affinities를 승격 1,105편에 생성(임베딩 파이프라인) | 킨드레드 스트립·movies-like 개방 |
| OpenAlex 재시도 | reception-run-summary의 "academic pending" 6,844편 재실행 | 얇은 영화 리셉션(academic) 증분 — C3 커버리지 확대 |
| director_slug 백필 | 승격 773편의 NULL 슬러그 — **허브 실존 확인부**(없으면 film→404 링크 제조, `page.tsx:662,:774,:795` 트랩) | 허브 카탈로그 레이어 연결 |
| director_facts/portrait 생산 | 얇은 645 허브의 편집층(전례 205개 파이프라인) | D6 게이트 구제·허브 실속의 근본 해결 |
| 페이지 없는 감독 540명 | 승격작 ≥2인 124명(≥3인 60명)만 신규 허브 후보 — 오너 결정 사안 | 신규 표면(신중) |

## §7. 검증 체크리스트 (수행자가 채워 보고)

- [ ] tsc net-new 0 (기존 베이스라인 ~20; node는 `~/.local/node/bin`)
- [ ] **film-load8** bump 확인 + 로더/렌더 한 커밋 · (D4 시) **director-load6**
- [ ] 라이브(캐시버스터·R-V): 승격 Tier-2 표본 3편(수상형 `the-english-patient-1996` / 리셉션형 `13th-2016` / 이벤트만형 1편) — C1 문단·C2 문단·C4 히어로 4스틸 렌더, 서브페이지 문장 템플릿과 불일치 확인
- [ ] FilmReceptionSection: reviews=0 & papers>0에서 "0 reviews" 칩 없음·scholarship 카피
- [ ] 얇은 감독 허브 표본 2개: 카탈로그 행 점수 렌더(D1 — "not yet scored" 소멸) · press 다이제스트(D2) · 게이트 미달 허브 noindex(D6)
- [ ] directors 사이트맵 엔트리 수 = 게이트 통과 수(페이지·사이트맵 동일 술어)
- [ ] ReadPlates가 승격 Tier-2 서브페이지에 렌더(C5 인접수정)
- [ ] GSC 고지문 2건(감독 허브 noindex 물결·Tier-2 메인 재크롤) 오너 보고에 포함

## §8. 결정로그·오픈 결정

| 결정 | 상태 |
|---|---|
| 리셉션 다이제스트를 "critics" 아닌 "scholarship"으로 | 확정(실측: 코호트 criticism 0) |
| TMDB bio 미사용 | 확정(기존 결정 보존 — 번복은 오너만) |
| D6 감독 게이트 술어·noindex 규모 | **✅ 실측(2026-07-15): 858 허브 → pass 678·noindex 180**(단일작 508 중 328은 records≥6/편집층으로 구제, 180만 탈락). 예상 ≤506 대비 훨씬 온건 — `(rec+hon)≥6` 항이 실속 있는 단일작 감독을 구제. 술어 변경 불필요, 그대로 배포. |
| 페이지 없는 감독 540명 신규 허브 | **오너 결정 대기**(§6) — 이 지시서에서 만들지 말 것 |
| C3의 quotes cap=2 | 확정(서브페이지 다수 보유 원칙) |
