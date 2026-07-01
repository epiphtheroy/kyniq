# MetaTake 계보 레이어 — 인터페이스 계약서 (Interface Contract) · v3

> 계보(Lineage) 레이어를 **별도로 구축해 마스터 에이전트에게 넘기기 위한** 합의서.
> 통합(테이블 생성·적재·웹 연동)은 전적으로 마스터 에이전트가 수행합니다.
> v3 변경: **에디션(연도판) 층 도입**, `result`/`rank` 1급화, `label_ko` 제거.
> 작성: 2026-06-24 · 대상 DB: `kyniq` (jvgarcqrtsmgfimdcwgo)

---

## 1. 역할 경계 (Boundary)

| 주체 | 하는 일 | 하지 않는 일 |
|---|---|---|
| **설계·데이터 에이전트** (이 패키지 작성자) | DB **읽기(SELECT)만** · 외부 조사(Wikidata·TSPDT·영화제) · **파일 산출물** 생성 | DB 쓰기, DDL, `apply_migration`, `execute_sql` 쓰기, 직접 적재·스키마 변경 |
| **마스터 에이전트** (통합 담당) | 스키마 적용/변형 결정 · 테이블 생성 · 적재(upsert) · `film_affinities` 확장 · 웹 연동 | — |

> 이 패키지의 어떤 파일도 자동 적용되지 않습니다. 마스터가 검토 후 적용합니다.

---

## 2. 데이터 모델 — 3층 (이번 버전의 핵심)

```
lineage_lists (시리즈/권위)        예: 황금종려상, 칸 경쟁부문, S&S 비평가폴, 누벨바그
   └─ lineage_editions (연도판)     예: 황금종려상 2019, S&S 2022, TSPDT 2024판   ← 연도는 '항상' 여기
        └─ film_lineage (소속/결과)  result(won/nominated/selected), rank   ← 영화는 tmdb_id 로 연결
```

**연도(year) 처리 규칙** — 과거 결함을 바로잡은 부분:
- 연도가 **리스트 정체성**인 것(S&S 2012≠2022, TSPDT 판본) → `lineage_editions` 의 행.
- 매년 반복되는 **수상·선정** → 같은 리스트의 연도별 `lineage_editions` + `film_lineage.result`.
- **사조(movement)·국가 정전 일부** 처럼 연도 없는 소속 → 에디션 없이 `film_lineage` 가 list 에 직접 연결(`edition_year` 공란).

## 3. 공통 키 계약 (Schema-agnostic)

내부 uuid를 절대 노출하지 않습니다. 안정 키로만 참조:
- **영화 = `tmdb_id`** (films.tmdb_id, UNIQUE, 100% 채움)
- **리스트 = `slug`** (kebab, facet 네임스페이스)
- **에디션 = (`list_slug`, `year`)** 조합 → 마스터가 edition_id 로 해소
- **계층 = `parent_slug`** (uuid 아님)

---

## 4. 파일 인터페이스 (규격)

### 4.1 `seeds/lineage_lists.csv` — 시리즈/권위
| 컬럼 | 필수 | 의미 |
|---|---|---|
| `facet` | ✅ | `festival`/`section`/`award`/`canon`/`movement`/`national`/`auteur` |
| `slug` | ✅ | 전역 UNIQUE, kebab |
| `label` | ✅ | 표시명(영문) |
| `parent_slug` | | 상위 slug (award/section→festival, 하위사조→사조) |
| `country` | | iso2. '국가 라인' 그룹핑 (national/auteur 채움; 영화제·정전은 국제이므로 보통 비움) |
| `has_editions` | ✅ | `true`/`false` (연도판 보유 여부) |
| `tier` | ✅ | `T1`~`T4` 등급 (03_registry_spec.md 루브릭) |
| `authority_weight` | | 0~1, tier 밴드 내 값 |
| `source` | | `tspdt`/`wikidata`/`bfi`/`editorial`… |
| `external_ref` | | JSON 문자열 |
| `description` | | |

> 아우터(작가주의 감독) 라인은 `facet=auteur` + `country` 로 국가 라인에 합류한다. 상세: `04_auteur_spec.md`.

### 4.2 `seeds/lineage_editions.csv` — 연도판 (연도가 사는 곳)
| 컬럼 | 필수 | 의미 |
|---|---|---|
| `list_slug` | ✅ | 상위 리스트 slug |
| `year` | ✅ | 연도 |
| `edition_label` | | "72nd", "21st" 등 |
| `slug` | ✅ | 전역 UNIQUE (예: `cannes-palme-dor-2019`) |
| `rank_max` | | 정전 리스트 크기(예: 1000) |
| `source` / `external_ref` | | |

> `has_editions=false` 인 리스트(사조 등)는 이 파일에 행이 없습니다.

### 4.3 `mappings/film_lineage.csv` — 영화 ↔ 리스트(+에디션) 소속/결과
| 컬럼 | 필수 | 의미 |
|---|---|---|
| `tmdb_id` | ✅ | films.tmdb_id 로 해소 |
| `list_slug` | ✅ | lineage_lists.slug 로 해소 |
| `edition_year` | | 있으면 (list_slug, year)→edition_id 해소. 사조 등은 공란 |
| `result` | | `won`/`nominated`/`selected` (수상·선정) |
| `rank` | | 정전 에디션 내 순위 |
| `value` | | JSON(보조). 기본 `{}` |
| `confidence` | | 0~1 (퍼지 매칭일수록 낮춤) |
| `source` | | |

> CSV 내 JSON·아포스트로피 값은 따옴표로 감쌉니다.

---

## 5. 마스터 에이전트용 통합 절차

1. `02_schema.sql` 검토 → 적용하거나 자체 스키마로 변형(컬럼 의미만 맞으면 무방).
2. `lineage_lists` upsert(`ON CONFLICT (slug)`) → `parent_slug`→`parent_id` 2차 패스.
3. `lineage_editions` upsert(`ON CONFLICT (slug)`; 또는 `(list_id, year)`) — `list_slug`→`list_id` 해소.
4. `film_lineage` upsert:
   - `tmdb_id`→`films.id`, `list_slug`→`list_id`, (`list_slug`,`edition_year`)→`edition_id`(있으면).
   - 중복 키 = (film_id, list_id, edition_id).
5. **정전 완전성 원칙 (확정)**: 계보 라인은 **TMDB 기준으로 완전하게** 나온다 — 기존 ~1,900 로컬 카탈로그에 있든 없든. 로컬 DB는 *참고일 뿐 게이트가 아니다.*
   - tmdb_id 미존재 시 **스킵 금지** → `films`에 tmdb_id 앵커로 레코드 생성(`visible=false`,`hold=true`).
   - **DB 존재 유무는 별도 플래그**로만 기록: 기존 카탈로그 = `in_seed_catalog=true`, 정전으로 새로 들어온 영화 = `false`(아래 §schema 추가 컬럼). 게이팅 아님, 단순 체크 항목.
6. `selectivity`/`film_count` 재계산(schema §8).
7. `film_affinities` additive 확장 → `lineage_score`/`shared_list_ids` 계산.
8. `verify.sql` 로 검증.

---

## 6. 충돌 보증

- 기존 컬럼/값 **무수정** (`films.genres/keywords`, `canonical_tags`, `taxonomy_nodes`, `meta_takes`).
- 신규 식별자만: `lineage_lists`, `lineage_editions`, `film_lineage`, `lineage_list_aliases`, `lineage_sources`.
- `film_affinities` 는 **nullable·additive 컬럼만** 추가.
- 공개 라우팅 `/lists/<slug>`, `/lists/<slug>/<year>` 로 기존과 분리 권장.

---

## 7. 범위 카탈로그 (무엇을 채울 것인가)

| facet | 1차 시드(핵심) | 확장 |
|---|---|---|
| festival/section/award | 칸·베니스·베를린 주요 부문/상 | 선댄스·로카르노·로테르담·TIFF 등 |
| award(academy/national) | 아카데미(작품·국제장편·감독) | 세자르·청룡·대종 등 |
| canon | S&S(각 판, 비평가/감독)·TSPDT·AFI 100·1001 Movies | Cahiers 연간·Criterion·National Film Registry |
| movement | 누벨바그·네오리얼리즘·뉴할리우드·일/홍/대/한/이란 뉴웨이브·도그마95 등 (~30-50, 유한) | 군소 사조 |
| national | (선택) 국가×연도 베스트 | 대량 확장 영역 |

> `era`(연대)는 `films.year` 파생. **`auteur`(작가주의 감독)는 `facet=auteur` 라인 + `country` 로 국가 라인에서 관리**(대표작만 큐레이션, `04_auteur_spec.md`); 사람 메타는 `directors` 유지, 전체 필모는 `director_slug` 자동 군집.

---

## 8. 패키지 구성

```
handoff/
  00_INTERFACE_CONTRACT.md     ← (이 문서)
  01_design.md                 ← 설계도 (분석 + 근거)
  02_schema.sql                ← 제안 마이그레이션 v3 (3층 + country/auteur/in_seed_catalog)
  03_registry_spec.md          ← 레지스트리 빌드 스펙 (등급 T1–T4)
  04_auteur_spec.md            ← 아우터(감독) 라인 스펙
  seeds/
    lineage_lists.csv          ← 레지스트리 실데이터 (133개, country 포함)
    lineage_editions.csv       ← 연도판 실데이터 (15개)
    auteurs.template.csv       ← 아우터 레지스트리 규격
    *.template.csv             ← 컬럼 규격 예시
    README.md
  mappings/
    film_lineage.template.csv  ← 소속/결과 (TMDB 기준 완전, 로컬 DB 게이트 아님)
    film_auteur.template.csv   ← 대표작 (rep_type: defining/recent/both)
    README.md
  ingest_spec.md
  verify.sql
```
