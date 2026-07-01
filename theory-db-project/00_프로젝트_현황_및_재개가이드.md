# 영화이론 DB 프로젝트 — 현황 및 인수인계 가이드

최종 업데이트: 2026-06-26 (3차 — 커버리지 공백 보강까지 완료)
이 문서 하나로 전체 공정·의도·결과·파일 위치를 파악하고 이어서 작업할 수 있습니다.
모든 산출물 위치: `/Users/jerryje/Documents/MetaTake/theory-db-project/`

---

## 0. 프로젝트 의도(왜) 한 줄

영화 내용 분석을 위한 **이론가·이론·개념 데이터베이스**를 구축하고, 실제 학술장(Film Quarterly·50개 저널)과 대조해 **커버리지를 검증·보강**한다. 최종적으로 MetaTake 제품 DB(Supabase `kyniq`)에 통합 가능한 형태로 정리한다.

**연결 정보**
- MetaTake DB = Supabase 프로젝트 **`kyniq`** (project_id `jvgarcqrtsmgfimdcwgo`). 핵심 테이블: `theory_canon`(2,587 이론), `theorists`(1,840), `canon_theorist`, `sm_concepts`(1,227, 원어 409), `taxonomy_nodes`(2,928, *영화 내용*용), `theory_families`(0, 비어있음).
- 원본 입력: `MetaTake/thorist/Theories and Theorists - 시트1.csv`(=theory_canon 덤프), `MetaTake/magazine research agent/film-theory-journals-50.csv`(50저널 목록), 업로드 `445 Theorist List Final.md`.

---

## 1. 전체 공정·결과 (단계별, 전부 DONE)

| 단계 | 무엇을·왜 | 결과 | 핵심 산출물 |
|---|---|---|---|
| 1 | 445 이론가 리스트 평가·동시대 보강 | 오류 ~20건 수정, 신규 95명 | `이론가리스트_평가보강_보고서.md`, `이론가_리스트_보강판.md` |
| 2 | 난립 택소노미 통합 + 이중 마스터 | 1,528→171 Major(+543 Sub), 13 Part 전수 재매핑 | `Unified_Theory_Master.xlsx`, `통합_택소노미_백본.md`, `통합_작업_보고서.md` |
| 3 | 이론가→고유개념 DB(3~10개) | **이론가 2,219 · 개념 8,876행 · canonical 8,196** | `Theory_Concept_DB.xlsx`, `Theorist_Concepts_link.csv`, `Theory_Concepts_canonical.csv`, `migration_theory_concepts.sql` |
| 4 | Film Quarterly 커버리지 검증 | 이론가 36%/개념 21%, 공백 ~50명 식별 | `FQ_커버리지_보고서.md` |
| 5 | 50개 저널 하네스 + 커버리지 | 334 레코드/47저널, 이론가 55%/키워드 33%, 공백 ~59명 | `Journal_Theory_Keyword_DB.xlsx`, `Journal50_Coverage_Report.md` |
| 6 | **커버리지 공백 보강(이번 세션)** | 공백 195명 중 **192명 보강**(개념 817행 추가) + 로스터 union 보정 | (3단계 `Theory_Concept_DB.xlsx`에 통합, v3) |

### 6단계 상세 (이번 세션에 한 일·공정·의도)
- **의도**: 4·5단계에서 "정전은 잘 커버하나 현재 활동 중 동시대 영화학자가 공백"임을 확인 → 그 공백을 메워 DB를 최신 학술장에 맞춤.
- **공정**:
  1. FQ 공백 + 50저널 공백을 **합집합·정제**(감독·작가 등 비이론가 제외, 이미 ≥3개 보유자 제외) → **보강 대상 195명** 산출.
  2. 10개 **병렬 에이전트**가 20명씩 담당, 각 이론가 **3~10개 고유 개념**을 추출. **품질관리**: 동시대 학자는 WebSearch 검증, 정전만 지식 허용, **날조 금지**(검증 안 되면 축소/스킵). 원어·한줄정의·통합 택소노미(Part/Major/Sub)·era·source(DB/Knowledge/Web)·confidence(high/med) 부여.
  3. 결과를 기존 개념 DB에 **병합·dedup**, canonical 재생성, 워크북 v3 재빌드. QC(빈 행 0, Part 라벨 검증, 중복 제거) 통과.
- **결과**: 이론가 2,027→**2,219명**, 개념 8,059→**8,876행**. 보강 192명은 대부분 web 검증(Web 출처 1,059행). **로스터 union 보정**도 동시 해결 — DB `theorists`에만 있고 우리 개념DB엔 없던 인물(Barbara Creed·Jean-Louis Baudry·Sergei Eisenstein·Siegfried Kracauer·Tania Modleski·Mary Ann Doane·Anne Friedberg·Janet Staiger 등)이 이 보강에 포함돼 개념과 함께 회수됨.
- **품질 예시**(스폿체크 통과): Eisenstein(intellectual montage/монтаж аттракционов…), Malabou(plasticity/plasticité, destructive plasticity), Hongwei Bao(tongzhi/同志, queer socialism), Benson-Allott(killer tapes, post-cinematic spectatorship), Steinbock(shimmering), Gómez-Barris(extractive zone, submerged perspectives).
- **미보강 3명**: Hila Peleg(큐레이터·감독, 고유 이론 없음 — 스킵), 그리고 일부 군소 공저자는 confidence=med·3개로 축소. 정직한 미달 33명(전체의 1.5%)은 검증 불가한 군소 인물.

---

## 2. 남은 일 (NEXT)

### 🔴 우선순위 1 — DB 반영(사용자 승인 후)
1. **Supabase 브랜치 적용**: `migration_theory_concepts.sql`을 `kyniq` 브랜치에 적용·검증 후 머지(운영 직접쓰기 금지). `theory_concepts`(8,196 개념)/`theorist_concepts`(8,876 M:N) 적재 + 원어 백필(sm_concepts 조인) + 신규 이론가 insert.
2. **택소노미 노드화**: 통합 백본(171 Major/543 Sub)을 `taxonomy_nodes`에 kind=theory_part/major/sub로 추가(또는 비어있는 `theory_families` 채움). 기존 theory_canon 분류는 보존.

### 🟠 우선순위 2 — 심화(선택)
3. **페이월 본문 심화**: 50저널 다수가 abstract 기반. 브라우저 도구(Chrome MCP, JS 렌더링)·기관 접근으로 본문을 열면 저널당 레코드 확대 + 커버리지 재측정.
4. **신조어 키워드 인덱스**: 저널 키워드 DB의 동시대 신조어(spectacular silence, re'nao 등)는 일반 DB엔 없어도 검색·태깅용 보조 인덱스로 유지.

### 재개 체크리스트
1. 이 문서 + `_work/` 확인. 2. Supabase MCP로 `kyniq` 연결 확인(`list_tables`). 3. 위 우선순위 1(마이그레이션) 또는 추가 요청부터.
> `outputs/` 임시폴더는 세션 간 비워짐 — 새 산출물은 반드시 이 영구 폴더로 복사.

---

## 3. 파일 인덱스 (이 폴더)

| 파일 | 내용 |
|---|---|
| `Theory_Concept_DB.xlsx` | **이론가→개념 DB v3 (2,219명·8,876행)** — 메인 |
| `Theorist_Concepts_link.csv` / `Theory_Concepts_canonical.csv` | 위 DB의 CSV(적재용) |
| `Unified_Theory_Master.xlsx` | 통합 택소노미 + 이론/이론가 이중 마스터 |
| `Journal_Theory_Keyword_DB.xlsx` | 50저널 키워드 DB(334행) + Coverage 탭 |
| `migration_theory_concepts.sql` | DB 적재 마이그레이션 초안(미적용) |
| `*_보고서.md` / `Journal50_Coverage_Report.md` / `FQ_커버리지_보고서.md` | 단계별 보고서 |
| `통합_택소노미_백본.md` | 13 Part·171 Major·543 Sub 백본 |
| `_work/unified/` | 택소노미 맵·개념 청크·하베스트 중간물 |
| `_work/coverage/` | FQ·저널 커버리지 추출·판정·보강(augout) 원본 |
| `_work/journals/` | 저널 그룹별 추출 원본 grp_1..10 |

(영문 사본: `00_Project_Status_Resume_Guide.md`, `Journal50_Coverage_Report.md`)
