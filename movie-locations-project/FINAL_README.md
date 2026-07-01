# 영화 촬영지 데이터셋 — 최종본

LLM + 웹검색으로 여러 독립 출처에서 **사실만** 종합하고, 출처 신뢰도로 등급을 매겨
배포 여부를 자동 판정하는 에이전트와 그 실행 결과입니다.

## 최종 결과 (34편 / 124 촬영지)
| 등급 | 건수 | 의미 |
|---|---|---|
| verified | 106 | 독립 출처 2곳 이상 |
| verified_set_not_real | 11 | 검증됨 + '실제 장소 아닌 세트'로 표시 |
| probable | 4 | 권위 단일출처(위키/IMDb 등) + 개연성 통과 → 배포 |
| weak | 3 | 저권위 단일출처 → 검토 버킷(미배포) |
| quarantined_legal | 0 | (1건 발생 → 복구검색으로 독립출처 찾아 verified 승급) |

**배포 가능 121 / 검토 3 / 격리 0.** 다양성: 22개국, 시대 1953~2021,
유명작 28 + obscure 6(저커버리지 스트레스 테스트).

## 왜 이 방식인가 (합법성)
- 크롤 가능 여부(robots.txt)와 재사용 가능 여부(저작권·데이터베이스권)는 별개입니다.
- 단일 사이트를 긁지 않고 **여러 독립 출처에서 사실을 종합**하므로, 특정 데이터베이스의
  '선택·배열을 상당 부분 추출'했다는 파생 인과가 끊깁니다.
- 서술형 표현은 100% 리프레이즈(원문 미복제) → 텍스트 저작권 회피.
- **비대칭 규칙**: 어떤 항목의 유일 출처가 *보호 DB*(movie-locations.com 등)면
  `quarantined_legal`로 격리(미배포). 이게 데이터베이스권 리스크를 정확히 차단합니다.

## 에이전트 파이프라인 (`movie_locations_llmsearch.py`)
1. **SEARCH** — 영화별 다각도 검색(촬영지 / set-vs-filmed / "real or set?").
2. **GENERATE** — LLM이 후보 추출. 각 항목에 출처 URL 필수, `narrative_setting`(영화 속
   장소)와 실제 촬영지 분리, `built_set`(세트/CGI) 판정.
3. **VERIFY** — 적대적 반증 패스("세트 아니냐 / 배경지 아니냐 / 다른 영화 아니냐").
4. **JUDGE(등급)** — 출처 권위 티어(A 위키·IMDb·주요언론·공식 / B 편집형 블로그 /
   C 무명 / X 보호DB) + 개연성(지오코딩·제작국 일치) + 비대칭 법적 규칙으로
   verified/probable/weak/quarantined_legal 판정.
5. **RECOVERY** — 단일/약함/격리 항목은 2차 타깃 검색으로 독립출처 보강 후 재판정.
   (실제로 격리됐던 The Long Good Friday의 Waterman's Arms가 이 단계에서 verified 복구됨.)
6. **OUTPUT** — 배포 대상(verified·probable)과 검토/격리 버킷을 분리해 JSON+Excel.

## 신뢰도와 법적 안전의 정렬
정밀도를 높이려 다중출처를 요구하면, 떨어져 나가는 건 '한 곳만 아는 obscure 항목'
= 법적으로 위험한 단일출처 항목입니다. **신뢰도를 올리는 행동이 곧 법적 안전을 높입니다.**
그리고 single_source를 무작정 버리지 않고 권위로 차등(probable로 구제)하므로 아깝지 않습니다.

## 산출물
- `movie_locations_FINAL.xlsx` / `.json` — 최종 통합 데이터셋(등급·세트호스트·출처 포함, 색상 구분).
- `movie_locations_llmsearch.py` — 재사용 에이전트(검색 provider + LLM + 반증 + 티어 + 복구).
- `LLMSEARCH_NOTES.md` — 설계·반복(round1/2) 기록.
- 참고: `movie_locations_crawler.py`(movie-locations.com + Wikidata 커넥터판)도 함께 보관.

## 실행
```bash
pip install requests beautifulsoup4 openpyxl openai
export LLM_API_KEY=...  SEARCH_API_KEY=...  SEARCH_PROVIDER=tavily   # 선택 GEOCODE=1
python movie_locations_llmsearch.py --titles "Parasite (2019)" "Skyfall" "Inception" --min-sources 2
```

(법률 정보는 일반 설명이며, 상업화 전에는 관할 국가의 전문가 검토를 권합니다.)
