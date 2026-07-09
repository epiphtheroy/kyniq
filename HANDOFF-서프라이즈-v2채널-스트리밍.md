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

## C. `/random/v2` "METATAKE TV" — 스크린 에세이 채널 (2026-07-10 전면 재설계)

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

**주의:** `.svc-*` 베이스(bed/media/scrim/ctrls)는 **릴(/random/reel)과 공유** — 수정 시 릴 확인. 구 `.svc-ed-*`/`.svc-comp-*`(NYT 6컴포지션)는 폐기·삭제됨. Barlow Condensed는 globals.css 상단 @import.

**미결(원우 결정 대기): 배경 bed.** 자동화 탭에선 임베드 자동재생이 막혀 검게 보임(실브라우저는 재생). 옵션: 하이브리드(백드롭 항상+영상 위) 등 — 단 미재생 임베드가 불투명 검정이라 하이브리드도 완전 해결은 아님.

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
