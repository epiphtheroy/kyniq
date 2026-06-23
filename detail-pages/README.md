# metatake — 상세(show) 페이지 디자인 세트 (시안)

상단 메뉴(인덱스)에서 한 항목을 클릭해 들어가는 **개별 상세 페이지 6종**의 리디자인 시안.
각 페이지는 **실제 현재 페이지 구조(`app/.../page.tsx`)를 그대로 따르고**, 내용은 **Supabase 실데이터**로 채웠다.
v6 디자인 시스템과 인덱스/홈/블로그 시안과 톤·메커니즘을 통일했다.

| # | 페이지 | 파일 | 실제 라우트 | 실제 소스 | 예시(실데이터) |
|---|---|---|---|---|---|
| 01 | **Film** | `01-film.html` | `/film/[slug]` | `app/film/[slug]/page.tsx` | Parasite (2019) |
| 02 | **Figure** | `02-figure.html` | `/film/[slug]/figure/[figureSlug]` | `app/film/[slug]/figure/[figureSlug]/page.tsx` | Parasite → the scholar's rock (Suseok) |
| 03 | **Director** | `03-director.html` | `/director/[slug]` | `app/director/[slug]/page.tsx` | Quentin Tarantino |
| 04 | **Trope** | `04-trope.html` | `/trope/[slug]` | `app/trope/[slug]/page.tsx` | The Mid-Story Genre Turn (틸) |
| 05 | **Meta take** | `05-metatake.html` | `/take/[slug]` | `app/take/[slug]/page.tsx` | The Cyborg Body (주인공·빨강) |
| 06 | **Ask** | `06-ask.html` | `/ask` | `app/ask/page.tsx` | "How does cinema portray surveillance?" |

## 페이지별 핵심 (현재 구조 그대로, v6로 끌어올림)

- **01 Film** — 컬러 백드롭+포스터 히어로 · "Metatake reads X through N figures…" 인트로 · **Figures(kind 그룹, 와이드 행, 설명 전문 + reaches)** · 살아있는 맵 · **Meta takes | Tropes 2단(각 via 피겨)** · Films most connected(via 메타테이크) · Film info(접이식) · seq/prov.
- **02 Figure** — Kind/Type(트로프, 틸)/Takes · 영화 컨텍스트 · 설명 전문 · Search images/clips↗ · **Takes(레지스터 색 카드 + rationale 전문 + → 메타테이크 허브, emerging/Community 배지)** · 맵 · **Connected figures(공유 트로프별 형제 figure)** · Contribute · seq/prov.
- **03 Director** — 인물 사진·출생 · fingerprint 인트로("computed, not asserted, ≥2편 반복") · **Signature meta takes(presence dots N/총편수 + 영화 목록)** · **Signature tropes(틸)** · **Filmography(백드롭 카드, 편당 meta take 수)**.
- **04 Trope** — laconic(틸) · thesis · 맵 · **Figures of [트로프] — N across M films(실시간 검색 필터, 멤버 행 = 영화 — figure[영화와 동일 크기] + 설명 전문)**. figure-type = **틸**.
- **05 Meta take(주인공)** — laconic + after [이론가] · thesis · 맵(defining 안쪽 / unexpected kin 바깥) · **Representative takes = Defining cases + Unexpected kin(레지스터 배지 + rationale 전문, 영화 — figure 동일 크기 인라인)** · **All takes(검색·🎲 Random·장르/레지스터 토글, 폴더 아이콘 + "N takes", 펼치면 전 행 표시)** · seq/prov. **빨강**.
- **06 Ask** — 근거 기반 Q&A. 질문 → 코퍼스에서만 합성한 답변 + **인라인 [N] 인용(→ 출처 하이라이트)** · Threads to pull · **Sources(추적 가능: figure · 영화 → 메타테이크 + 레지스터 배지)** · "▦ retrieved, not generated" 스탬프.

## 공통 상세 페이지 규약 (6종 통일)

- v6 토큰: 흰 종이 · PT Serif+Inter · **빨강 하나 #E3120B**(트로프 영역만 틸 #167C6B) · 헤어라인 · 사각 모서리 · **컬러 이미지**.
- 마스트헤드 = 본 사이트와 동일(+Blog). 각 페이지에서 해당 nav 항목 빨강 active.
- **스탯 스트립** — 숫자 클릭 시 해당 섹션으로 점프 + **스크롤 진입 시 카운트업 애니메이션**.
- **살아있는 맵(검은 별자리)** — 엔티티별(film→figure→meta take / figure→meta·trope / trope→figures / hub→films). 드래그·줌·hover.
- **본문은 전문 노출**(figure 설명·take rationale) — 클램프/펼치기 없이.
- **레지스터 배지 색 = §7 실제 매핑**, **via [figure]=빨강, via [meta take]=빨강, 트로프=틸**.
- 새 시각요소: director **presence dots(N/총편수)**, meta take **All takes 폴더 탐색기(폴더 아이콘+개수, 검색·랜덤·장르/레지스터 토글)**.

## 진짜 vs 자리표시자

- **진짜:** 본문·figure 설명·take rationale·register·메타테이크/트로프/연결·랭킹·필모·카운트 = 전부 Supabase 실데이터(프로젝트 `jvgarcqrtsmgfimdcwgo`).
- **자리표시자:** prev/next(SeqNav)·Save/Contribute 액션·Ask의 답변 합성(데모, 로딩→고정 샘플)·일부 링크(`#`). 실연동 시 실제 라우트·API(`/api/ask`)·SeqNav로 교체.

## 빌드 시 주의

- Film 페이지: figures는 `kind` 순서(character→object→location→form→trope), via 피겨는 실제 `takes`→`meta_takes(kind=reading)` / `figure_type_members(kind=figure_type)`로.
- Director "signature" = 필모 ≥2편에서 반복(추측 금지).
- Meta take: Defining=`meta_take_rankings.rel_rank`, Unexpected kin=`surp_rank`. All takes는 장르/레지스터 양쪽 폴더에 전 행.
- Ask: 답변은 `/api/ask`(코퍼스 RAG), 모든 [N]은 실제 take로 링크. 추측 답변 금지.
