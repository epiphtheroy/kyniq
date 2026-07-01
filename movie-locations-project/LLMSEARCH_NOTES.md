# LLM+검색 에이전트 — 프로토타입 실행·반복 기록

실제 웹검색으로 4편(Parasite·La La Land·Mad Max Fury Road·Skyfall)을 돌리며,
결과를 보고 절차(프롬프트)를 고쳐 다시 돌린 기록입니다. 다양성: 한국·미국·
아프리카(더블링)·다국가(set↔filmed 함정).

## 라운드 1 — 순진한 추출, 관찰된 실패모드
검색→추출만 했을 때 드러난 문제:

- **F1. 단일출처 위험**: 여러 영화에서 검색 1위가 movie-locations.com / atlasofwonders.
  그대로 뽑으면 "단계만 늘어난 같은 추출". → 법적·신뢰도 둘 다 위험.
- **F2. '촬영지'로 오인되는 세트**: Parasite의 박사장 저택, Skyfall Lodge는
  실제 장소가 아니라 **세트**(블로그·관광글이 실제처럼 소개). 그대로 두면 오정보.
- **F3. 입도 편차**: 주소(La La Land) ↔ 자연지형(나미비아 사막) 혼재.
- **F4. set↔filmed 혼동**: Fury Road는 배경(가상 황무지)과 촬영지(나미비아)가 다름.
  Skyfall의 'Scotland' 일부는 실제 Surrey 세트.

## 라운드 2 — 절차 보정
F1~F4를 반영해 파이프라인을 수정:

1. **다중출처 게이트**: 서로 다른 도메인 **≥2**여야 `verified`. movie-locations.com/
   atlasofwonders는 "이것만으로는 불충분"(블록리스트) — 다른 독립출처 필수.
2. **필드 분리**: `narrative_setting`(영화 속 장소) ↔ 실제 `real_name/filming_area/country`.
3. **`built_set` 플래그 + 반증 패스**: "이거 세트/CGI 아니냐, 배경지 아니냐, 다른 영화
   아니냐"를 LLM이 적대적으로 재검. 세트면 `verified_set_not_real`로 표시.
4. **`granularity`(address/venue/area/region/set)** 와 **`confidence` 등급** 부여.
5. (선택) **지오코딩 정합성**: 주소→좌표가 안 나오거나 지역 불일치면 플래그.

보정 후 F2 함정 2건을 다중출처로 재검증 → 둘 다 "세트" 확정:
- Parasite 저택: Jeonju Film Studio Complex 인근에 지은 세트(1층 세트+2층 CGI).
  출처: screenrant, dezeen, filmoblivion.
- Skyfall Lodge: Surrey Hankley Common에 plywood/plaster로 짓고 폭파.
  출처: 007.info, visitsurrey, getsurrey, James Bond Dossier.

## 최종 실행 결과 (4편)
| 지표 | 값 |
|---|---|
| 후보 촬영지 | 18 |
| verified(다중출처 통과) | 17 |
| single_source(격리·미배포) | 1 (Rossing Mountains, 출처 1곳) |
| 세트 함정 적발 | 2 (Parasite 저택, Skyfall Lodge) |

영화별: Parasite 4/4, La La Land 6/6, Fury Road 3/4(1 격리), Skyfall 4/4.

## 판단 — "예측 가능한 범위"인가
- **정밀도 우선**으로 동작: 다중출처로 확증되는 **유명·명백한 촬영지**가 잘 잡힘.
  이들은 동시에 **법적으로 가장 안전한**(여러 곳이 보도한 공개 사실) 항목.
- **재현율은 낮음**: 한 사이트만 아는 obscure 항목은 single_source로 빠짐. 그런데
  그게 바로 운영자가 혼자 연구한 '위험한' 항목 → 신뢰도와 법적 안전이 같이 좋아짐.
- **세트 함정**을 잡아내는 것이 이 방식의 핵심 강점(스크래핑은 오히려 놓치기 쉬움).
- 한계: 100%는 아님. 그래서 등급 분리·불확실성 표기·표본 감사를 전제로 운용해야 함.

## 산출물
- `movie_locations_llmsearch.py` : 확정 절차를 코드화한 에이전트(검색 provider + LLM +
  반증패스 + 다중출처 게이트 + 지오코딩). 본인 키로 `--titles`만 주면 동작.
- `llmsearch_run.json` / `llmsearch_run.xlsx` : 위 4편 실제 실행 결과(등급·출처 포함).

실행: `python movie_locations_llmsearch.py --titles "Parasite (2019)" "La La Land" "Skyfall" --min-sources 2`
(환경변수: LLM_API_KEY, SEARCH_API_KEY[+SEARCH_PROVIDER], 선택 GEOCODE=1)

## 업데이트 — single_source를 버리지 않고 '판단'하기
무조건 드롭은 "신뢰도 낮음"과 "확증 부족"을 혼동하므로, 등급(tier) 판정으로 교체:

1. **출처 권위 등급**: Tier A(위키·IMDb·주요 언론·공식 관광/스튜디오), Tier B(편집형
   촬영지 블로그), Tier C(무명/포럼/SNS), X(보호 DB: movie-locations.com 등).
2. **2차 타깃 검색 복구**: 단일/약함 항목에 `"<영화> <장소> filming location"` 추가검색
   → 독립출처가 붙으면 승급. (실제로 Rossing Mountains가 이 방식으로 verified 복구됨)
3. **개연성 판단**: 지오코딩 성공 + 제작국/지역 일치. 실패 시 강등.
4. **비대칭 법적 규칙(핵심)**: 단일출처가
   - 개방·권위(Tier A) → `probable`로 **배포**(신뢰도·법적 둘 다 양호)
   - Tier B/C → `weak`(검토 버킷, 별도 보관)
   - **보호 DB 한 곳뿐 → `quarantined_legal`(격리, 미배포)** — 파생 리스크 그대로라서.

결과 등급: `verified > probable > weak > quarantined_legal > rejected`.
배포 대상(SHIPPABLE) = verified / verified_set_not_real / probable.
→ 권위 있는 단일출처 사실은 살리고(아깝지 않게), 법적으로 위험한 '보호 DB 단독'만 격리.
   신뢰도와 법적 안전이 계속 같은 방향으로 정렬됨.

단위검증 통과: 위키 단독→probable, 보호DB 단독→quarantined_legal, 무명 단독→weak,
독립 2곳→verified, 보호DB+독립1→verified, 개연성 탈락→강등, 복구로 weak→verified.
