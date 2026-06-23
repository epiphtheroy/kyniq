# Metatake — index-page redesign 시안 (최종본 보관)

> **다른 AI에게 반영을 맡길 때는 먼저 `HANDOFF-MASTER-redesign-시안-총정리.md`를 읽으세요.**
> 6개 시안의 진짜/가짜 구분 · 실제 라우트 · 디자인 토큰 · 반영 순서를 한 문서로 총정리했습니다.

이 폴더는 진행 중인 인덱스/메인 페이지 리디자인 **시안(컨셉)의 최종본**만 모아둔 곳입니다.
모든 파일은 실제 metatake.net 구조·데이터 위에서 만든 단일 HTML(의존성 없음) — 브라우저로 바로 열림.
(중간 버전들 v1·v2·v3…은 상위 폴더에 그대로 있습니다. 필요 없으면 지워도 됩니다.)

## 최종본 목록

| # | 페이지 | 파일 | 핵심 |
|---|---|---|---|
| 01 | **Home** (메인 · v6 "The Pair") | `01-home.html` | 첫 줄 **AI 임베딩 기반(≠ 생성 콘텐츠)** 선언 · 히어로 **안 어울리는 두 영화 + 빨강 선 + 공유 메타테이크(via 피겨)** 박스형 전시 + **10개 페어 갤러리** · 개념 사슬 · 실시간 카운터 · 살아있는 별자리 · 진입문 · 매니페스토 |
| 02 | **Meta takes** | `02-meta-takes.html` | 정의 블록 · 회전 카드 덱(5분 새 4장) · Defining cases = 영화 썸네일+ **via [피겨]** · A–Z/Most films/Newest 카탈로그 |
| 03 | **Directors** | `03-directors.html` | 작가 지문 — Signature readings/tropes 각각 **via [피겨]** + 대표작 백드롭 · A–Z/Nationality/Films 카탈로그 |
| 04 | **Films** | `04-films.html` | 백드롭 히어로 · Meta takes/Tropes **via figure** 2열 · Movies-like(공유 의미 kin) · A–Z 점프바 3열 카탈로그 |
| 05 | **Tropes** | `05-tropes.html` | figure-type 허브(틸 강조) · laconic+definition · Figures = 영화 썸네일 + **via [피겨]** · A–Z/Most films/Newest 카탈로그 |
| 06 | **Latest / Trending** | `06-latest-trending.html` | 매거진형 — Latest는 **엔티티 5종 색박스 masonry + 무한 스크롤**, Trending은 **4영역(메타·테이크·트로프·영화) 랭킹 + 더보기→각 메인** · 순위 안은 영화·**via 피겨**(Takes만 본문 2줄) |

(상위 폴더의 원본 파일명: `home-redesign-v6-the-pair.html`(홈, 이전 v5 `home-redesign-v5-living-paper.html`는 아카이브),
`meta-takes-index-enriched-final-v4.html`, `directors-index-enriched-v5.html`, `films-index-enriched-v3.html`.)

## 공통 패턴 (인덱스 페이지 = 소개 + 랜덤 피처 + 카탈로그)

- **차별점 소개** — 빨강 좌측선 블록으로 "이 엔티티가 무엇인지" 효익 중심 1~2문장.
- **랜덤 피처 카드 덱** — 오른쪽으로 넘어가는 4장 덱, 7초 회전 · 5분마다 새 세트 · hover 정지 · ↻/‹›/점 조작.
- **카탈로그** — 정렬 탭(기본 A–Z, "The/A" 관사 무시) + **A–Z 점프바**(sticky) + **3칸 그리드**, 행 전체 클릭.
- **이미지는 오른쪽**, 텍스트는 왼쪽 정렬. 디자인 토큰: 흰 종이 · 잉크 블랙 · 빨강 #E3120B 하나(+트로프는 틸 #167C6B) · PT Serif/Inter.

## 데이터 출처 / 주의

- 카드·카탈로그의 제목·편수·시그니처·**via 피겨**·kin·백드롭은 모두 **실제 metatake.net** 페이지에서 수집(시안이지만 사실 기반).
- laconic/thesis 등 일부 산문은 시안용 카피 — 실연동 시 DB(`meta_takes.laconic/thesis` 등)로 교체.
- 백드롭/포스터 이미지는 TMDB에서 실시간 로드(네트워크 필요).

## 상태

- [x] Home · Meta takes · Directors · Films · Tropes · Latest/Trending  (6개 완료)
- [ ] 다음 후보: **Concepts** · Genres · Ask
