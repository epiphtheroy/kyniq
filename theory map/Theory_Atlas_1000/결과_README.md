# 🧭 Theory Atlas · 999 — 실제 데이터 스케일 테스트 결과

여러분의 실제 이론 DB(`MetaTake/theory-db-project/Theory_Concepts_canonical.csv`, **7,110개 개념**)에서 **999개를 층화표본**으로 뽑아 의미 지도를 만든 결과입니다.

## 지금 보기
`webmap/index.html` 더블클릭 → 999개 개념이 의미공간에 배치된 지도. 드래그/휠로 탐색, 좌측 **검색창**으로 개념·이론가 찾기, 도메인 칩으로 필터, 점 클릭 시 개념 열람.

## 무엇을 실제로 했나
1. **추출**: CSV에서 개념·한줄정의·이론가·도메인 계층(part/major/sub)을 읽어 999개 표본(13개 학문 도메인 비례).
2. **벡터화**: 각 개념 텍스트 → TF-IDF (vocab 2,020).
3. **의미 임베딩**: 그람행렬 고유분해로 **LSA(잠재의미분석) 80차원**.
4. **2D 투영**: 코사인거리 → 고전 MDS + SMACOF → kNN 그래프 평활화.
5. **시각화**: deck.gl(WebGL) 산점도 + 도메인 색상 + 검색/필터/열람.
6. 전체 처리 시간 **약 1.8초** (순수 numpy, 외부 키·네트워크 0).

## 핵심 결과 — "임베딩이 의미를 잡았는가?"
정량 지표 **kNN purity**(어떤 개념의 최근접 이웃 10개 중 같은 도메인 비율):

| 공간 | kNN purity | 의미 |
|---|---|---|
| **LSA 80차원 임베딩** | **0.727** | 이웃의 73%가 같은 도메인 — 의미를 강하게 포착 |
| 2D 투영 후 | 0.369 | 80→2차원 평탄화에서 구조 일부 손실(정상) |
| 무작위 기대치 | 0.127 | 비교 기준선 |

→ **0.727 vs 0.127**: 임베딩이 우연의 5.7배로 의미적 군집을 형성. 가설("이론도 임베딩하면 가상지도에 배치된다")이 실제 1,000개 규모에서 **검증**되었습니다. 2D에서 0.369로 떨어지는 부분이 바로 생산 단계에서 **UMAP**(국소구조 보존 우수)과 **Gemini 임베딩**(신경망, 동의어·다국어까지 포착)을 쓰는 이유입니다.

## 이 PoC vs 생산 파이프라인
| 단계 | 이 테스트(무키·즉시) | 생산(권장) |
|---|---|---|
| 임베딩 | TF-IDF + LSA (numpy) | **Gemini Embedding 001** (2025 MTEB 1위) |
| 2D 투영 | MDS + SMACOF | **UMAP** |
| 군집/라벨 | 도메인(part) 기준 색칠 | HDBSCAN + LLM 권역 라벨 |

생산 전환은 `../TheoryAtlas/pipeline/build_theory_map.py`에 이미 구현돼 있습니다(키만 넣으면 동일 스키마로 7,110개 전체에 확장 가능).

## 폴더
```
Theory_Atlas_1000/
├─ webmap/index.html        ← 999개 개념 지도(데이터 내장, 더블클릭)
├─ data/theory_atlas.json   ← 999 노드 + 13 도메인 + 엣지
└─ pipeline/
   ├─ build_scale.py        ← CSV→임베딩→좌표 (이 테스트 재현용)
   └─ make_scale_site.py    ← 지도 HTML 생성
```

## 재현 / 개수 바꾸기
```bash
cd pipeline
SRC_CSV="…/Theory_Concepts_canonical.csv" \
OUT_DIR=".." N=2000 python3 build_scale.py   # N으로 표본 수 조절(전체 7110까지)
OUT_DIR=".." python3 make_scale_site.py
```
