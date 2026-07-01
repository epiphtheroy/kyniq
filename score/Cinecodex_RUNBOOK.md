# Cinecodex — 실행 런북 (RUNBOOK, 구현 디테일)

> QC가 지적한 "실행 차단" 공백을 닫는 구체 문서. 이 런북 + 전략 + 핸드오프 + 스키마 + 프로덕션 프롬프트면 키보드 앞에서 바로 돌릴 수 있다.
> 통일 설정값(다른 문서의 표기는 이 값으로 통일): **temperature=0.6 · B(배치)=8 · 전수 N=1 → 플래그분 N=3 · 모델: Sonnet 주력 / Opus 감사 / Haiku 금지.**

---

## 0. 코퍼스 소스 (무엇을 채점하나)
- **6,000편 원본:** 사용자의 기존 카탈로그 DB(Supabase `films` / FilmCurio 확장후보 등). 여기서 film_id·title·year·director 추출.
- **메타데이터 보강:** TMDB(`TMDB_READ_TOKEN`)로 director/country/language/tmdb_id 채움.
- **외부지표(표시·검증 전용, 입력 아님):** OMDB(`OMDB_API_KEY`)로 imdb_rating·metascore·RT, canon_score는 사용자 정전 DB에서. → `films` 테이블의 별도 컬럼.
- 적재 후 `films`에 6,000행이 있어야 채점 시작.

---

## 1. temperature ↔ "deterministic" ↔ N 해소 (방법론 전제)
- 프롬프트 규칙 #5 "be deterministic"의 의미 = *밴드 중점에 스냅하는 일관된 매핑*(자의적 분산 금지)이지 표본 변이 0이 아니다.
- 자기일관성 N>1은 temp>0의 표본 변이를 이용한다. **1주차 실측:** 200편을 temp=0.6, N=5로 돌려 영화별 V SD 분포를 본다.
  - 만약 SD≈0(거의 동일) → N=1로 충분, N은 비용 낭비. 전수 N=1 확정.
  - SD가 의미 있게 >0 → 플래그분 N=3 유지(중앙값이 노이즈 흡수).
- 즉 **temp/N은 1주차 실측으로 확정**하되, 시작 기본값은 temp=0.6 / 전수 N=1 / 플래그 N=3.

---

## 2. 배치 요청 형태 (Anthropic Message Batches) + 매핑
한 배치 요청 = B(=8)편. 각 request의 `custom_id`로 추적·역매핑한다.

```
custom_id 규칙:  "{film_id}__{prompt_version}__{model_id}__s{sample_index}"
                  배치는 한 묶음에 같은 sample_index만 담는다(N>1이면 sample별로 별도 배치).
request.params = {
  model: <pinned model_id>,
  temperature: 0.6,
  max_tokens: 1500,                       # 8편 × ~110tok 출력 여유
  system: [ {type:"text", text:<PROMPT_PRODUCTION_v2 전체>,
             cache_control:{type:"ephemeral"}} ],   # ← 캐시 대상(시스템 블록 끝에 부착)
  messages: [ {role:"user", content:
     "1. <T> (<Y>, <D>)\n2. ...\n8. ..."} ]          # 무작위 순서 8편
}
```
- **N 구현:** 같은 8편 묶음을 sample_index 1..N 으로 *별도 request*(또는 별도 배치)로 N회 제출. custom_id에 s1/s2/s3.
- **결과 역매핑:** 응답 JSON 배열의 각 객체 `n/title/year`를 입력 순서·title과 **대조 검증**. 불일치/누락이면 그 영화는 parse 실패로 표시하고 단건 재시도 큐로.
- **프롬프트 캐싱:** system 블록에 `cache_control:ephemeral`(5분 TTL). 배치 내 동일 system이 연속되면 캐시 히트. **1주차에 캐시 히트율·Batch+캐시 동시적용을 실측 확인**(미적용 시 비용은 표 B≈$46로 상승, 그래도 무방).

---

## 3. 집계 잡 (의사코드) — median 단위 못박음
```
for film in films where has N samples (prompt_version, panel):
    samples = scoring_runs[film, prompt_version, model(s) in panel]   # N rows
    for k in [COG,AFF,FORM,MORAL,DUR,ITX,FR,ETX,CTX,BANK,INSINCERE,COWARD,POLAR]:
        med[k] = median(s[k] for s in samples)        # ← 하위점수별 median (이것이 표준)
    V = (med.COG+med.AFF+med.FORM+med.MORAL+med.DUR)/5
    C = (med.ITX+med.FR+med.ETX+med.CTX)/4
    R = 0.6*(med.BANK+med.INSINCERE+med.COWARD)/3 + 0.4*med.POLAR
    sd_v = stdev( per-sample V )   # 샘플별 V 먼저 계산해 그 분산 (신뢰도 지표)
    sd_r = stdev( per-sample R )
    upsert film_scores(med..., V,C,R, n_samples, sd_v, sd_r, panel)
    # U,S는 저장 안 함 → view film_scores_ranked / 앱에서 lambda로 계산
```
주의: **median은 13개 하위점수 각각에 대해** 낸 뒤 그 13개로 V/C/R 계산(스키마 하단과 동일). V/C/R을 먼저 내고 median하지 않는다.

---

## 4. 플래그 임계 (잠정 기본값 — 1주차 실측으로 보정)
`film_scores.flagged=true` 및 `review_queue` 적재 조건(하나라도 해당):
- **near_threshold:** 어떤 축(V/C/R)이 밴드 경계(12.5, 37.5, 62.5, 87.5 — 즉 0/25/50/75/100의 중간)에서 ±4 이내. (밴드가 갈리는 지점.)
- **high_sd:** sd_v > 5 또는 sd_r > 5. (N>1일 때만.)
- **panel_disagree:** Opus vs Sonnet의 |ΔV| > 8 또는 |ΔR| > 8.
- **high_risk:** R ≥ 60 (Pass3 Opus 감사 대상에 자동 포함).
- **parse_fail:** 재시도 후에도 유효 JSON 실패.
라우팅: near_threshold/high_sd → Pass2(Sonnet N=3). panel_disagree/high_risk → Pass3(Opus) → 여전히 갈리면 human.

---

## 5. 파싱·재시도 정책
1. 응답에서 ```fence 제거, 첫 `[`~마지막 `]` 추출 → JSON 파싱.
2. 객체 수 == 입력 영화 수, 각 n/title 대조. 13개 키 존재·0–100 정수 검증.
3. 실패 시 단건(B=1)으로 **최대 2회 재시도**(retry_count 기록). 그래도 실패 → parse_ok=false, review_queue(reason=parse_fail).

---

## 6. 드리프트 게이트 (정지 트리거 수치화)
- **컨트롤셋:** `Cinecodex_Anchor_Bank_v2.md`의 *합의 강한* 앵커에서 60편 선정. 각 (film,dimension)에 expected_band 부여 = 그 차원 골드값을 가장 가까운 0/25/50/75/100으로 반올림, tolerance ±12.
- **언제:** 매 1,000편 묶음 시작 전 + 모델 버전/프롬프트 변경 시. 컨트롤셋 재채점.
- **정지 규칙:** 관측 하위점수가 expected_band ±12를 벗어난 (film,dimension) 비율이 **전체의 10% 초과**면 `gate_passed=false` → 파이프라인 정지·원인 점검(모델 스냅샷·프롬프트 해시 확인)·재보정 후 재개. (10% 이하는 통과, drift_runs에 로그.)

---

## 7. 재개(resume) — 멱등성
- `scoring_runs` unique(film_id,prompt_version,model_id,sample_index)로 중복 삽입 차단.
- **남은 작업 쿼리:**
```
select f.film_id from films f
left join scoring_runs r
  on r.film_id=f.film_id and r.prompt_version='cinecodex-prod-v2'
 and r.model_id=<m> and r.sample_index=1
where r.run_id is null;          -- 아직 Pass1 안 된 영화
```
- 비동기 배치: 제출 시 `batch_jobs`에 행 생성(status=submitted, film_ids[]). 폴링으로 status 갱신, ended면 결과 회수→scoring_runs upsert→n_completed 갱신. 미회수 배치는 batch_jobs에서 식별해 재폴링.

---

## 8. 모델 ID 확정 (실행 직전)
- 예시 표기는 `claude-sonnet-4-6`(주력), `claude-opus-4-8`(감사). **실행 직전 `/v1/models`로 정확한 스냅샷 문자열을 확인·고정**하고 model_id에 기록(자동 업그레이드 금지). Anthropic 신토크나이저는 토큰 ~35%↑ 가능 → 비용 버퍼 반영.

---

## 9. note ON 감사 서브셋 = 별도 프롬프트 버전
프로덕션은 note 생략(`cinecodex-prod-v2`). 감사 5%는 note 포함 출력 스키마를 쓰므로 **별도 prompt_version `cinecodex-prod-v2-note`**로 동결(SHA 별도). 같은 버전에서 출력 스키마가 갈리지 않게.

---

## 10. 1주차 체크리스트 (이 순서로 닫기)
1) films 6,000 적재(+외부지표 별도). 2) prompt_versions에 v2/v2-note SHA 동결. 3) 모델 스냅샷 확정. 4) 파일럿 300편 Pass1 → 파서·집계·캐시 히트·비용 로깅 동작 확인. 5) 배치크기 B(1/8/15)·N(SD 분포)·플래그 임계 실측 보정. 6) 컨트롤셋 60편·드리프트 게이트 가동. 7) 전수 확장.
