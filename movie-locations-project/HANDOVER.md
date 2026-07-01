# 인수인계 문서 (HANDOVER) — 영화 촬영지 사실 데이터셋 프로젝트

> 이 문서 하나로 다른 AI/개발자가 프로젝트의 **의도·결정·파일·프롬프트·비용·미해결과제**를
> 한눈에 파악하도록 작성. 위치: `/Users/jerryje/Documents/MetaTake/movie-locations-project/`.
> 폴더 구조: **루트 = 현행(ACTIVE)**, `history/` = 과거 1·2세대, `run_examples/` = 3세대 중간 실행결과.
> 작성일 2026-06-28.

---

## 1. 한 줄 요약
영화별 **실제 촬영지(사실 데이터)**를 모아 구조화 데이터셋을 만든다. 단, **합법적으로** —
한 사이트를 통째로 긁지 않고 **여러 독립 출처에서 사실만 종합**하고, 출처 신뢰도로 **등급(tier)**을
매겨 배포 여부를 자동 판정한다.

## 2. 무엇을 / 왜 하려 했나 (의도)
- 목표: "어떤 영화가 어디서 촬영됐다"를 **영화명·연도·감독·출연·지역·촬영지(장소/주소/장면역할/
  세트여부/좌표)** 로 정규화한 데이터셋. 셋제팅(촬영지 관광)·검색 서비스의 기반 데이터.
- 출발점: 사용자가 `movie-locations.com`을 크롤하려 했음(robots.txt 허용). 그러나 **저작권/
  데이터베이스권** 우려가 제기됨.
- 그래서 프로젝트의 진짜 주제는 **"법적으로 안전하게 사실을 모으는 방법론"** 으로 진화함.

## 3. 핵심 의사결정의 변천사 (반드시 읽을 것)
프로젝트는 3세대를 거쳤다. 최종은 **3세대**다.

**1세대 — movie-locations.com 단일 크롤 (폐기)**
- 사실만 추출 + 서술 리프레이즈 → 텍스트 저작권은 회피.
- 그러나 *그 사이트의 선택·배열을 그대로 복제*하는 문제(데이터베이스권) 잔존.
- 산출: `movie_locations.json/.xlsx`(10편), `movie_locations_crawler.py`.

**2세대 — 멀티소스(movie-locations + Wikidata CC0) (보강책)**
- Wikidata P915(CC0) 커넥터 추가, 제목 기준 병합 + 중복제거, 출처 태깅.
- 한계: Wikidata는 고전·유명작 커버리지가 희박 → 결국 데이터의 대부분이 여전히
  movie-locations.com에서 옴 → 우려 미해소.

**3세대 — LLM + 웹검색, 다중출처 + 티어 판정 (최종 채택) ★**
- 특정 사이트를 긁지 않고 **웹을 검색해 여러 독립 출처에서 사실을 종합**.
- 단일 DB 의존(파생 인과)이 끊겨 **법적으로 가장 깨끗**, 다중검증으로 **신뢰도 확보**.
- single_source는 버리지 않고 **출처 권위로 차등**(아깝지 않게 구제). 위험한 "보호DB 단독"만 격리.
- 이게 현재의 정답. 에이전트 = `movie_locations_llmsearch.py`, 운영 = `run_queue.py`.

## 4. 법적 결론 (요지)
- **사실은 비저작물** — 어디서 찍혔다는 건 누구의 것도 아님.
- **표현 미복제** — 서술 100% 리프레이즈(원문 문장 금지).
- **다중출처 종합** — 한 DB의 "상당 부분 추출 + 그 사이트에서 파생" 인과를 끊음(데이터베이스권 방어).
- **비대칭 격리 규칙** — 어떤 항목의 유일 출처가 보호DB(movie-locations.com/atlasofwonders)면
  배포에서 제외(`quarantined_legal`). 그의 고유 연구만 정확히 회피.
- **출처 URL 기록**이 "독립 도출"의 적극적 증거 = 최강 항변.
- 결론: 운영자가 실질적으로 주장할 근거는 거의 없음. (변호사 아님 — 상업화 전 전문가 검토 권장.)
- 더 깨끗이 하려면: 공개 인용 목록에서 movie-locations.com을 빼고 *교차검증 용도로만 비공개* 사용.

## 5. 시스템 아키텍처 — 에이전트 파이프라인 (영화 1편 = 1 작업)
`movie_locations_llmsearch.py` 안에 전부 구현됨. 8단계:

1. **SEARCH** `gather_evidence()` — 검색 3종: `촬영지 목록` / `set vs filmed` / `real place or set?`.
2. **GENERATE (LLM)** `generate()` — 후보 추출. 인용 URL 필수, 원문 미복제, set/filmed 분리, 세트 판정.
3. **VERIFY (LLM)** `verify_candidate()` — 적대적 반증(세트/배경지/타영화 오인 체크).
4. **JUDGE** `judge()` — 출처 권위 티어 + 개연성 + 비대칭 규칙으로 등급화.
5. **RECOVERY** `recovery_search()` — weak/격리 항목에 2차 타깃검색 → 독립출처 보강 후 재판정.
6. **GEOCODE(선택)** `geocode_ok()` — Nominatim(무료, 1req/s). 지역 불일치 강등.
7. **GRADE 분리** — 배포(verified/probable) vs 검토(weak) vs 격리(quarantined_legal).
8. **WRITE** `write_outputs()` — JSON + Excel.

### 출처 권위 티어
- **A**(단일이라도 probable 가능): wikipedia, imdb, 주요언론(cnn/bbc/npr/variety/guardian/nyt),
  공식 관광/스튜디오, `.gov/.gov.uk/.go.kr/.or.kr`.
- **B**(단일이면 weak): 편집형 촬영지 블로그(giggster, screenrant, almostginger 등).
- **C**(무명/SNS/AI위키 예: grokipedia) → weak.
- **X**(보호DB: movie-locations.com, atlasofwonders) → 단독이면 격리.

### 판정 규칙
| 조건 | 등급 | 처리 |
|---|---|---|
| 독립출처 ≥2 | verified | 배포 |
| 권위(A) 단일출처 + 개연성 | probable | 배포 |
| 저권위(B/C) 단일출처 | weak | 검토 버킷 |
| 유일 출처가 보호DB | quarantined_legal | 격리 |
| 세트/CGI로 확인 | verified_set_not_real | 배포(+set_host 태그) |

## 6. 프롬프트 (그대로 옮김 — 수정 시 여기 기준)

**추출(GEN_PROMPT) 핵심 규칙**
- 증거에 근거한 사실만. 각 항목 `sources`(URL) 필수, 못 대면 드롭.
- `narrative_setting`(영화 속 장소) ↔ `real_name/filming_area/country`(실제) 분리.
- `built_set`=세트/CGI/백롯이면 true(실제 방문지 아님). 유명 저택이 실은 세트인 함정 주의.
- 서술 문장 복제 금지, `scene_role`은 자체 표현으로 짧게. 고유명사(장소/주소)는 정확히.
- `granularity` ∈ address/venue/area/region/set.

**반증(VERIFY_PROMPT) 핵심**
- 제공된 근거만으로 후보를 *반증 시도*: 세트/CGI 아니냐? 배경지(set)를 촬영지로 착각 아니냐?
  다른 영화/동명 장소 혼동 아니냐? → `{keep, built_set, reason}` 반환.

> 전체 원문은 `movie_locations_llmsearch.py`의 `GEN_PROMPT`, `VERIFY_PROMPT` 상수 참조.

## 7. 모델 & 비용 (2026-06 조사치)
추출·검증은 가벼운 작업 → **저가 모델로 충분**.
- 권장 기본: **gpt-4o-mini** ($0.15/$0.60 per 1M). 최저가: **gemini-2.5-flash-lite** ($0.10/$0.40).
- 반증만 더 똑똑하게: gpt-5-mini ($0.25/$2.00).

**영화당 비용** (가정: LLM 입력 8k/출력 2k 토큰, 검색 5콜):
| 모델 | LLM/편 | 검색/편 | 합계/편 | 1,000편 | 10,000편 |
|---|---|---|---|---|---|
| gpt-4o-mini | $0.0024 | $0.040 | **$0.042** | $42 | $424 |
| gemini-2.5-flash-lite | $0.0016 | $0.040 | **$0.042** | $42 | $416 |
| claude-haiku-4-5 | $0.018 | $0.040 | $0.058 | $58 | $580 |

- **비용은 검색이 95%, LLM은 ~5%.** 모델 교체보다 **검색 콜 수 줄이기/캐싱**이 절감에 효과적.
- Tavily 무료 1,000크레딧/월 = **약 200편/월 무료**(basic 1크레딧=$0.008).
- 가격은 자주 바뀜 → 청구 전 공식 페이지 재확인. (`run_queue.py`의 `PRICES` 갱신.)

## 8. 실행 방법 (조사 바로 투입)
```bash
cd /Users/jerryje/Documents/MetaTake/movie-locations-project
pip install requests beautifulsoup4 openpyxl openai
export LLM_API_KEY=...   SEARCH_API_KEY=...   SEARCH_PROVIDER=tavily
export LLM_MODEL=gpt-4o-mini       # 또는 gemini-2.5-flash-lite
# (선택) export GEOCODE=1

# titles.txt = 영화 제목 한 줄씩 (사용자가 별도 정리한 리스트)
python run_queue.py --titles-file titles.txt --out-dir run1 --min-sources 2
# 중단 시 같은 명령 재실행 → done.txt 체크포인트로 이어서 처리
# 결과: run1/dataset.json , run1/dataset.xlsx
```

## 9. 파일 인벤토리 (`/Users/jerryje/Documents/MetaTake/` 하위)

### ★ 현재 사용(3세대, ACTIVE)
| 파일 | 용도 |
|---|---|
| `movie_locations_llmsearch.py` | **메인 에이전트**(검색→추출→반증→티어→복구). 프롬프트·티어·judge 포함. |
| `run_queue.py` | **큐 실행기**: titles.txt → 순차처리, 체크포인트 재개, 비용추정, 통합 출력. |
| `PROCESS_RUNBOOK.md` | 운영 런북(공정·비용·모델·명령). |
| `movie_locations_FINAL.json` / `.xlsx` | **최신 데이터셋(34편/124 촬영지)**. 등급·세트호스트·출처 포함, 색상 구분. |
| `LLMSEARCH_NOTES.md` | 에이전트 설계·반복(round1/2·티어 도입) 기록. |
| `FINAL_README.md` | 최종 산출물 요약. |
| `HANDOVER.md` | (이 문서) 인수인계. |

### 과거(1·2세대, 히스토리 — 참고용 보관, 운영엔 미사용)
| 파일 | 비고 |
|---|---|
| `history/movie_locations_crawler.py` | 1·2세대: movie-locations.com 직접 추출 + Wikidata(CC0) 커넥터. |
| `history/movie_locations.json` / `.xlsx` | 2세대 movieloc 정규화(10편, 리프레이즈). |
| `history/movie_locations_OLD_backup.json` | 그 이전 스키마 백업. |
| `history/README.md` | 1세대 초기 설명. |
| `run_examples/llmsearch_run.json` / `.xlsx` | 3세대 1차 4편 실행. |
| `run_examples/llmsearch_batch.json` / `.xlsx` | 3세대 유명작 28편 배치. |
| `run_examples/llmsearch_obscure.json` | 3세대 obscure 6편 스트레스 테스트(티어 실제 발동 확인). |
| `history/_build_batch.py`, `history/_obscure_stress.py` | 위 배치/스트레스 산출용 빌더 스크립트. |

> 참고: 28편 배치 + 6편 obscure를 합쳐 복구 반영한 게 `movie_locations_FINAL.*`이다.

## 10. 했던 고민들 / 미해결·주의사항 (다음 담당자가 알아야 할 것)
- **라이브 실행 미검증 구간**: 이 환경(도구 제약)에서 Wikidata SPARQL 라이브와 외부 LLM API
  실호출은 못 돌렸다. 매핑/병합/판정 로직은 **단위테스트로 검증**했고, 웹검색은 실제로 돌렸다.
  → 다음 담당자는 본인 키로 `run_queue.py`를 소규모(5~10편)로 먼저 돌려 **실토큰·실비용·정밀도**를 측정할 것.
- **출처 귀속의 정밀도**: 현재 검색 요약 기반으로 도메인을 항목에 귀속한다. 자동화 시 LLM이
  각 location에 어떤 URL이 근거인지 정확히 매기도록(스니펫 인용) GEN 프롬프트를 더 조일 여지.
- **비용 절감 레버**: 검색이 비용의 95%. ① gather 쿼리 3→2 축소 ② 결과 캐싱 ③ recovery는 weak에만
  제한 ④ 배치 LLM(반값) ⑤ 자체 검색 인프라.
- **재현율 한계(정직)**: obscure 영화는 구체 촬영지가 거의 문서화 안 된 경우가 많아 적게 나온다
  (예: Save the Green Planet). 지명을 지어내지 않는 게 원칙 — 저재현율을 수용한다.
- **세트 함정**: 유명 '촬영지'가 실은 세트인 경우(Parasite 저택=Jeonju 세트, Skyfall Lodge=Surrey)
  를 built_set로 잡고 `set_host`(스튜디오/위치)를 태그한다. 스크래핑이 놓치기 쉬운 강점.
- **품질 운영**: 배포분 5~10% **사람 표본 감사** 권장. weak 버킷은 별도 검토 후 승급/폐기.
- **지오코딩**: 좌표는 다른 곳에서 처리 예정이라 했음(GEOCODE=1은 선택). 정합성 체크용으로만 활용 가능.
- **법적 가드레일은 항상 ON**: 보호DB 단독 격리, 서술 리프레이즈, 사진/원문 미복제, 출처 로그 보관.

## 11. 권장 다음 단계
1. 사용자 영화 리스트를 `titles.txt`로 저장 → 소규모 파일럿(10편) 실행해 실비용·정밀도 측정.
2. 정밀도 보고 후 GEN/VERIFY 프롬프트 미세조정(인용 스니펫 강제 등).
3. 본 배치(전체 큐) 야간 실행 → `dataset.*` 생성.
4. (선택) movie-locations.com을 공개 인용에서 제외한 '클린 배포본' 분기.
5. (선택) 좌표 지오코딩 파이프라인 연결(외부).

(법률 정보는 일반 설명이며 관할 국가 전문가 검토를 권장한다. 가격·모델은 2026-06 기준으로 변동될 수 있다.)
