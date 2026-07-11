# HANDOFF — MetaTake 이론 DB 통합·운영 마스터 인수인계

작성: 2026-07-03 · 작성 주체: Claude (Cowork 세션, 사용자 wonwoo와의 방법론 확정 대화 기반)
대상 독자: **이 작업을 이어받을 다음 AI 또는 협업자.** 이 문서 하나만 읽으면 전체 상황·결론·다음 행동을 파악할 수 있도록 작성됨.
선행 문서와의 관계: `theory-db-project/00_프로젝트_현황_및_재개가이드.md`는 "엑셀 개념 DB를 **만드는** 공정"의 인수인계다. **본 문서는 그 상위 문서**로, 만들어진 DB를 제품 DB와 통합하고 앞으로의 글쓰기 파이프라인을 운영하는 전체 그림을 다룬다. 충돌 시 본 문서가 우선.

---

## 0. 30초 요약 (결론)

1. 사용자는 영화를 보고 이론을 추출해 에세이(극상글·행동해독 브리핑)를 쓴다. 이론 개념 데이터가 **세 곳에 분산**되어 있다: 로컬 md 에세이, Supabase `kyniq`(metake.net 제품 DB), 로컬 엑셀 개념 DB(8,196 개념).
2. 데이터 대조 결과 **Supabase `theory_canon`(2,587행)이 부모, 엑셀 DB가 그것을 정제·확장한 자식**이다(정확일치 71%, 포함관계 ~87%). 엑셀이 3배 크고, dedup·원어·정의·통합 택소노미까지 갖춰 품질도 높다.
3. 확정된 방향: **엑셀을 새 정본(canonical)층으로 Supabase에 적재하고, theory_canon을 crosswalk로 매핑**한다(합치는 게 아니라 앵커를 교체). 그 위에 **3층 구조(원문→발생→정본) + 주기적 통폐합 배치** 파이프라인을 세운다.
4. 임베딩에 대한 판정: **전면 해결책 아님, 부분 채택.** 매칭 캐스케이드의 3단계 후보 검색과, 분석 시 top-k retrieval에만 사용.
5. ~~지금 해야 할 일 = Phase 1~~ → **Phase 1은 2026-07-07 기준 완료됨** (theory_concepts 8,196 적재, crosswalk 2,004건, 사용 중 canon 100% 매핑). 2026-07-07 총정리 실행 내역은 §10 참조. 다음 할 일: §10 말미의 "남은 작업".
6. **읽는층(인덱스 3면) 현황**: `/concept`·`/theorist`·`/tradition`은 **2026-07-11~12에 공용 `TheoryExplorer` 셸(통합검색+축탭)로 통합 재설계 완료·라이브** — 영화 없는 카테고리 게이팅 + 이론가/개념 얼굴 썸네일(`lib/theorist_portrait.json`). **인덱스/읽는층 UI 세션은 §14 먼저 읽을 것**(중복 재설계 금지). 데이터·파이프라인은 §10~13.

---

## 1. 사용자의 작업 방식 (왜 이 프로젝트가 존재하는가)

사용자는 영화를 이론으로 읽는다. 영화 한 편을 분석하면서 그 안에 작동하는 이론 개념(예: 바타유의 '저주받은 몫', 프로이트의 '반복강박', 엘리아스의 '자기강제')을 추출해 두 종류의 에세이를 쓴다:

- **극상글** (Ultra Creative Misreading / Exegesis / PlainGuide): 영화 한 편에 대한 밀도 높은 이론적 독해. 글 끝에 "Quick glossary" 형태로 사용된 개념이 정리됨.
- **행동해독 브리핑**: 영화 속 인물 행동의 수수께끼를 3개의 서로 다른 이론 전통으로 해독. 각 단락이 `**개념(원어)** (이론가, 저작, 연도)` 형식으로 시작 — 구조가 매우 규칙적.

한 편의 글은 **여러 개의 이론**을 담는다. 사용자는 앞으로 **수천 편**의 영화를 더 분석할 계획이며, 그 과정에서 개념이 반복 등장하기도 하고 새 개념이 나오기도 한다. 사용자가 원하는 최종 상태: **"글만 써서 폴더에 올려두면, 자동으로 매칭·분류되고, 네이밍이 조정되고, 항목이 늘거나 분리되고, 그 변경이 글에도 역반영되는"** 시스템. (결론: 95% 자동화 가능 — §4 참조)

핵심 고민이었던 것: ① DB가 3곳에 분산, ② 개념이 8,000개가 넘어 분석 시 통째로 넣으면 오히려 방해, ③ 임베딩이 해결책인가?

---

## 2. 자산 인벤토리 — 모든 데이터의 위치

### 2.1 로컬 (`/Users/jerryje/Documents/MetaTake/`)

**에세이 코퍼스 (1층 원문 — 절대 정규화하지 말 것)**

| 위치 | 내용 |
|---|---|
| `극상글/` | 42개 파일. 영화별 UCM/Exegesis/PlainGuide/v5.x, EN·KO 병행. 프롬프트 원본(`Ultra_Creative_Misreading_PROMPT.md`)도 이 폴더에 있음 |
| `_행동해독_브리핑/` | 6개 파일 (Banshees, Force Majeure, In the Mood for Love, Phantom Thread, The Bodyguard 1992, Vertigo) |
| 루트에 흩어진 것들 | `Grave_of_the_Fireflies_*`, `Antichrist_v5.1_EN.md`, `*_DB_Discoveries.md` 등 — 백필 시 루트도 스캔할 것 |

**이론 개념 DB (3층 정본의 원천 — 최신·최대·정제본)** — `theory-db-project/`

| 파일 | 내용 |
|---|---|
| `Theory_Concept_DB.xlsx` (v3) | **마스터.** 시트: Theory Concepts(canonical **8,196** 개념: concept_id, concept, native, one_liner, part/major/sub, n_theorists, theorists) · Theorist→Concepts(**8,876** M:N행: +era, source(DB/Knowledge/Web), confidence(high/med)) · Roster(**2,219** 이론가) |
| `Theory_Concepts_canonical.csv` / `Theorist_Concepts_link.csv` | 위 두 시트의 CSV 판 (적재용) |
| `migration_theory_concepts.sql` | **미적용 초안.** kyniq에 `theory_concepts`+`theorist_concepts` 테이블 생성·적재·이름매칭 SQL. Phase 1의 출발점 |
| `Unified_Theory_Master.xlsx` | 통합 택소노미로 재매핑된 이론 2,682행 + Theorist Master 590명 + Changelog |
| `통합_택소노미_백본.md` | **13 Part / 171 Major / 543 Sub** 백본 정의 |
| `Theory_Index_통합.csv` | 이론 2,682행의 구→신 택소노미 매핑. **`OldMajor` 열이 있어 theory_canon 소급 재분류의 열쇠** |
| `Theorist_Master_통합.csv` | 이론가 마스터 통합판 |
| `FQ_*.csv/md`, `Journal_Theory_Keyword_DB.xlsx`, `journals_keyword_db.csv`, `Journal50_Coverage_Report.md` | 학술장(Film Quarterly + 50저널) 커버리지 검증 산출물. 보조 자료 |
| `00_프로젝트_현황_및_재개가이드.md` (=`00_Project_Status_Resume_Guide.md`) | 엑셀 DB 구축 6단계 공정의 상세 인수인계 (선행 문서) |

**원본 덤프**: `thorist/Theories and Theorists - 시트1.csv` = Supabase `theory_canon`의 덤프(2,587행). 엑셀 프로젝트의 원천 입력이었음. 계보 증거이자 crosswalk 대조용.

### 2.2 Supabase

- **제품 DB = 프로젝트 `kyniq`** — `project_id: jvgarcqrtsmgfimdcwgo` (metake.net 백엔드). 확장: **pgvector, pg_trgm** 설치됨 (unaccent, http도 있음).
- 같은 조직의 `AVAULT`(ifywktyiyeyifqgmvtzb)는 뉴스/아웃리치용 **별개 프로젝트 — 건드리지 말 것.**

`kyniq` 핵심 테이블 (2026-07-03 기준 행수):

| 테이블 | 행수 | 설명 |
|---|---|---|
| `theory_canon` | 2,587 | 이론 정전 (part/major_category/sub_category/title/theorist/**embedding** 전량). **택소노미 난립 상태**: major 1,687종/sub 2,038종 (통합 백본 171/543과 대비) |
| `theorists` | 1,840 | 이론가 (slug, name, blurb) |
| `canon_theorist` | 981 | theory_canon ↔ theorists 링크 |
| `sm_concepts` | 1,227 | 사이트 표면 개념층. **원어(native) 409개 보유**, 전량 canon_slug 매핑됨. 신규 정본의 원어 백필 소스 |
| `figures` | 18,168 | 영화 장면/형상 단위. **전량 임베딩됨.** film_id로 films 연결 |
| `meta_takes` | 11,974 | figure들을 묶는 개념 클러스터 (title, laconic, thesis, essay, kind, maturity, cohesion, member_count). 임베딩 10,527. **`merged_into`로 이미 960건 통폐합됨** — "생성 후 통폐합"이 이미 절반 구현된 증거 |
| `meta_take_edges` | 19,765 | (a, b, relation, similarity) 유사도 그래프 |
| `films` | 6,701 | 영화 마스터 |
| `taxonomy_nodes` | 2,928 | 영화 *내용*용 택소노미 (이론 택소노미와 별개) |
| `theory_families` | 0 | 빈 테이블. 통합 백본을 채울 후보 자리 |
| `_bak_*` 테이블들 | — | 과거 백업. 무시 |

---

## 3. 두 DB의 관계 — 데이터로 검증한 사실

2026-07-03 세션에서 실제 대조한 결과 (정규화: 소문자화·괄호꼬리 제거·기호 정리):

1. **계보**: `theory_canon` → CSV 덤프(`thorist/`) → 로컬에서 택소노미 정규화 + 개념 단위 확장 → `Theory_Concept_DB.xlsx`. **한 데이터의 3세대이며 엑셀이 최신 세대.**
2. **겹침**: canon 제목(정규화 후 2,210종) 중 **1,570개(71%)가 엑셀 개념과 정확 일치**, 부분포함까지 ~87%. 즉 엑셀 ⊃ canon 거의 전부 + 약 5,600개 신규/세분 개념.
3. **granularity**: canon은 이론 단위라 근접중복 난립 (예: 푸코 — `Governmentality`와 `Governmentality (Broader Application)`, `Panopticism (Sociology)`과 `The Panopticon (Disciplinary Society)`이 별개 행). 엑셀은 이론가당 3~10개 고유 개념으로 dedup + 원어·한줄정의·출처·신뢰도 부여.
4. **이론가**: canon 내 고유 이론가 1,936명(정규화 1,746) 중 로스터가 1,504명 커버. **242명 미커버(대부분 표기 변형 추정 — Phase 1 잔여작업)**. 역으로 로스터에만 있는 710명은 동시대 보강분.
5. **택소노미**: DB는 난립(1,687 majors), 로컬은 통합(171 majors), **구→신 매핑표(`Theory_Index_통합.csv`의 OldMajor 열)가 이미 존재.**
6. DB 쪽 고유 자산: canon 전량 임베딩, 실서비스 연결, sm_concepts의 원어 409개.

**결론: 통합 = 병합이 아니라 세대교체.** 엑셀을 새 정본층 `theory_concepts`로 적재하고, `theory_canon`은 보존한 채 crosswalk로 매핑(71%는 자동). 사이트가 참조하는 앵커를 점진적으로 신층으로 옮긴다.

---

## 4. 확정된 방법론과 그 이유

### 4.1 3층 구조

- **1층 원문(에세이)**: 자유롭게 쓴다. DB가 글쓰기를 제약하지 않는다. 본문 산문은 파이프라인이 **절대 수정하지 않는다.**
- **2층 발생(occurrence)**: 글에서 개념이 나올 때마다 `(영화, 개념표기, 이론가, 저작·연도, 출처파일, 인용문맥)` 행을 **append-only**로 기록. 기록 시점에 중복 판단 금지 — 쓰기 마찰이 0이어야 수천 편을 감당.
- **3층 정본(canonical)**: `theory_concepts`(엑셀 적재본) + 통합 택소노미. occurrence→정본 연결(resolution)은 **주기 배치**로.

### 4.2 Resolution 캐스케이드 (매칭 순서)

① 이론가+개념명 정확/별칭(alias) 매칭 → ② pg_trgm 유사 문자열 → ③ 임베딩 top-k 후보 → ④ LLM 판정. 판정 결과는 3종: 기존 개념 연결 / **신규 개념 제안(`status=provisional`)** / 저신뢰 → 검토 큐. 모든 판정은 alias 테이블에 기록되어 같은 결정을 두 번 하지 않음 → 시스템이 수렴 (초기 수작업 多 → 후기 80~90% 자동).

### 4.3 임베딩 판정 (사용자의 원래 질문에 대한 답)

**부분 채택.** 이유: 이론 개념은 "이론가명+용어"라는 강한 어휘 앵커가 있어 대부분 이름 매칭으로 해결된다. 임베딩만으로 8천 개를 클러스터링하면 뭉개진 군집이 나온다(meta_takes의 maturity='cliche' 클러스터들이 그 징후). 임베딩의 올바른 자리는 두 곳뿐: ⓐ 캐스케이드 3단계의 후보 검색, ⓑ **분석 시 retrieval** — 새 영화의 figure마다 관련 정본 개념 top-10~20만 꺼내 쓰는 것. ⓑ가 "8,000개라 오히려 방해"라는 고민의 해법이다. **분석할 때 DB 전체를 컨텍스트에 넣지 말 것.**

### 4.4 자동화 경계

95% 자동. 단 3지점은 검토 큐 유지: **신규 개념 승인(provisional→정식), 저신뢰 매칭, 병합·분리 확정.** 이유는 기술이 아니라 편집권 — 개념의 이름과 경계는 사용자 비평 체계의 저작 행위이므로, 전자동 시 "사용자 것이 아닌 택소노미"가 됨. 검토는 건당 승인/거부 몇 초. 사용자가 원하면 자동 승인 전환 가능하나 초기 몇 사이클은 검토 권장.

### 4.5 역반영(write-back) 원칙

글에는 개념 **ID**가 연결된다(이름 아님). 각 md 하단에 파이프라인 전용 생성 블록을 삽입:

```
<!-- metatake:auto — 수정 금지, 파이프라인이 재생성 -->
연결 개념: [반복강박 #1042] [자기강제 #3877] ...
```

통폐합 배치에서 병합·개명·분리가 일어나면 **영향받은 글의 블록만 자동 재생성** — 이것이 "작업이 글에도 반영되는" 메커니즘.

---

## 5. 실행 로드맵 (현재 위치: Phase 1 시작 전)

### Phase 1 — 정본 통일 ★지금 할 일★

1. Supabase **브랜치** 생성 (`create_branch`) — **운영 직접쓰기 금지.**
2. `theory-db-project/migration_theory_concepts.sql` 적용 → `theory_concepts`(8,196) + `theorist_concepts`(8,876) 적재 (CSV: `Theory_Concepts_canonical.csv`, `Theorist_Concepts_link.csv`).
3. 원어 백필: `sm_concepts.native`(409개) 조인. 이론가 ID 매칭: 이름 정확일치 update (SQL 초안에 포함).
4. **crosswalk 테이블** `theory_canon_map`(canon_id, concept_id, method, similarity) 구축: 71% 정확일치 자동 → 나머지 trgm/임베딩 → 잔여 ~10% 검토 큐.
5. `Theory_Index_통합.csv`의 OldMajor 매핑으로 theory_canon에 통합 택소노미 소급 (기존 분류 보존, 새 컬럼 또는 taxonomy_nodes/theory_families 활용).
6. 잔여 정리: 미매칭 canon 행 + 이론가 242명 표기 통일 → alias 등록.
7. 검증 후 `merge_branch`. 이후 **엑셀은 스냅숏 export로 강등** (형제 DB 금지, 정본은 Supabase 하나).

### Phase 2 — Occurrence 파이프라인

`concept_occurrences` 테이블(film_id, concept_surface, theorist_surface, source_file, snippet, resolved_concept_id nullable, embedding) + `concept_aliases` 테이블 신설. 추출 스크립트 작성(행동해독은 볼드 헤더, 극상글은 glossary 섹션이 파싱 앵커). **기존 에세이 ~48편 백필** 실행 → metake.net 기존 매칭과 대조 리포트(이미 맞음/누락/충돌) → 누락 자동 추가, 충돌만 큐.

### Phase 3 — 신규 글 루프

inbox 폴더(예: `극상글/_inbox/`) + 예약 작업(매일 1회 스캔) 또는 수동 트리거 → 추출→매칭→write-back. 사용자는 글만 쓰면 됨.

### Phase 4 — 통폐합 배치 (50편마다 또는 월 1회)

provisional↔기존 병합 후보 제시(임베딩+이름) → `merged_into`·alias 기록 / 발생 많고 응집도 낮은 개념 분리 후보 / 개명. 종료 시 영향 글 생성 블록 재생성.

### Phase 5 — 분석 강화

영화 분석 워크플로에 pgvector retrieval 연결: figure당 관련 정본 개념 top-10~20 제공.

---

## 6. 새 AI의 첫 30분 체크리스트

1. 이 문서 전체 + `theory-db-project/00_프로젝트_현황_및_재개가이드.md` 읽기.
2. Supabase MCP로 `kyniq`(jvgarcqrtsmgfimdcwgo) 연결 확인: `list_tables` → §2.2 행수와 대차 확인 (달라졌으면 그 사이 작업이 있었던 것 — 사용자에게 확인).
3. `theory_concepts` 테이블 존재 여부 확인 → 없으면 Phase 1부터, 있으면 Phase 진행도를 사용자에게 확인.
4. 로컬 파일 존재 확인: `theory-db-project/` 마스터 파일들, `thorist/` 덤프.
5. 작업 산출물은 반드시 `/Users/jerryje/Documents/MetaTake/`에 저장 (세션 임시 outputs 폴더는 세션 간 소멸).

## 7. 불변 원칙 (하지 말 것)

- 운영 DB 직접 쓰기 금지 — 항상 브랜치→검증→머지.
- 에세이 본문 산문 수정 금지 — 생성 블록만 파이프라인 소유.
- occurrence는 append-only — 기록 시점 중복 판단 금지.
- 개념 참조는 ID로 — 이름 하드코딩 금지.
- 신규 개념 날조 금지 — 검증 안 되면 provisional/스킵 (엑셀 구축 때의 품질 정책 계승).
- theory_canon 삭제 금지 — 보존 + crosswalk (사이트가 아직 참조).
- AVAULT 프로젝트 접근 금지 (무관한 별개 서비스).

## 8. 용어집

- **극상글 / UCM**: Ultra Creative Misreading. 영화 한 편의 밀도 높은 이론적 독해 에세이.
- **행동해독 브리핑**: 인물 행동을 3개 이론 전통으로 해독하는 정형 포맷 에세이.
- **figure**: 영화 속 장면/형상/모티프 단위 (kyniq.figures).
- **meta_take**: figure들을 묶는 개념 클러스터 (영화 쪽 개념층 — 이론 정본과 별개 축).
- **theory_canon**: 구세대 이론 정전 (2,587행, DB).
- **theory_concepts**: 신세대 정본 개념층 (엑셀 8,196 → Phase 1에서 DB 적재 예정).
- **occurrence**: 특정 글에서 특정 개념이 등장한 1회의 기록.
- **crosswalk**: theory_canon → theory_concepts 세대 간 매핑 테이블.
- **provisional**: 8천 개에 없어 새로 제안된 개념의 잠정 상태.

## 9. 관련 선행 문서

- `theory-db-project/00_프로젝트_현황_및_재개가이드.md` — 엑셀 DB 구축 6단계 공정 상세 (완료).
- `theory-db-project/통합_택소노미_백본.md` — 13/171/543 백본 정의.
- `DB_Protocol.md`, `MASTER.md` 등 루트의 기존 프로토콜 문서 — 본 문서와 충돌 시 본 문서 우선하되, 사이트 운영 규칙은 해당 문서 참조.

---

## 10. 작업 로그 — 2026-07-07 총정리 실행 (완료)

세션 사이에 대량 생성이 있었다: `essays` 3,278편(mode: concept_briefing 2,462 = /curious/decoder 행동해독, fan_theories 등), `essay_entity_links` 13,851건(concept 10,869 / theorist 2,982), `theorists` 3,760명으로 증가, **Phase 1의 핵심(theory_concepts 8,196 + theorist_concepts 8,876 + theory_canon_map)은 이미 적재되어 있었음.** 이 상태에서 사용자 지시("직접 해결")로 아래 통폐합을 프로덕션에 직접 실행했다(각 단계 백업/원장 있음).

### 10.1 concept vs tradition의 실체 (진단 확정)

- **/tradition (342개)** = `take_canon`(5,552링크)이 참조하는 `theory_canon` 행들. 이름과 달리 학파가 아니라 **구세대 정전 이론 항목**이라 근접중복 다수("Panopticism"/"The Panopticon", "Care Ethics"/"Ethics of Care", "Hyperreality"/"Hyper-reality" 등).
- **/concept (~1,078개)** = `essay_entity_links`의 concept 엔티티(에세이가 실제 호명한 개념).
- 즉 두 축 모두 "개념"이고 세대만 다른 것 — 분간이 안 가는 게 당연했다.

### 10.2 실행한 것

1. **tradition 중복 병합 18건** (342→324): 백업 `_bak_take_canon_20260707`, 원장 `canon_merges`(18행, 링크 110건 이동, 유실 0). 판정 원칙: 동일 이론가+동일 이론만 병합. 개념적으로 다른 쌍(Retributive↔Restorative Justice, The Gaze(Mulvey/Lacan)↔Clinical Gaze(Foucault), Biopower↔Biopolitics)은 보존.
2. **crosswalk 완성**: 사용 중 canon 342개 → `theory_canon_map` 100% 매핑(전체 2,004행). 방법: 정확/정규화 → trgm 후보 LLM 전수 판정(확정 25, review 5, 오매칭 기각 다수 — 예: Foucault Normalization↔Vaughan Normalization of Deviance 기각). 기존 오매핑 1건 교정(canon 16 Goffman → Dramaturgy #511, Alexander 동명 개념 아님).
3. **매칭 불가 canon 61건 → provisional 개념 생성** (`theory_concepts.source='provisional-from-canon-20260707'`) + 이론가 링크 부여.
4. **에세이 슬러그 버그 수정**: 파이프라인 slugify가 공백을 'e'로 치환한 버그 발견(`the-real`→`theereal`, 201회 사용 포함). `essay_entity_links` 1,471건 수정, `slug_aliases`에 리다이렉트 등록(총 960행). **이 버그는 essays 파이프라인 코드에 아직 살아있을 수 있음 — 코드 수정 필요.**
5. **concept 축 resolution 100%**: 고유 개념 엔티티 1,064개 전부 정본 연결 완료 — slug 정확 855 + `concept_aliases` 132(정규화 104 + LLM 판정 28) + provisional 신설 104(`source='provisional-from-essay-20260707'`: the Real, suture, double consciousness, primitive accumulation 등 유명하지만 DB에 없던 개념들).
6. 최종 상태: theory_concepts **8,361**(정식 8,196 + provisional 165), concept_aliases 132, canon_map 2,004(review 32), traditions 324.

### 10.3 남은 작업 목록 (2026-07-08 세션에서 대부분 처리됨 — §11 참조)

1. **review 큐 처리**: `theory_canon_map WHERE status='review'` 32건 + 병합 보류 후보(Frankfurt School↔Frankfurt School Aesthetics, Secularization 쌍, Fashion 군, Everyday↔Social Performance) 사용자 확인.
2. **provisional 165건 승격/병합 심사**: 이름·이론가 보강, 택소노미(part/major/sub) 배정.
3. **제품 제안 (frontend 작업 필요)**: /tradition의 이름-실체 불일치 해소. 권고안 — /tradition을 "정전 이론(canonical theory)" 축으로 솔직하게 리네이밍하거나, crosswalk을 통해 /concept으로 흡수하고 /tradition은 통합 택소노미 Major(171) 기반의 진짜 학파 축으로 재구축. 후자가 원설계(§4)에 부합.
4. **essays 파이프라인 슬러그 버그 코드 수정** (공백→'e'). 수정 전까지 새 글마다 같은 버그 재발.
5. 잔여 buggy 슬러그 소수(괄호 포함 이름 등 패턴 밖) 정리: `entity_slug ~ 'e[a-z]'` 계열 점검.
6. Phase 2~5는 §5 그대로 유효 — occurrence 테이블(concept_occurrences)은 사실상 `essay_entity_links`가 그 역할을 시작했으므로, 로컬 md 백필 시 이 테이블로 합류시킬 것.

---

## 14. 작업 로그 — 2026-07-11~12: 이론 인덱스 3면 통합 재설계 + 초상 썸네일 (배포 완료·라이브)

사용자 지시: `/concept`·`/theorist`·`/tradition` 인트로 3면 총정리. 문제 — ① 검색기 부재(특히 theorist·tradition은 아예 없음), ② concept의 도메인→필드→개념 3중 중첩 혼란, ③ **영화 없는 카테고리 노출**(Literature 도메인 0편, Management 600개념 중 35편만 등). 가치 프레임(사용자 강조): "이론 설명"이 아니라 **"세상에 이해 안 되는 것 → 이름(개념) → 스크린에서 목격"의 아카이브** — 영화=이론의 재현 가능한 수단. 0편 = 재현사례 없음 = UX·SEO 양쪽 저가치 → 기본 숨김이 정답.

1. **공용 셸 `components/theory/TheoryExplorer.tsx`(client)** — 3면 공통: 히어로(질문형 가치 카피)+**통합 검색**(`/api/search kinds=idea,theorist,tradition mode=lex`, 종류별 그룹 결과)+**축 전환 탭**(Concepts·Theorists·Traditions는 실제 `<Link>` 라우트라 각자 canonical/JSON-LD 유지)+children(SSR 브라우즈, searching 중 `hidden`으로 크롤 링크 보존). 세 `page.tsx`가 이 셸을 감싸고 축별 브라우즈를 children으로 주입. **⚠️ `type=search` 네이티브 ✕ 중복 → `::-webkit-search-cancel-button{display:none}`.**
2. **축별 브라우즈 컴포넌트** — `TheoristDirectory`(레터바+films/AZ 정렬+얼굴 카드+블러브 글로스), `TraditionDirectory`(도메인 그룹+films>0 기본, 0편 26개는 토글), `ConceptDomainRail`(도메인 카드, **live>0만**—Literature 0편 숨김, "N on screen of M"+도메인 글로스), `DomainConcepts`(도메인 페이지 필드→개념, films=0 기본숨김+**"Show N not yet on screen" 토글**로 전체 레지스트리 노출, 전체는 DOM 상주라 크롤 가능). `ConceptDirectory`에 썸네일 슬롯 추가(기존 검색/정렬/레터바 유지).
3. **영화 없는 카테고리 게이팅(핵심 수정)** — 도메인 페이지 `/concept/domain/[domain]`는 이제 영화 있는 개념만 기본 노출(예: Management 35/600, "Where does cinema stage management?" 카피), 나머지는 토글. /tradition은 films>0 학파만 기본. /concept 도메인 레일은 Literature(2개념·0편) 숨김. **불변식: 0편을 완전 삭제가 아니라 게이팅**(전체 레지스트리는 SEO 자산이라 DOM 상주).
4. **초상 썸네일(사용자 추가지시 "감독처럼 얼굴")** — 이미지 컬럼 부재(`theorists`=id·slug·name·blurb뿐). 기존 `lib/theorist_qid.json`(299 QID)을 **`scripts/build-theorist-portraits.mjs`로 Wikidata P18→Commons `Special:FilePath?width=200` 백필 → `lib/theorist_portrait.json`(261명)**. 이론가 카드=slug 직접 조회. **컨셉 행=theorist NAME만 보유 → concept 페이지에서 `theorist_index`로 name→slug→portrait 맵 빌드**(그래서 loadRows에 theorist_index RPC 추가). 초상 없으면 모노그램(이니셜) 폴백. plain `<img loading=lazy>`(CSP 무관 — slug 페이지가 이미 같은 Commons 패턴 사용). 책·논문 표지는 데이터 부재라 이론가 얼굴로 대체.
5. **가치·질문형 SEO** — 타이틀/H1/카피 전부 "film examples"·질문형: `/concept` "…1,404 Ideas, 16,420 Film Examples", `/theorist` "Film Theorists A–Z — the thinkers cinema is read through", `/tradition` "Schools of Film Theory — traditions and the films that carry them", 도메인 "Where does cinema stage X?". 세 면에 CollectionPage+BreadcrumbList(+ItemList) JSON-LD. §13의 "사전 오독 방지" 정신 계승.
6. **라이브 검증**: 로컬 dev(스크린샷)+**프로덕션 4면 전부 확인**(/concept·/theorist·/tradition·/concept/domain/management). 초상 425개 렌더, 게이트 토글 작동. 타입체크 제 파일 0 에러.
7. **⚠️ 함정(다음 에이전트 필독)**: (a) **`app/globals.css`의 `@import "tailwindcss"` 후 폰트 `@import url()`는 tailwind 확장 후 순서위반 → `next dev`(Turbopack) 500. 하지만 프로덕션 빌드는 정상**(Vercel 배포 전부 READY, 번들러 turbopack이어도 build는 dev만큼 엄격치 않음). **검증은 tsc + 프로덕션, `next dev` 아님.** (b) My Films 렌즈 `.mtl-swap-out`은 concept/theorist에서 보존(tradition은 대체목록 없어 제외 — §13.6과 동일 이유). (c) 셸의 통합검색은 `hrefOf`가 idea→/concept, theorist→/theorist, tradition→/tradition 매핑에 의존([[unified-hybrid-search-live]]). (d) 배포 CHURN: 워처가 파일별 커밋→다중 배포, 동시 세션과 인덱스 경합 가능 — 배포 후 Vercel 최신 state READY 확인.
8. **연관 auto-memory**: `theory-index-explorer-redesign`(상세). 이 3면은 [[index-explorer-redesign]](/film·/director의 IndexExplorer)와 자매 패턴이나 별도 컴포넌트(theory 전용 셸).

## 13. 작업 로그 — 2026-07-08 (3차): 이론 축 상세 기획 구현 (배포 완료)

사용자 스펙: 모든 목록에 숫자, A–Z·필터·이론가 정렬, 개념 상세 내 검색/소팅/필터, 개념 '명함 카드' 디자인(질감·서체), 표기 규범, 한국어 라벨 영문화, 무LLM SEO 부제 일관화.

1. **DB**: `concept_live_registry`(영화 걸린 개념 1,141 + 영화수 + 이론가), `concept_domain_live(part)`(도메인 개념 전수 + 영화수), `concept_domain_counts`(14개 도메인 요약), `school_name` 한국어→괄호영문 추출. sm 'hane'→'han' 슬러그 교정.
2. **/concept 인덱스**: `ConceptDirectory` 클라이언트 컴포넌트 — 검색(개념+이론가), A–Z 레터바, 정렬 3모드(영화수/A–Z/이론가별 "이름 — 개념"), 전 행 영화 수. 도메인 칩에 등록/상영중 숫자. 타이틀 "Film Theory Concepts A–Z — 1,554 Ideas, 15,384 Film Readings".
3. **/concept/domain/[domain]**: 분야 헤더에 "N concepts · M film readings", 개념별 영화수, 영화수순 정렬, 한국어 분야명은 괄호 영문 표기.
4. **개념 상세**: `ReadingsExplorer` — 리딩 12건 초과 시 검색(영화/테제/이론가)+프레임워크/연대 필터+정렬(관련도/최신/최고전/A–Z). **개념 명함 카드**(.ccard) — 레이드지 텍스처(SVG feTurbulence)+이중 괘선+PT Serif 표제+Inter 킥커+이탤릭 한줄정의+이론가 칩+영화수 스탯.
5. **표기 규범(확정)**: 제목·목록의 개념명은 문장 첫 글자만 대문자(sentence case), 따옴표·꺾쇠 없음, 본문 산문 속 언급만 `<em>`. 원어는 " · 원어" 병기. 데이터는 원형 보존, 표시만 변환.
6. **/tradition 빈 화면 수정**: 원인은 my-films 렌즈 only 모드에서 `.mtl-swap-out`이 목록을 숨기는데 대체 컴포넌트가 없던 것 — 클래스 제거로 해결. 행에 "N concepts" 부기. **존치 결정**(학파 축 = 검색 자산).
7. **개념 데이터 병합 25건 추가**(괄호 변형·동일 이론 쌍: Bad faith/mauvaise foi, Bare life/homo sacer, Social Contract 등; Lyotard 포스트모던 숭고 등 학술적 구별 쌍은 보존). 인덱스 병합 로직도 괄호 병기 접기.
8. **데스크(curious) 에세이 카드화**: 개념 페이지의 "From the desks"가 제목 텍스트 링크뿐이던 것을 → RPC `concept_desk_essays`(영화 백드롭 + essays.dek/본문 발췌 + 데스크 라벨) 기반 카드로 격상. 미스리딩 카드와 동급 비주얼(DECODER/FAN THEORIES 등 데스크별 컬러 라벨). 라이브 검증: /concept/duration.
9-b. **E-E-A-T 요소**: 개념 페이지(양 분기)에 저작 표시·개정 날짜·메쏘드 링크 라인 추가 — "By the Metatake concept desk · Revised {date} · How we read films →(/methodology)". 개정일은 RPC `concept_last_updated`(연결 에세이 최신 published_at). theory 분기 JSON-LD에 WebPage(dateModified + author Organization) 추가.
9. **명함 카드 v2 (사용자 디자인 지시)**: 카드는 키워드 단독 — 중앙 정렬, 타자기 서체(American Typewriter 계열), 자간 .07em, 킥커 "CONCEPTS ON SCREEN"(자간 .34em), 넉넉한 여백(패딩 54px). 한줄정의·이론가 칩·영화 스탯은 카드 밖으로. **카드 직후 첫 문장이 코너 정체성 선언**: "This is not a dictionary entry. The concept desk tracks where X actually surfaces on screen — N films…" (사전으로 오독되는 SEO 리스크 대응). 설명은 "THE IDEA IN BRIEF" 라벨로 그 아래. 데스크 에세이에도 `DeskExplorer`(검색·데스크 필터·정렬, 8건 초과 시) 적용, 수집 한도 12→36.

## 12. 작업 로그 — 2026-07-08 (2차): concept/tradition 축 통합 + 학파 축 재건 (배포 완료)

사용자 결정: "tradition과 concept은 구분 안 되니 합치되, /tradition은 진짜 학파 축으로 재건"(추천안 승인). 실행·배포·라이브 검증 완료.

1. **DB (마이그레이션 `tradition_school_axis_rpcs`)**: `school_name/school_slug`(Major 라벨 정규화), `canon_concept_slug`(구 슬러그→정본 개념, 308용), `concept_canon_readings`(crosswalk 경유 Strong Misreadings — concept 페이지 흡수용), `theory_schools_index`(학파 179개: 개념·영화 수 집계), `theory_school_detail`(학파 소속 개념+영화수+이론가). 전부 SECURITY DEFINER.
2. **`app/tradition/[slug]/page.tsx` 재작성**: 학파 슬러그면 학파 페이지, 구 canon 슬러그면 `permanentRedirect`로 `/concept/<정본>`에 308. 구 URL 383개의 `slug_aliases` 원장 등록(reason='tradition-axis-merge').
3. **`app/tradition/page.tsx` 재작성**: 택소노미 Major 기반 학파 인덱스(179개).
4. **`app/concept/[slug]/page.tsx` 확장**: `concept_canon_readings` 흡수 — sm 분기는 리딩 병합(take_id dedupe), theory 분기는 "Strong Misreadings that lean on X" 섹션 신설. 리스티클 제목·robots도 흡수분 포함해 계산.
5. **라이브 검증**: `/tradition/the-gaze` → `/concept/the-gaze` 308 + "310 Films That Can Be Read Through Lacan's Gaze"(흡수로 298→310). `/tradition` = 학파 인덱스. `/tradition/psychoanalytic-psychological` = "Psychoanalytic & Psychological in Film — 1507 Readings Across 43 Concepts".
6. 남은 소일거리: 택소노미 Major 라벨 정리(번호 변형·한국어 Family 라벨 영문화 여부는 편집 판단), lib/related.ts의 tradition 티저 로직은 구 축 기준이라 추후 학파 기준으로 갱신 가능.

## 11. 작업 로그 — 2026-07-08 실행 (§10.3의 잔여 작업 + 사용자 승인 일괄 처리)

사용자가 "모두 추천대로" 승인 → 직접 실행. **중요: 이 폴더(MetaTake)가 곧 사이트 저장소**(Next.js app/ + worker/ 파이프라인)임이 확인됨 — 코드 수정까지 포함해 처리했다.

### 11.1 데이터 (Supabase kyniq, 모두 완료)

1. **review 큐 32건 판정 → 0건**: 승인 17(동일 이론·이론가), 재매핑 3(Halbwachs→Collective Memory, Sontag Disease Narratives→Illness as Metaphor, Taylor→A Secular Age), 기각 12(예: Presentism↔Presenteeism, Transactional↔Transformational Leadership) → 기각분은 provisional 생성·매핑.
2. **Frankfurt School 병합** (canon 1602→744): tradition 324→**323**.
3. **provisional 심사**: 내부·정식 중복 20건 병합(Repetition compulsion 3종→1, Heteronym/s, the-unreliable-narrator→정식 등; 링크 이동·리다이렉트·alias 원장 기록), 잔여 **157건 전원 택소노미(part/major/sub) 배정 완료**.
4. **2차 슬러그 버그 대청소 (원천)**: 버그(공백→'e')의 뿌리는 `sm_concepts.slug`(440건)와 `theorists.slug`(504건)였음 — `desk_link_dictionary` RPC가 이를 퍼뜨림. 원천 교정 + `/concept/*`,`/theorist/*` 리다이렉트 등록, entity_links 2차 패턴(괄호 포함) 56건 추가 수정.
5. **별칭 오염 대청소**: 사전 생성의 "괄호 별칭" 규칙이 `(Human)`, `(Memory)`, `(Performance)` 같은 도메인 꼬리표를 별칭으로 등록 → 일반 단어가 나오는 에세이가 엉뚱한 개념에 연결. **오염 링크 4,241건(콘셉트 링크의 39%) 백업 후 삭제** (`_bak_eel_alias_pollution_20260708`). concept 축: 939 distinct / 6,628 links로 정화.

### 11.2 코드 (이 저장소, 커밋 전 — 사용자 검토 후 배포)

1. `worker/build-entity-links.py` + `lib/desks.ts`: 괄호 별칭 규칙 교체 — 머리말(꼬리표 제거)은 별칭 허용, 괄호 안은 "단일 토큰 & (길이≥12 또는 비ASCII)"만 허용(Wiederholungszwang은 살고 Human은 죽음). **슬러그 버그·별칭 오염 재발 방지.**
2. **무LLM SEO 리스티클 제목** (`lib/listicle.ts` 신설): 데이터만으로 `"49 Films That Can Be Read Through Kant's Sublime"` 형 제목·설명 생성(고유 영화 수 + 첫 이론가 성 + 실제 영화 제목 2개 "From X to Y:"). 적용: `app/tradition/[slug]/page.tsx`(title/description/og/부제), `app/concept/[slug]/page.tsx`(sm·theory 분기 title/description + 부제). 영화 수 3편 미만이면 기존 제목 유지. 설명에 실제 영화 제목이 들어가므로 "영화와 동떨어진 느낌" 방지.
3. 타입체크: 수정 파일 에러 0 (저장소 기존 에러 53건은 별개 — .next 스테일 타입, admin 페이지 등).

### 11.2b 배포 및 배포 중 발견·수정한 프로덕션 버그 (2026-07-08)

- **배포 완료**: 사용자 Mac의 auto-deploy 워처가 커밋·푸시 → Vercel 빌드 READY → metatake.net 반영. 라이브 검증: `/tradition/the-gaze` 제목이 "298 Films That Can Be Read Through Lacan's Gaze"로 렌더링 확인.
- **RLS 버그 발견·수정**: `/tradition/[slug]` 상세가 전부 404였음(코드 변경과 무관한 기존 버그). 원인: `theory_canon` 등 이론 계층 테이블에 RLS만 켜져 있고 anon SELECT 정책이 없어 페이지의 anon 쿼리가 빈 결과 → notFound. 마이그레이션 `public_read_policies_theory_layer`로 `theory_canon, take_canon, sm_concepts, concept_aliases, theory_canon_map`에 공개 읽기 정책 추가. 이미 404로 ISR 캐시된 슬러그는 최대 30분(revalidate 1800) 후 자동 회복.
- 샌드박스에서 git 잠금파일(.git/HEAD.lock) 잔류 사고 있었음 — 제거 완료, fsck 정상.

### 11.3 남은 것 배포 후 `build-entity-links.py --truncate` 재실행하면 사전이 깨끗한 상태에서 링크 재생성됨(현 DB는 이미 수동 정화됨이라 필수는 아님).
2. **/tradition 축의 학파 재구축**(§10.3-3 후자안): 데이터 기반(crosswalk 100%)은 완성. 통합 택소노미 Major(171) 기반의 학파 페이지 신설은 별도 기능 작업으로 남음.
3. provisional 157건의 one_liner(한줄정의)·native(원어) 보강 — 다음 배치에서.
4. `theory_concepts` 택소노미 라벨 표기 불일치(번호 붙은 "7. Visual Culture…" vs 없는 것) 정규화 — 표시용이라 급하지 않음.
