# 공유 디자인 표준 (정본) — 12 클러스터 확정 결정

> `CONFLICTS-AND-COORDINATION.md`의 12개 `[⚠ COORD]`에 대한 **단일 확정 기준**. 모든 페이지가 이걸 따른다. 🎨=디자인(지금 적용) · 🔧=백엔드(로직 문서로 역반영, `SHARED-STANDARD` 비주얼만 지금). 작성 2026-06-26.

---

## S1. 추천 명칭 (C2) 🎨
- 모든 추천 표면에서 *Δindex 최상위 1편* = **「오늘의 한 편」** + 부제 `최대 Δ · → NAV +N`.
- 폐기 표현: "오늘 할 일/오늘의 최대 알파/Δindex 최상위 기회"(라벨로는 금지, 본문 설명은 가능).
- 적용: command-center · watchlist · asset-desk · analysis.

## S2. 색 토큰 정본 (C3·C9·C10·C12) 🎨
`:root`에 다음 토큰을 추가/통일(전 다크 페이지):
```
--blind:#E8B23A;    /* 블라인드/공백 = gap amber 계열 (conquer red에서 분리) */
--forming:#C8922B;  /* "형성 중" 중립 골드 (red 금지) */
--masque:#9B8CF0;   /* 동행 가면무도회 보라 (pair 하드코드 토큰화) */
```
- **블라인드/공백**은 `--red`(conquer=완파/도장깨기 전용)를 **재사용 금지** → `--blind`(amber). 의미: 빨강=정복했다, 앰버=아직 안 갔다.
- **6+가용 이유 정본 재확인**: `safe` teal · `frontier` blue · `canon` gold · `gap` amber · `conquer` red · `reading` violet · (`avail` green). **블라인드 = gap의 절대형 → amber 계열로 통일.**
- **형성 중** = `--forming` 골드. red 금지(오독 방지).
- **타입 6색 정본**(서재 등): 영화 `--ink` · 감독 violet · 트로프 teal · 미스리딩 amber · 리니지 blue · 형상 `--figure:#86b9ec`. (figure 색 충돌 없음 — 확정.)

## S3. 가용성 3-상태 표기 (C5) 🎨
- **지금 가능** = solid green dot(`--avail`) + 제공자명(MUBI/Criterion · 지역).
- **미확인** = hollow ring + "가용성 미확인"("정보 없음 ≠ 안 됨").
- **만료 임박** = pill `D-N`(노랑 좌액센트).
- 적용: watchlist(정본 보유) · command-center · collection.

## S4. 완파(도장깨기) 상태 4-state (C8) 🎨 + 🔧(마일스톤)
- **잠금** <50% (회색) · **진행** 50–74% (`--canon` 진행) · **근접** 75–99% (`--canon` 강조) · **완파** 100% (`--conquer` 축포).
- Phase 4 `fire_lineage_milestones`(50/75/100 임계)와 정확히 일치.
- 적용: profile · command-center · analysis · asset-desk.

## S5. 용어집 hover (C4) 🎨
- 약어/전문어 첫 등장에 `.gloss`(점선 밑줄 + hover 한국어 정의) 부착.
- **정본 용어 사전**: 정전가(영화 객관 시장가) · NAV(내 영화 자산 총량) · WWI(이 영화가 나에게 맞는 정도 0–100) · Δindex(이 한 편 보면 NAV +N) · 커버리지(이 계보 중 내가 본 %) · 블라인드(아직 0~소수 본 권위 계보) · 정복도(이 감독 대표작 중 본 비율) · aw(계보 권위 가중) · rel(취향 관련성) · cov(커버리지).

## S6. 별점 컴포넌트 표준 (C1 비주얼) 🎨 / 영속·재계산 🔧
- 마크업 `.starwrap`: 0.5–5 half-star, hover preview, 옆에 "0.5–5" 스케일 단서, 클릭=확정.
- **평점 ⟹ 봤어요** 자동(별도 클릭 없음). 표준 마이크로카피: "평점을 주면 자동으로 '봤어요'".
- 🔧 `rate_film(0.5–5)` RPC → 가치뱃지·NAV 즉시 재계산(optimistic). (phase2 역반영.)

## S7. 인라인 액션 바 표준 (C1 비주얼) 🎨 / 동작 🔧
- 행/카드 hover·선택 시 아이콘 액션: **담기 · 봤어요 · 관심없음 · 공개토글**. 동일 아이콘·위치·피드백(toast·✓·fade).
- 인스펙터 없이 그 자리에서. 클릭은 `stopPropagation`(행 선택과 분리).

## S8. 담기 동작 의미 (C6) 🎨+🔧
- **담기 = 워치리스트에 추가**(제자리 마킹 + toast, **페이지 이동 없음**).
- **봤어요 = 보유로 이동**(+별점 입력 유도).
- inspector "담기"도 동일(이전의 `location.href→collection` 금지). 🔧 `add_watchlist`·`mark_watched` RPC.

## S9. 공개/비공개 토글 (C7 비주얼) 🎨 / 모델 🔧
- pill 1종: `🌐 공개 중` / `🔒 비공개` + 클릭 토글(제자리). role=switch.
- 적용: collection(행) · library(카드) · write(글) · profile(섹션).
- 🔧 통합 모델: item-level(`user_movies.visibility`·서재 항목) + profile section-level(`portfolio_public` 화이트리스트). **화이트리스트 투영은 RPC/뷰 강제**(프런트 가림은 보조). (phase0·phase4 역반영.)

## S10. write 인스펙터 반응형 예외 (C11) 🎨
- write는 좁은 폭에서도 인스펙터(첨부·연결 레일) 유지: 페이지에 `body.keep-inspector` 클래스로 `@media(max-width:1280px)` 강제 접힘을 무력화(또는 인라인 첨부 폴백).

## S11. Cinecodex 표시 표준 (비섞임 나란히 · 신뢰도 · 재현성 · 위험색) 🎨 + 🔧(점수 생성=STEP B)
엔진 ⑨(`docs/logic/09-intrinsic-cinecodex.md`) 출력을 표시하는 공통 규약. **점수 생성 완료(6,701편, 2026-07-01) → 활성 가능.**
- **나란히(never-blend) 분리 칸:** Cinecodex(우리 분석)·외부지표(IMDb/RT/Meta)·정전가(canon)를 *절대 한 숫자로 합치지 않고* 분리된 칸으로. 라벨 명확("우리 / 외부 / 정전").
- **위험 색 `--risk`(신토큰):** 위험(R) 표시는 `--risk` — 완파 `--red`와 **구분**(빨강=정복 전용). 고위험 = `--risk` 배지.
- **신뢰도 노출:** 저신뢰(고 sd_v·flagged·panel_disagree) = 흐림 + 플래그 아이콘. **단 분열적(고 POLAR) ≠ 불신뢰** — 분열성은 흐리지 말고 별도 「분열성」 배지.
- **재현성 카드(접이):** model_id·prompt_sha·n_samples·sd·scored_at(비결정성 정직 공개).
- **미평가 빈 상태:** 점수 없는 영화 = 「Cinecodex 미평가 · 분석 대기」 흐린 카드(NaN 금지).
- **공개 프로필 금지:** 13 서브점수·신뢰도·prompt_sha는 다크 셸 전용(공개 프로필 노출 금지).
- **어휘:** 「미적 단계」(영화, ≠레벨 밴드) · 「영화 순가치」 U(≠NAV) · C 진입비용 · S 샤프 · POLAR 분열성.
- 적용: 평가 카드(신규)·watchlist(위험 배지·U/R)·collection(V/U)·analysis(μ–σ 평면 V×R).

---

## 적용 매트릭스 (페이지 × 클러스터)

| 페이지 | 적용할 클러스터 |
|---|---|
| command-center | S1 명칭 · S2 blind색 · S3 가용성 · S4 완파 · S5 용어집 · S6/S7/S8 인라인 |
| watchlist | S1 · S2 · S3 가용성 · S5 · S6/S7/S8 |
| asset-desk | S1 · S4 · S5 · S7/S8 |
| collection | S3 · S6 별점 · S7/S8/S9 |
| analysis | S1 · S2 blind색 · S5 용어집 |
| onboard-rate | S6 별점 · S9(없으면 생략) · "형성 중" S2 |
| library | S2 figure확인 · S7/S9 공개토글 |
| write | S9 공개토글 · S10 반응형 |
| pair | S2 forming골드·masque토큰 · S5 |
| profile(라이트) | S4 완파 · S9 공개토글 비주얼 · 라이트 스킨 유지 |

🔧 백엔드 전제(지금 비주얼만, 로직은 phase 문서): S6 rate_film · S7/S8 담기/봤어요/관심없음 RPC · S9 visibility 모델 · **S11 Cinecodex 표시(점수 생성=STEP B 후 활성)**.

---

*하나의 표준이 12개 충돌의 정본. 페이지는 이걸 *참조*만 하면 서로 안 싸운다.*
