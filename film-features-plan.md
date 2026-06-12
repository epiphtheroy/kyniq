# FilmCurio — 영화 허브 고정 섹션 4종 설계 (film features)

> 결정 요약: 30개 프롬프트 컬렉션(폴더 "30 Prompts")을 검토한 결과,
> 고정 섹션은 **10개가 아니라 4개**로 확정한다. 컬렉션의 나머지(해석 방법론형:
> SIGNIFIER·ENIGMA·PSYCHO·PHILOSOPHY·CHARACTER·FIGURE·FACE 등)는 고정 섹션이
> 아니라 **featured-qa 생성 프롬프트의 질문 선정·답변 렌즈 보강재**로 흡수한다.
> 근거: 해석 영역은 이미 틀(frame) 레이어와 영화 고유 Q&A가 커버하며,
> 같은 틀의 글 × 1,000편은 scaled-content 패턴이므로 고정물은 적을수록,
> 서로 구조가 다를수록 안전하다.

## 1. 고정 섹션 4종 (kind)

| kind | 원천 프롬프트 | 형식 | 방문자 의도 |
|---|---|---|---|
| `pitch` | ASSET/CINECODEX 축약 | 산문 (스포일러 제로) | **안 본 사람**: 볼만한가? |
| `record` | MATRIX+LEDGER+BUSINESS 통합 | 구조화 데이터(jsonb) | 사실 확인: 제작·산업·수상 |
| `reception` | METACRITIC | 산문 | 담론: 당시 vs 현재 평가 |
| `experience` | AESTHETIC 10단계 | 분류(enum)+동급작 5편 | 탐색: 비슷한 경험의 영화 |

설계 원칙:
- **2존 영화 허브**: 허브 상단 = 프리뷰 존(pitch/record/experience — 안 본 사람도
  안전, 스포일러 제로 보장), 하단 = 해석 존(reception 일부 + Q&A — 스포일러 가드
  적용). ASSET의 "절대 스포일러 금지" 규율이 상단 존의 계약이다.
- **pitch**는 원본 7 Acquisitions를 **3 assets + invitation**으로 압축(허브는
  목차이지 에세이가 아님). 5/10단어 케이던스 규칙은 유지(차별적 문체 자산).
- **record**는 산문이 아니라 **필드**다: 예산/흥행/수상/제작비화/전략적 의미.
  이 구조화가 "디렉토리"의 실체이고 영화 간 비교 쿼리·JSON-LD의 재료다.
- **experience의 10단계는 전역 닫힌 enum으로 승격**: `films.aesthetic_level`
  (1–10). ending_type과 같은 1급 분류축 — `/experience/[level]` 허브 차원이
  공짜로 생기고 추천("같은 강도의 영화")의 축이 된다.
- **reception**은 "개봉 당시 지배적 해석 → 전환점 → 현재 위상"의 3박자 산문.

## 2. 스키마 (migration 0012)

```sql
film_features(id, film_id, kind, body text, payload jsonb,
              status[draft|approved|published|hidden],
              source, generated_by, self_confidence, claims_sourced,
              created_at, updated_at, UNIQUE(film_id, kind))
films.aesthetic_level int (1-10), films.aesthetic_label text
```

- RLS: 익명은 published만. 워커는 service role.
- payload 규약:
  - pitch: `{assets:[{title,body}×3], invitation, hwadu}`
  - record: `{premiere, budget, box_office, awards[], production_notes[],
    strategic_significance}` (불확실 필드는 null — 추정 금지)
  - reception: `{at_release, turning_point, today}` (body에 합본 산문도 저장)
  - experience: `{level, label, definition, comparables[5], rationale}`

## 3. 생성 파이프라인 (worker/film-features.py)

영화당 **2콜** (4콜 아님 — 비용·일관성):
- **Call A — pitch** (창작 모드, temperature 0.7): 스포일러 제로 강제.
  검증: 스포일러 정규식 백스톱 + self_confidence ≥ 0.75.
- **Call B — record+reception+experience** (사실 모드, temperature 0.2):
  검증: experience.level ∈ 1..10, comparables 5편, record 필드 타입,
  claims_sourced 필수. 불확실 항목은 null 허용(환각 데이터 차단).
- upsert(film_id, kind) — 재실행 안전. films.aesthetic_level 동기 갱신.
- 파일럿: 발행 질문이 있는 15편 → 검수 → 신규 영화는 생성 시 포함.

## 4. 비용

영화당 2콜 ≈ $0.005 미만(flash) → 1,000편 ≈ $5 수준. 기존 Q&A 생성(1콜)에
비해 +2콜이지만 영화당 1회뿐.

## 5. 흡수되는 아이디어 (백로그)

1. **10 Rhetorical Patterns**(CINECODEX 비밀 지침)을 prompt-featured-qa.md의
   답변 품질 규칙("aha"가 충족시켜야 할 시네필의 욕망 명세)으로 이식.
2. **LEDGER 관점**("영화 = 감독 커리어의 베팅")은 감독 허브의 시그니처
   콘텐츠("감독의 베팅 연대기")로 확장.
3. **ESSAY(서정 에세이)**는 영화당 고정이 아니라 주간 1편 에디토리얼 피처로.
4. 해석 방법론군(B군)은 featured-qa의 asker/answerer 렌즈·질문 종류 목록에
   단계적으로 주입(예: ENIGMA→"가장 불가해한 표면 요소" 질문 종류 강화).

## 6. UI (다음 단계)

영화 허브 `/film/[slug]` 재구성:
1. 헤더(기존) → **Why watch (pitch)** → **The record(팩트 시트)** →
   **The experience(레벨 배지+동급작)** — 프리뷰 존
2. 구분선("이하 스포일러 존" 고지) → **The reception** → 고유 질문 리스트(기존)
   → 틀/태그 칩 — 해석 존
3. `/experience/[level]` 허브 + /frames 인덱스에 차원 추가는 후속.
