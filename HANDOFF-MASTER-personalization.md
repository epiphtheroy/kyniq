# MetaTake 개인화 스위트 — 마스터 인수인계 (HANDOFF)

> **이 문서 하나로 시작하라.** 개인화(내 영화 자산관리) 페이지 묶음의 *의도 → 결과물 → 파일 위치 → 상호 관계 → 다음 일* 을 종합한다. 작성 2026-06-25. 모든 경로는 이 컴퓨터의 실제 절대경로다. 루트: `/Users/jerryje/Documents/MetaTake/`

---

## 0. 읽는 순서 (새 AI를 위한 진입로)

1. **이 문서** (§1~§9) — 전체 그림.
2. `docs/SUITE-AUDIT-personalization.md` — 어휘 표준 + 정리 이력(무엇을 왜 통일했나).
3. `docs/PLAN-personalization-portfolio.md` — 데이터 모델·화면 구조 기획서(목업의 근거).
4. **라이브 목업 10개를 브라우저로 열어보라.** `mockup-me-command-center.html`에서 시작해 상단 네비·CTA로 페이지 사이를 실제로 오가면 동선이 체감된다.
5. 데이터 substrate를 깊게: `handoff/00_MASTER_HANDOFF.md` + `handoff/07_scoring_model.md`(계보·점수 모델).
6. 기존 사이트 컨텍스트: `00-INDEX.md`, `docs/STATE-2026-06-17.md`.

---

## 1. 한 문단 요약

MetaTake(영화 비평 사이트, Supabase+Next.js, 엔티티 척추 `영화→형상(figure)→강한 오독(take)→트로프`)에 **개인화 영역 = "영화를 지적·미학적 자산으로 보유·관리하는 터미널"** 을 설계했다. 블룸버그 자산관리 비유: *영화=자산, 본 영화=포트폴리오, 볼 영화=파이프라인, 평생 볼 수 있는 영화는 유한 자본*. 결과물은 **인터랙티브 HTML 목업 10개**(사적 다크 터미널 + 공개 라이트 프로필 + 슬로우 SNS)와 **기획/감사 문서 2개**다. 이 목업들은 `handoff/`의 **계보(lineage) 데이터 레이어**(115 라인·10,238 멤버십·160 감독·3분리 점수)를 시각적 연료로 쓴다. 13개가 흩어져 만들어진 뒤 한 차례 **정리(어휘·네비·버전 통일 + 동선 배선)** 를 거쳐 *하나의 운영체계*로 수렴했다.

---

## 2. 의도 & 배경 (왜 이렇게 만들었나)

- **핵심 비전**: 시네필은 영화를 *자산처럼* 느낀다. 좋은 영화를 보면 우량주를 싸게 산 것이고, 실망하면 유한한 시간을 잃은 것이다. 그래서 페이지의 목표는 단순 기록이 아니라 **"영화적 자산 증식"** — 유한 시간당 미적 수익의 극대화.
- **시네필 심리의 양가성**(목업의 추천 로직 근거): ① 검증된 감동의 연장(안전자산) ② 안전하게 떠나는 모험(새로운 도전) ③ 사랑하는 계보의 완파(도장깨기) ④ 구독 서비스에서 무비용 취득(가용) ⑤ 자기가 반응하는 *읽는 방식*(Reading/강한 오독). 이 다섯이 추천 "이유"의 축이 되었다.
- **왜 계보(lineage)가 중심인가**: "왜 이 영화를 봐야 하나"를 *수치로* 설명하려면 객관적 근거가 필요하다. `handoff/`의 계보 레이어(수상·정전·국가·감독·사조)가 그 근거(설명가능한 점수)를 제공한다. 추천은 블랙박스가 아니라 *기여도 순으로 펼쳐지는 논거*다.
- **왜 사적/공개를 스킨으로 가르나**: 사적 분석·운용은 **다크 터미널**(집중·고밀도), 세상에 보이는 얼굴은 사이트의 공개 정체성인 **라이트 Living Paper**(편집·여백). 프라이버시 우선(실명 미사용·선택 공개).

---

## 3. 아키텍처 — 3층

```
(C) 통합 척추  ── 공통 어휘(점수·이유·색) · 글로벌 네비 · 동선 · 데이터 객체
        ▲ 묶는다
(B) 설계 산출물 ── 목업 10 (UX/화면) + 기획서 + 감사문서
        ▲ 시각적 연료
(A) 데이터 substrate ── 계보 레이어(handoff/) + 기존 Supabase(app/, supabase/)
```

- **(A) 데이터 substrate** — `handoff/`(계보 CSV·점수 모델, §0 5번 참조) + 라이브 Supabase(`supabase/migrations/`, `app/`). 목업의 모든 수치(정전가·커버리지·affinity·감독 추천)는 이 층에서 산출되어야 할 *실데이터의 자리표시자*다.
- **(B) 설계 산출물** — 본 인수인계의 주 대상. §4 인벤토리.
- **(C) 통합 척추** — §6(어휘)·§7(동선). 실빌드 시 `user_films`·`user_pins`·`takes`·`user_rank` + `film_scores`·`film_lineage` 위에 올라간다.

---

## 4. 파일 인벤토리 (정확한 경로)

루트 `/Users/jerryje/Documents/MetaTake/`.

### 4.1 라이브 목업 10개 (전부 인터랙티브 단일 HTML, 브라우저로 열면 동작·이동)

| 면 | 파일 | 한 줄 | 스킨 |
|---|---|---|---|
| 기록 | `mockup-me-onboard-rate-v2.html` | 본 영화 평가 시딩(루프·리니지 불러오기·벌크) | 다크 |
| 내 자산〈현황〉 | `mockup-me-command-center.html` | 계보 커버리지·블라인드·추천·포지셔닝 종합 | 다크 |
| 내 자산〈운용〉 | `mockup-me-asset-desk.html` | 유한자본 NAV·5전략 추천 데스크·리스크리턴·P&L | 다크 |
| 내 자산〈분석〉 | `mockup-me-analysis-v2.html` | 리니지(연대·국가·감독·상호추천) + 해석 렌즈 탐색 | 다크 |
| 보유 리스트 | `mockup-me-collection-list-v2.html` | 중고차식 패싯 3단(필터·리스트·추천), 정전가=가격 | 다크 |
| 볼 영화 | `mockup-me-watchlist.html` | 스트리밍 등록→재리스팅·이유 스택·WWI·순위 | 다크 |
| 서재 | `mockup-me-library.html` | 모든 엔티티 담기·컬렉션·즐겨찾기·공개 | 다크 |
| 노트 | `mockup-me-write.html` | 글쓰기 composer·영화/형상/트로프 엮기·공개 | 다크 |
| 동행 | `mockup-me-pair.html` | 이중 노출 슬로우 SNS(하루 페어·싱크율·암실 교류) | 다크 |
| 공개 프로필 | `mockup-me-profile.html` | 모듈별 공개 토글·뱃지·리스트(공개 얼굴) | **라이트** |

### 4.2 아카이브(롤백용, v2가 대체) — `mockup-archive/`
`mockup-me-onboard-rate.html` · `mockup-me-collection-list.html` · `mockup-me-analysis.html`. **참조 금지**(라이브에서 링크 없음). analysis v1의 렌즈 탐색은 v2에 병합됨.

### 4.3 기획·감사 문서 — `docs/`
- `docs/PLAN-personalization-portfolio.md` — 최초 기획서: 데이터 모델(`user_films`·`user_taste_profile`·RPC), 화면 구조, 수치 정의(WWI·정전가).
- `docs/SUITE-AUDIT-personalization.md` — 정리·개선 감사: 비일관성 진단 + 표준화 + 실행 현황(§7).

### 4.4 데이터 substrate — `handoff/` (계보 레이어, 별도 패키지)
`handoff/00_MASTER_HANDOFF.md`(진입), `handoff/07_scoring_model.md`(PrestigeScore/DiscoveryScore/Total), `handoff/02_schema.sql`, `handoff/seeds/`·`handoff/mappings/`(CSV 실데이터). **목업의 점수·계보·affinity는 모두 이 층에서 나온다.**

### 4.5 기존 사이트(참고) — `app/`, `supabase/migrations/`, `00-INDEX.md`, `docs/STATE-2026-06-17.md`
실제 Next.js 코드·DB. 개인화 토대로 이미 존재: `user_pins`(follow/like, `supabase/migrations/0020_user_pins.sql`), `/me`(`app/me/page.tsx`), `/u/[username]`, `/settings`.

---

## 5. 페이지별 상세 (의도·기능·데이터·관계)

각 페이지: **무엇을/왜 → 핵심 인터랙션 → 다루는 데이터 객체 → 어디로 잇는가.**

1. **기록 `onboard-rate-v2`** — *고통스러운 시딩을 최소화*. 퍼지 검색(오타·한글)·한 클릭 별점·평가 시 비슷한 영화가 옆 레일로 fly-in(모멘텀 루프)·좌측 **리니지 불러오기 칼럼**(감독/정전/영화제 클릭→스트림)·벌크(텍스트 AI매칭·엑셀·레터박스/왓챠). 데이터: `user_films(status=watched, rating, watched_at)`. 잇기: → 보유 리스트·볼 영화.
2. **현황 `command-center`** — *내 자산의 종합 현황*. 헤더 **NAV 1,284·LV.Established**, 계보 커버리지 매트릭스(라인별 관람/전체·등급), 블라인드 스팟(권위×미답), WHY-WATCH 추천(필람/발굴), 별자리, Prestige×Discovery 포지셔닝, 연대/국가/사조/감독 커버리지. 데이터: `film_lineage`·`film_scores`·`user_films`. 잇기: 추천→볼 영화.
3. **운용 `asset-desk`** — *유한 자본 운용*. NAV·관람예산·생애잔여·적중률·후회손실, **지속 추천 데스크**(5전략, 다중 논거=확신도, E/R), 완파 보드, Reading 성향, 구독 가용, 리스크–리턴 프론티어, 자산 곡선(적중/drawdown). 잇기: 추천 필람/발굴/완파→볼 영화.
4. **분석 `analysis-v2`** — *리니지로 나를 이해*. 상단 교차필터(연대·국가·감독·리니지 멤버십 클릭→내 영화 점등), **감독 상호추천 그래프**(auteur_edges: 본 감독↔추천 감독), **영화 상호추천**(film_affinities), 그리고 하단 **해석 렌즈 탐색**(트로프·Reading·형상 클릭→내 영화 필터, 독립 IIFE)+형상 클라우드+자기 서사. 잇기: 상호추천→볼 영화.
5. **보유 리스트 `collection-list-v2`** — *중고차식 매물 리스트*. 좌측 다중 패싯(정전가·별점·**가치**·연대·국가·G등급·리니지·깊이·가용), 중앙 리스트(**정전가=가격**·P/D·별점·**가치 뱃지** 저평가발굴/정전합치/고평가), 우측 영화 선택→**3전략 추천 광고카드**(안전자산/안전한 모험/리니지 완파). 데이터: `user_films`·`film_scores`. 잇기: 추천 +워치리스트→볼 영화.
6. **볼 영화 `watchlist`** — *파이프라인 운용*. 상단 **스트리밍 채널 등록→가용 재리스팅**(만료 D-day), 각 후보의 **"왜 추천됐나" 이유 스택**(기여도 순, 6+가용), **WWI** 종합, 3열 카드, 패싯·정렬, **순위(1·2·3 podium)**. 데이터: `user_films(status=watchlist)`·`user_rank`·가용성. 잇기: 봤어요→보유.
7. **서재 `library`** — *모든 엔티티 큐레이션 보관*. 영화·감독·트로프·미스리딩·리니지·형상을 **한 컬렉션에 혼합** 수납, 분류별/컬렉션 폴더/즐겨찾기, 폴더 공개 토글+공유. 데이터: `user_pins`(다형 확장). 잇기: 공유→공개 프로필.
8. **노트 `write`** — *영화에 매이지 않는 글쓰기*. 2-pane(목록+에디터), 유형(자유/영화 코멘트/**강한 오독**/트로프 기여), 본문에 영화 *복수* 엮기·형상 검색(→미스리딩)·트로프 추가·생성, 공개 토글. 데이터: `takes`·`figures`·`tropes`. 잇기: 공개→영화 코멘트/형상 미스리딩/공개 프로필.
9. **동행 `pair`** — *매우 느린 취향 SNS "이중 노출"*. 하루 한 명 취향 페어(성별 선택), 싱크율, **가면**(취향만 공개·신상 가림), 오늘의 한 편을 두고 **암실 동시 공개** 한 줄 교류, 건네는 한 편(선물), 경계(자정 휘발·DM 없음). 잇기: 간직→서재.
10. **공개 프로필 `profile`** *(라이트)* — *세상에 보이는 얼굴*. 모듈별 공개/비공개 👁 + **공개 미리보기**, 신원 규칙(핸들·이메일 비공개·사진 선택), 수치·**업적 뱃지**·리니지·공개 글·본 영화·만든 리스트. **트로프·미스리딩은 제외**(해석 내부는 사적). 잇기: 본 영화→보유, 컬렉션→서재.

---

## 6. 공통 어휘 표준 (전 페이지가 따른다)

> 정본 출처: `docs/SUITE-AUDIT-personalization.md` §3. 실빌드 시 `lib/`의 단일 상수로 관리할 것.

### 6.1 점수·레벨 (단일화 완료)
- **영화적 자산 NAV** = 유일한 포트폴리오 총량. 헤더는 항상 **"NAV 1,284 · LV. Established · 상위 14%"**(현황·운용 동일). *Cinephile Index는 폐기 → 레벨 밴드로 흡수.*
- **정전가(Standing)** = 영화의 *시장 가치*(계보 PrestigeScore+γ·Discovery). 보유작·후보 공통 표기.
- **WWI(Why-Watch Index)** = 후보의 *나에 대한 적합도*(아래 이유들의 가중합). 후보(볼 영화)에만.
- **가치 뱃지** = `정전가 vs 내 별점` → 저평가 발굴/정전 합치/고평가 실망(보유 리스트 고유).

### 6.2 추천 이유 taxonomy + 색 (정본 = watchlist)
| 이유 | 색 | 정의 |
|---|---|---|
| safe 안전자산 | teal `#1FB286` | 고친연도·저분산(검증된 감동의 연장) |
| frontier 안전한 모험 | blue `#3E8FE0` | 신영역 + 정전 안전망(새로운 도전) |
| conquer 리니지 완파 | red `#E3120B` | 감독·정전 완성 진척(도장깨기) |
| gap 공백 충족 | amber `#C8922B` | 내 sparse 축 메움 |
| canon 정전 위상 | gold `#D9A441` | S&S·수상 standing |
| reading Reading | violet `#9B8CF0` | 내가 반응하는 오독 렌즈 |
| (avail 구독 가용) | green `#2E9E5B` | *이유가 아니라 필터/가산* (만료 경고) |

### 6.3 스킨 규칙
사적 = **다크 터미널**(`--bg:#0B0B0C`), 공개 = **라이트 Living Paper**(`--paper:#FAF8F3`, `--accent:#E3120B`). 현재 profile만 라이트(규칙대로). library 공개 컬렉션·write 공개 글이 외부로 나갈 때의 *공개 뷰는 라이트*로 렌더할 것(미구현).

### 6.4 글로벌 네비 (7항목, 13면 동일)
`기록 · 내 자산 · 볼 영화 · 서재 · 노트 · 동행 · 공개 ↗`. 목업에선 클릭 시 해당 파일로 `location.href` 이동(브라우저에서 폴더째 열면 동작). "내 자산"은 현황으로 진입(현황/운용/분석 사이 sub-nav는 §9 미구현).

---

## 7. 페이지 간 관계 / 동선 지도 (배선 완료)

```
기록(onboard) ──기록한 영화는──▶ 보유 리스트 · 볼 영화
보유 리스트 ──영화 선택→3전략 추천 "+워치리스트"──▶ 볼 영화
현황·운용 ──추천(필람/발굴/완파)──▶ 볼 영화
분석 ──영화 상호추천 "→ 볼 영화에 담기"──▶ 볼 영화
볼 영화 ──"봤어요"(승격)──▶ 보유 리스트
서재 ──"공유"──▶ 공개 프로필
공개 프로필 ──"본 영화 전체"→보유 · "컬렉션 미리보기"→서재
동행 ──"서재에서 보기"──▶ 서재
+ 모든 면 상단 글로벌 네비로 상호 이동
```

공통 데이터 척추 = **`user_films.status`(본/볼)** · **`user_pins`(다형 담기)** · **`takes`(노트/오독)** · **`user_rank`(순위)**. 모든 면이 이 4개를 읽고 쓴다.

---

## 8. 적용한 정리 이력 (무엇을 왜 통일했나)

13면이 순차로 만들어지며 어휘가 분기했다. 한 차례 정리로 수렴:
- **R1 글로벌 네비** — 13면 제각각이던 네비를 단일 7항목으로, 클릭 이동까지.
- **R2 점수·레벨** — 경쟁하던 두 총점(Cinephile Index 648 vs NAV 1,284)을 NAV로 단일화.
- **R3 analysis 병합** — v2가 빠뜨린 렌즈 탐색(트로프·Reading·형상)+형상 클라우드+자기 서사를 *독립 IIFE*로 복구(리니지 메인 유지, 전역 충돌 0).
- **R4 정리** — v1 3종 아카이브, command/desk를 「현황」/「운용」으로 관계 표기.
- **P2 교차링크** — §7 동선을 실제 클릭 이동으로 배선(끊긴 링크 0, 검증 완료).

상세·근거는 `docs/SUITE-AUDIT-personalization.md` §2·§7.

---

## 9. 알려진 갭 / 남은 일

1. **"내 자산" sub-nav 미구현** — 글로벌 네비의 "내 자산"은 현황으로만 진입. 현황↔운용↔분석↔보유 사이 드롭다운/탭이 필요(감사 §3.3).
2. **이유 taxonomy 잔여 정렬** — command-center 추천 카드는 아직 *현황*용(Prestige/Discovery) 표기. watchlist의 6+가용 칩·WWI로 완전 정렬은 실데이터 빌드 시.
3. **공개 뷰 라이트 렌더** — library/write의 공개물 외부 뷰는 라이트 스킨으로(미구현).
4. **실데이터 전환** — 전부 자리표시자 수치. §10의 매핑대로 실 RPC/테이블에 연결 필요.
5. **소소** — pair 선물(건넨 한 편)→볼 영화 담기 미배선, 모바일 폴리시 일부.

---

## 10. 실데이터 전환 가이드 (목업 → 실빌드의 다리)

목업을 실제로 살리려면 (순서):

1. **상태 레이어** — `docs/PLAN-personalization-portfolio.md` §3의 `user_films`(status/rating/watched_at/visibility) + `user_taste_profile`(taste_vector·분포) 마이그레이션. `user_pins`는 다형 담기(서재)로 확장, `user_rank`(볼 영화 순위) 추가.
2. **계보·점수 적재** — `handoff/00_MASTER_HANDOFF.md` §7 순서대로 `film_lineage`·`film_scores` 적재(`handoff/07_scoring_model.md`의 PrestigeScore/DiscoveryScore). → 현황 커버리지·보유 정전가·분석 리니지의 실데이터.
3. **추천 엔진** — §6.2 이유 6+가용을 RPC `score_watchlist(uid)`로(친연도=taste_vector 코사인, 완파=감독/정전 잔여, 공백=sparse 축, 가용=스트리밍 조인). → 볼 영화 WWI·이유 스택·운용 데스크.
4. **상호추천** — `auteur_edges`(감독)·`film_affinities`(영화 공유 리니지)를 분석면 그래프에 연결.
5. **글/오독** — `takes`·`figures`·`tropes`를 노트 composer·서재·프로필에 연결.

페이지↔데이터 매핑 요약: 기록→`user_films`쓰기 · 현황/보유→`film_lineage`+`film_scores`+`user_films` · 볼 영화→`score_watchlist`+가용+`user_rank` · 분석→`film_lineage`+`auteur_edges`+`film_affinities`+`takes` · 서재→`user_pins` · 노트→`takes` · 프로필→공개 가능 필드 화이트리스트.

---

## 11. 관련 문서 지도

| 문서 | 역할 | 경로 |
|---|---|---|
| **이 문서** | 마스터 진입 — 개인화 스위트 전체 | `HANDOFF-MASTER-personalization.md` |
| 기획서 | 데이터 모델·화면·수치 정의 | `docs/PLAN-personalization-portfolio.md` |
| 감사·표준 | 어휘 정본 + 정리 이력 | `docs/SUITE-AUDIT-personalization.md` |
| 계보 데이터 | 점수·계보 substrate | `handoff/00_MASTER_HANDOFF.md` (+ `07_scoring_model.md`) |
| 사이트 현황 | 기존 엔티티·DB·페이지 | `00-INDEX.md`, `docs/STATE-2026-06-17.md` |
| 목업 10 | UX/화면 결과물 | `mockup-me-*.html` (§4.1) |

---

## 12. 한 줄
**13개 면이 한 번의 정리(어휘·네비·동선 통일)를 거쳐 *영화적 자산운용 운영체계* 하나로 수렴했다. 다음은 이 자리표시자 수치를 `handoff/` 계보 데이터와 `user_films`/`user_pins`/`takes` 위의 실 RPC로 갈아끼우는 일이다.**
