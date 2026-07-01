# 🧭 Theory Atlas — 사상의 지도 (Semantic Map of Theory)

지명이 아니라 **의미(임베딩)** 로 그린 가상지도. 영화이론 브리핑 문서에서 **이론가·이론 개념**을 추출하고, 의미가 가까운 개념끼리 가깝게 배치한 뒤, 발견된 "사상 권역(territory)"을 지도처럼 그려 탐색·열람하게 합니다.

현재 3개 문서(*Cléo from 5 to 7*, *Do the Right Thing*, *2001: A Space Odyssey*)에서 **9개 개념**을 뽑아 **실제 작동**합니다.

## 지금 바로 보기

`webmap/index.html`을 **더블클릭**하세요(설치·키 불필요, 인터넷만 연결).

- 점 하나 = 이론 개념. 가까울수록 의미가 유사합니다.
- 색 영역 = 데이터에서 **발견된 사상 권역**: 🔴시선과 인종화된 자아 · 🟢낯설어진 지각 · 🟠실재의 결.
- 드래그=이동, 휠=확대/축소(진짜 지도처럼 네비게이션), 점 클릭=전문(EN+KO) 패널.
- 우측 목록은 **현재 화면 안의 개념**으로 자동 갱신. 상단에서 권역 필터·한/영 전환.

## 어떻게 좌표가 정해지나 (핵심)

이것이 프로젝트의 심장입니다. 표준 파이프라인은 **벡터화 → 2D 투영 → 군집 → 라벨**입니다.

1. **벡터화(임베딩)**: 각 개념을 "개념명+이론가+전통+해설" 텍스트로 묶어 고차원 벡터로 바꿉니다. 의미가 가까우면 벡터도 가깝습니다. (생산용: **Gemini Embedding 001** — 2025년 MTEB 1위.)
2. **2D 투영**: 고차원을 사람이 볼 수 있는 평면으로 누릅니다. 대규모는 **UMAP**, 소규모(현재 9개)는 **MDS+SMACOF**(이 PoC가 사용, 적합도 stress≈0.15로 양호).
3. **군집**: 가까운 점들을 묶어 권역을 찾습니다(**HDBSCAN**, 폴백 k-means).
4. **라벨**: 각 권역의 개념들을 보고 **LLM이 권역 이름**을 짓습니다(Nomic/Apple Atlas 방식).

> PoC는 외부 키 없이 동작하도록 **LLM이 도출한 의미 유사도 행렬 → MDS**로 좌표를 냈습니다.
> 이는 (임베딩→코사인거리→투영)과 **동일한 발상의 소규모판**이며, 수천 개로 커지면 아래 파이프라인이 진짜 임베딩으로 대체합니다.

## 폴더 구조

```
TheoryAtlas/
├─ webmap/index.html        ← 완성된 사상의 지도 (deck.gl, 데이터 내장, 더블클릭 실행)
├─ data/theory_atlas.json   ← 9개 개념 좌표 + 권역 폴리곤 + 의미 엣지
├─ pipeline/
│  ├─ build_theory_map.py   ← 수천 문서 확장용 임베딩 에이전트
│  └─ requirements.txt
└─ README.md
```

## 수천 문서로 확장하기 (자동화 에이전트)

```bash
cd pipeline
pip install -r requirements.txt
export GEMINI_API_KEY="..."            # https://aistudio.google.com/apikey
python build_theory_map.py --src "/내/이론문서/폴더" --out ".."
```

자동으로: Gemini가 개념 추출 → Gemini Embedding으로 벡터화 → UMAP 투영 → HDBSCAN 군집 → LLM이 권역명 부여 → `data/`와 지도 갱신. **새 문서를 넣고 다시 실행하면 지도가 자라납니다.**

## 기술 스택 (최첨단)

| 단계 | 도구 | 비고 |
|---|---|---|
| 개념 추출 | Gemini 2.5 (structured output) | JSON 스키마 보장 |
| 임베딩 | **Gemini Embedding 001** | 2025 MTEB 1위 (대안: Qwen3-Embedding, NV-Embed 오픈소스) |
| 2D 투영 | **UMAP** (소규모는 MDS+SMACOF) | 클러스터 구조 보존 |
| 군집 | **HDBSCAN** | 밀도기반, 군집 수 자동 |
| 권역 라벨 | LLM 라벨링 | Nomic/Apple Embedding Atlas 방식 |
| 시각화 | **deck.gl** (OrthographicView, WebGL) | 수백만 점까지 확장 |

## 배포

`webmap/` 폴더를 정적 호스팅(Vercel/Firebase/Cloudflare Pages)에 올리면 끝입니다. deck.gl·데이터가 모두 클라이언트에서 동작합니다.
