# HANDOFF — MetaTake 지도 프로젝트 (AI 인수인계표)

> **읽는 AI에게**: 이 문서 하나로 지금까지 만든 3개 지도 프로젝트의 **의도·산출물·정확한 파일 경로·기술결정·다음 단계**를 모두 파악할 수 있습니다. 모든 경로는 사용자 컴퓨터의 절대경로입니다. 작업 전 이 문서를 먼저 읽으세요.

작성일: 2026-06-28 · 작성: Cowork 세션 · 사용자: 원우 (channel.wonwoo@gmail.com)

---

## 0. 전체 의도 (왜 만들었나)

MetaTake는 **영화를 공간·사상으로 매핑해 탐색 가능한 웹 지도로 서비스**하려는 프로젝트다. 세 갈래가 있다.

1. **영화 공간 아카이브 → 실제 지도** (지리 좌표): 영화 글/촬영지의 지명을 추출·지오코딩해 Google맵식 지도에 배치하고, 이용자가 지도를 네비게이션하다 특정 지역에서 글/장면을 읽게 한다.
2. **영화 촬영지 DB → 실제 지도** (지리 좌표): 검증된 촬영지 데이터셋을 좌표화해 위성/지도 위에 핀으로 표시, 각 핀에 영화·스크린 역할·주소·신뢰도 표시.
3. **이론·이론가 → 의미 지도** (가상 좌표): 지리 좌표가 없는 이론 개념을 **임베딩**해 2D로 투영, "사상의 지도"로 만들어 탐색·열람한다.

공통 UX 원칙: **지도를 움직이면 화면 안 항목이 좌측 목록에 뜨고, 클릭하면 본문/상세를 읽는다.** 공통 설계 원칙: **데이터(geojson/json)와 표현(지도 프론트)을 분리** → 표시 라이브러리(Google Maps↔MapLibre↔deck.gl)를 데이터 재사용한 채 교체 가능.

---

## 1. 산출물 한눈에 (3개 프로젝트)

| # | 프로젝트 | 무엇 | 지도 진입 파일(더블클릭) | 상태 |
|---|---|---|---|---|
| A | **FilmAtlas** | 영화 6편 공간초록의 지명 45곳 → 지리 지도 | `…/Google map/FilmAtlas/webmap/index.html` | 작동(PoC) |
| B | **MovieLocations** | 촬영지 DB 124곳 → 위성/지도 + 스크린역할 | `…/Google map/MovieLocations/webmap/index.html` | 작동 |
| C | **TheoryAtlas** | 이론 개념 → 임베딩 의미 지도 | `…/theory map/TheoryAtlas/webmap/index.html` (9개 PoC)<br>`…/theory map/Theory_Atlas_1000/webmap/index.html` (999개 실데이터) | 작동 |

`…` = `/Users/jerryje/Documents/MetaTake`

모든 `webmap/index.html`은 **데이터 내장 self-contained** — 더블클릭으로 브라우저에서 바로 열림(설치·API키 불필요, 인터넷만 필요: 지도 타일/CDN 로드용).

---

## 2. 프로젝트 A — FilmAtlas (영화 지명 → 지리 지도)

**의도**: 영화별 "공간초록" 에세이(.md)에서 지명을 추출, 단위(scale)·역할(role) 분류 후 좌표화해 지도에 표시. 핀 클릭 시 3개 perspective 전문을 읽음.

**경로**
```
/Users/jerryje/Documents/MetaTake/Google map/
├─ Biutiful_EN.md, ImportExport_EN.md, ClairesKnee_EN.md,
│  GodfatherPartII_EN.md, MatchFactoryGirl_EN.md, OnceUponATimeInAnatolia_EN.md   ← 원본 에세이 6편
└─ FilmAtlas/
   ├─ webmap/index.html              ← 지도 앱(MapLibre, 위성/지도 토글, 클러스터, 데이터내장)
   ├─ data/places.geojson            ← 지명 45곳(좌표+scale+role+영화ID+발췌)
   ├─ data/articles.json             ← 영화 6편 전문(3 perspective + 출처)
   ├─ pipeline/build_data.py         ← 확장용: .md폴더→Gemini추출+지오코딩→데이터 자동생성
   ├─ pipeline/requirements.txt
   ├─ README.md                      ← 사용/배포/확장 안내
   └─ 영화_지명지도_기술설계.md         ← 상세 기술설계 문서(아키텍처/비용/로드맵)
```

**기술**: 지오파싱(LLM 인식 + 지오코딩) → MapLibre GL JS + OpenFreeMap 타일(무키) + Esri 위성. 좌표는 PoC라 지식기반 부여; 확장은 `build_data.py`가 Gemini+Nominatim/Google Geocoding 사용.

**확장 실행**
```bash
cd "/Users/jerryje/Documents/MetaTake/Google map/FilmAtlas/pipeline"
pip install -r requirements.txt
export GEMINI_API_KEY=...           # 선택: GEOCODER=google GOOGLE_MAPS_KEY=...
python build_data.py --src "…/에세이폴더" --out ".."
```

---

## 3. 프로젝트 B — MovieLocations (촬영지 DB 124곳 → 지리 지도)

**의도**: 사용자가 준 검증 촬영지 데이터셋을 좌표화. **주소 있으면 주소, 없으면 real place 기준**으로 최대한 상세 지점에 핀. 각 핀에 영화·**스크린 속 역할(scene_role)**·영화 속 장소(narrative)·세트여부·확정주소·좌표·정밀도·신뢰도·출처 표시.

**경로**
```
/Users/jerryje/Documents/MetaTake/Google map/
├─ movie_locations_FINAL.json        ← 원본 입력 DB(34편/124곳, 출처·신뢰도 티어 포함)
└─ MovieLocations/
   ├─ webmap/index.html              ← 지도 앱(위성/지도 토글, 클러스터, 정밀도색상, 검색, 스크린역할 표시)
   ├─ data/locations.geojson         ← 124곳 좌표+모든 속성(scene_role/narrative/set_host/precision 등)
   ├─ data/resolved_addresses.csv    ← 확정 주소·좌표 표(기계가공용)
   ├─ 확정주소표.md                   ← 영화별 확정주소·좌표·정밀도(사람용)
   └─ DB_평가.md                      ← 데이터베이스 품질 평가(종합 B+, 개선안)
```

**좌표화 규칙 & 정밀도 등급**: exact(건물/랜드마크) 69 · street(도로명) 7 · set(스튜디오) 3 · area(지역중심) 40 · region(광역) 5. `geocode_basis`=address(103)/real_place(21). **샌드박스 네트워크 차단으로 외부 지오코더 미사용 → 지식기반 좌표.** 건물 단위 100% 정밀화는 Google Geocoding API 재처리 권장.

**재생성**(좌표 테이블은 `build_locations.py`에 인라인; 스크립트는 스크래치 작업본이라 사용자폴더엔 산출물만 있음. 재처리 필요 시 이 핸드오프의 §6 절차 참고).

**알려진 점검 항목**(DB_평가.md 참조): ① 주소 없는 광역항목 45건은 점→폴리곤 권장 ② weak 신뢰 3건(grokipedia/tumblr) 재검증 ③ **Oldboy "Mount Lyford(뉴질랜드)" 오류 의심** — 한국영화에 NZ산, 원출처 재확인.

---

## 4. 프로젝트 C — TheoryAtlas (이론 → 의미 지도)

**의도**: 지리 좌표가 없는 이론·이론가를 **임베딩→2D 투영**해 가상지도에 배치. 가까울수록 의미가 유사. 발견된 "사상 권역"을 영역으로 그리고, 클릭하면 개념 해설을 읽음.

**경로**
```
/Users/jerryje/Documents/MetaTake/theory map/
├─ 2001_A_Space_Odyssey.md, Cleo_from_5_to_7.md, Do_the_Right_Thing.md  ← 원본 이론 브리핑 3편
├─ TheoryAtlas/                         ← (PoC) 9개 개념
│  ├─ webmap/index.html                 ← deck.gl 의미지도(줌/팬, 권역영역, EN/KO토글, 전문패널)
│  ├─ data/theory_atlas.json            ← 9노드+3권역+엣지
│  ├─ pipeline/build_theory_map.py      ← ★생산 파이프라인: Gemini임베딩→UMAP→HDBSCAN→LLM라벨
│  ├─ pipeline/requirements.txt
│  ├─ README.md
│  └─ 사상의지도_기술설계.md              ← 의미 카토그래피 설계문서
└─ Theory_Atlas_1000/                   ← (실데이터 스케일 테스트) 999개 개념
   ├─ webmap/index.html                 ← deck.gl 의미지도(검색, 13도메인 필터, 라벨)
   ├─ data/theory_atlas.json            ← 999노드+13도메인
   ├─ pipeline/build_scale.py           ← CSV→TF-IDF→LSA→MDS (무키 실행, 이 테스트 재현용)
   ├─ pipeline/make_scale_site.py       ← 지도 HTML 생성
   └─ 결과_README.md                     ← 스케일 테스트 결과/지표 해설
```

**실데이터 소스**: `/Users/jerryje/Documents/MetaTake/theory-db-project/Theory_Concepts_canonical.csv` (7,110개 개념; concept/native/one_liner/part/major/sub/theorists). Theory_Atlas_1000은 여기서 999개 층화표본.

**핵심 결과(검증)**: LSA 80차원에서 **kNN purity 0.727**(무작위 0.127) → 임베딩이 의미를 포착함을 정량 입증. 2D 투영 후 0.369(80→2차원 평탄화 손실). **PoC는 무키용 TF-IDF/LSA**; 생산은 `build_theory_map.py`로 **Gemini Embedding 001 + UMAP**로 교체(동일 JSON 스키마).

**확장 실행**
```bash
cd "/Users/jerryje/Documents/MetaTake/theory map/TheoryAtlas/pipeline"
pip install -r requirements.txt
export GEMINI_API_KEY=...
python build_theory_map.py --src "…/이론문서폴더" --out ".."
# 또는 무키 스케일 테스트:
cd "/Users/jerryje/Documents/MetaTake/theory map/Theory_Atlas_1000/pipeline"
SRC_CSV="…/Theory_Concepts_canonical.csv" OUT_DIR=".." N=2000 python3 build_scale.py
OUT_DIR=".." python3 make_scale_site.py
```

---

## 5. 공통 기술 스택 & 핵심 설계 결정 (반드시 숙지)

- **지도 표시**: 지리 지도 = MapLibre GL JS(오픈소스) + **OpenFreeMap** 벡터타일(무키) + **Esri World Imagery** 위성(무키). 의미 지도 = **deck.gl** OrthographicView(WebGL, 비지리, CARTESIAN 좌표계).
- **데이터/표현 분리**: 모든 지도는 `data/*.json|geojson` + `webmap/index.html`(데이터 내장본). 확장 시 fetch 방식으로 전환 가능. Google Maps JS API로 교체 시 데이터 재사용.
- **API 키 미사용**: 이 세션 샌드박스는 외부 네트워크/모델다운로드 차단. 그래서 (a) 지명/촬영지 좌표는 **LLM 지식기반 부여**, (b) 이론 임베딩은 **TF-IDF/LSA(순수 numpy)**. **생산 전환 시** Gemini(추출·임베딩), Google/Nominatim(지오코딩), UMAP/HDBSCAN으로 교체 — 해당 코드는 각 `pipeline/`에 이미 작성됨.
- **임베딩 권장 모델**: Gemini Embedding 001(2025 MTEB 1위). 투영=UMAP, 군집=HDBSCAN, 라벨=LLM.
- **배포**: 모든 `webmap/`는 정적. Vercel/Firebase/Cloudflare Pages에 폴더 업로드로 배포 가능. (사용자는 Vercel 호스팅 보유.)

---

## 6. 원본 데이터 소스 (입력) 경로

| 데이터 | 경로 | 내용 |
|---|---|---|
| 촬영지 DB | `/Users/jerryje/Documents/MetaTake/Google map/movie_locations_FINAL.json` | 34편/124곳, 출처·신뢰도 티어 |
| 이론 개념 DB | `/Users/jerryje/Documents/MetaTake/theory-db-project/Theory_Concepts_canonical.csv` | 7,110개 개념 |
| 이론가 마스터 | `/Users/jerryje/Documents/MetaTake/theory-db-project/Theorist_Master_통합.csv` | 591명 |
| 이론가-개념 링크 | `/Users/jerryje/Documents/MetaTake/theory-db-project/Theorist_Concepts_link.csv` | 8,059 링크 |
| 영화 확장목록 | `/Users/jerryje/Documents/MetaTake/metatake_films_expansion_1000.csv` | 1,000편 |
| 영화 공간초록 | `/Users/jerryje/Documents/MetaTake/Google map/*_EN.md` (6편) | FilmAtlas 입력 |
| 이론 브리핑 | `/Users/jerryje/Documents/MetaTake/theory map/*.md` (3편) | TheoryAtlas 입력 |

---

## 7. 미해결 과제 / 다음 단계 (우선순위)

1. **실 임베딩/지오코딩 전환**: Gemini·Google API 키로 (A)촬영지 건물단위 정밀 지오코딩, (C)전체 7,110개 신경망 임베딩. 코드는 준비됨, 키만 필요.
2. **MovieLocations 보강**: weak 3건 재검증, Oldboy 항목 오류 확인, 광역 45건 폴리곤화, 좌표를 원본 JSON에 영구 병합.
3. **콘텐츠 연동(미구현, 사용자 요청 보류)**: 좌측 패널을 사용자 Vercel 서버로 연결(`link`/`image` 필드 추가, iframe 또는 새탭). **광고는 같은 도메인 호스팅 권장.**
4. **TheoryAtlas 고도화**: 자연어 검색, 계보(영향관계) 엣지, 다중 렌즈(전통/시대별 재투영).
5. **배포**: 각 webmap을 Vercel에 올려 공개 URL화.

---

## 8. 주의/정리 사항

- **중복 폴더**: `/Users/jerryje/Documents/MetaTake/Google map/TheoryAtlas/`는 초기 빌드 시 잘못 생성된 **9노드 사본**(시스템 권한으로 삭제 실패). **정본은 `theory map/TheoryAtlas/`**. Google map 쪽 TheoryAtlas는 무시/삭제 권장.
- `webmap/index.html`은 데이터 내장본이라 용량이 큼(예: Theory_Atlas_1000은 ~510KB). 데이터 갱신은 각 `pipeline/make_*site.py`가 HTML 내 `const ATLAS=…`/`const DATA=…`를 정규식 치환.
- 지도는 인터넷 연결 시에만 배경 타일/CDN(deck.gl, MapLibre)이 로드됨. 핀·글 데이터는 오프라인에서도 내장.
