# PLAN — Intent Coverage / Quick Answers 층 (정본)

> 2026-07-11 작성. 목적: 검색 수요(쿼리)를 **데이터로 답할 수 있는 질문+답 블록**으로 전 콘텐츠 유형에 커버. 키워드 스터핑이 아니라 "질문을 심는 게 아니라 답을 심는다"가 헌장.
> 발단: GSC에서 /film/atlas/idiocracy-2006 노출의 절반이 "idiocracy skyline"류 — 페이지가 답하지 않는 인텐트였음.
> 상태: **설계 + 유형별 진단 진행 중**. 구현 웨이브는 §6.

## 0. 헌장 (불변식 — 모든 웨이브에 적용)

1. **답 없는 질문 금지.** Q는 답 필드가 non-null일 때만 생성. 콘텐츠 없이 검색어 문구만 심는 것(=스터핑/도어웨이)은 어떤 경우에도 금지.
2. **엔티티 불변.** 답변 속 영화명·연도·도시·인명은 소스 행과 문자열 일치해야 통과(figure 질문층의 원칙 승계). 검증은 파이썬/SQL, LLM 아님.
3. **LLM은 표현만, 그것도 꼬리에만.** Wave 1~2는 LLM-0(순수 템플릿). LLM(Haiku 배치) 도입 시에도 사실은 행에서, 문장화만 위임 + 기계검증 게이트.
4. **배치는 리드 아래 "Quick answers" 블록.** H3 질문 + 1~3문장 답, 페이지당 3~6개 상한, 본문에 동일 답 섹션이 있으면 그 질문은 생략(중복 금지).
5. **측정 없이는 확장 없음.** 웨이브마다 mt_gsc_daily로 유형별 CTR/순위 before/after 판독 후 다음 웨이브.
6. **변형어 직조 규칙 (2026-07-11 원우 지시 반영).** 한 Q&A 블록은 검색 변형어 2~3개를 질문과 답에 나눠 자연스럽게 직조한다 — 예: Q에 "skyline", A에 "skyscrapers"와 "dystopian cityscape". 안전선: ① 같은 변형어 반복 최대 2회, ② 반드시 문법적 문장 안에서, ③ 변형어는 답 내용의 진실한 서술이어야 함, ④ 변형어 출처는 GSC 실측(1층) 또는 유형별 동의어 사전(2층, 예: filmed/shot/filming locations). 나열식 삽입(콤마로 키워드 나열)은 곧 스터핑 — 금지.

## 1. 1층 — 미커버 인텐트 탐지기 (GSC 실측 기반)

- 소스: `mt_gsc_daily` (일 배치, GSC 워처가 적재 중).
- v1 로직: 28일 창에서 `(page, query)` 노출 ≥5 를 작업 큐 테이블 `intent_queue(page, query, imps, wpos, status, first_seen)` 에 적재. status = new → answered(블록 배포) / covered(본문이 이미 답함) / rejected(데이터로 답 불가).
- 실행: 기존 30분 인사이트 크론에 편승하되 일 1회 가드(GSC가 일 단위라 충분). 신규 high-signal 진입은 mt_insights에 한 줄 emit(운영자 가시성).
- 커버 판정 v1은 수동(웨이브 작업 시 큐 소진), v2에서 제목·블록 텍스트와 텀 오버랩 자동 매칭.

## 2. 2층 — 유형별 질문 템플릿 (규칙 조립, LLM-0)

원리: 페이지 유형마다 "렌더 시점에 이미 있는 구조화 데이터"로 100% 답할 수 있는 질문 템플릿을 정의하고, 공용 컴포넌트 `<QuickAnswers items={[{q, a, href?}]}/>` 로 렌더.

(유형별 데이터·템플릿·갭·마운트 지점: §5 진단 결과에 — 에이전트 진단 후 채움)

## 3. GSC 초기 수요 신호 (2026-07-01~07 실측)

| 유형 | 쿼리 | 노출 | 평균순위 | 판독 |
|---|---|---|---|---|
| film-atlas | 11 | 37 | **9.1** | 수요·위치 모두 최상 — Wave 1 |
| film 허브/페이지 | 15 | 33 | 13.1 | |
| tropes 허브 | 17 | 30 | 52.6 | 헤드텀, 장기전 |
| director | 9 | 15 | 24.5 | |
| lineage(정전) | 7 | 12 | 29.1 | |
| movies-like | 6 | 11 | **8.8** | 위치 최상 — Wave 2 |
| theorist/concept/credits | 5 | 8 | — | 표본 미달 |

## 4. 콘텐츠 유형 인벤토리 (슬러그 표면 전수)

**영화 종속(2단계)**: film/atlas(403), film/lineage(895), reception(2,972), misreadings(1,932), credits(1,000), [desk] 에세이, figure, q, movies-like, takescore/film(6,701), whereto, tv(1,794), tv/list(5,559)
**엔티티 허브**: director(+서브 8종: start 205·next 199 등), trope, concept, theorist(358), take, credits/person
**컬렉션/정전**: lineage(202), genre, movements(25), tradition, frame(12), catalog(504), atlas 국가(73)/도시(511)

## 5. 유형별 진단 (데이터 → 답 가능 질문 → 갭)

공통 사실: 아래 5종은 전부 `unstable_cache` 경유라 Quick-answers 블록은 **추가 쿼리 0**으로 렌더 가능. JSON-LD는 기존 스크립트 옆에 FAQPage를 얹을 수 있으나 리치스니펫 기대는 낮음(§7).

### 5.1 film/atlas (촬영지) — Wave 1
- 데이터: RPC `film_geo` → 핀별 `name·country·precision·layer(filmed|setting)·built_set·set_host·narrative_setting·scene_role·sources`
- Q템플릿: Where was X filmed / Was X filmed in {country} / How many locations / Was {place} real or a built set ←`built_set` / What scene was shot at {place} ←`scene_role`
- 갭(생성 금지): 촬영 시기·예산·방문 가능 여부·"왜 그곳인가"(scene_role 밖)
- 게이트: 좌표셀 ≥3 아니면 404. 마운트: `.mt-wrap` 내 `<Byline>` 직후(282-285행 부근)
- 동반 수정: `leadText()` 국가→도시 우선(§발단), meta description도 같은 함수라 동시 개선됨

### 5.2 film/lineage (수상·정전) — Wave 2
- 데이터: RPC `film_lineage_for` → `facet·list_label·parent_label·result(won/nominated/listed)·edition_year·rank/rank_max`
- Q템플릿: Did X win {award}(yes/no) / What awards did X win / Was X nominated for {award} / Is X in Sight & Sound·1001 Movies ←canon 멤버십 / X's rank on {list}
- 갭: **인물 단위 노미네이션 불가(행이 영화 단위)** — "which actor was nominated"류 생성 금지. 득표·박스오피스 불가
- 게이트: lineage 행 ≥3 아니면 404(visible 무관 — 수상은 사실). 마운트: `</header>` 직후(268-270행)

### 5.3 film/[slug]/reception (리셉션 연대기) — Wave 3
- 데이터: `film_reception(outlet·critic·headline·verdict·dek_lead·review_year)` + `film_release_events(country·event_type·event_date·note)` + `film_wd_honors`
- Q템플릿: When was X released (in {country}) / When did X premiere / When did X hit streaming·Blu-ray ←event_type=digital|physical / What did critics say ←outlet+headline+dek_lead / How many reviews
- 갭: **RT%·메타크리틱 등 집계점수 없음**(tier는 내부용) — 점수형 질문 생성 금지. 리뷰 전문 불가(저작권)
- 게이트: 리셉션+명예 합산 3 미만이면 noindex. 마운트: `.essay-body` 인트로 문단 직후(338-345행)

### 5.4 film/[slug]/misreadings — Wave 4 (주의 유형)
- 데이터: `takes(framework·take_title·rationale·leap·strength)` + figures
- Q템플릿: X interpretations / How many readings / What is the {framework} reading of X / How is {character} read in X
- 갭·경고: **"ending explained"·플롯·감독 의도류 사실형 질문 금지** — 이 데이터는 의도적 과잉해석(강한 오독)이라 해석-논증 프레이밍만 허용. 질문 문구 자체를 "readings/interpretations"로 한정
- 게이트: 리딩 ≥5만 색인. 마운트: TOC 문단 직후(239-241행)

### 5.5a movies-like — Wave 2
- 데이터: `film_affinities`(score·cos·shared tropes) + 관련작 films + `takescore_for_slugs`
- Q템플릿: movies like X(랭킹 그대로) / what does {related} have in common with X ←공유 트로프 / best movie similar to X ←recs[0]+cos% / movies like X worth watching ←ts 필터
- 갭: 장르·스트리밍 결합 불가("movies like X on Netflix" 금지 — provider 조인 없음)
- 게이트: visible & recs≥3만 색인. 마운트: `<LensQuickBar>`~`<ol.ml-list>` 사이(173-178행)

### 5.5b takescore/film · whereto — 이미 패턴 보유 (보강만)
- takescore: `cinecodex_card` 단일 RPC에 ts·rank·ext(imdb/rt/meta)·prose 헬퍼(`lib/takescore_prose.ts`) 완비 — "is X worth watching / X rating / X IMDb score" 전부 답 가능. 마운트: tsf-verdict 직후(~252행)
- whereto: `buildReport()`의 "The short version"이 **사실상 Quick answers 원형** — where to watch / free / MUBI / Criterion / leaving {service} + runtime·ratings(로드돼 있으나 미사용) 추가 여지
- 갭: 가격 불가·자막 불가

### 5.5c film/[slug]/[desk] · figure · tv — Wave 4
- desk: 구조화 답은 dek·spoiler_level·minutes·otherDesks뿐(본문은 프로즈) — Quick facts 스트립 수준
- figure: **이미 FAQ JSON-LD + leadQuestion 가동**(질문층 선행 사례). 보강: tropes·neighbors·connections 필드로 Q 추가
- tv/[slug]·tv/list: segments(챕터)·duration·built_at / n_films·dek — VideoObject 옆 보조 Q

### 5.5 film/[slug]/credits — Wave 3
- 데이터: TMDB live(`credits`) + 감독 협업사: `crew[craft].people` (writer/dp/editor/composer/pd) · `topCast(name·character)` 상위 5 · `relations(shared.length·idx)` · `companies`
- Q템플릿: Who directed/wrote/shot/scored X / Who stars in X / **Who plays {character} in X** ←topCast.character / How many films has {director} made with {person} ←relations / What company produced X
- 갭: 상위 5 밖 전체 캐스트 불가·예산·개런티 불가
- 게이트: tmdb_id 필수, 핵심 크래프트 ≥2만 색인. 마운트: `<Byline>` 직후(150-153행)

### 5.6 엔티티 허브 (director+서브 9종 · trope · concept · theorist · take · credits/person) — Wave 4
- **공통 발견: "spelled out" 결정론 섹션이 trope·concept·theorist·credits·catalog에 이미 존재** — Quick answers는 그 스코프 변수를 재사용(추가 페치 0). FAQPage JSON-LD는 현재 /trope에만 있음 → **concept·theorist·credits가 최대 공백 표면**.
- director 허브: 필모(ItemList 기존)·born·where-to-start picks·next 추천·sigTropes — 스탯 스트립 직후 마운트(~456-463행). 서브페이지 게이트: start=picks≥3·next≥3·life=facts≥4 색인.
- trope: thesis/laconic·maturity(cliché 여부!)·filmCount·최초/최다 영화(full 게이트 시) — "is {trope} a cliché" ←maturity는 독특한 답변 가능 질문.
- concept: 3분기(sm/theory/takes) 각각 마운트 지점 상이(§에이전트 진단), "what is {concept}"←intro/one_liner.
- theorist: readings≥3만 색인, "which films are read through X"·개념 선반.
- credits/person: 크래프트 필모·troupe(협업 빈도·연도 스팬)·"is {person} also a director" — ≥3 정독 영화만 색인.
- take: 사실상 리다이렉트 표면(published reading ~0) — **웨이브 제외**.

### 5.7 컬렉션·정전 (lineage · genre · movements · tradition · frame · catalog · atlas 국가/도시) — Wave 2(lineage)·Wave 5(나머지)
- **lineage/[slug] (정전, Wave 2)**: `lineage_list_films`로 "which film won {award} in {year}"·"complete list of winners"·"#N on {list}" 완전 답변. ⚠️함정 2: 행에 인물 없음("who won" 감독/배우 단위 금지) · **edition_year(수상연도)≠film_year(개봉연도)** 혼동 금지. 색인 게이트 ≥3.
- genre: 연대기 데이터만 — **"best {genre}" 금지, "most recent/of the {decade}"로 재프레임**. 색인 게이트 없음 주의(1편이어도 색인).
- movements: demand 정렬로 "most famous {movement} films" 가능, 시대·역사 서술 불가. noindex<8. 마운트는 서버측(클라이언트 컴포넌트 밖).
- tradition: **정의 필드 없음** — "what is {school}" 답 불가(갭), 개념·이론가 목록형 Q만.
- frame: rank+rationale 있어 "best film for {frame}" 가능(진짜 랭킹). 스포일러 게이트: aha는 spoiler none만.
- catalog: confidence=분류 확실성이지 품질 아님 — "best" 금지, "which films feature/earliest/decade" 가능. FAQPage 이미 있음.
- atlas 국가/도시: "movies filmed in {country/city}"·landmarks·returning directors — 품질 신호 없어 "best" 금지.

### 5.8 전 유형 공통 규칙 (진단에서 도출)
- **"best" 질문은 실제 랭킹 필드가 있을 때만**: rank(lineage·frame)·demand(movements)·ts(takescore·movies-like). 없으면 most/earliest/chronological로 재프레임.
- noindex 페이지(pageRobots 미달)에는 Q&A 리치마크업 미배치(본문 블록은 무해하나 우선순위 낮음).
- 공용 컴포넌트 `<QuickAnswers items={[{q,a,href?}]}/>` 1개 + 유형별 변형어 사전(§0-6) — 전 페이지 추가 페치 0(모든 필드가 이미 렌더 스코프에 존재함을 4갈래 진단으로 확인).

## 6. 구현 웨이브 (순차, 각 웨이브 = 에이전트 작업지시 1건)

- **Wave 0 — 공통 기반**: `<QuickAnswers>` 컴포넌트 + 유형별 변형어 사전 + `intent_queue` 테이블·탐지기 v1(§1) + FAQPage JSON-LD 헬퍼(선택).
- **Wave 1 — film-atlas (403p)**: QuickAnswers 블록 + leadText 도시 우선 수정(국가→도시 — meta description 동시 개선). 수요 검증 완료 상태에서 출발. 마운트·필드 §5.1.
- **Wave 2 — movies-like + film-lineage + lineage 정전**: "movies like X"(위치 8.8) / "did X win {award}" / "which film won {award} in {year}" — 수상 데이터 3면 동시 커버. ⚠️§5.7 함정 2종 준수.
- **Wave 3 — reception(2,972) + credits(1,000) + whereto 보강**(runtime·ratings 미사용 필드 활용).
- **Wave 4 — 엔티티 허브**: director 허브+서브, trope("is it a cliché"), concept·theorist·credits(FAQ 공백 3종), figure 보강. take 제외.
- **Wave 5 — 컬렉션**: genre(재프레임)·movements·frame·catalog·atlas 국가/도시 + tradition(정의 필드 수혈 선행 필요) + 1층 탐지기 v2(자동 커버 판정).
- 각 웨이브 완료 기준: 배포 + 라이브 검증(실제 HTML에서 블록·변형어 확인) + GSC 1~2주 판독 메모를 본 문서 §8에 追記.

## 8. 판독 로그 (웨이브별 before/after)

- (첫 판독은 Wave 1 배포 +2주)

## 7. 리스크 노트

- 사이트 전체가 신규 도메인 신뢰 축적기 — 블록 추가는 **기존 페이지 개선**이라 안전(신규 URL 대량 투하 아님, 코호트 동결과 충돌 없음).
- FAQPage 리치스니펫은 2023년부터 일반 사이트에 거의 미노출 — 스키마는 선택사항, 효과의 본체는 본문 질문 H3+답.
- 스카이라인류(제작 비하인드)는 데이터에 없으면 **생성 금지** — 큐레이션 사실(출처 포함) 수혈 후에만.
