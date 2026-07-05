# KEPT — 나중에 같이 해결할 항목 (parking lot)

> 대화가 길어져서, "나중에 해결"하기로 한 것을 여기 모은다. 해결되면 ✅ 표시하고 본 문서에서
> 줄을 긋는다. 관련 상세: `figure-page-design.md`, `meta-take-architecture.md`.

## A. 후속작업(설계상 다음 단계 — 누락 아님). 전 영화 보강 후 일괄 실행.
- [ ] **빅뱅 수렴 / 중복병합·분리** — `mt-consolidate` (OpenAI text-embedding-3-small + 로컬 코사인).
      enrichment이 만든 새 메타테이크 후보들을 임베딩으로 dedup(≥0.86) + >30편 분리. (arch §10-1, §14-6)
- [ ] **허브 저작** title/laconic/thesis/essay — `mt-author` (Gemini), ≥5편 게이트. (arch §10-2)
- [ ] **승인 큐** candidate→approved→published (어드민). (arch §10-3)
- [ ] **이중 랭킹**(defining/unexpected) — `mt-rank` (OpenAI 임베딩). (arch §10b)
- [ ] **추천·"kin"**(film_affinities) — `mt-recommend` (로컬 TF-IDF). (arch §10b)
- [ ] **유지 봇**(야간 cron) — 신규 take 매칭/병합/분리/재랭킹. (arch §10-4)
- [ ] **인용 출처(DOI) Crossref 검증** — `reception` 레지스터 take의 출처. 명시적 추후. (arch §14-3, 백로그 #4)

## B. figure 페이지 셋업 갭(메타테이크 단계 아님 — 작은 것).
- [ ] **figure.slug 백필** — migration 0014 적용 + `slugify(label)` 영화 내 충돌 해소. (URL용)
- [ ] **기존 시드 take 레지스터 분류** — 페이지 배지/3-카운트용. (enrichment v2가 `existing_take_register`로 생성)
- [ ] **토큰 linkify** — 본문 영화/형상/허브 언급을 `{{film}}/{{figure}}/{{meta_take}}`로. `mt-author`가 에세이엔 이미 적용.

## C. 지금 튜닝(후속 아님 — 생성 품질).
- [x] 목소리 학술화 → 금지어 + 하우스 보이스 (보정 프롬프트 반영).
- [x] 개념·제목 중복(ideological 쏠림) → 한 콜/영화 + 레지스터 분산 (v2 반영).
- [x] **존재하지 않는 허브 ref → take 유실 (2026-06-14 해결).** ref는 주입된 published 목록만 허용;
      지어낸 ref는 워커가 `new` 후보로 자동 전환(드라이런·persist). 전체 허브 목록 주입으로 적중률↑.
- [ ] 슬러그 ASCII 전용(accents 탈락: acousmêtre→acousm-tre). URL엔 무해하나 인지만. 추후 결정.
- [ ] `reception` 레지스터가 실제로 쓰이게(현재 0회) + 출처는 A의 Crossref와 연동.

## D. 진짜 약점(설계에도 명시 안 됨 — 결정 필요).
- [ ] **사실 Verifier 부재.** 메타테이크 파이프라인엔 전용 사실검증 없음(문서는 "근거 강제 + 사후
      spot-audit + content_events"만). 예: 보강 출력의 "다리 보조기 즉각 치유" 오류. 가벼운 사후
      감사 이상이 필요한지 결정.

## E. 미해결 설계 결정 (figure-page-design.md §12 M1–M7).
- [ ] M1 모더레이션 강도(선검수 vs 선발행) · M2 새 메타테이크 제안 허용 범위 · M3 업보트/평판 ·
      M4 본인 기여 수정/삭제·반달 대응 · M5 enrichment 런칭 전 전수 vs 점진 · M6 take 페이지
      Examples 형상 링크화 시점 · M7 레지스터 팔레트 확정(10종/명칭/`reflexive`).

## F. 인프라 메모.
- [ ] 샌드박스가 Supabase/Gemini로 직접 못 나감(프록시 403) → 실모델 런은 사용자 맥에서
      `.command` 더블클릭 또는 화면사용 ON 시 Claude가 구동. 결과 번들은 파일로 읽어 검수.
- [x] **Gemini 3.1 Pro API 문자열 = `gemini-3.1-pro-preview`** (확인·적용됨. `--model`로 교체 가능).

## G. 스케일/통합 — 1천 편 빅뱅 점검에서 나온 것 (최종 작업 시 필수).
- [ ] **`mt-consolidate` v2 어댑테이션 (블로커 아님, 필수).** 현 코드는 시드 `raw_concept`를 재클러스터.
      v2는 생성 때 ref/new로 허브를 이미 정하므로, 통합은 "raw 재클러스터"가 아니라 **new 후보끼리/기존
      허브와 dedup(임베딩 ≥0.86) + ≥5편 게이트**로 바꿔야 함. 복잡도·비용은 동일.
- [ ] **`components()` numpy 벡터화.** 현재 순수 파이썬 O(n²)·1536차원 → 구별 개념 ~5K 넘으면 급격히 느림
      (n=20K ≈ 5시간+). numpy(또는 FAISS/근사 NN)로 한 줄 바꾸면 2만 개도 수 초. (증분 모드는 전체
      재클러스터 안 하므로 무관 — 빅뱅 1회성에만 해당.)
- [ ] **한 콜 출력 16K 토큰 상한.** figure당 3~5 take면 여유. 10 take/figure를 원하면 영화당 출력이
      상한 근접 → **영화당 2콜로 분할** 필요(비용 ≈2배). 권장 그레인 = figure당 3~5.
- [ ] **허브 목록 프롬프트 주입의 스케일 한계.** 전체 허브 주입은 수백 개까진 OK. 허브가 ~1–2K 넘으면
      프롬프트가 비대(>200K 토큰 → 2배 단가) → **영화 임베딩 최근접 top-K 허브만 주입**으로 전환.
- [ ] **비용 기준선(1천 편 빅뱅):** 생성 ~$60–130(배치~표준, 3 take), 저작 ~$6, 임베딩 <$1, 통합/랭킹
      로컬. **증분 = 편당 ~$0.10.** 빅뱅 생성은 **배치 API(50% 할인)** + 야간 권장. 증분은 야간 cron.
- [ ] **pgvector ANN 인덱스 필수(10만 take 규모).** 인덱스 없으면 유사도 쿼리가 전수 스캔 → 느림.
- [x] **(카나리 2026-06-14 발견·해결) 영화당 1콜 + 10형상 → 출력 16K 상한 truncation / figure_id 에코
      불일치로 일부 영화가 0건 적재**(FG가 그랬음, PotD 30건은 정상). 해결: **figure 6개씩 청크 분할**
      + **label 폴백 매칭** + 매칭 부족 시 **⚠ 경고**(조용히 안 빠짐). `need_enrich` 멱등이라 재실행이
      빠진 영화만 채움. → 전체 567편 돌리기 전 이 견고화가 적용돼 있어야 함(적용됨).

## H. 임베딩 전략 — 세 엔티티 각자 고유 임베딩 (스키마에 이미 vector(1536) 존재).
- **무엇을 임베딩하나(축이 다름):** figure → `description`(표면) · take → `rationale`(의미/읽기) ·
  meta-take → `essay+thesis`(개념). 올바른 텍스트를 넣어야 함(섞으면 벡터 무용).
- **figure 임베딩 = 표면 축.** "놀라움 = 의미 가까움 × 표면 멂" 계산 + figure dedup + 검색용.
  figure끼리 표면 닮음은 주 연결자가 아님(의미 연결은 공유 허브 경유 — TV Tropes식 표면매칭 회피).
- **용도:** 랭킹(relevance/surprise), 증분 매칭(새 항목→그래프), dedup(형상·후보·중복 take),
  허브 soft edges(Compare/Contrast), 시맨틱 검색, 추천 보강.
- **운영:** 빅뱅 때 배치 계산 + 증분은 신규만. **ANN 인덱스 필수.** 텍스트 변경 시 `dirty` 재임베딩.
- **비용: 거의 0.** text-embedding-3-small $0.02/1M → 전체 ~$0.23 1회성, 편당 ~$0.0002. Gemini 생성
  호출 수엔 영향 없음(별도 API). 한 번 저장하면 이후 모든 유사도=로컬 코사인 → 다운스트림 LLM 호출 절감.
- (선택) figure에 "의미 센트로이드"(자기 take 평균)를 추가하면 "같은 읽기 형상" 검색이 빠름. 기본은
  figure=표면 1개로 두고 필요 시 추가(센트로이드는 take 임베딩에서 도출 가능).

## I. 사이트 검색 v2 — 의미·하이브리드 (★ 잊지 말 것, 사용자 명시 요청 2026-06-16)
- **v1 완료(migration 0019)**: Postgres FTS + pg_trgm로 **키워드+오타** 검색(films·figures·meta-takes·directors
  의 이름/제목/laconic). `search_site(q,limit)` RPC + `SearchBox`(내비·홈 타입어헤드) + `/search` 페이지.
- **v2 (반드시 할 것 — take/figure 임베딩이 생긴 뒤):**
  1. **의미검색**: take.rationale + figure + meta_take 임베딩(pgvector)으로 *개념* 질의("감시에 관한 읽기").
     쿼리 임베딩 1콜(OpenAI text-embedding-3-small) → `<=>` ANN.
  2. **하이브리드 랭킹**: 키워드(FTS/trgm) + 의미(코사인)를 **RRF**(reciprocal rank fusion)로 융합.
  3. **읽기 본문 검색**: v1은 *이름*만. takes.rationale까지 FTS 확장(결과는 그 take의 figure 페이지로).
  4. 전제: figure-enrich 배치 + mt-rank가 take/figure 임베딩을 채운 뒤(현재 take_emb=0, fig_emb=0) + pgvector ANN 인덱스.
- 비용: 쿼리당 임베딩 ~$0.000005(무시). 인덱스 1회 구축.

## J. Tropes (figure 유형) 레이어 — 2026-06-17 결정·구축
- **개념:** 메타테이크=읽기(뜻), 트로프=figure 유형(대상/장치, TV-Tropes식 분류명사). 둘은 직교 축.
  한 `meta_takes` 테이블에 **`kind` 판별자**('reading'|'figure_type'). figure↔트로프 멤버십은
  `figure_type_members`(다대다). 마이그레이션 0028–0031.
- **빌드 파이프라인(메타테이크 것 재사용):** ① `trope-tag.py`(stage1) — figure를 *영화-불문 유형 태그*
  최대 3개로(영화당 1콜, Opus, **figure는 정수 인덱스로 식별** — UUID 왕복하면 LLM이 변조해 FK 에러).
  ② stage2(군집+명명, 미작성) — figure_tags를 정규화/임베딩 군집 → ≥5편 게이트 → 가족 인지형 명명
  (극작가 카테고리). ③ 소프트 배정(임계값) → members.
- **★중요 발견:** **figure description 임베딩은 "같은 영화"로 뭉친다**(설명이 영화 고유명사를 담음),
  교차영화로는 스타일/국적으로 뭉침 → 순수 임베딩으론 트로프 안 나옴. 그래서 **유형 태깅(추상화)** 필수.
- **교차링크:** `trope_readings`(트로프→읽기) + `meta_take_tropes`(읽기→트로프) RPC. 양쪽 페이지에 `.xbox`.
- **UI:** nav Genres→Tropes, `/tropes` 인덱스, `/trope/[slug]` 허브, figure 페이지 "Type" 줄.
- **(2026-07-05~06 순위 표면)** /trope 멤버 라이브 랭킹·% match·질문형 부제·FAQ/ItemList, 피겨 nearest-figures, /catalog 순번·confidence %, 필름 Tropes 독해제목 라인 — 정본 `HANDOFF-트로프피겨아키타입-순위표면.md` (★함정: ftm.sim=상수, 피겨 임베딩=표면축 → 랭킹은 take↔trope 코사인).

## K. 메타테이크 "학술 헤더" — 2026-06-17 구축 (학자·학생·연구자·창작자용)
- **무엇:** 메타테이크(reading) 페이지에 `ScholarHeader` — ① 정식 이론용어(`raw_concept`) + 계보
  (`theorist`, 274/274 채움; 분리자식엔 같은 raw_concept에서 backfill) ② 렌즈 지도(register 분포)
  ③ 외부 학술검색 링크(Google Scholar·JSTOR·PhilPapers, **인용 생성 금지 — 검색 링크만**) ④ "개념별
  필모그래피" 프레이밍 + AI 인용주의 문구.
- **비용 0(LLM 없음):** 전부 기존 데이터(raw_concept·theorist·register)에서 렌더.

## L. ★다음 빅뱅(영화 +500~1000) 프롬프트 점검 체크리스트 (반드시)
빅뱅 때 figure-enrich/메타테이크 산출이 **아래를 빠짐없이 생성**해야 학술헤더·트로프가 자동으로 채워짐:
1. take마다: `raw_concept`(정식 이론용어), `theorist`(정전적 귀속), `register`(10종), `rationale`,
   (선택)`source_citation`/`source_url` — **단 출처는 미검증이므로 "scholarship anchored"로 과장 금지.**
2. figure마다: 영화색을 *덜* 탄 깔끔한 `description`(유형 태깅 품질의 토대) + slug.
3. 신규 영화 적재 후 순서: tmdb-fetch → figure-enrich → mt-embed → mt-consolidate(dedup+split≤70)
   → mt-author(Opus) → mt-rank/recommend → **trope-tag → trope stage2** → **theory-canon 매칭** → 검증 → 배포.
   - **trope-tag 파라미터(빅뱅 포함 필수):** figure당 **최대 3 태그**(주1+보조≤2), 영화당 1콜(Opus),
     figure는 **정수 인덱스로 식별**(UUID 왕복 금지 — LLM 변조 시 FK 에러). 멱등(미태깅만).
4. **이론 정전(Theories & Theorists CSV, 2,586개) 활용 = 프롬프트 주입이 아니라 임베딩 후처리.**
   enrich는 raw_concept 자유 생성 그대로 → 사후 `theory-match`: raw_concept(또는 meta_take 임베딩)을
   정전 이론 임베딩과 최근접 매칭 → theory_families(전통) 부여 + theorist 대조 검증(오귀속 플래그).
   정전 1회 임베딩 ~$0.05, enrich 비용 0 추가, 이미 생성된 것에도 소급 적용. top-K *선정*은 LLM 0.
5. 백로그: 인용 **Crossref/Semantic Scholar 검증** 후에야 진짜 인용을 자산으로 노출(§A #4).
6. about/guidelines 문구 유지: 사실오류는 고침/해석은 열어둠 · 즉시게시+감사루프 · posters·stills(TMDB).
