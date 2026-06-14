# FilmCurio / Metatake — 형상 페이지 + 기여(Contribution) 설계

> 이 문서는 **형상(figure)에 독립 페이지를 부여**하고, 그 위에 **로그인 사용자의 기여 레이어**
> (take 추가 · figure 추가)를 얹는 설계 명세다. 작업 언어 한국어, 코드/식별자 영어.
> 함께 볼 것: `meta-take-architecture.md`(척추·충돌 시 이 문서가 그 위의 형상 부분을 갱신),
> `figure-meaning-plan.md`(기저 메커니즘·렌즈), `spoiler-guard-design.md`, `site-ia-plan.md`.
> **이 문서가 형상 페이지/기여에 관한 한 최신·우선이다.**

---

## 0. TL;DR

형상은 더 이상 영화 페이지 안의 불릿이 아니라 **`/film/[film-slug]/figure/[figure-slug]`의 독립
페이지**다. 한 형상 아래엔 **서로 다른 비평 렌즈로 서로 다른 메타테이크에 연결되는 take ≥3개**가
모인다(이것이 thin-content 위험을 없애는 장치). 형상 묘사는 **영화적으로 매우 구체적**(무엇이
화면에 실제로 보이고 들리는가)이어야 한다. 그 위에 **로그인 사용자가 take를 추가**(메타테이크
선택 필수)하고 **영화 아래에 새 형상을 추가**할 수 있는 기여 레이어를 둔다. 사용자가 기존
메타테이크에 못 붙이면 **새 메타테이크를 제안**할 수 있고, 그 제안이 여러 영화로 반복되면
파이프라인이 자동으로 새 메타테이크로 승격한다 — **기여가 곧 허브 생성의 연료**가 된다.

---

## 1. 결정 요약 — 무엇이 뒤집혔나 (중요)

기존 `meta-take-architecture.md`에는 정반대 결정이 **확정**으로 박혀 있었다. 이 문서가 이를 갱신한다.

| 항목 | 이전 (architecture 확정) | 이번 (이 문서) |
|---|---|---|
| 형상 페이지 | **독립 페이지 아님.** 영화 페이지 안 구조화 섹션(섹션 SEO). "thin 방지" (§5.5, 확정 B) | **모든 형상이 독립 페이지** `/film/[slug]/figure/[fig-slug]` |
| thin-content 방지 | 페이지로 승격하지 않는 것 | **형상당 take ≥3(렌즈·메타테이크 다양)** + **사용자 기여로 성장** |
| 형상당 take 보강 | 백로그 #2, **"지금 하지 않음"** | **활성화.** AI enrichment 패스로 ≥3 시드 |
| 콘텐츠 생산 | take·meta take 모두 AI, 비평가는 승인만 (확정 1) | AI 시드 **+ 사용자 기여(take·figure)** + 모더레이션 |
| 기존 Q&A 부활 | "Q&A 격리·비삭제" | Q&A UI는 부활하지 않음. 대신 **기여 메커니즘만** 형상/테이크/메타테이크 척추에 흡수 |

**왜 일관적인가:** 형상을 섹션에 가둔 단 하나의 이유가 thin-content였다. "형상당 다양한 take ≥3"
요건이 바로 그 위험을 제거하므로, ①(독립 페이지)와 ②(take ≥3)는 서로를 정당화한다.

확정된 갈림길 (이번 대화):
- **A. URL = 영화 하위 중첩** `/film/[film-slug]/figure/[figure-slug]`.
- **B. 게이트 = 모든 형상이 페이지.** (게이트 없음. 대신 ≥3 시드 + 기여로 밀도 확보.)
- **C. 다양성 = 렌즈 + 메타테이크 둘 다 강제.** 같은 형상의 take 3개는 서로 다른 렌즈이고
  서로 다른 메타테이크에 연결된다.

---

## 2. URL · 슬러그 설계

### 2.1 라우트
- **형상 페이지:** `/film/[film-slug]/figure/[figure-slug]`
  (Next.js App Router: `app/film/[slug]/figure/[figureSlug]/page.tsx`)
- 형상은 작품에 고정된다(figure-meaning-plan §1의 핵심 비대칭). URL이 그 종속을 표현하고,
  동명 형상("the ending", "the mirror")을 영화 네임스페이스로 자연 구분한다.
- 브레드크럼: `Films › [감독] › [영화] › [형상]`.

### 2.2 형상 슬러그 (메타테이크와 동일 원칙 = store ID, resolve at render)
- `figures.slug` 컬럼 신설. **영화 내 유일**(`UNIQUE(film_id, slug)`), 전역 유일 아님.
- 생성: `slugify(label)`. 한 영화 안에서 충돌 시 `-2`, `-3` 접미. (긴 label은 잘라 60자 상한.)
- **개명/병합 안전:** `slug_history`에 `entity='figure'` 추가(현재 CHECK는 meta_take/film/director만
  허용 → 확장). 형상 label/slug이 바뀌면 old_slug→현재로 **301**. 단 형상 슬러그는 영화에
  종속되므로 history 조회 시 `(film_id, old_slug)`로 매칭.
- **인라인 링크 토큰:** 본문(설명·에세이)의 형상 참조는 `{{figure:<id>}}` 토큰으로 저장하고
  렌더 시 현재 label+href로 해소. (현 `lib/mtTokens.tsx`는 `{{figure}}`를 **미지원** → §9에서 추가.)

---

## 3. 데이터 모델 델타 (migration 0014 예정)

기존 0013 위에 얹는 변경만. **무손실·재실행 가능**(`ADD COLUMN IF NOT EXISTS`).

```sql
-- ── figures: 슬러그 + 기여자 + 모더레이션 ───────────────────────
ALTER TABLE public.figures
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES public.profiles(id),  -- UGC 형상
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id);
-- status는 이미 존재(default 'approved'). UGC는 'in_review'로 들어옴.
-- source도 존재(default 'ai'). UGC는 'human'.
CREATE UNIQUE INDEX IF NOT EXISTS uq_figures_film_slug ON public.figures(film_id, slug);

-- ── takes: 렌즈 + 기여자 + 모더레이션 + 업보트 ──────────────────
ALTER TABLE public.takes
  ADD COLUMN IF NOT EXISTS register text         -- 비평 레지스터(상위 축, §6.1)
       CHECK (register IN ('formal','semiotic','psychoanalytic','ideological',
              'politico_economic','philosophical','existential','mythic',
              'genealogical','reception')),
  ADD COLUMN IF NOT EXISTS angle text,            -- 자유 sub-angle 라벨(30 prompt 팔레트, §6.2)
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published'
       CHECK (status IN ('draft','in_review','published','rejected')),
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'ai'
       CHECK (source IN ('ai','human')),
  ADD COLUMN IF NOT EXISTS upvotes int NOT NULL DEFAULT 0;
-- 기존(시드) take는 source='ai', status='published'로 백필.
-- register는 theory_family→레지스터 매핑으로 백필(§6.5) — 애매하면 null 후 enrichment가 채움.

-- ── slug_history: figure 엔티티 추가 ───────────────────────────
ALTER TABLE public.slug_history DROP CONSTRAINT IF EXISTS slug_history_entity_check;
ALTER TABLE public.slug_history
  ADD CONSTRAINT slug_history_entity_check
  CHECK (entity IN ('meta_take','film','director','figure'));

-- ── take 업보트(중복 방지, 업보트 온리 불변 준수) ───────────────
CREATE TABLE IF NOT EXISTS public.take_votes (
  take_id uuid REFERENCES public.takes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (take_id, user_id)
);

-- ── 형상당 발행 take 수(페이지 밀도/배지용) ─────────────────────
CREATE OR REPLACE VIEW public.figure_take_counts AS
  SELECT figure_id, count(*)::int AS take_count
  FROM public.takes WHERE status='published' AND meta_take_id IS NOT NULL
  GROUP BY figure_id;
```

### 3.1 RLS 갱신 (중요 — 현재 takes는 `USING(true)`라 전부 공개)
```sql
-- takes: 발행분 또는 (본인 글) 또는 admin만
DROP POLICY IF EXISTS "takes: read" ON public.takes;
CREATE POLICY "takes: read" ON public.takes FOR SELECT USING (
  status='published' OR author_id = auth.uid() OR public.is_admin()
);
-- takes: 로그인 사용자 본인 명의로 insert(in_review로 강제)
CREATE POLICY "takes: insert own" ON public.takes FOR INSERT
  WITH CHECK (author_id = auth.uid() AND source='human');
-- figures: 본인 in_review 형상도 본인은 조회 가능하도록 보강
DROP POLICY IF EXISTS "figures: read" ON public.figures;
CREATE POLICY "figures: read" ON public.figures FOR SELECT USING (
  status='approved' OR author_id = auth.uid() OR public.is_admin()
);
CREATE POLICY "figures: insert own" ON public.figures FOR INSERT
  WITH CHECK (author_id = auth.uid() AND source='human');
-- take_votes: 본인 것만
ALTER TABLE public.take_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "take_votes: rw own" ON public.take_votes
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```
> 주의: 모더레이션을 "선검수"로 가면 위 INSERT 정책에 `status='in_review'`도 강제(서버 액션에서
> 세팅). "선발행 후감사"로 가면 `status='published'` 허용. → §7 모더레이션 결정 참조.

---

## 4. 형상 페이지 레이아웃 (`/film/[slug]/figure/[fig-slug]`)

take 페이지(`app/take/[slug]/page.tsx`)와 **같은 `.mt-*` 디자인 시스템**으로 렌더해 일관성 유지.

```
[MetatakeNav active="films"]
[브레드크럼]  Films › 감독 › 영화 › (현재 형상)
[h1.mt-h1]    형상 label            ← 예: "Forrest Gump's voice-over narration"
[info box .mt-info]
   ├ Film      → /film/[slug]        (영화로 복귀)
   ├ Kind      Character / Object / Location / Form / Trope
   └ Takes     N  (발행 take 수)

[설명 블록]   영화적으로 구체적인 2~4문장 (§5). 스포일러 가드 적용. {{토큰}} 해소.

[h2.mt-h2  "Readings"]              ← 이 형상의 take들 (핵심)
   각 take 카드 = ┌────────────────────────────────────────────┐
                 │ [렌즈 배지: Formal]   → [메타테이크 링크: The Unseen Voice] │
                 │ 전체 해석문(rationale) — 잘림 없음               │
                 │ (출처/이론가는 비발행이면 숨김)  · ▲업보트 N      │
                 └────────────────────────────────────────────┘
   • 렌즈순/업보트순 정렬. AI take 먼저, 사용자 take는 같은 목록에 자연 편입(배지로 구분 가능).
   • 각 카드의 메타테이크 링크가 토끼굴 입구 = "이 읽기를 공유하는 다른 영화들로".

[h2  "Kin — 이 형상과 같은 읽기를 가진 형상들"]   ← 횡단 연결(발견)
   이 형상의 take가 걸린 메타테이크들을 매개로, 다른 영화의 형상 N개를 모아 노출.
   (meta_take_rankings 재사용: 같은 meta_take에서 surprise 상위 → "뜻밖의 친족".)

[기여 CTA]   "이 형상에 당신의 해석을 더하기" → 로그인 사용자에게 인라인 폼(§7).
```

설계 원칙:
- **각 take가 어떤 메타테이크에 연결되는지 명시** — 카드마다 메타테이크 링크 + 렌즈 배지(요구사항).
- **긴 해석문의 집** — rationale 전문을 카드 본문으로(요청2의 근본 해결). take 페이지의 "Examples"
  에서는 압축 노출, **형상 페이지에서 전문 노출**로 역할 분담.
- **양방향:** 형상→메타테이크(카드 링크), 메타테이크→형상(take 페이지 Examples는 향후 형상 링크로
  업그레이드), 영화→형상(영화 페이지 label을 형상 링크로, §4.1).

### 4.1 영화 페이지 연동 (`app/film/[slug]/page.tsx`)
- 현재 figure label은 **plain text**(106행). → `<Link href={`/film/${slug}/figure/${f.slug}`}>{f.label}</Link>`.
- 각 형상 옆 "→ 메타테이크" 칩은 유지(여러 개면 "+N"). 형상 페이지가 상세를 받는다.

---

## 5. 형상 묘사 명세 — "영화적으로 매우 구체적"

하우스 보이스(`editorial-voices.md`)와 architecture §13의 **"형상=사실(건조)"** 원칙을 강화한다.

- **무엇:** 화면에서 실제로 관찰되는 것 — 어느 장면/숏/대사/소리/색/동선. *추상·해석 금지*
  (해석은 take의 몫). "Observed before abstract."
- ✗ "권력의 공허를 상징하는 오브제" (추상·해석)
  ✓ "영화가 열리고 닫힐 때 화면을 가로질러 떠다니다 포레스트의 발치 흙바닥에 내려앉는 흰 깃털.
     첫 등장은 약 90초 롱테이크의 부감." (구체·관찰)
- **길이:** 2~4문장. **톤:** 건조·사실·구어체(레인식 위트는 take로). **시점:** 1인칭 금지.
- **스포일러 가드:** `spoiler_level`(none/mild/major) 부여 + 기존 마스킹/블러 체계. 엔딩 관련 형상 주의.
- **링크:** 언급되는 영화/형상/메타테이크는 토큰(`{{film}}`/`{{figure}}`/`{{meta_take}}`).

---

## 6. take 관점 다양성 — 비평 레지스터(register) 2층 모델 + 반복편향 방지

> **고정 5렌즈는 폐기.** 이유: ① 밋밋함(모든 형상을 같은 격자에 끼워 맞춤) ② 반복편향(LLM이
> 자동으로 정신분석/트라우마로 쏠림). 목표 셋: ⓐ 형상마다 **고유한** take, ⓑ 코퍼스가 한 관점으로
> 쏠리지 않음, ⓒ 그러면서도 take가 **메타테이크로 수렴**(허브 유지). **핵심 분리: 레지스터=들어가는
> 길(다양), 메타테이크=도착지(수렴).** 길을 다양화해도 도착지가 공유되므로 그래프는 안 흩어진다.
> ("렌즈"는 구어, 정식 명칭은 "레지스터".)

### 6.1 레지스터 팔레트 (v1 제안 — 10종, 튜닝 가능)
*비평적 주의의 양식.* 고정 enum이되 **인덱스·필터·분산 강제용 상위 축**이고, 그 아래 **열린
sub-angle**(자유 서술)이 붙는다(2층). `takes.register`.

1. **형식·기법 (formal)** — 프레이밍·편집·사운드·색·연기·리듬. 형식이 곧 의미.
2. **기호·상징 (semiotic)** — 모티프·은유·기표/기의. 이 형상이 무엇을 대신하는가.
3. **정신분석 (psychoanalytic)** — 욕망·무의식·응시·환상. *(기본값화 방지 위해 배급 제한.)*
4. **이데올로기·정치 (ideological)** — 권력·재현·누구의 시선·무엇이 자연화되는가.
5. **정치경제·사회 (politico_economic)** — 계급·노동·자본·제도·물질 구조(이데올로기 비평과 구분).
6. **철학·윤리 (philosophical)** — 존재·지각·윤리적 상황. (현상/누메논)
7. **실존·정동 (existential)** — 죽음·자유·무드·*느껴지는* 상황. (pulse 보이스와 짝)
8. **신화·원형 (mythic)** — 신화·제의·동화 구조·원형.
9. **영화사·계보 (genealogical)** — 계보·영향·상호텍스트·장르사 속 위치. *형상+영화 고유라 강력한
   다양화기이며 LLM 기본값이 아님 → 반복편향을 깨는 주력.*
10. **수용·비평사 (reception)** — 실제 비평가·학자가 *실제로* 한 해석(인용). 시드의 `theorist`/
    `source_citation`/`source_url` 활용. **근거 있는 비평 vs 민속분류 = TV Tropes와의 차별점.**

(선택 11: 상호텍스트·자기반영 `reflexive` — 인용·각색·메타영화. 우선 sub-angle로 두고 필요 시 승격.)

### 6.2 2층 구조 + 사용자의 30 prompt 흡수
- **상위(레지스터, ~10):** 안정적 · 인덱싱 · 분산 강제용. `takes.register`.
- **하위(sub-angle, 자유):** 그 take의 구체 각도 라벨. `takes.angle`(text). **사용자가 준 30개
  프롬프트**(SIGNIFIER · FACE · PHENOMENON/NOUMENON · AESTHETIC …)는 여기 **sub-angle 팔레트**로
  들어가 레지스터 아래 분류된다(예: SIGNIFIER→기호, FACE→형식, PHENOMENON→철학). → 구조(상위)와
  풍부함(하위)을 동시에 얻는다.
- 기존 `theory_family`(특정 이론)·`theorist`(귀속)는 유지. 결국 4층 비평 메타데이터:
  **레지스터(거침) → 이론 패밀리(특정) → 이론가(귀속) → 메타테이크(도착·수렴).**

### 6.3 반복편향 방지 전략 (핵심 — 5장치)
1. **형상-적합 선택(고유성).** 생성기는 "이 형상이 *보상하는* 레지스터"를 먼저 점수화한다. 모든
   형상에 10개를 끼우지 않는다. 얼굴 클로즈업 → 형식·정동·정신분석; 공장 기계 → 정치경제·상징.
   형상이 다르면 적합 레지스터가 달라져 **take 세트가 형상마다 고유**해진다.
2. **코퍼스 균형(IDF, 반편향).** 레지스터 전역 사용 히스토그램 유지. 두 레지스터가 비슷하게
   맞으면 **전역적으로 드문 쪽 우대** `weight = fit × 1/log(1+global_count)`. 정신분석 같은
   기본값을 자동 감점. (기존 surprise/TF-IDF 가중 논리 재사용.)
3. **형상 내 강제 분산(다양성).** ≥3 take = **서로 다른 레지스터 ≥3** + **서로 다른 메타테이크
   ≥3.** 같은 레지스터의 sub-angle 둘은 "다른 것"으로 안 침. 한 영화 안 형상들끼리도 레지스터가
   겹치지 않게 신호 주입.
4. **근거 우선 생성(반템플릿 핵심).** 모든 take는 **이 형상에서만 보이는 화면 근거**에서 출발
   (하우스 룰 "observed before abstract"). 근거가 형상마다 다르므로 읽기가 달라진다 = 매드립스 방지.
5. **기본값 금지 가드레일(프롬프트).** "형상이 특별히 요구하지 않는 한 트라우마/오이디푸스/거울단계로
   가지 말 것. 같은 영화의 두 형상에 같은 레지스터를 독립적 근거 없이 부여하지 말 것. 뻔하지 않되
   변호 가능한 읽기를 우선." + 그 영화에서 이미 쓴 레지스터 신호 전달.

### 6.4 수렴 안전장치 (다양성이 그래프를 깨지 않게 — 가장 중요)
레지스터는 **길**, 메타테이크는 **도착지**다. 서로 다른 형상이 서로 다른 레지스터로 들어와도
**같은 메타테이크**에 도착할 수 있고, 그게 토끼굴 연료다. 메타테이크는 여전히 ≥5편 게이트로
수렴·발행. → **다양성 추구가 45k 고아 노드(figure-meaning §6 실패 모드)를 부활시키지 않는다.**
레지스터 다양화는 take.rationale(읽기)에만 적용되고, take.meta_take_id(도착지)는 수렴 규칙을 따른다.

### 6.5 다양성 규칙 + 백필
- 발행 take ≥3, **레지스터 ≥3 distinct + 메타테이크 ≥3 distinct.**
- 시드 take 레지스터 백필: theory_family→레지스터 매핑으로 1차 추정, 애매하면 null 후 enrichment가 채움.
- 모든 형상이 즉시 ≥3은 아님(시드 한계). 부족분은 §8 enrichment + 사용자 기여로 채움(빈 상태 허용).

### 6.6 출력 계약(output contract) — 추출/보강 프롬프트 공유 (링치핀)
페이지는 이 JSON을 렌더하고, **두 프롬프트(from-scratch 추출 / 기존 보강)가 같은 모양을 뱉는다.**
계약을 먼저 못 박아야 페이지·프롬프트가 따로 놀지 않는다.

```jsonc
{
  "figure": {
    "label": "the floating feather",
    "kind": "object",                 // character|object|location|trope|form
    "description": "...영화적으로 구체적인 2~4문장 (§5)...",
    "spoiler_level": "none",          // none|mild|major
    "register_fit": ["formal","philosophical","genealogical","semiotic"]
                                       // 이 형상이 '보상하는' 레지스터 랭킹 (§6.3-1)
  },
  "takes": [                          // ≥3, 레지스터·메타테이크 서로 다름
    {
      "register": "formal",          // §6.1 10종 중 하나
      "angle": "the wandering camera",        // 자유 sub-angle (30-prompt 팔레트)
      "evidence": "여는 90초 크레인 숏이 깃털을 따라간다", // 화면 근거(필수, §6.3-4)
      "rationale": "...60~90단어, 근거우선, 하우스 보이스...",
      "metatake": { "ref": "the-wandering-camera" },      // 기존 슬러그 연결  …또는…
      "metatake": { "new": { "title": "The Wandering Camera", "laconic": "..." } },
      "confidence": 0.78
    }
  ]
}
```
- **from-scratch 추출:** `takes`에 전체 세트(≥3)를 새로 생성.
- **보강(enrichment):** `existing_registers`를 주입받아 **거기 없는 레지스터로만** 추가 take를 생성,
  총 distinct 레지스터 ≥3이 되게. 출력 shape는 동일(`figure.description`은 재작성 선택, `takes`는
  추가분만). → **계약 하나, 채우는 지시 둘.**
- `metatake.new`는 candidate로 적재되고 dedup/수렴은 기존 `mt-consolidate`가 담당(중복 방지·≥5편 게이트).
- **ref 무결성(2026-06-14):** `metatake.ref`는 **주입된 published 허브 목록의 슬러그만** 허용(모델은
  그 목록에서 verbatim 복사). 모델이 목록에 없는 ref를 지어내면 워커가 자동으로 `new` 후보로 전환해
  **take를 버리지 않는다**(드라이런·persist 양쪽). → 그래서 프롬프트에 **전체 허브 목록을 주입**하고,
  발행 시 redlink(없는 링크)가 0이 된다.

---

## 7. 기여(Contribution) 인터페이스 — 이 설계의 심장

> 요구: "모든 figure 밑에 로그인하면 take를 넣을 수 있고(메타테이크 선택 필수), 영화 아래에
> 임의로 figure도 넣을 수 있으며 그 figure에도 take+메타테이크를 넣는다. **이 인터페이스가 잘
> 만들어져야 한다.**"

### 7.1 Take 추가 (형상 페이지 인라인 폼, 로그인 필수)
4필드. 핵심은 **메타테이크 선택을 쉽고 정확하게** 만드는 것.
1. **메타테이크 선택 (필수).** 검색형 콤보박스.
   - published 메타테이크를 **제목 + laconic**로 타이프어헤드(이론 패밀리로 그룹).
   - 선택 시 그 메타테이크의 thesis 미리보기(맞는지 확인).
   - **"딱 맞는 게 없어요 → 새 메타테이크 제안"** affordance (§7.3).
2. **레지스터 선택 (필수).** §6.1의 10종 레지스터 + 자유 sub-angle. (이 형상에 이미 있는 레지스터는
   "중복" 힌트 표시 — 다양성 유도지만 차단은 아님.)
3. **해석문 작성 (필수).** rationale. 가이드 문구: "화면의 무엇에 근거하는가부터." 60~ 단어 권장.
   미리보기에 하우스 보이스 톤 힌트.
4. **제출.** `source='human'`, `author_id`, 선택 메타테이크/렌즈로 take insert. 상태는 §7.4.

### 7.2 Figure 추가 (영화 페이지 "형상 추가" 버튼, 로그인 필수)
미니 2스텝:
- **Step 1 — 형상:** label, kind(5종), description(영화적으로 구체적, §5 가이드 인라인),
  spoiler_level. `source='human'`, `author_id`.
- **Step 2 — 첫 take:** §7.1 폼 그대로(메타테이크+렌즈+해석문 필수). **형상은 take 1개 이상과
  함께만 생성**(고아 형상 방지). 이후 다른 사용자가 §7.1로 ≥3까지 채움.

### 7.3 새 메타테이크 제안 = 허브 생성 루프 (요청자의 "새 메타테이크 효과")
- 기존에 못 붙일 때만. title(명사구) + laconic + (선택)thesis 입력.
- 즉시 `meta_takes(status='candidate', source='human', critic_approved_by=null)` 생성하고 take를 그 후보에 연결.
- candidate는 **공개 비노출**(RLS: published만). 후보가 **서로 다른 영화 ≥5편**의 형상을 모으면
  기존 `mt-consolidate`/유지봇 게이트가 발행 후보로 승격 → 비평가 승인 → published.
- 즉 **사용자 기여가 메타테이크 척추에 연료를 댄다.** (Q&A를 부활시키지 않고 효과만 흡수.)
- 중복 폭발 방지: 제안 title을 임베딩해 기존 메타테이크와 cosine ≥0.86이면 "비슷한 게 있어요"
  로 기존 선택 유도(mt-consolidate 임계 재사용).

### 7.4 모더레이션 모델 [결정 필요 — §12]
- **권장(선검수):** human take/figure는 `status='in_review'`로 들어가 **관리자 큐**(기존
  `/admin/review` 패턴 재사용 — 카드 + 승인/반려)에서 검수 후 published. 신뢰 등급(role) 또는
  관리자는 즉시 published. → SEO/품질 보호. 소규모 사이트에 안전.
- 대안(선발행 후감사): AI 원칙("발행 후 감수")과 동일하게 즉시 published + spot-audit. 마찰↓
  스팸/품질 위험↑.
- 어느 쪽이든: 업보트-온리(불변 #2), `content_events`에 기여/검수 로깅, 본인 글 수정/삭제 허용,
  레이트리밋. AI 콘텐츠는 "FilmCurio Editorial" 귀속, 사람 기여는 프로필 귀속(소켓퍼펫 금지 #5).

### 7.5 재사용 자산
- 로그인/프로필: 기존 Supabase Auth + `profiles`(username/role).
- 검수 큐 UI 패턴: `app/admin/review/page.tsx`(레거시 Q&A 큐, 이미 보존됨)를 take/figure용으로 복제.
- 업보트 UX·정렬 점수: 레거시 `contributions`의 upvote/sort_score 관행.

---

## 8. AI Enrichment 워커 (`figure-enrich`) — ≥3 시드

architecture 백로그 #2를 활성화. 목적: 시드 형상(대부분 take 1개)을 **렌즈·메타테이크 다양한
≥3 take**로 보강 + 묘사를 §5 기준으로 재작성.

- **입력:** take<3인 형상 + 그 영화 컨텍스트 + 기존 take의 렌즈/메타테이크.
- **출력:** 부족한 렌즈를 채우는 신규 take(rationale + lens + 메타테이크 제안). 묘사 재생성.
- **수렴 장치:** 그 영화 관련 기존 메타테이크 후보 ~30개 주입, "기존 우선, 신규는 정말 없을 때만"
  (architecture §9 패턴 재사용). 신규 제안은 임베딩→cosine로 alias/판정/신규.
- **근거 강제·환각 차단·스포일러 가드.** 강한 모델 + 비평 보이스. 10~15형상 파일럿 후 배치.
- **운영:** `worker/figure-enrich.py` + `run-figure-enrich.command`(기존 `.command` 패턴). 임베딩·
  랭킹은 enrichment 후 `mt-rank`/`mt-recommend` 재실행. 비용: 보강 대상 규모에 비례(~$수십).
- **순서:** 지금은 **설계만**. 실제 배치는 마이그레이션 0014 + 형상 페이지 + 기여 UI 후.

---

## 9. 토큰/링크 갱신 (`lib/mtTokens.tsx`)

- 현재 `TokenResolver`는 `film`/`meta_take`만, 정규식도 `(film|meta_take|take)`. **`figure` 추가.**
- `hrefFor('figure', …)`은 영화 종속이라 단순 id로 안 됨 → figure 토큰은 `{{figure:<id>}}`를
  렌더 시 `{film_slug, figure_slug, label}`로 해소(리졸버가 figure_id→경로 매핑 주입).
- 원칙 불변: **store IDs, resolve at render** + redlink 금지 + slug 변경 301.

---

## 10. SEO / 색인 정책

- **모든 형상 색인**(게이트 B). thin-content 방어선 = ① 묘사(구체) + take ≥3(다관점) ②
  사용자 기여로 성장 ③ 메타테이크/영화로의 조밀한 링크(고립 페이지 아님).
- 과도기(enrichment 전, take<3 형상)엔 **noindex 후 ≥3 충족 시 index** 단계적 색인 옵션 권장.
- schema.org: 형상 페이지 = `CreativeWork`/`Article`(about: Movie) + 각 take를 `Comment`/
  `Review`류로. 영화↔형상↔메타테이크 양방향 내부링크.
- canonical: `/film/[slug]/figure/[fig-slug]`. 영화 페이지의 형상 앵커는 형상 페이지로 통합.

---

## 11. 빌드 순서 (권장)

1. **migration 0014**(§3) — 슬러그/렌즈/모더레이션 컬럼 + slug_history figure + RLS + take_votes.
   기존 형상 슬러그 백필(`slugify(label)` + 영화 내 충돌 해소), take lens 백필.
2. **`lib/mtTokens.tsx`** figure 토큰 지원(§9).
3. **형상 페이지** `app/film/[slug]/figure/[figureSlug]/page.tsx`(§4) + 영화 페이지 label 링크화(§4.1).
4. **기여 서버 액션 + 폼**(§7): take 추가, figure 추가, 새 메타테이크 제안, 업보트. RLS·레이트리밋.
5. **검수 큐**(§7.4): `/admin/review` 복제 → take/figure 승인·반려. `content_events` 로깅.
6. **AI enrichment 워커**(§8) 파일럿 → 배치 → `mt-rank`/`mt-recommend` 재실행.
7. 검증·단계적 색인·배포(기존 `.command` + Vercel ISR, `revalidate=300`).

---

## 12. 미해결 결정 (다음 대화에서 확정)

- **M1. 모더레이션 강도(§7.4):** 선검수(권장) vs 선발행 후감사 vs 신뢰등급 혼합.
- **M2. 새 메타테이크 제안 허용 여부(§7.3):** 허용(허브 생성 루프, 권장) vs 기존 선택만(품질 통제).
- **M3. 업보트/평판:** 단순 업보트(불변 #2) 외에 정렬·노출에 평판 반영할지.
- **M4. 본인 기여 수정/삭제 범위 + 반달 대응(레이트리밋·플래그).**
- **M5. enrichment를 런칭 전 전수 돌릴지 vs 인기 영화부터 점진.**
- **M6. take 페이지 Examples의 형상명을 형상 페이지 링크로 업그레이드할 시점.**
- **M7. 레지스터 팔레트 확정(§6.1):** v1 10종 + sub-angle 2층 모델. 종수(8~12)·명칭·`reflexive`
  승격 여부를 사용자가 최종 조정.

---

## 13. 갱신해야 할 기존 문서

- `meta-take-architecture.md`: §5.1(형상 SEO 확정 B), §5.5(형상=섹션, 독립 아님), §13 결정기록(B),
  백로그 #2(보류→활성), §7 스키마(0014 델타 참조), §11(Q&A 처리: "기여 메커니즘 흡수"로 갱신).
- `figure-meaning-plan.md`: §9 UI(`/figure/[id]`→중첩 URL), §11 빌드 순서, §12 미해결 A(비평 레지스터 2층 모델 확정).
- `00-INDEX.md`: 문서 맵에 본 문서 등록 + 제품 설명에 "형상 페이지 + 기여" 반영.

---

## 부록: 이어받는 AI에게
- 형상 페이지는 take 페이지의 `.mt-*` 디자인 시스템을 **그대로** 쓴다(새 디자인 발명 금지).
- 검증된 자산 재사용: Supabase Auth/profiles, `/admin/review` 큐 패턴, mtTokens, mt-consolidate
  임베딩 임계(0.86), `.command` 워커, 스포일러 가드, content_events 감사.
- 가장 큰 함정: 기여로 메타테이크가 무한 증식하는 것 → §7.3 임베딩 중복검사 + 5편 게이트 + 비평가
  승인으로 막는다. "수렴시키며 짓는다"는 원칙은 사용자 기여에도 동일하게 적용된다.
