# FilmCurio — Spoiler Guard 설계 (스포일러 가드)

> 목표: AI가 콘텐츠를 **생성하는 시점에** 스포일러 여부를 스스로 판단·표시하고,
> 사이트는 그 판단을 받아 (1) 목록에서는 이모지 마스킹 제목, (2) 본문에서는
> 흥미를 끄는 스포일러 배지 + 블러를 렌더링한다. 추가 모델 호출 없음 — 기존
> 싱글콜 아키텍처 안에서 해결한다.

---

## 1. 핵심 원칙

- **판단은 생성 콜 안에서.** 별도 분류기/검증 모델을 두지 않는다. 기존
  self-gate(self_confidence, claims_sourced)와 같은 위치에 스포일러 판단
  필드를 추가한다. 비용 증가 ≈ 0, 아키텍처 일관성 유지.
- **강제는 결정적 검증기에서.** 모델의 판단을 그대로 믿지 않고, 코드 레벨
  검증(필드 형식, 이모지 존재, 정규식 백스톱)으로 한 번 더 거른다.
- **SEO는 건드리지 않는다.** 원본 제목은 질문 상세 페이지의 `<h1>`, `<title>`,
  JSON-LD에 그대로 남는다. 마스킹은 **목록 표면**(홈 피드, 영화 페이지, 연관
  질문, 검색 자동완성)에서만. 본문 블러는 CSS만 — SSR HTML에는 전문이 포함되어
  크롤러는 전부 읽는다.

## 2. 스포일러 등급 정의

| spoiler_level | 의미 | 예 |
|---|---|---|
| `none` | 전제(premise) 수준만. 주제·기법·장르 얘기 | "중심 테마는 무엇인가?" |
| `mild` | 중반 전개·디테일이 드러남. 결말/반전/죽음은 없음 | "중간의 느린 구간에서 뭘 놓쳤나?" |
| `major` | 결말, 반전, 정체, 죽음, 인물의 운명이 드러남 | "왜 그가 마지막에 그녀를 죽였나?" |

`title_spoiler`(boolean)는 별도 축: **제목만 읽어도** 스포일러가 되는가.
"결말에서 실제로 무슨 일이 일어났나?"는 major 답변이지만 제목 자체는 스포일러가
아니다(`title_spoiler: false`). "왜 X가 Y를 배신했나?"는 제목이 스포일러다(`true`).

## 3. 생성 시 추가되는 필드 (모델 출력)

```json
{
  "spoiler_level": "none | mild | major",
  "title_spoiler": false,
  "question_display": "<title_spoiler가 true일 때만: 이모지 마스킹 제목. 아니면 \"\">",
  "hook": "<spoiler_level이 major일 때만: 스포일러 없는 1문장 티저(≤30단어). 아니면 \"\">"
}
```

**question_display 규칙 (프롬프트에 명시):**
- 스포일러를 만드는 단어**만** 트렌디한 이모지로 치환 — 운명이 드러나는 인물명,
  kill/die/betray류 동사, 반전 명사. 나머지 문장 구조는 그대로 둬서 읽히게 한다.
- 이모지 1–3개. 영화 제목은 절대 마스킹하지 않는다.
- 마스킹 후에도 "클릭하고 싶은" 질문이어야 한다. 수수께끼처럼 흥미를 유발하는
  것이 목적. 예: "Why did the detective shoot his partner?" →
  "Why did the detective 🔫 his 🤝?"
- 사이트 전반 "No emojis" 규칙의 **유일한 예외**가 이 필드다.

**hook 규칙:** 피드는 답변 첫 ~400자를 티저로 노출하는데, major 답변의 첫
문단은 그 자체가 결말 요약이다(크럭스를 첫 문장에 답하는 하우스 스타일 때문).
그래서 major 항목은 모델이 스포일러 없는 티저 한 문장을 따로 쓴다. 목록에서는
본문 대신 이것을 보여준다.

## 4. 결정적 검증기 백스톱 (worker validator)

1. `spoiler_level` ∈ {none, mild, major} — 아니면 항목 거부.
2. `title_spoiler === true` → `question_display`는 비어있지 않고, 이모지를
   포함하며, 원제목과 달라야 한다. 위반 시 항목 거부(재시도 1회는 기존 흐름).
3. `title_spoiler === false` → `question_display`는 강제로 `""`.
4. `spoiler_level === "major"` → `hook` 필수(비어있지 않음, ≤200자, 금칙어 통과).
5. **정규식 백스톱:** 제목이 스포일러 패턴
   (`dies|death|kills?|killed|murder|the killer|is actually|turns out|twist|betray|ending reveals`)
   에 걸리는데 모델이 `title_spoiler: false`라고 했다면 — 항목은 통과시키되
   `spoiler_level`을 최소 `mild`로 승격하고 `content_events`에
   `spoiler_heuristic_mismatch` 이벤트를 남긴다(어드민 감사용). 이모지 마스킹은
   결정적으로 생성할 수 없으므로 거부 대신 보수적 처리 + 감사 추적.

## 5. DB (migration 0010)

```sql
ALTER TABLE questions ADD COLUMN spoiler_level text
  CHECK (spoiler_level IN ('none','mild','major'));
ALTER TABLE questions ADD COLUMN title_spoiler boolean DEFAULT false;
ALTER TABLE questions ADD COLUMN display_title text;  -- null → 원제목 사용
ALTER TABLE questions ADD COLUMN safe_hook text;      -- null → 본문 티저 사용
ALTER TABLE canonical_answers ADD COLUMN spoiler_level text ...;  -- provenance 미러
```

기존(레거시) 행은 `spoiler_level IS NULL` → UI는 **mild처럼** 취급(배지는
보여주되 블러 없음). 사이트가 본래 해석 사이트라 전면 블러는 과잉. 추후
재감사(reaudit) 루프에서 백필 가능.

## 6. UI

**목록 표면** (홈 피드 `app/page.tsx` + `app/api/feed`, 영화 페이지, 연관 질문,
검색 자동완성, 질문 페이지 하단 MoreFeed):
- 제목 = `display_title ?? title`.
- `spoiler_level === 'major'`인 피드 카드: 티저 = `safe_hook ?? 본문 티저`,
  카드에 작은 스포일러 칩 표시.

**스포일러 칩 (목록용):** 작고 둥근 pill — `🍿 Ending inside` — 액센트 컬러
테두리, 호기심을 자극하는 문구. 경고가 아니라 예고편 같은 느낌.

**질문 상세 페이지 (`SpoilerShield` 클라이언트 컴포넌트):**
- `major`: 본문(스탠드퍼스트 포함) 위에 배지 배너 —
  "🎬 This reading goes all the way to the end" + "Reveal the answer" 버튼.
  본문은 CSS 블러 + 하단 페이드. 클릭하면 부드럽게(트랜지션) 해제.
  HTML에는 전문 포함(SSR) → SEO/AI 인용 무손실.
- `mild`: 배너만, 블러 없음.
- `none`/legacy null: 배너 없음(null은 작은 칩만).
- `<h1>`은 항상 원제목 — 이 페이지에 온 사람은 그 질문을 검색해서 온 사람이다.

## 7. 수정 파일 목록

| 파일 | 작업 |
|---|---|
| `prompt-featured-qa.md` | Spoiler gate 섹션 + 출력 스키마 4필드 추가 |
| `worker/src/generator.ts` | SYSTEM_PROMPT 동기화, FeaturedItem 타입, 검증기 규칙 1–5, insert 컬럼 |
| `lib/pipeline.ts` | 간이 SYSTEM_PROMPT + insert 동기화 |
| `supabase/migrations/0010_spoiler_guard.sql` | 신규 |
| `components/SpoilerShield.tsx` | 신규 (배너 + 블러/리빌) |
| `components/InfiniteScrollFeed.tsx` | display_title, safe_hook, 칩 |
| `app/page.tsx`, `app/api/feed/route.ts` | 쿼리에 스포일러 필드 추가 |
| `app/film/[slug]/page.tsx`, `components/RelatedQuestions.tsx`, `components/SearchTypeahead.tsx` | display_title 적용 |
| `app/film/[slug]/q/[question-slug]/page.tsx` | SpoilerShield 통합, MoreFeed 필드 |

## 8. 비용/리스크

- 모델 호출 수 변화 없음. 출력 토큰 +~40/항목 (≈ +1–2% 비용).
- 리스크: 모델 오판(false negative) → 정규식 백스톱 + 감사 이벤트 + 기존
  reaudit 루프로 커버. 이모지 과용 → 검증기에서 question_display 외 필드에
  이모지 발견 시 거부 가능(기존 No emojis 규칙 유지).
