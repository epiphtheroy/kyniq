# 🎬 Film Spatial Atlas

영화 공간초록(spatial abstract) 글에서 **지명을 추출 → 지도에 배치 → 탐색하며 읽는** 웹 서비스.
현재 6편(Biutiful, Import/Export, Claire's Knee, The Godfather Part II, The Match Factory Girl, Once Upon a Time in Anatolia)으로 **실제 작동**합니다.

## 지금 바로 보기

`webmap/index.html` 파일을 **더블클릭**하세요. 브라우저에서 바로 열립니다(별도 설치·키 불필요).

- 지도를 움직이면 → 우측 패널에 **그 화면 안의 장소·영화 글**이 제목+발췌로 나타납니다.
- 핀 또는 카드를 클릭 → 말풍선/패널에서 **전체 글(3개 perspective)** 을 읽습니다.
- 핀 색상 = 장소 유형: 🔵배경 🟠제작·촬영지 🟣영화제 ⚪상징/부재. 상단 칩으로 켜고 끌 수 있습니다.
- 멀리서 보면 지점이 **클러스터(숫자 원)** 로 묶이고, 줌인하면 풀립니다 → 수천 핀도 끄떡없는 구조.

> 지도 타일은 키가 필요 없는 오픈소스(OpenFreeMap), 지도 엔진은 MapLibre GL JS(오픈소스)입니다.
> 인터넷 연결이 있어야 지도 배경이 보입니다(글·핀 데이터는 파일에 내장).

## 폴더 구조

```
FilmAtlas/
├─ webmap/index.html      ← 완성된 지도 앱 (데이터 내장, 더블클릭 실행)
├─ data/
│  ├─ places.geojson      ← 45개 장소(좌표+메타)
│  └─ articles.json       ← 6편 원문(3 perspective + 출처)
├─ pipeline/
│  ├─ build_data.py       ← 수천 편 확장용 자동화 에이전트
│  ├─ requirements.txt
│  └─ geocode_cache.json  ← (실행 시 생성) 지명→좌표 캐시
└─ README.md
```

## 수천 편으로 확장하기 (자동화)

영화 글 .md 파일들을 한 폴더에 모아두고:

```bash
cd pipeline
pip install -r requirements.txt
export GEMINI_API_KEY="..."          # https://aistudio.google.com/apikey (무료 등급 존재)
python build_data.py --src "/내/영화글/폴더" --out ".."
```

그러면 자동으로:
1. **Gemini 2.5** 가 글마다 지명을 추출하고 단위(scale)·역할(role)을 분류 (지오파싱 인식 단계)
2. **지오코딩**으로 좌표를 부여 — 기본은 무료 **Nominatim(OSM)**, 캐시로 중복 호출 제거 (해소 단계)
3. `data/`와 `webmap/index.html`을 갱신

> 더 정확한 좌표가 필요하면 Google Geocoding API로 전환:
> `export GEOCODER=google GOOGLE_MAPS_KEY="..."` (월 1만 건 무료, 캐시 적용 시 충분).

새 영화 글을 폴더에 추가하고 다시 실행하면 지도가 갱신됩니다 — **중간 개입이 필요 없는 1-커맨드 파이프라인**입니다.

## 인터넷에 공개하기 (배포)

`webmap/` 폴더를 정적 호스팅에 올리면 끝입니다(HTTPS·CDN 자동):

```bash
# 예: Firebase Hosting
npm i -g firebase-tools
firebase init hosting      # public 폴더로 webmap 지정
firebase deploy
```

또는 Cloudflare Pages / GitHub Pages / Netlify에 `webmap` 폴더를 드래그·연결해도 됩니다.

## 다음 단계 옵션

- **데이터 분리 로딩**: 수천 편이 되면 데이터를 HTML에 내장하는 대신 `places.geojson`을 fetch하도록 전환(작은 코드 변경). 그때는 로컬에서 `python -m http.server` 로 띄우거나 호스팅에서 바로 동작.
- **Google Maps JS API로 표시 전환**: 데이터(geojson/articles)는 그대로 두고 표시 레이어만 교체 가능 — 설계 문서의 "데이터/표현 분리" 원칙 덕분.
- **영화별 색상/포스터 썸네일, 검색·필터 고도화, 모바일 레이아웃** 추가.
