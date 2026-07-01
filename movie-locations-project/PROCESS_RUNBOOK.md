# 공정 런북 — 영화 촬영지 조사 파이프라인

영화 제목 리스트를 큐로 넣으면 자동으로 사실 데이터셋이 나오도록 정리한 운영 문서.
법적 안전(다중출처 종합·보호DB 격리)과 신뢰도(다중검증)를 동시에 만족합니다.

---

## 0. 전제 / 입력
- 입력: **영화 제목 한 줄씩** 적은 텍스트 파일(`titles.txt`). `#`는 주석.
  예) `Parasite (2019)` / `Heat 1995` / `Skyfall`
- 출력: `dataset.json`, `dataset.xlsx` (등급·출처·세트호스트 포함).
- 처리 단위: **영화 1편 = 1 작업**. 큐 실행기가 순차 처리 + 중단 시 재개.

## 1. 파이프라인 (영화 1편당 8단계)
1. **SEARCH** — 다각도 검색 3종: `촬영지 목록` / `set vs filmed` / `real place or set?`.
2. **GENERATE(LLM)** — 후보 촬영지 추출. 규칙: 출처 URL 필수, 원문 미복제(리프레이즈),
   `narrative_setting`(영화 속 장소) ↔ 실제 촬영지 분리, `built_set`(세트/CGI) 판정,
   세트면 `set_host`(스튜디오/위치) 기입.
3. **VERIFY(LLM, 배치 1콜)** — 적대적 반증: "세트 아니냐 / 배경지 아니냐 / 다른 영화 아니냐".
4. **JUDGE(등급)** — 출처 권위 티어(A 위키·IMDb·주요언론·공식 / B 편집형 블로그 / C 무명 /
   X 보호DB) + 개연성(지오코딩·제작국 일치) + **비대칭 법적 규칙**.
5. **RECOVERY** — `weak`/`quarantined_legal` 항목에 2차 타깃 검색으로 독립출처 보강 후 재판정.
6. **GEOCODE(선택)** — 주소 → 좌표(Nominatim 무료, 1req/s). 지역 불일치 시 강등.
7. **GRADE 분리** — `verified`·`verified_set_not_real`·`probable`=배포 / `weak`=검토 / `quarantined_legal`=격리.
8. **WRITE** — 증분 저장(jsonl) + 통합 JSON/Excel. 체크포인트로 재개 가능.

**판정 규칙 요약**
| 조건 | 등급 | 처리 |
|---|---|---|
| 독립 출처 ≥2 | verified | 배포 |
| 권위(Tier A) 단일출처 + 개연성 | probable | 배포 |
| 저권위(B/C) 단일출처 | weak | 검토 버킷 |
| **유일 출처가 보호DB(movie-locations 등)** | quarantined_legal | **격리(미배포)** |

## 2. 모델 선택 (2026-06 실가격 기준)
추출·검증은 가벼운 작업이라 **저가 모델로 충분**합니다. 권장 순:
1. **gpt-4o-mini** ($0.15/$0.60 per 1M) — 품질·가격 균형, 기본값 권장.
2. **gemini-2.5-flash-lite** ($0.10/$0.40) — 최저가. 살짝 약하지만 이 작업엔 무방.
3. (반증 패스만 더 똑똑하게: gpt-5-mini / gemini-2.5-flash로 교체 가능 — 비용 소폭↑)

배치 API(반값)·프롬프트 캐싱을 쓰면 LLM비를 더 낮출 수 있음.

## 3. 영화별 비용 (추정)
가정: 영화당 LLM ≈ 입력 8k / 출력 2k 토큰, 검색 ≈ 5콜(gather 3 + recovery 2).

| 모델 | LLM/편 | 검색/편 | **합계/편** | 1,000편 | 10,000편 |
|---|---|---|---|---|---|
| gpt-4o-mini | $0.0024 | $0.040 | **$0.042** | $42 | $424 |
| gemini-2.5-flash-lite | $0.0016 | $0.040 | **$0.042** | $42 | $416 |
| gpt-5-mini | $0.0060 | $0.040 | **$0.046** | $46 | $460 |
| claude-haiku-4-5 | $0.0180 | $0.040 | **$0.058** | $58 | $580 |

**핵심: 비용은 LLM이 아니라 검색이 좌우합니다**(영화당 ~$0.04 중 95%가 검색).
- Tavily 무료 1,000크레딧/월 = **약 200편/월 무료**.
- 검색비 절감: 검색 콜 수↓(gather 2종으로), 캐싱, 또는 더 싼 검색 provider.

## 4. 처리량 / 안정성
- 속도 제약은 보통 **검색 API rate limit**. 영화당 ~10–20초(검색 지연 포함) 예상.
- 1,000편 ≈ 수 시간. 야간 배치 권장.
- **재개 가능**: `done.txt` 체크포인트로 중단 후 같은 명령 재실행 시 이어서 처리.
- 실패 항목은 건너뛰고 로그에 기록 → 나중에 재시도.

## 5. 품질·법적 가드레일 (항상 켜둘 것)
- 출처 URL을 **항상 기록**(독립 도출의 증거 = 최강의 항변).
- 보호DB 단독은 **격리 유지**(절대 배포 큐로 내보내지 않기).
- 서술 표현 **리프레이즈 강제**, 사진·지도·원문 문장 **재배포 금지**.
- 정기 **표본 감사**(배포분의 5–10% 사람 점검)로 정밀도 모니터.

## 6. 실제 실행
```bash
pip install requests openpyxl openai
export LLM_API_KEY=...   SEARCH_API_KEY=...   SEARCH_PROVIDER=tavily
export LLM_MODEL=gpt-4o-mini        # 또는 gemini-2.5-flash-lite
# (선택) export GEOCODE=1

# 큐 실행 (titles.txt = 당신이 정리한 영화 리스트)
python run_queue.py --titles-file titles.txt --out-dir run1 --min-sources 2

# 중단되면 같은 명령 재실행 → 이어서 처리
# 결과: run1/dataset.json , run1/dataset.xlsx (+ results.jsonl, done.txt, 비용 로그)
```

## 7. 파일 구성
- `run_queue.py` — 큐 실행기(체크포인트·증분저장·비용추정).
- `movie_locations_llmsearch.py` — 에이전트(검색→추출→반증→티어→복구).
- `dataset.json` / `.xlsx` — 산출 데이터셋.
- (참고) `movie_locations_crawler.py` — movie-locations.com + Wikidata 커넥터판.

(가격은 2026-06 조사치이며 자주 바뀝니다. 청구 전 공식 페이지로 재확인하세요.
 법률 정보는 일반 설명이며 상업화 전 전문가 검토 권장.)
