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

## C. `/random/v2` "The Metatake Channel" — 방송형 무인 안내문 + 에디토리얼

풀스크린(`position:fixed`) 방송 오버레이. 영화가 프레임을 채우고 렌즈가 방송 자막처럼 위에 얹힘. 채널버그(●METATAKE ON AIR)·상단 진행바·컨트롤 3.2s 자동숨김·Space 정지·←→ 넘김. **v1 미변경**(성공 시 승격 방침).

**진화 로그(원우 지시 흐름):**
1. 첫 v2 = 영상(YouTube 임베드) 배경 오버레이. 원우가 "아름답게 오버레이됐다"고 선호.
2. 검은 화면 다수 + 유튜브 재송출 위험 논의 → 이미지(백드롭 켄번즈) 배경으로 교체.
3. 원우 최종 결정: "유튜브 안 올리고 사이트 전용" → **첫 v2(영상 오버레이) 복귀** + 에디토리얼 업그레이드.

**에디토리얼 업그레이드(현행):** `svc-ed-*` 레이어 + **6 랜덤 컴포지션** `svc-comp-0..5` (매 카드 랜덤). NYT 에디터풍:
- ⓪ **Front page** — 좌상 거대 제목 + 밑줄, 우상 연도·감독, 우하 "No.N" 폴리오
- ① **Diagonal** — 붉은 사선 + 화살표, 렌즈 우측
- ② **Peek** — 거대 인용부호가 좌측 모서리서 빼꼼, 제목 우상, 렌즈 중앙좌
- ③ **Ledger** — 등록마크 코너틱 + 제목 위 라벨, 렌즈=좌측 붉은테 카드
- ④ **Float** — 제목 좌하 대형, 자막 2개 드리프트, 렌즈 우측중앙(시적)
- ⑤ **Broadside** — 제목 세로회전(우측 edge) + 굵은 붉은 세로 바
20모드 렌즈는 `Lens` 함수가 방송자막(kicker/head/body/quotes/roll/list/chips)으로 렌더.

**⚠️ 함정 (재발 방지): `position:fixed; inset:0`가 이 빌드 CSS 파이프라인에서 top/bottom만 드롭됨**(left/right는 적용 → 높이 10px로 붕괴). **longhand 필수: `top:0;left:0;width:100vw;height:100vh`**. + 루트 layout이 전역 Footer 렌더 → 풀스크린은 `document.body.style.overflow='hidden'` 잠금.

**미결(원우 결정 대기): 배경 bed.** 여러 영화에서 영상 자리가 검게 뜸(임베드 자동재생 이슈; 자동화 탭에선 확실히 막힘, 실제 브라우저는 재생될 수 있음). 옵션: (1) 백드롭 켄번즈 고정(안정, 영상無) (2) 하이브리드(백드롭 항상+영상 위) — 추천 (3) 현행 유지.

파일: `app/random/v2/page.tsx`, CSS `app/globals.css` `.svc-*` + `.svc-ed-*` + `.svc-comp-*`.

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
