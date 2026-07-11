# HANDOFF — Surprise 확장 · v2 "The Metatake Channel" · 릴 · 유튜브 스트리밍 검토

**세션 2026-07-09 정본.** "Surprise me" 계열(홈 히어로 + `/random`) 확장 → 방송형 무인 안내문 v2(`/random/v2`) → 30초 릴 시제품(`/random/reel`) → 유튜브 스트리밍 기술·저작권 검토까지. **Surprise/‌`/random`/v2/릴/유튜브 영상 관련 세션은 여기서 시작.** 관련 auto-memory: `surprise-me-expansion`.

`surprise_home` 자체의 상위 맥락은 `docs/FRONTEND-DISCOVERY-AND-DECISIONS.md`(홈 discovery 층 소유).

---

## 0. 한눈에 — 라이브 상태

| 표면 | 상태 | 정체 |
|---|---|---|
| 홈 히어로 + `/random` (v1) | 🟢 LIVE | 공유 컴포넌트 `SurpriseStage`. surprise_home **20모드**. 미디어 16:9 고정 레이아웃. |
| `/random` | 🟢 LIVE | 홈과 동일 히어로(SurpriseStage) + 하단 "wander by type" 월(토글·믹스·30장). |
| `/random/v2` "The Metatake Channel" | 🟡 프로토타입 LIVE | 영상 풀스크린 방송 오버레이 + **에디토리얼 6 랜덤 컴포지션**. 원우 검토중(배경 bed 결정 대기). |
| `/random/reel` | 🟡 프로토타입 LIVE | 30초 릴(스틸 5편 + AI 낭독 + 자체 앰비언트). 유튜브 화면녹화 소스용. |
| 유튜브 스트리밍 | ⛔ 보류 | 기술 검토 완료 / 저작권이 벽 / 원우 방향 결정 대기. |

마이그레이션: **0050** (surprise_home 확장), **0051** (reel_cards RPC) — 둘 다 관리 API로 프로덕션 적용됨. 워처가 `supabase/migrations`는 스테이징 안 하므로 파일 커밋은 수동.

---

## A. surprise_home 20모드 확장 (마이그레이션 0050)

랜덤 분석영화 1편 → 큐레이션된 "놀라운 각도" 하나라는 **의도 유지**하며 14→20모드. 신규 6개(전부 영화중심 렌즈, 데이터 부재 시 misreading 폴백):

- **reception** — film_reception.dek_lead 비평 인용
- **honors** — film_lineage_for; 게이트 cnt≥3이면 `/film/lineage/slug` 아니면 `/film/slug`
- **question** — published questions; title_spoiler면 safe_hook/display_title
- **locations** — film_locations; `/film/slug#df-atlas`
- **theorist** — takes.theorist_id→theorists; `/theorist/slug` (영화를 그 이론가로 읽기)
- **misreadings_teaser** — published takes 개수 + 제목; `/film/slug/misreadings`

가중치: misreading×4 + 원조8 + 신규6 = 19슬롯(+희귀 chip 18%). misreading이 폴백 포함 최다(~30%).

**⚠️ 함정 (중요·재발 방지): jsonb 빈-게이트.** `jsonb_build_object('items', <빈 jsonb_agg=SQL NULL>)`은 `{"items": null}`(JSON null)을 만들어 `r->'items' is null`이 **FALSE** → 폴백 안 걸리고 빈 카드. **올바른 게이트: `r->'items' is null or jsonb_typeof(r->'items')='null'`**. 기존 item/chip 모드 전부 이 잠복버그였어서 같이 수정함. (theorist/question은 select-into가 SQL NULL이라 `r is null`로 OK; honors/misreadings_teaser는 `cnt` 변수 체크로 OK.)

부수: reception/locations 라벨의 빈-문자열 critic/scene_role은 `nullif(btrim(...),'')`로 걸러 attribution 꼬리 구분자(" · ") 제거.

---

## B. 레이아웃 수정 + SurpriseStage 공유 + /random 통합

**레이아웃 수정** (원우: "좌측 패널 길어지면 화면부분도 퍽하고 길어진다"): `app/home2.css`
- `.hs-vh{align-items:start}` (구 stretch)
- `.hs-main{aspect-ratio:16/9; flex:0 0 auto; min-height:0}` (구 flex:1 0 auto; min-height:360) → **미디어 고정 16:9**
- `.hs-textwrap{max-height:82vh; overflow:auto}` → 패널만 아래로 성장/스크롤
- `.hs-left{position:sticky; top:14px}`

**공유 컴포넌트** `components/home2/SurpriseStage.tsx` — 인터랙티브 스테이지 + 20모드 렌더러 추출. `HeroSurprise`(홈)는 `.hero>.wrap>SurpriseStage auto + topicchips`로 슬림화(auto=14s 자동넘김). `SurpriseCard` 타입 export.

**`/random`** (`app/random/page.tsx`) — 루트 `.sm-page` 유지 + 상단 `.mthome>.hero>.wrap>SurpriseStage`(홈과 픽셀동일) + 하단 "Or wander by type" 월(구 surprise/surprise_set 토글·믹스·30장, 마이그레이션 0049). CSS: `.sm-page .sm-rand-hero{background:#0e0c0a}`(mthome cream 방지).

신규 렌즈 렌더 CSS(home2.css): `hs-quote*`, `hs-honor*`, `hs-body__k`, `hs-li__t--mut/--fw`.

---

## C2. TV 프로덕션 엔진 — 영화별 방송 자동생산 (2026-07-10, 마이그 0056·0057·0058; 전 코퍼스 빌드 완료)

**목적:** 영화별 방송(프로그램)을 LLM-0으로 자동 컴파일 → 시청목록으로 묶어 연속재생(유튜브식) → 장차 film 페이지 상단 트레일러 대체. **설계 축: 세그먼트가 topic 태그를 달고 beats까지 사전 컴파일 저장 → "액션영화 로케이션" 같은 미래 컷 = WHERE절**(재생성 불필요).

- **DB(0056):** `tv_programs`(영화당 1, slug=film slug, meta.clips) / **`tv_segments`**(원자단위: film×topic×seq, title=궁금증 헤드라인, accent, **beats jsonb**=플레이어 그대로 소비, duration_ms; 인덱스 (film_id,topic)·(topic)) / `tv_playlists`(kind='films'|'segments', rule jsonb) / `tv_playlist_items`(program_id 또는 segment_id).
- **컴파일러 `tv_compile_film(uuid)`:** 챕터 순서 open→misreading×3(테이크당 1모듈)→figures→ideas→reception→honors→canon→locations(atlas)→map→kindred→close. 헤드라인=ScreenRant식 템플릿×사실, `tv_pick`(hashtext 결정적)이라 재빌드에도 카피 불변. `tv_chunks`(문장분할)·`tv_hold`(읽기시간). **배경 클립=trailer/teaser만**(explain|featurette|interview|review|making 등 제외 — "영화 설명 영상 금지"). ⚠️ 템플릿 함정(이중관사): The-시작 제목("The Monkey")은 `'The %s …'` 꼴 템플릿과 충돌해 "The The …"를 만든다 — prog `'The %s Dossier'`→`'%s: The Dossier'`, close `'The %s File Stays Open'`→`'%s — The File Stays Open'`, kindred `'The %s Family Tree'`→`'The Family Tree of %s'`로 모두 교체됨(2026-07-10 코퍼스 QA에서 214세그 적발·수정). 새 템플릿 추가 시 선두 `The %s` 금지.
- **피드 `tv_watch(p_list,p_program)`:** (null,null)=선반(플레이리스트+전 프로그램 라이트) / (list)=풀 엔트리(segments-kind는 세그먼트를 1세그 미니프로그램으로 합성 → 플레이어 동일 처리) / (program)=단일.
- **시드(0057):** 10편 컴파일(128세그) — 팔므도르 6(Wages of Fear·Conversation·Apocalypse Now·Pulp Fiction·Shoplifters·Anatomy of a Fall)+Amélie(slug **am-lie-2001**)·Cold War·Great Beauty·All About My Mother. 플레이리스트 3: `palme-files`(films 6)·`thriller-files`(films 4, genres 배열 컷)·**`on-location`(segments 10 — 주제 슬라이스 증명)**.
- **프론트:** `/api/tv/watch` → **`components/TVProgramPlayer.tsx`**(컴파일된 beats 재생; **랜덤 플레이**: 모듈 전부 저장·재생 시 open+셔플 중간(≤170s 예산)+close 샘플링 — 원우 지시 "테이크 많아 길면 랜덤"; 챕터 점프=window 'tvw-jump' 이벤트; 플레이리스트 자동 다음) + **`/tv/watch`**(유튜브형: 플레이어+챕터칩+Up next 레일+Watch lists/All programs 선반; `?list=`·`?v=`).
- **주의:** sv2 존-렌더 JSX가 MetatakeTV와 TVProgramPlayer에 중복(3벌째) — 존 구조 바꿀 땐 두 파일 동기. 새 영화 추가 = `select tv_compile_film(id)` 1콜. **✅ 완료(2026-07-10, 마이그 0058 v2, Opus 실행):** 전 코퍼스 배치 컴파일 — 1,794편 방송 / 141 스킵(트레일러 없음 139·테이크<3 2) / 27,583 세그먼트, 플레이리스트 20개(장르 18·on-location·palme-files). 실행·QA 전체 기록은 `docs/WORKORDER-tv-corpus-build.md`(상태 완료).

### C2-b. 읽는층 편입 — film 히어로 교체 + 방송 SEO 페이지 (2026-07-10, 마이그 0059)
- **film 페이지 상단 영상 교체(완료):** 방송이 컴파일된 영화는 히어로가 트레일러 릴 대신 방송을 재생. `components/FilmTVHero.tsx`(클라이언트, `/api/tv/watch?v=slug` 페치 → `TVProgramPlayer` 마운트; 로딩 중엔 백드롭+ON AIR 리본으로 유튜브 이중로드 방지; 프로그램 없으면 릴로 폴백). 서버는 `app/film/[slug]/page.tsx`의 `filmHasProgram(slug)`(캐시키 `film-tv-present-v2`, 인덱스 exists 프로브)로 게이트 → 히어로 스왑 + **"▶ TV Broadcast" 탭**(두번째 rail=spoiler zone, href `/tv/{slug}`, accent #C8102E). CSS `.df-tvhero`(16:9, `.tv-embed`가 채움).
- **방송 "업로드" 페이지(완료):** **`app/tv/[slug]/page.tsx`** = 영화별 방송의 정규 색인 페이지(ISR 300, per-slug lazy). 본문 `components/TVSingle.tsx`(단일 엔트리 재생+챕터+More 레일=다른 방송으로 내부링크). **영상 SEO 신호**: VideoObject JSON-LD(name·description·thumbnailUrl·**uploadDate**=built_at·duration=Σseg·embedUrl·contentUrl=유튜브 트레일러·publisher·about=Movie) + **Clip hasPart**(챕터별 key moments, seq 순 offset) + BreadcrumbList + og:type=video.other·og:video(유튜브 embed)·og:image(w1280 백드롭)·canonical. built_at은 raw pg 타임스탬프가 `new Date()`로 파싱됨(단 `safeIso` 가드로 절대 throw 금지).
- **⚠️ RLS 함정(0059):** `tv_*` 테이블은 RLS **활성 + 정책 0개**로 생성돼 anon SELECT가 0행 반환 → 위 두 직접 select(탭 게이트·built_at)가 조용히 실패(탭·히어로 안 뜸, uploadDate 누락). `tv_watch` RPC는 security definer라 무사. 0059가 published 프로그램/공개 세그·플레이리스트에 SELECT 정책 부여(쓰기 정책 없음=deny-by-default 유지). **tv_* 신규 직접 read 추가 시 정책 필수.**
- **검증:** `/tv/pulp-fiction-1994` VideoObject+Clip+og:video 라이브, `/film/pulp-fiction-1994` TV Broadcast 탭+16:9 방송 히어로 라이브(백그라운드 트레일러는 `document.hidden` 자동재생 게이팅 때문에 자동화 탭에서만 검게 보임 — 실사용 정상).
- **플로팅 미니 TV(2026-07-10 복원):** `components/FloatingTrailerDock.tsx` — 방송 히어로가 뷰포트를 벗어나면 **예전 플레인 트레일러 릴**(오버레이 없음)이 좌하단에 도킹(드래그·음소거·닫기, `.iv-frame--float` 가구 재사용). iframe은 플로팅 시에만 마운트(방송과 유튜브 이중로드 방지), 루프는 `playlist=` 체인(YT API 불사용, 음소거 토글만 postMessage). FilmTVHero가 fragment로 히어로 밖에 마운트(`.df-tvhero`의 overflow:hidden 클리핑 회피). 방송 없는 영화는 FilmHeroReel 자체 플로팅 그대로.

### C2-c. 전략 플레이리스트 체계 — ✅ 구현 완료 (2026-07-11, 마이그 0060)
정본 지시서 **`docs/WORKORDER-tv-strategic-playlists.md`**(상태=완료). 새 카테고리 없이 **기존 축 미러링**, LLM-0.
- **빌드 결과: 5,559 플레이리스트 / 53,506 아이템** — 트로프 2,859(`conn_film_trope_vec`→`meta_takes` figure_type)·아키타입 1,535(`figure_taxonomy`→`taxonomy_nodes` 6축, seg 매핑=lib/catalog KINDS)·컨셉 588(`takes.concept` 슬러그화, **concept_readings 정규식과 동일** 필수)·감독 192·이론가 150·리니지 89(무브먼트 67 포함)·genre_topic 71(segments-cut)·국가 45·장르 18·연대 11·manual(palme) 1.
- **DB(0060):** tv_playlists에 axis/key/cut/intro/href/n_* 추가. 제너레이터 `tv_build_{lineage,director,genre,country,decade,theorist}_playlists()`(소형, 1콜) + `tv_build_{trope,concept,archetype}_playlists(min,batch,offset)`(대형, 배치 러너로 offset 루프). upsert 헬퍼 `tv_upsert_film_playlist`/`tv_upsert_seg_playlist`가 items·counts·intro까지 조립. `tv_directory(axis,q,limit,offset)`+`tv_directory_summary()`(브라우즈 UI용, 페이징 필수).
- **tv_watch v3:** 리스트 브랜치 맨 앞에 **인트로 브리핑 pseudo-엔트리**(topic='intro', beats=pl.intro) 삽입 + 셸프 36 캡 + n_playlists.
- **프론트:** `/tv/list/[slug]`(독립 색인 페이지, CollectionPage+ItemList JSON-LD, `TVListView`) + `PlaylistTVEmbed`(director/lineage/movements/genre/trope/concept 페이지 임베드, 빈 슬러그 자동 숨김) + 사이트맵 tv-programs/tv-lists 자식.
- **⚠️ anon 3초 타임아웃 함정(중요):** anon 역할 statement_timeout=3s인데 콜드 리스트/셸프 빌드는 ~4s(콜드), 최초 DDL 직후 15s. → `/tv/list` 404, 임베드·셸프 error. **해결: tv_watch에 함수레벨 `set statement_timeout to '12s'`**(ISR+s-maxage 300 캐시라 첫 히트만 부담) + 라우트 maxDuration=30. 신규 tv_* 무거운 anon RPC 추가 시 동일 패턴 필수.
- **✅ 완료(2026-07-11):** 브라우즈 UI **`/tv/lists`**(축 필터 탭+검색+페이지네이션, `TVDirectory`+`/api/tv/directory`; /tv/watch 셸프·단일·리스트뷰 링크 — ⚠️`.tvpg` 다크셸이라 필터칩은 라이트잉크), **tradition 히어로**(0062 `tv_films_for_concepts`). 전 엔티티 상단 영상 히어로 통일(0061 §C2-c와 세트).
- **다음(미착수, 데이터 선행):** crew 축 플레이리스트(DB에 person→film 매핑 부재 — film_credits 테이블 선행 필요; credits는 릴로 동작), 이론가·트로프 segments-cut(컴파일러 v3 meta 스탬프 후).

**(구 기획 노트)** 실측 리니지 89·감독 192·장르 18·국가 45·연대 11·이론가 276 + 강화 3축(≥3) 트로프 2,859·아키타입 1,535·컨셉 588 ≈ ~5,500. 각 방송 = ① 세부 페이지 임베드(PlaylistTVEmbed) + ② 독립 slug `/tv/list/[slug]`(CollectionPage+ItemList) + ③ **인트로 브리핑**(제목·클리핑 기준·영화 수·챕터 수 — tv_playlists.intro beats를 tv_watch가 pseudo-엔트리로 선두 삽입). 스키마=0060(axis/key/cut/intro/href 컬럼 추가), 생성기 `tv_build_*_playlists()` 8종+`tv_directory()`. ⚠️ 이론가·트로프 segments-cut은 엔티티 불일치로 P1 금지(컴파일러 v3 meta 스탬프 후). 브라우즈 UI는 tv_directory() 소비로 후속.

## C. METATAKE TV — 채널 (2026-07-10; `/random`=임베드 페이지, `/random/v2`=풀스크린 키오스크)

**8차: /tv 슬러그 이전 + 임베드 축소·가독성 수정(2026-07-10).** 슬러그 `/random`→**`/tv`**, `/random/v2`→**`/tv/full`**(구 URL은 `redirect()` 서버 리다이렉트로 살림, `app/random/page.tsx`·`app/random/v2/page.tsx`=redirect만). 내비(`components/home2/Nav.tsx` wander)·⌘K(`GlobalCmdK.tsx`) 라벨 "Surprise me"→"METATAKE TV". `app/tv/{page,full/page,layout}.tsx` 신설(layout=메타데이터). **⚠️ 도시에 검정-검정 버그**: `.mt p{color:var(--ink)}`(특정성 0,1,1)가 `.tvd-p`(0,1,0)를 이겨 어두운 텍스트→불가시. `.tvpg .tvd-*`(0,2,0)로 전 텍스트·링크 특정성 올려 해결. 임베드는 뷰포트가 아닌 박스(~78vh)라 `.tv-embed .sv2-*`로 폰트·마스트·자막·칩·맵 전면 다운스케일 + 아틀라스/커넥션 맵 대폭 축소(FilmMap h300→210, box 460/400px)·하단(bottom 6/5%)·상단툴바 제거(`.sv2-atlas .fmap-head,.fmap-tools{display:none}`, 지도+좌측 리스트만). 홈 히어로(v1)는 여전히 미변경. **함정 교훈: 전역 CSS라 `.mt` 요소셀렉터가 라이트테마 색을 강제 → 다크 오버레이 안 텍스트는 반드시 클래스 특정성 2단(`.부모 .자식`) 이상으로.**

**7차: "Surprise me" → "METATAKE TV" 페이지 승격(2026-07-10).** `/random`이 큰 임베드 TV(상단 78vh) + 하단 **라이브 도시에**(page-within-page)로 개편. TV를 **풀스크린/임베드 겸용 공유 컴포넌트 `components/MetatakeTV.tsx`**로 추출(`embed` prop, `onCard` 콜백). `/random/v2/page.tsx`=`<MetatakeTV/>`(풀스크린), `/random/page.tsx`=헤더(METATAKE TV·ON AIR 브랜딩)+`<MetatakeTV embed onCard={setCard}/>`+`TVDossier(card)`. 임베드 모드: 바디 스크롤잠금 해제·Space 키핸들러 비활성(페이지 스크롤 방해 방지)·컨트롤 상시표시(`.tv-embed .svc-ctrls{opacity:1}`). 루트 클래스 `svchan`(풀스크린) vs `tv-embed`(relative). 도시에=현재 방송 카드를 정적으로 펼침(포스터·제목·감독·딥링크 The film/lens/director + 렌즈 전체 본문/칩/리스트), TV 넘어가면 갱신. CSS `.tv-embed`·`.tvpg`·`.tv-stage`·`.tvd-*`. 홈 히어로(v1 SurpriseStage)는 미변경(원우 확인 대기: 홈도 TV로 바꿀지).

### 이하 초기 재설계(§C 원문):

**METATAKE TV 스크린 에세이 채널.**

풀스크린(`position:fixed`) 방송 오버레이 위에 **MUBI 스크린 에세이 페이싱의 비트(beat) 엔진**. 영화가 프레임을 채우고, 렌즈는 "한 번에 한 생각"의 비트 시퀀스로 흐름. Space 정지·←→ 넘김·컨트롤 3.2s 자동숨김. **v1 미변경.**

**진화 로그(원우 지시 흐름):**
1. 첫 v2 = 영상(YouTube 임베드) 배경 오버레이. 원우 선호.
2. 검은 화면 + 유튜브 재송출 논의 → 이미지 켄번즈로 잠시 교체.
3. "사이트 전용" 결정 → 영상 복귀 + NYT풍 6컴포지션(`svc-ed-*`, 폐기됨).
4. **2026-07-10 원우 재지시** → METATAKE TV로 전면 재설계(현행): 좌상 마스트 고정·우상 TV로고·상하단 중앙 존 활용·대형 텍스트패널 분할·맵 삽입·색·모션·패턴.

**현행 구조 (`app/random/v2/page.tsx` + globals.css `.sv2-*`):**
- **고정 가구(전 패턴 공통):** ① 좌상 **마스트플레이트** — 영화제목(블록 내 최대, **Barlow Condensed** = curious.css와 같은 ScreenRant계 폰트) + 연도(액센트색)·감독, 찐한 그리드 배경 배너, 좌측 액센트 엣지, 클릭=영화 페이지. ② 우상 **METATAKE TV 로고**(+● ON AIR 블링크). ③ 상단 **세그먼트 비트 레일**(스토리식, 비트당 1칸, 액센트색 채움).
- **비트 엔진:** `compileBeats(card)`가 20모드 각각의 **텍스트 포맷을 미리 알고** 비트 3~8개로 컴파일. 긴 본문은 `chunks()`로 문장 단위(≤150자) 분할 — 대형 텍스트 패널 제거. hold는 글자수 비례(3.6~9.5s). 카드 길이 = 비트 합(대략 20~40s). 첫 top 비트는 **잔류 스테이트먼트**(이후 비트 진행 시 `is-min`으로 축소·상단 잔류).
- **존:** top(상단 중앙 타이틀존) / sub(하단 중앙 자막존) / quote(중앙 대형 인용) / stack(수상·로케이션 하나씩 누적) / chips(스태거 팝인) / **map(EntityMap 실삽입, 15s 홀드 — film_map·director_map·figure_links)**.
- **모드별 액센트 12색**(`ACCENT` 맵): 오독=#E3120B 레드, 이론가=바이올렛, 비평=로즈, 수상=골드, 로케이션=틸, 큐리어스=시안, 추천류=오렌지, why/start=그린, 맵=블루, 칩=샌드. `--acc` CSS 변수로 키커·밴드·세그먼트·마스트 엣지 구동. 키커 잉크는 다크(#140f0b), 레드 계열만 흰색.
- **패턴 4종 랜덤**(`sv2-p-*`): `air`(클린 페이드업) / `band`(액센트 엣지 다크밴드 와이프인 — 방송 하단자막) / `ink`(어두운 프레임+세리프 자막, 스테이트먼트 중앙 — 에세이룩) / `wire`(좌측 레일+→마커+헤어라인).
- 일시정지 = 비트 클록+세그먼트 애니+영상(postMessage) 동시 정지; 재개 시 현재 비트 재시작(nonce).

**⚠️ 함정 (재발 방지): `position:fixed; inset:0`가 이 빌드 CSS 파이프라인에서 top/bottom만 드롭됨**(left/right는 적용 → 높이 10px로 붕괴). **longhand 필수: `top:0;left:0;width:100vw;height:100vh`**. + 루트 layout이 전역 Footer 렌더 → 풀스크린은 `document.body.style.overflow='hidden'` 잠금.

**주의:** `.svc-*` 베이스(bed/media/scrim/ctrls)는 **릴(/random/reel)과 공유** — 수정 시 릴 확인. 구 `.svc-ed-*`/`.svc-comp-*`(NYT 6컴포지션)는 폐기·삭제됨. Barlow Condensed+Barlow는 globals.css 상단 @import.

**2차 다듬기(2026-07-10, 원우 피드백 반영):** ① 마스트에 **포스터**(surprise_home base에 `poster` 추가 — **마이그 0052** 적용) + 마스트 타이포는 **Barlow 정상 장평**(Condensed 아님)·감독명 승급. ② 스테이트먼트 **최대 2줄**(line-clamp)·**top 7%**·폭 90vw(글자 더 들어가게). ③ 하단 자막존 = **속보 띠**(sv2-band: 액센트 보더 다크밴드, 와이프 인→홀드→슬립 아웃; band 패턴은 풀블리드, ink는 세리프, wire는 좌측 도킹). ④ 맵/커넥션 = **우하단 작은 박스**(460px, EntityMap h300). ⑤ **이미지 배경 금지** — bed는 클립 전용, draw()가 클립 있는 카드만(최대 4회 재추첨). ⑥ **액센트 프레임**(.sv2-frame) — 화면 가장자리 모드색 테두리가 매 비트 펄스. ⑦ 모든 비트에 **퇴장 애니메이션**(`--exit`=hold-520ms; sub 슬립다운·quote 페이드업·chips 페이드).
- 검증 아티팩트: **백그라운드 Chrome MCP 탭은 CSS 애니메이션·setTimeout 스로틀** → 스크린샷 어둡게·비트클록 느림·맵 비트(index 1) 도달 전 카드 자동넘어감. 검증은 스크린샷 대신 **DOM/rect + ego API 노드수**로. 실브라우저 정상.

**6차 정리(2026-07-10 5차 피드백):** ① 아틀라스 **우하단**으로 이동(좌→우), 박스 820→**600px**·좌측 장소패널 340→**220px**(`.sv2-atlas .fmap-body`). ② **figures를 칩 클라우드**로(누적 스택→idea처럼 한꺼번에, SQL 상한 6→14 마이그 0055). ③ **존 매핑 정리 3계열**: 칩(한꺼번에=tropes·ideas·figures) / 스택(하나씩 누적=honors·lineage·kindred·watch_next·recommended_by·where_to_start·director_next·why_watch·misreadings_teaser) / 프로즈(misreading·theorist·question·invitation·generic) + 인용(reception) + 지도(커넥션 우하단 EntityMap·아틀라스 우하단 FilmMap). **⚠️ `.svc` 전역충돌 교훈**: 초기 v2 루트가 `.svc`라 SaveChip의 기존 전역 `.svc`와 충돌→필름페이지 검은 오버레이 먹통 → `.svchan`으로 개명. 새 전역 풀스크린 클래스는 반드시 전역 grep 후 명명.

**5차 다듬기(2026-07-10 4차 피드백):** ① **아틀라스 좌측 장소 패널 복원** — FilmMap `panelSide="left"`, 박스 폭 520→820px. ② **아틀라스 줌인** — FilmMap에 신설 `fitMaxZoom` prop(기본 9, 기존 페이지 불변) → v2는 13. ③ 자막존 bottom 12→8%(더 하단). ④ 새 모드 3종(**마이그 0054, 총 24모드**): **figures**(영화별 인물·이미지 로스터+설명, 'the film as a whole' 제외) · **invitation**(is_invitation 테이크의 rationale=감독/맥락 소개, take_title 없음 주의) · **lineage**(film_lineage_for의 rank 강조="In the canon", honors=수상과 별개 축). 액센트: figures #C8A2E0·invitation #5FC9A8·lineage #E0A93E. ⑤ **루트 컨테이너 `.svc`→`.svchan` 리네임**(외부 변경, 자식 `.svc-*`·`.sv2-*` 유지, 릴과 공유 컨테이너 명확화). **보류: credit 사진그리드**(crew_index.json 파일, SQL불가) · **film↔film 전용 맵**(film_map이 근접영화 포함, 전용은 EntityMap API 포맷 작업 필요).

**4차 다듬기(2026-07-10 3차 피드백):** ① **아틀라스 지오맵 좌하단** — locations 모드를 `FilmMap`(MapLibre, `/api/geo?film=slug`) 좌하단 박스(`.sv2-atlas`)로; 커넥션 EntityMap은 우하단(`.sv2-map`). ② **엔티티별 상단 표제색** — `--ent`(영화=흰·감독=#BBD9F5·피겨=#F3D08A·이론가=#CFC6FF), 모드 액센트 `--acc`(가구색)와 별개 축. ③ 칩 클라우드 bottom 13→9%(하단 앵커). ④ 스택 **각 행 중앙정렬**(inline-flex+align-items:center)로 좌측편중 해결. ⑤ 새 모드 **kindred**(film_affinities 46k 근접이웃, **마이그 0053**) → surprise_home 21모드. **미착수 후보(원우 판단): essay**(essays 3,267 verified이나 생성동결 라이브 불확실), **daily**(뉴스 헤드라인), **counterpoint**(전용 테이블 확인 필요), director bio(208 얇음).

**3차 다듬기(2026-07-10 2차 피드백):** ① 페이싱 완화(hold 최소 5.2s, 글자당 42) ② 거친 clip-path 와이프·슬립 제거 → 부드러운 페이드+살짝 상승(빼꼼)/조용한 페이드아웃 ③ **리스트 모드 전부 stack 누적**(watch_next·recommended_by·where_to_start·director_next·why_watch·misreadings_teaser + 기존 honors·locations) — 사라지지 않고 쌓임 ④ **자막존 전 패턴 중앙정렬**(wire 좌측밀기 제거 → 좌측 클리핑 해결; 패턴은 위치 아닌 스타일만) ⑤ **칩 중앙하단**(bottom:13%) ⑥ **맵 우하단 박스**: EntityMap이 데이터실패 시 null-반환하는 함정 → `.sv2-map__h` 헤더(라벨+Explore↗) 항상표시 + 진입 opacity-only(force-graph 캔버스 폭측정 간섭 제거) + 박스 확대(520px). ⑦ **액센트 프레임 삭제**.

---

## D. `/random/reel` — 30초 릴 시제품 (마이그레이션 0051)

유튜브 Short용 30초 시제품(원우: "30초/5편/영화 소리 대신 배경음·AI목소리/소리 간헐"). **합법·환경가능 방식으로 구현:**
- 영상 대신 **영화 백드롭 스틸 5편 + 켄번즈** (푸티지 다운로드 불가라)
- 각 편 강한 오독 헤드라인 오버레이(실제 앱 데이터)
- **AI 목소리 = 브라우저 SpeechSynthesis**(유료 API 불필요)가 각 편 헤드라인 간헐 낭독
- **배경음 = Web Audio 생성 앰비언트 패드**(연속·저작권 제로)
- 시작 커버 ▶(브라우저 오디오 정책상 첫 클릭 필요)

데이터: RPC **`reel_cards(p_n)`**(마이그 0051, N편 + backdrop + 강한 misreading) → `app/api/reel/route.ts` → `app/random/reel/page.tsx`. 환경: ffmpeg 미설치라 MP4 렌더 불가 → 웹 릴을 화면녹화하는 방식. CSS `.reel-*`(globals.css).

---

## E. 유튜브 스트리밍 — 기술·저작권 검토 (실행 보류, 원우 결정 대기)

**핵심 결론: 기술은 쉽고, 저작권(Content ID)이 진짜 벽.**

- **기술 파이프라인(전부 검증됨):** FFmpeg→RTMP(24시간 lofi식) / 헤드리스 브라우저 캡처(v2 페이지를 그대로 방송) / OBS 브라우저소스 / **Remotion**(React라 같은 데이터로 MP4 렌더). 업로드=YouTube Data API v3.
- **Content ID 현실:** 임베드는 합법, **재업로드/재송출은 걸림**. 클레임≠스트라이크(클레임=수익몰수/차단, 스트라이크=DMCA 3회면 채널정지). 24시간 자동 푸티지 스트림이 가장 취약.
- **"작게+소리켜기" 회피 안 됨** — Content ID가 리사이즈/크롭/PiP 다 잡고, 오디오가 최강 트리거(소리 켜면 악화).
- **수익 포기 시:** "monetize" 정책 클레임은 영상 유지(무해) → 업로드형은 상당히 현실적. 단 "block" 정책(음악 레이블)·수동 DMCA·라이브 실시간 차단은 별개.
- **빠른 교차 + 강한 비평 + 짧은 클립 = 공정이용 최강 구성.** 단 **영화 클립 음소거 + 자체 내레이션**이 핵심(오디오 매칭 제거).
- **다른 사업 수익엔 영향 없음** — Content ID/스트라이크는 유튜브 내부 한정. 유튜브 밖은 실제 소송뿐(짧은클립 비평·비수익은 확률 매우 낮음). *(변호사 아님, 규모/수익화 단계 전문가 확인 권고.)*

**권리 깨끗한 영상층:** ① 자체 자산(비평 지도·타이포·TakeScore) ② 포스터(정지물=자동단속 회피, 단 저작권물) ③ PD 아카이브(유일하게 다운로드+재업로드 자유) ④ 라이선스 스톡. **TMDB 백드롭/스틸=영화 프레임이라 유튜브엔 중~고위험**(사이트 임베드는 무해).

**PD 아카이브 조사(중단됨):** 코퍼스 1,932편 중 1964년 이전 PD 후보 234편(pre-1930 15 + 1930–63 219), 나머지 1,698편(88%)은 대상 아님. URAA(외국영화 복원)·갱신여부로 **진짜 클린-PD는 수십 편 규모** → 대량 소스 부적합. Internet Archive 실측은 원우 지시로 중단.

**영화별 공식영상 소스:** **TMDB `/videos`**(기생충 42·듄2 45개 official 유튜브 — 예고편·클립·피처렛; 앱이 이미 TMDB 키 보유) / Movieclips(Fandango) / Apple·RT·IGN. 단 전부 **임베드/링크용**(재업로드는 Content ID).

**추천 경로:** Phase0 사이트 오버레이(완료) → Phase1 Remotion 업로드 에피소드(소유 비주얼+음소거 짧은클립, Shorts) → Phase2 24시간 이미지 무인채널(PD/포스터/지도). 예고편 재송출은 회피.

---

## 파일·라우트·마이그레이션 지도

- **마이그레이션:** `supabase/migrations/0050_surprise_home_expand.sql`, `0051_reel_cards.sql` (프로덕션 적용됨, 파일 수동커밋)
- **컴포넌트:** `components/home2/SurpriseStage.tsx`(신규 공유), `HeroSurprise.tsx`(슬림)
- **라우트:** `app/random/page.tsx`(홈통합+월), `app/random/v2/page.tsx`(채널), `app/random/reel/page.tsx`(릴)
- **API:** `app/api/reel/route.ts`, `app/api/surprise/route.ts`·`set/route.ts`(mix)
- **CSS:** `app/home2.css`(`.hs-*` 레이아웃수정·신규렌즈), `app/globals.css`(`.svc-*`·`.svc-ed-*`·`.svc-comp-*`·`.reel-*`·`.sm-rand-*`)

## 미결·결정 대기
- v2 배경 bed(영상/이미지/하이브리드) 결정 — **원우**
- v2 → v1 승격 여부, 컴포지션 6종 피드백 — **원우**
- 유튜브 방향(이미지 무인채널 / Remotion 비디오에세이 / 보류) — **원우**
- (기술) Remotion 에피소드 시제품, 무음클립 자동조립 파이프라인 — 지시 대기
