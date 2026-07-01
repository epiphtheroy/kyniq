# movie-locations.com 사실 추출 — 테스트 결과 (10편)

## 무엇을 했나
영화별 **객관적 사실만** 추출했습니다. 저작권 보호 대상인 서술형 설명 문단은 복사하지 않았습니다.

추출 항목:
- 영화명 · 제작연도 · 감독 · 출연진 · 촬영 지역
- 촬영지별: **장면(역할) + 장소명 + 주소 + 지역 + 현황(영업/폐업/철거 등)**

테스트 대상 10편: Heat, The Godfather, Jaws, Gladiator, The Matrix, Vertigo, Fight Club, Die Hard, Taxi Driver, Pretty Woman
→ 총 **127개 촬영지** 추출.

## 합법성 근거
- `robots.txt`에 크롤 금지(Disallow) 규칙 없음 (Sitemap 지시문만 존재) → 크롤 허용.
- **사실관계(facts)는 저작권 대상이 아님.** "어떤 영화가 어디서 촬영됐다"는 사실·주소·장소명만 추출하고, 사이트 운영자가 작성한 창작적 서술 문장은 제외했습니다.
- 크롤러는 요청 간 지연(rate limit)·robots 준수·식별 가능한 User-Agent를 적용해 서버에 부담을 주지 않습니다.

## 결과물
| 파일 | 설명 |
|---|---|
| `movie_locations.xlsx` | 사람이 보기 좋은 스프레드시트. 시트1=영화 요약, 시트2=촬영지 127행 (필터 적용) |
| `movie_locations.json` | 프로그램 처리용 구조화 데이터 |
| `movie_locations_crawler.py` | 재사용 크롤러(에이전트). 직접 실행해 더 많은 영화로 확장 가능 |

## 크롤러 사용법 (본인 컴퓨터에서)
```bash
pip install requests beautifulsoup4 openpyxl

# 1) 기본 유명작 10편
python movie_locations_crawler.py

# 2) 특정 글자(예: h)의 영화 자동 수집, 최대 20개
python movie_locations_crawler.py --letter h --limit 20

# 3) URL 직접 지정 / 지연·출력명 조정
python movie_locations_crawler.py --urls <url1> <url2> --delay 3 --out my_result
```
실행하면 `<out>.json` 과 `<out>.xlsx` 가 자동 생성됩니다 — 추가 수작업이 필요 없습니다.

## 참고
- `movie_locations.json`/`.xlsx`의 테스트 데이터는 정확도를 위해 주소·현황을 정밀 검수한 버전입니다.
- 크롤러를 대규모로 돌릴 때는 `--delay`를 충분히(2초 이상) 두는 것을 권장합니다.

출처: https://movie-locations.com/ — The Worldwide Guide To Movie Locations
