# HANDOFF — 다국어 프로젝션 (Locale Projection) 구축 지시서 · 웨이브 1 = 한국어 /ko

> **한 줄**: 영어 사이트를 단일 정본(SSOT)으로 유지한 채, Tier-2 수준 표면(필름 메인·아틀라스·촬영지·감독·카탈로그)을
> `/{locale}` 프리픽스 아래에 **프로젝션(투영)** 하는 다국어 관리 체계를 세운다. 번역비가 드는 롱폼 콘텐츠
> (poetics·figures·takes·misreadings 본문)는 범위에서 제외. TMDB·지명은 다국어 값 불러오기 + 소량 사전 번역으로 해결.
> **웨이브 1 = 한국어(/ko)**, 이후 일본어·프랑스어·스페인어가 같은 체계에 열(column)로 추가된다(오너 로드맵).
> 목표: 현금 비용 ~0원, 영어만 관리해도 디자인·DB 구조 변경이 모든 언어 사이트에 자동 반영, **새 언어 추가 = §-2.2
> 체크리스트 7단계(구조 변경 0)**.
>
> **작성 2026-07-16 · 개정 v4 2026-07-16 (다국어 체계로 일반화 — 개정 이력은 문서 말미 §11).**
> 브랜치: `claude/korean-site-localization-27lciv` (PR #9). 파일명의 "KO 프로젝션"은 역사적 명칭 — 체계의 이름은
> **다국어 프로젝션**이고 이 문서가 그 정본이다. 이 문서는 **임의의 AI 세션이 이 문서만으로 착수 가능한 최종 작업
> 지시서**다. 실측 근거: `lib/tmdb.ts`(language 파라미터 미사용, films 테이블 캐시), `app/film/[slug]/[desk]/ko/page.tsx`
> (기존 KO 에세이 표면), `lib/seo.ts filmIndexBar`(색인 게이트 SSOT)·`INDEX_COHORT_ESSAYS_KO`(:264, 코호트 캡 선례),
> `components/room/strings.ts`(사전 패턴 선례), `app/sitemaps/essays-ko.xml`(KO 사이트맵 선례),
> `lib/atlas_cities.json`(도시 511개), `supabase/migrations/0104_*`(최신 마이그),
> `app/film/[slug]/page.tsx:570`(film_sentences_for RPC — §1.1 예외의 근거).

---

## §-2 다국어 관리 체계 — 로케일 레지스트리와 새 언어 추가 절차

오너 요구(2026-07-16): 한국어는 시작일 뿐이고 일본어·프랑스어·스페인어까지 같은 방식으로 확장한다. 따라서
**모든 원시 자재(타입·사전·컬럼·헬퍼·셸·사이트맵)는 처음부터 로케일-제네릭으로 짓고, "ko"는 어디에도 하드코딩하지
않는다** — ko가 등장해도 되는 곳은 레지스트리의 항목 하나, 사전 파일 하나, 마이그레이션의 컬럼명뿐이다.

### -2.1 로케일 레지스트리 `lib/i18n/locales.ts` — 유일한 언어 목록
```ts
/** 다국어 프로젝션의 SSOT. 언어 추가는 이 객체에 항목 1개를 더하는 것에서 시작한다.
 *  live=false인 로케일은 어디에도 노출되지 않는다(라우트·hreflang·사이트맵·배너 전부). */
export const LOCALES = {
  en: { live: true,  tmdb: "en-US", intl: "en-US", ogLocale: "en_US", label: "English" },
  ko: { live: true,  tmdb: "ko-KR", intl: "ko-KR", ogLocale: "ko_KR", label: "한국어" },   // 웨이브 1
  ja: { live: false, tmdb: "ja-JP", intl: "ja-JP", ogLocale: "ja_JP", label: "日本語" },    // 예약 (오너 로드맵)
  fr: { live: false, tmdb: "fr-FR", intl: "fr-FR", ogLocale: "fr_FR", label: "Français" },  // 예약
  es: { live: false, tmdb: "es-ES", intl: "es-ES", ogLocale: "es_ES", label: "Español" },   // 예약
} as const;
export type Locale = keyof typeof LOCALES;
export const LIVE_LOCALES = (Object.keys(LOCALES) as Locale[]).filter(l => LOCALES[l].live);
export const PROJECTED_LOCALES = LIVE_LOCALES.filter(l => l !== "en"); // 투영 대상(EN 제외)
```
예약 로케일(ja/fr/es)의 항목은 **지금 넣어둔다** — live=false라 아무 표면에도 영향이 없고, 타입·설계가 처음부터
복수 로케일을 강제하게 만드는 것이 목적이다. es의 지역 변형(es-ES vs es-MX) 등 세부는 해당 언어 착수 시 오너 결정.

### -2.2 새 언어 추가 절차 (체크리스트 — 이 7단계 밖의 작업이 필요하면 설계 위반을 의심할 것)

| # | 단계 | 내용 |
|---|---|---|
| 1 | 레지스트리 | `locales.ts`의 해당 항목 검토(지역 변형 확정) — live는 아직 false |
| 2 | 코어 어휘 | §2.2.1 어휘 매트릭스에 해당 언어 열 채움 → **오너 승인** (언어별 문체 결정 포함) |
| 3 | 사전 | `lib/i18n/dict/<loc>.ts` 생성 — 기존 ko.ts와 **같은 키 집합**을 해당 언어로 (audit가 키 패리티 검사) |
| 4 | DB | 마이그: `title_<loc>`·`overview_<loc>`·`<loc>_fetched_at`·`name_<loc>` nullable 컬럼 (§3.1과 같은 템플릿) |
| 5 | 백필 | `worker/tmdb-i18n-backfill.py --locale <loc>` 실행 (워커는 로케일 파라미터화 — §3.2) + 지명 데이터(§3.3 동일 방식) |
| 6 | 셸·사이트맵 | `app/<loc>/**` 셸 디렉터리를 app/ko/** 에서 기계적 복사(로케일 상수만 교체, 각 ≤20줄) + `films-<loc>.xml` 등 샤드 + `INDEX_COHORT_FILMS_<LOC>` 캡 상수 |
| 7 | 개방 | live=true 전환 → hreflang·스위처·배너·사이트맵 인덱스에 자동 편입 → 검색엔진 제출(언어별: ko=네이버, 그 외 GSC/Bing 기본) |

**"카테고리별로 다국어 네이밍"(오너 표현)의 구현이 §2.2.1 어휘 매트릭스다** — 영어 키가 행(row), 언어가 열(column)인
표 하나가 전 언어 네이밍의 SSOT이고, 새 언어는 열 하나를 채우는 일이다.

### -2.3 hreflang의 다국어 형태
언어가 늘어도 §6.1의 `alternates.languages`에 **live 로케일 중 해당 페이지가 색인 적격인 것만** 열거하면 된다
(x-default는 항상 en). 언어 간 상호 hreflang(ko↔ja)도 같은 맵에서 자동으로 성립한다 — 언어별 특수 배선 금지.

---

## §-1 정본 관계 선언 — 이 문서와 `HANDOFF-한국어화-i18n-마스터.md`

저장소에는 한국어화 정본이 하나 더 있다: `HANDOFF-한국어화-i18n-마스터.md`(2026-07-11, 이하 "마스터").
두 문서는 **상충이 아니라 역할 분담**이며, 실행자는 다음 분담을 절대 흐리지 말 것:

| 층 | 담당 문서 | DB 전략 | 비용 |
|---|---|---|---|
| **크롬·템플릿·데이터 투영층** — UI 문자열, 결정론 조립 문장, TMDB/지명 데이터 값 | **본 문서** | 원본 테이블에 가산적 nullable `_<loc>` 컬럼 (§3) | ~0원 |
| **롱폼 프로즈층** — takes·essays·figures·meta_takes·reception **본문**의 LLM 번역 + 자율 번역 루프 | **마스터** (§6 content_i18n 사이드테이블 + 리컨실러) | `content_i18n` 사이드테이블 (lang 컬럼 — 이미 다국어 설계) | ~$220/언어 (Opus 배치, 오너 착수 결정 대기) |

- 본 문서는 마스터 로드맵의 **웨이브⓪~① 중 "생성기 i18n + 데이터 조인" 부분(마스터 계층 B·C)을 선행 실행**하는
  구체 지시서다. 마스터의 `content_i18n` 루프가 나중에 켜져도 본 문서의 구조(셸·사전·`_<loc>` 컬럼)는 그대로 유효하며,
  롱폼 번역문은 `locVal()`이 아니라 content_i18n 조인으로 렌더에 흘러들어온다(그 배선은 마스터 착수 시점의 일).
  content_i18n의 `lang` 컬럼과 본 문서의 로케일 레지스트리는 같은 코드값(ko/ja/fr/es)을 쓴다.
- **표면 데이터(제목·overview·지명)는 `_<loc>` 컬럼, 롱폼 본문은 content_i18n** — 같은 필드를 두 곳에 이중 저장하지 말 것.
- 마스터 **웨이브⓪(핵심 어휘·브랜드 어휘 오너 승인)** 게이트는 본 문서에도 적용된다 → §2.2.1.
- 마스터 §5(SEO)·§8(열린 결정)과 본 문서가 다르면 **본 문서가 우선**한다(본 문서가 최신 오너 검토를 반영).

관련: `HANDOFF-철학자패널-리뷰반영.md` §5-9는 "한국어 정적 페이지" 제안을 한국어화 정본으로 이관했다 —
그 이관의 실질 수신처는 이제 본 문서다. 철학자패널 작업과의 **순서 조율은 §10 (실행 전 필독)**.

---

## §0 대원칙 — "영어 단일 정본, 각 언어는 투영"

오너 요구사항의 핵심: **영어 글·디자인·DB 구조만 관리한다. 언어 사이트들은 별도 관리 대상이 아니다.**
이를 보장하는 5개 불변식(invariant). 모든 작업은 이 불변식을 깨지 않는 방향으로만 진행한다.

| # | 불변식 | 구현 수단 | 깨지면 생기는 일 |
|---|---|---|---|
| P1 | **포크 금지** — 로케일 라우트 파일은 얇은 셸(≤20줄). 본문 렌더 코드는 EN과 공유 | 페이지 본문을 `_shared.tsx`로 추출, 각 로케일 page.tsx는 래퍼 | 디자인 변경이 언어판에 반영 안 됨 (다중 관리 시작) |
| P2 | **폴백 필수** — 모든 번역 값(UI 사전, DB `_<loc>` 컬럼)은 부재 시 영어로 폴백 | `t()` 헬퍼 + `locVal()` 액세서 (§2) | 영어만 갱신했을 때 언어판이 깨지거나 빈 값 노출 |
| P3 | **가산적 DB만** — 기존 테이블·컬럼 절대 변경 금지. nullable `_<loc>` 컬럼 추가만 허용 | 마이그레이션 규칙 (§3) | 기존 EN 쿼리·공장·워커가 깨짐 |
| P4 | **사전 키 = 영어 원문** — 모든 언어 사전의 키는 영어 문자열 그 자체(전 언어 공통 키 집합) | `DICTS.ko["Watch now"] = "지금 보기"` (§2) | 영어 카피 변경 시 낡은 번역 잔존. 키=원문이면 자동 영어 폴백 + 감사 스크립트에 잡힘 |
| P5 | **색인 게이트 상속+강화** — 로케일 페이지의 robots 판정은 영어 쌍둥이의 게이트를 그대로 import한 뒤 **해당 언어 실질 조건(§6.2)을 AND로 추가** | `filmIndexBar` 재사용 + `title_<loc> AND overview_<loc>`(v1), 로케일별 코호트 캡 (§6) | thin/혼합언어 페이지 대량 색인 → EN으로 캐노니컬 접힘 또는 사이트 전체 품질 신호 훼손 |

**왜 이 구조면 "영어만 관리"가 성립하는가**: 디자인 변경 → 공유 컴포넌트 수정 → 전 언어판이 같은 컴포넌트라 즉시
반영(P1). DB 구조 변경 → 언어판은 테이블을 포크하지 않고 `_<loc>` 컬럼+폴백만 얹으므로 새 컬럼·테이블은 그대로
통과(P2·P3). 영어 카피 변경 → 사전 키 미스매치 → 전 언어 자동 영어 폴백, `i18n-audit` 리포트에 미번역으로 표시(P4).
새 페이지 타입·새 콘텐츠 → 로케일 셸을 만들기 전까지는 언어판에 존재하지 않을 뿐, 아무것도 깨지지 않음.
**새 언어 → §-2.2 체크리스트만으로 편입.**

**금지사항 (하드 룰)**
- **"ko" 하드코딩 금지** — 로케일 코드가 등장해도 되는 곳은 `locales.ts`·`dict/<loc>.ts`·마이그레이션 컬럼명·
  셸 디렉터리명·코호트 상수명뿐. 헬퍼·컴포넌트·조건문에는 항상 `Locale` 타입 값이 흐른다.
- IP 기반 강제 리다이렉트 금지 (Googlebot은 미국 IP — EN 페이지를 못 보게 됨). 제안 배너만 (§7).
- 영화 제목을 직접 번역하지 말 것 — **TMDB 해당 언어 공식 표기만** 사용, 없으면 영어 제목 폴백. `original_title`은
  원문 유지. (ko의 TMDB 표기 공백은 KOBIS 보완 옵션 — §9, 오너 결정. 타 언어는 해당 언어권 소스 검토를 그 언어 착수 시.)
- 제품 어휘는 전 언어에서 번역 금지: NAV, TakeScore, Tier, WWI, V/C/R/U, Metatake, Engine Room, Strong Misreadings,
  Embedding Fantasia. (`components/room/strings.ts` 헤더 주석의 기존 규칙과 동일.)
- **Embedding Fantasia 모듈(df-know)은 번역 대상이 아니며 EN 외 로케일에서는 렌더하지 않는다** — §1.1 (오너 확정
  2026-07-16). 비-EN에서 섹션·탭 모두 부재.
- 번역 작업 중 영어 원문을 "개선"하지 말 것 — 영어 수정은 별도 커밋/별도 판단.
- EN 쌍둥이가 noindex인 로케일 페이지를 색인시키지 말 것 (P5).
- 로케일 전용 컴포넌트 파일 생성 금지. locale 분기로 레이아웃을 바꾸는 것도 금지 — 텍스트/값만 달라진다.
  (열거된 예외 둘뿐: ① §6.2의 robots 강화 조건 — 레이아웃이 아니라 색인 신호 ② §1.1의 Embedding Fantasia 표시
  게이트. 그 외 locale 레이아웃 분기 일절 금지.)
- **기존 KO 에세이 URL(`/film/[slug]/[desk]/ko`)은 절대 이동 금지** — 이미 색인·hreflang·`essays-ko.xml`이 걸려 있다.
  신규 표면은 `/{locale}` 프리픽스를 쓰므로 URL 체계가 이원화되는데, 이는 의도된 비일관성이다(색인 자산 보호 > 일관성).
- **마크업 위생**: 셸/로컬라이즈 과정에서 인접 `<span>` 사이 공백이 필요한 곳은 `{" "}`를 명시할 것 —
  JSX 줄바꿈 공백은 렌더 HTML에서 사라져 크롤러·AI 추출 텍스트가 붙어버린다(철학자패널 E5에서 확인된 실결함).

---

## §1 범위 (Tier-2 프로젝션 대상) — 웨이브 1은 전부 ko

**포함** (페이즈 순서대로):
1. `/ko/film/[slug]` — 필름 메인 (Tier-2 통합 본문: 수상·개봉·촬영지 리드는 결정론 조립이라 템플릿 번역으로 커버)
2. `/ko/atlas/[...]`, `/ko/film/[slug]/locations` — 아틀라스·촬영지 (도시 511 + film_locations 지명)
3. `/ko/director/[slug]` — 감독 메인
4. `/ko` 랜딩, `/ko/catalog/*`, 공유 네비/푸터 사전화, 로케일 스위처, 제안 배너
5. 사이트맵/hreflang/네이버/GSC 마감

**제외** (계약): poetics 에세이 44편, figures/takes/misreadings **본문**, docs/methodology, /room·/me·admin·crm (인증 영역),
ASK/chat (LLM 실시간 표면), blog. 롱폼은 기존 `essays.lang='ko'` 트랙 + 마스터 content_i18n 루프(§-1)가 담당한다 —
건드리지 않는다.

### 1.1 ⚠️ 예외 명시 — Fantasia는 비-EN 비표시, DB 원문 프로즈는 영어 병행 (오너 확정 2026-07-16)

필름 메인의 df-know 섹션은 렌더 시 조립이 아니라 **`film_sentences_for` RPC가 완성된 영어 문장 행을 DB에서 가져와
verbatim 렌더**한다(`app/film/[slug]/page.tsx:570`, film_sentences 466,974행). 행마다 문장이 다르므로 영어-키 사전으로는
구조적으로 번역 불가. 게다가 이 문장층에는 "Not AI-written" 브랜드 계약이 걸려 있어(정본 `HANDOFF-임베딩판타지아-문장층.md`)
번역 방식 자체가 오너 결정 사항이다.

**결정 ① — Embedding Fantasia 모듈은 비-EN 로케일에서 렌더하지 않는다.** 구현: 섹션·탭 생성 조건(현행
`sentences.length >= 2`)에 `locale === "en"`을 AND — 필름 페이지 섹션들은 이미 "데이터 있으면 표시"의 조건부
구조라 이는 포크가 아니라 기존 패턴의 연장이다(§0 예외 ②). 비-EN 렌더 경로에서는 문장 fetch 자체를 건너뛴다(불필요
쿼리 방지). 부수 효과: 언어판의 영어 비중이 줄어 §6.5 리스크 완화. 각 언어판 재개는 마스터 계층 B의
"13패턴+슬롯 사전 재생성"(LLM 0 유지)으로만 가능 — §9 오너 미결.

**결정 ② — takes(take_title·rationale)·figures(label·description)·리셉션 인용(headline·comment)·Strong Misreadings
티저는 언어판에서도 영어 원문 그대로 병행 표시한다** (리셉션 인용은 원문 병기가 원칙이라 영구히 원문이 맞음).
이들은 사이트의 제품 핵심이라 숨기면 언어판이 데이터 껍데기가 된다. **병행 규약**:
- 해당 영어 프로즈 블록의 래퍼 요소에 **`lang="en"` 속성**을 단다 — 사용자가 브라우저 번역(우클릭→"한국어로 번역")을
  쓰면 자국어 부분은 그대로 두고 영어 섹션만 번역된다. 스크린리더·언어 판정에도 도움.
- 섹션 머리에 **"영어 원문" 마이크로 라벨**(비-EN 로케일에서만 렌더 — 라벨 문자열 자체도 사전 키
  `"English original"`로 각 언어 사전에서 옴, `title` 툴팁 "브라우저 번역으로 읽을 수 있습니다"도 동일).
- 사이트가 크롬 내장 번역을 켜고 끄는 버튼은 만들 수 없다(브라우저 JS API 부재, 구글 웹사이트 번역 위젯은 상업
  사이트 중단) — lang 속성과 라벨이 우리가 할 수 있는 전부이자 충분한 지원이다. 이 이상을 시도하지 말 것.

이 혼재가 §6.5의 혼합 언어 리스크의 원천이므로 반드시 §6.5의 코호트 선별과 함께 운용할 것.

---

## §2 i18n 코어 — `lib/i18n/` (Phase 0)

새 디렉터리 `lib/i18n/`. **외부 라이브러리(next-intl 등) 도입 금지** — 199개 라우트 전체 리팩터링을 유발한다.
파일 구성: `locales.ts`(§-2.1) · `index.ts` · `dict/ko.ts`(언어별 1파일) · `values.ts` · `genres.ts` ·
`cities/ko.json`(언어별 1파일).

### 2.1 `lib/i18n/index.ts` — t()와 경로 헬퍼
```ts
import { LOCALES, type Locale } from "./locales";
import { KO } from "./dict/ko";
// 언어 추가 시 여기 import 1줄 + DICTS 1줄 (§-2.2 단계 3)
const DICTS: Partial<Record<Locale, Record<string, string>>> = { ko: KO };

/** UI 문자열 투영. 키 = 영어 원문(P4). 미번역/영어 로케일이면 원문 그대로(P2). */
export function t(locale: Locale, en: string, vars?: Record<string, string | number>): string {
  const s = DICTS[locale]?.[en] ?? en;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/** EN 경로 → 로케일 경로. locPath("ko", "/film/x") = "/ko/film/x" */
export function locPath(locale: Locale, path: string): string {
  if (locale === "en") return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}
/** 로케일 경로 → EN 경로 (프리픽스 제거) */
export function stripLocale(pathname: string): { locale: Locale; path: string } { /* 프리픽스가 LOCALES 키면 분리, 아니면 en */ }
```

### 2.2 `lib/i18n/dict/ko.ts` — 언어별 UI 사전 (키는 전 언어 공통 = 영어 원문)
```ts
/** KO UI 사전 — 웨이브 1. 키는 코드에 등장하는 영어 원문과 바이트 단위로 동일해야 하며,
 *  이 키 집합이 이후 dict/ja.ts·dict/fr.ts·dict/es.ts와 공유된다(audit가 키 패리티 검사).
 *  파라미터는 {n}, {title} 형태. 언어별 번역은 각 언어 파일에만 산다. */
export const KO: Record<string, string> = {
  // ── CORE VOCABULARY (§2.2.1 매트릭스의 ko 열 — 오너 승인 대상) ──
  "Directors": "감독",
  "Filming locations": "촬영지",
  "Where to watch": "볼 수 있는 곳",
  // ── 이하 롱테일 (승인 불요, 증분 추가) ──
  "Watch now": "지금 보기",
  "Awards & honors": "수상 이력",
  "Release history": "개봉 연혁",
  "Directed by {name}": "{name} 감독",
  "{n} min read": "{n}분 분량",
  "English original": "영어 원문",
  // …페이지 로컬라이즈 진행에 따라 증분 추가
};
```
채우는 방식: **페이지 타입을 로컬라이즈하는 페이즈에서, 그 페이지가 렌더하는 컴포넌트의 리터럴만** `t()`로 치환하며
그때그때 이 사전에 추가한다. 235개 컴포넌트 전수 추출을 선행하지 말 것 — 범위 밖 컴포넌트는 건드리지 않는다.
번역은 에이전트(Claude)가 세션 내에서 직접 수행한다(별도 API 비용 없음).

**문체 (ko 확정)**: 평서형 간결체, CTA는 존댓말 명사형("보기", "더 보기"), `room/strings.ts`의 terse+honest 톤 유지.
(마스터 §8 미결 #1을 이 기본값으로 해소 — 오너 검토 2026-07-16 승인. 오너가 합쇼체로 뒤집으면 사전만 고치면 된다.)
**문체는 언어별 결정 사항** — ja/fr/es 착수 시 §-2.2 단계 2에서 각각 확정(예: 일본어 です・ます체 여부).

#### 2.2.1 코어 어휘 매트릭스 — 오너 승인 게이트 (마스터 웨이브⓪ 상속, "카테고리별 다국어 네이밍"의 SSOT)

**Phase 2 착수 전에**, 사이트의 축이 되는 어휘 ~50개(네비 항목·카테고리/코너명·공통 CTA·필름 페이지 섹션 헤더)를
**매트릭스 표**(행 = 영어 키, 열 = 언어)로 작성해 **PR 본문에 그대로 실어 오너 확인을 받은 뒤** Phase 2를 진행한다.
웨이브 1에서는 ko 열만 채우지만 **표의 형태는 처음부터 다열**이다 — 이 표가 전 언어 네이밍의 단일 원장이며,
새 언어 추가란 이 표에 열 하나를 채워 승인받는 일이다(§-2.2 단계 2). 승인된 행은 각 언어 사전 파일 최상단의
"CORE VOCABULARY" 블록으로 들어간다(코드의 SSOT는 사전 파일, 매트릭스 표는 승인·조망용 — 문서 부록이나 PR에 유지).

| English (key) | ko | ja | fr | es |
|---|---|---|---|---|
| Directors | 감독 | *(착수 시)* | *(착수 시)* | *(착수 시)* |
| Filming locations | 촬영지 | | | |
| … (~50행, Phase 0에서 완성) | | | | |

원칙(마스터 §4와 동일): 브랜드 고유명은 전 언어 영문 유지, 기능적 명칭은 각 언어 정식 명칭 신규 제정.
이 표가 흔들리면 이후 모든 증분 번역이 흔들린다 — 롱테일 문자열은 승인 불요, **코어 어휘만 게이트**다.

### 2.3 `lib/i18n/values.ts` — DB 값 폴백 액세서 (로케일-제네릭)
```ts
import type { Locale } from "./locales";

/** DB 행의 로케일 값 투영. row에 `${field}_${locale}`이 있으면 쓰고 없거나 null이면 영어 폴백(P2·P3).
 *  새 컬럼이 EN 쪽에 추가돼도, 새 언어 컬럼이 추가돼도 이 함수는 무변경 — 구조 변경 자동 통과의 핵심. */
export function locVal<T extends Record<string, unknown>>(
  row: T, field: keyof T & string, locale: Locale
): string | null {
  if (locale !== "en") {
    const v = row[`${field}_${locale}` as keyof T];
    if (typeof v === "string" && v.trim()) return v;
  }
  const en = row[field];
  return typeof en === "string" ? en : null;
}
```
사용 예: `locVal(film, "title", locale)`, `locVal(film, "overview", locale)`, `locVal(loc, "name", locale)`.

### 2.4 `lib/i18n/genres.ts` — TMDB 장르 정적 맵 (언어별 열)
TMDB 장르는 고정 19종이므로 DB 컬럼 대신 코드 맵. 구조는 언어별: `GENRES: Partial<Record<Locale, Record<string,string>>>`
— 웨이브 1은 ko만 채움 (TMDB `/genre/movie/list?language=ko` 공식 표기 기준). `genreName(name, locale)` 헬퍼가
`GENRES[locale]?.[name] ?? name` 폴백. 새 언어는 같은 파일에 맵 하나 추가.

### 2.5 클라이언트 컴포넌트용 로케일 전달
서버 컴포넌트는 `locale` prop을 명시적으로 내려보낸다 (컨텍스트보다 추적 용이).
클라이언트 컴포넌트가 필요한 경우에만 `components/i18n/LocaleProvider.tsx` (React context + `useLocale()` 훅)를 만들고
로케일 셸에서 `<LocaleProvider locale="ko">`로 감싼다. **기본값은 "en"** — Provider가 없는 기존 트리 전체는 무변경으로 동작.

### 2.6 ⚠️ 캐시 규율 (이 저장소의 반복 함정 — 위반 시 오진·유령 404)
- `unstable_cache`로 감싼 로더가 **locale을 인자로 받게 되는 순간, 캐시 키에 locale을 반드시 포함**한다.
  v1의 로더들은 locale 무관 데이터만 반환하므로 해당 없음 — 하지만 나중에 누군가 로더 안에서 `t()`/`locVal()`을 호출하도록
  바꾸면 즉시 이 함정이 발동한다. 원칙: **로컬라이즈는 렌더 계층에서만, 캐시된 로더는 raw 데이터만.**
- 신규 로케일 라우트는 unstable_cache **null-포이즌 404** 함정 대상 — 로더가 일시 실패로 null을 캐시하면 ISR 주기 동안
  404가 굳는다. 기존 EN 로더의 null 처리 관행을 그대로 상속할 것.
- 배포 직후 라이브 검증은 항상 `?v={timestamp}` 캐시버스터. 긴 문장 grep 금지 — React 주석 노드가 렌더 HTML
  텍스트를 쪼갠다. 짧은 조각으로 검색.

---

## §3 DB — 가산적 마이그레이션 + TMDB 백필 (Phase 1)

### 3.1 마이그레이션 `supabase/migrations/0105_locale_projection_ko.sql` (언어별 1파일, 같은 템플릿)
> 번호는 착수 시점의 최신+1로 재확인 (현재 0104가 최신이며 0104는 오너 적용 대기 중).
```sql
-- 다국어 프로젝션 웨이브 1(ko): 가산적 nullable 컬럼만. 기존 스키마/RLS/뷰 무변경 (P3).
-- 새 언어 = 이 파일을 템플릿으로 _<loc> 마이그 1개 (§-2.2 단계 4).
alter table films add column if not exists title_ko text;
alter table films add column if not exists overview_ko text;
alter table films add column if not exists ko_fetched_at timestamptz; -- 백필 워커 증분 커서 (언어별 컬럼)
alter table film_locations add column if not exists name_ko text;
comment on column films.title_ko is 'TMDB ko-KR 공식 표기. 직접 번역 금지. null이면 title로 폴백.';
```
`NOT NULL`·default·인덱스·트리거 추가 금지. 기존 `select("*")` 호출들이 새 컬럼을 자동으로 받으므로 타입 정의
(`lib/tmdb.ts FilmRow` 등)에 `title_ko: string | null; overview_ko: string | null;` 필드를 추가한다
(언어 추가 시 해당 필드도 추가 — 타입은 컬럼의 거울).

### 3.2 백필 워커 `worker/tmdb-i18n-backfill.py` — **로케일 파라미터화**
기존 worker 컨벤션(`worker/tmdb-fetch.py`, `--films` 패턴은 `worker/asset-gen.py` 상단 `FILMS_ARG` 참조)을 따른다.
**`--locale ko` 필수 인자** — TMDB language 코드는 `lib/i18n/locales.ts`의 tmdb 값과 동일한 매핑을 워커 상수로 유지
(ko→ko-KR, ja→ja-JP, …). 새 언어 백필 = 같은 워커에 `--locale <loc>`.

- **입력 코호트**: 기본 = `films where tmdb_id is not null and (<loc>_fetched_at is null or <loc>_fetched_at < now() - interval '90 days')`.
  `--films slug1,slug2`(스코프 지정), `--missing`(title_<loc> null만), `--limit N`, `--dry` 지원.
- **동작**: 편당 `GET /movie/{tmdb_id}?language={tmdb_lang}` 1콜 →
  `title_<loc> = resp.title if resp.title != films.title else null` (해당 언어 표기가 영어 원제와 동일하면 저장 안 함 — 폴백에 맡김),
  `overview_<loc> = resp.overview or null` (TMDB 해당 언어 줄거리 없는 작품이 흔함 — null이면 영어 폴백),
  `<loc>_fetched_at = now()`.
- **레이트리밋**: TMDB ~40 req/s. 안전하게 20 req/s 스로틀. 5,000편 ≈ 5분. 비용 0원.
- **인증**: `TMDB_READ_TOKEN` env (lib/tmdb.ts와 동일한 v3/v4 분기).
- **증분 운영**: 신작이 공장 인테이크로 들어오면 이 워커를 `--locale ko --missing`으로 돌리면 된다. 공장 스테이지로
  편입하지 말 것(신축 금지 원칙) — 초기엔 수동/크론 실행, 오너가 원하면 나중에 manifest 레인 추가를 별도 결정.
- **검증 SQL**: `select count(*) filter (where title_ko is not null), count(*) filter (where overview_ko is not null), count(*) from films where tmdb_id is not null;`

### 3.3 지명 데이터 (웨이브 1 = ko; 새 언어는 같은 구조의 파일 추가)
- **도시 511개**: `lib/atlas_cities.json`을 수정하지 말 것(공장·맵 스크립트가 소비). 대신 병렬 파일
  `lib/i18n/cities/ko.json` 생성: `{ "los-angeles": {"name":"로스앤젤레스","country":"미국"}, … }` (키 = 기존 slug).
  에이전트가 세션 내 직접 작성 — 국립국어원 외래어 표기법 + 통용 표기 우선(뉴욕, 도쿄, 파리 등). 헬퍼
  `cityName(slug, locale)` → 해당 언어 파일 없거나 미등재면 영어 name 폴백.
- **film_locations.name_ko (~2,500행)**: 에이전트가 배치 번역해 `data/i18n/film-locations-ko.csv`
  (`id,name_ko` 2컬럼)로 저장 → `scripts/load-locations-i18n.mjs --locale ko`가 Supabase service key로 500행 단위 upsert.
  번역 규칙: 주소급 문자열("Hanam, Gyeonggi Province" → "경기도 하남시")은 한국 행정구역 표기로, 해외 지명은 외래어
  표기법으로, 확신 없는 고유명사(소규모 상호 등)는 **원문 유지**(오역보다 원문이 낫다). 여러 세션에 나눠 진행 가능 —
  CSV는 증분 append, 로더는 upsert라 재실행 안전.

---

## §4 라우트 프로젝션 — 셸 패턴 (Phase 2~4)

### 4.1 본문 추출 + 다중 셸 (페이지 타입당 1회 리팩터링, 언어 추가는 셸 복사만)
대상 페이지(예: `app/film/[slug]/page.tsx`)의 본문 전체를 같은 디렉터리의 `_shared.tsx`로 옮긴다
(Next는 `_` 프리픽스 파일을 라우트로 취급하지 않음):

```tsx
// app/film/[slug]/_shared.tsx  — 기존 page.tsx 내용 전체가 이사. locale 파라미터만 추가.
import type { Locale } from "@/lib/i18n/locales";
export async function filmMetadata(slug: string, locale: Locale): Promise<Metadata> { /* 기존 generateMetadata 본문 + §6 alternates */ }
export async function FilmPage({ slug, locale }: { slug: string; locale: Locale }) { /* 기존 렌더 본문 */ }
```
```tsx
// app/film/[slug]/page.tsx — EN 셸 (≤20줄, P1)
import { FilmPage, filmMetadata } from "./_shared";
export const revalidate = 3600; // 기존 값 유지
export async function generateMetadata({ params }: Props) { return filmMetadata((await params).slug, "en"); }
export default async function Page({ params }: Props) { return FilmPage({ slug: (await params).slug, locale: "en" }); }
```
```tsx
// app/ko/film/[slug]/page.tsx — KO 셸 (동일 형태, locale 상수만 "ko". 새 언어 셸 = 이 파일 복사 + 상수 교체)
import { FilmPage, filmMetadata } from "@/app/film/[slug]/_shared";
export const revalidate = 3600;
export async function generateMetadata({ params }: Props) { return filmMetadata((await params).slug, "ko"); }
export default async function Page({ params }: Props) { return FilmPage({ slug: (await params).slug, locale: "ko" }); }
```
> 설계 노트: `app/[locale]/` 동적 세그먼트로 전 언어를 한 셸에 담는 방안은 **기각** — 루트에서 기존 정적 라우트
> 전부와 매칭 우선순위가 얽히고(오타 URL 흡수·404 처리 복잡화), 미들웨어 불가침 원칙과도 충돌 여지. 언어당
> 셸 디렉터리 복사(각 파일 ≤20줄, 기계적)가 이 저장소에서는 더 안전하고, 비용은 언어당 몇 분이다.

리팩터링 규칙:
- `_shared.tsx`로 옮길 때 **로직·마크업을 1바이트도 바꾸지 않는다**. 이동 커밋과 로컬라이즈 커밋을 분리한다
  (리뷰에서 diff가 "이동"임이 보이도록).
- 이동 후 로컬라이즈 커밋에서: 사용자 노출 리터럴 → `t(locale, "…")`, DB 텍스트 값 → `locVal(row, "field", locale)`,
  장르 → `genreName()`, 지명 → `cityName()`/`locVal(loc,"name",locale)`, 날짜 포맷 →
  `new Intl.DateTimeFormat(LOCALES[locale].intl, …)`.
- 페이지가 렌더하는 공유 컴포넌트(SiteNav, 푸터, 섹션 컴포넌트)에 리터럴이 있으면 그 컴포넌트에 `locale?: Locale = "en"`
  prop을 추가하고 `t()`로 치환 — **기본값 "en"이므로 이 컴포넌트를 쓰는 다른 195개 라우트는 무변경**.
- **결정론 조립 문장만 t() 대상이다**: 필름 페이지의 렌더-시 조립 리드(수상 다이제스트 C1, 개봉 원장 문장, 촬영지 리드 등 —
  `HANDOFF-필름페이지-보강-작업지시서.md` 참조)는 조립 템플릿을 `t()` 경유로 바꾸면 템플릿 하나 번역이 수천 페이지를
  커버한다. 조립 로직(부분집합·문장형 선택)은 공유. **반면 DB에서 완성문으로 오는 것은 t() 대상이 아니다 —
  §1.1 규약대로 처리(Fantasia는 비-EN 비표시, takes·figures·인용은 `lang="en"`+라벨 병행).** 이 구분을 헷갈리면 안 된다:
  "이 문자열이 코드 리터럴/템플릿인가, DB 행인가"가 판별 기준.
- `generateStaticParams`는 로케일 셸에서 `return []` (기존 KO 에세이 페이지와 동일 — 온디맨드 ISR 패턴).

### 4.2 페이즈별 대상 라우트 (웨이브 1)
| Phase | EN 원본 | KO 셸 | 비고 |
|---|---|---|---|
| 2 | `app/film/[slug]/page.tsx` | `app/ko/film/[slug]/page.tsx` | 최우선. Tier-2 통합 본문 포함. **착수 전 §10 시퀀싱 확인** |
| 3 | `app/atlas/**`, `app/film/[slug]/locations/page.tsx` | `app/ko/atlas/**`, `app/ko/film/[slug]/locations/` | cities/ko.json 선행. **한국어 검색 기대값 최고 표면(§6.5)** |
| 4 | `app/director/[slug]/page.tsx`, `app/catalog/**`, `app/page.tsx`(홈) | `app/ko/director/…`, `app/ko/catalog/…`, `app/ko/page.tsx` | 홈은 라이트 버전 가능(오너 판단). **E1 홈 카피 확정 이후에만(§10)** |

필름 서브데스크(reception/watch/honors/credits/gallery 등)는 v1 범위 밖 — 필름 메인의 섹션 리드로 충분. 반응 보고 확장.

### 4.3 `app/ko/layout.tsx` (언어별 1파일, 동일 템플릿)
`<html lang>`은 루트 레이아웃 소관이라 로케일 서브트리에서 못 바꾼다. `app/ko/layout.tsx`는
`<LocaleProvider locale="ko">` 래핑 + (가능하면) 메타데이터 기본값만 담당. lang 속성은 §6.4의 방식으로 처리.

---

## §5 자동 전파 로직 — 감사 스크립트 (Phase 0에서 골격, 이후 증분)

`scripts/i18n-audit.mjs` — "영어만 관리" 체제의 관측 도구. 실패시키는 CI 게이트가 아니라 **리포트**다.
전 언어를 한 번에 보고한다(웨이브 1에서는 ko만 존재).

1. **사전 커버리지**: `lib/i18n/` 하위와 로컬라이즈된 `_shared.tsx`/컴포넌트에서 `t(locale, "…")` 첫 문자열 인자를
   정규식 추출 → 각 live 로케일 사전에 없는 키 목록 출력 = "현재 영어로 폴백 중인 문자열". 영어 카피를 바꾸면 여기 자동 표시.
2. **키 패리티**: 로케일 사전들 간 키 집합 차이 출력 (언어가 2개 이상 live일 때 — 한 언어에만 있는 키 = 누락 경보).
3. **DB 커버리지**: Supabase anon으로 `films`(visible 또는 filmIndexBar 통과 코호트) 중 `title_<loc> is null`·
   `overview_<loc> is null` 카운트, `film_locations` 중 `name_<loc> is null` 카운트를 live 로케일별 출력
   = 백필 큐 + §6.2 게이트 통과 규모.
4. **셸 두께 검사**: `app/{ko,ja,fr,es}/**/page.tsx` 각 파일 줄 수 > 25면 경고 (P1 위반 조짐 — 본문이 셸로 새기 시작한 것).
5. 출력은 stdout 요약 + `Outputs/i18n-audit-YYYYMMDD.md` (기존 Outputs 컨벤션 따름).

운영 리듬: 배포 전 1회 실행. 신작 유입 후 `worker/tmdb-i18n-backfill.py --locale <loc> --missing` 실행(live 로케일별).
이 두 개가 언어 사이트 유지관리의 전부여야 한다 — 그 이상이 필요해지면 P1~P4 위반을 의심할 것.

---

## §6 SEO 배선 (각 페이즈에 포함)

### 6.1 hreflang — `lib/i18n/seo.ts` (⚠️ 조건부 방출, 다국어 형태)
```ts
import { locPath, LIVE_LOCALES, type Locale } from "./index";
/** 로컬라이즈된 페이지 타입의 각 로케일 셸 metadata에 주입.
 *  indexableLocales = 이 페이지의 §6.2 게이트를 통과하는 비-EN 로케일 목록 (호출부가 films 행에서 판정). */
export function localeAlternates(enAbsPath: string, locale: Locale, indexableLocales: Locale[]): Metadata["alternates"] {
  const self = locPath(locale, enAbsPath);
  const langs: Record<string, string> = { en: enAbsPath, "x-default": enAbsPath };
  for (const l of indexableLocales) langs[l] = locPath(l, enAbsPath);
  // 자기 자신이 부적격 로케일이어도 canonical은 항상 자기 자신 (noindex는 robots가 담당)
  if (locale === "en" && indexableLocales.length === 0) return { canonical: self };
  return { canonical: self, languages: langs };
}
```
- **EN 페이지는 게이트(§6.2)를 통과하는 로케일 쌍둥이만 alternate로 방출한다.** hreflang 대상은 색인 가능해야
  한다는 구글 규칙 — noindex 쌍둥이를 가리키는 hreflang 수천 개는 깨진 쌍이다. EN metadata는 이미 films 행을 들고
  있으므로 `title_<loc>`/`overview_<loc>` 확인에 추가 쿼리가 들지 않는다. 언어 간(ko↔ja) 상호 hreflang도 같은
  맵에서 자동 성립(§-2.3) — 언어별 특수 배선 금지.
- 로케일 페이지 자신의 **canonical은 항상 자기 자신** — 언어판의 canonical을 EN으로 걸면 그 언어 색인이
  원천 차단되므로 절대 금지. 기존 선례: `app/film/[slug]/[desk]/page.tsx:191`.
- ⚠️ 이 변경은 EN 필름 6,701편 전체의 metadata를 건드린다 — 배포 후 검증은 캐시버스터 필수(§2.6), EN 쪽 diff는
  "alternate 추가"만이어야 하고 기존 canonical·robots는 바이트 불변이어야 한다.

### 6.2 robots — 게이트 상속+강화 (P5)
로케일 셸의 metadata는 EN과 **같은 신호 로더, 같은 게이트 함수**를 호출한다. 필름 메인이면
`film_index_signals_json()` RPC → `filmIndexBar(s)` → `pageRobots(passed)` 그대로. 로케일 전용 게이트 신설 금지.
그 위에 **v1 강화 조건을 AND로 얹는다: `title_<loc> IS NOT NULL AND overview_<loc> IS NOT NULL`이 아니면 해당
로케일 페이지는 noindex** (페이지 자체는 렌더됨 — 폴백 표시 + noindex). 근거: §1.1의 혼합 언어 구조상, 자국어 제목만
있고 본문 텍스트가 대부분 영어인 페이지는 EN 쌍둥이의 중복으로 읽혀 캐노니컬이 EN으로 접힐 위험이 크다(§6.5).
title만 있는 페이지까지 열지 말 것. GSC에서 해당 언어 색인이 안정 확인된 뒤 overview 조건 완화는 오너 결정(§9).

### 6.3 사이트맵
- 새 샤드(언어별): `app/sitemaps/films-ko.xml/route.ts` (Phase 2), `cities-ko.xml`·`locations-ko.xml` (Phase 3),
  `directors-ko.xml` (Phase 4) — 새 언어는 같은 이름 규칙 `*-<loc>.xml`. 구현은 대응 EN 샤드의 엔트리 생성 함수를
  재사용하되 URL에 `locPath()` 적용 + **§6.2와 동일 필터(`title_<loc> is not null and overview_<loc> is not null`)**
  적용. `essays-ko.xml`(기존)이 참조 구현.
  불변식: **사이트맵은 색인 가능 집합의 엄격 부분집합** — robots가 noindex인 URL이 사이트맵에 실리면 안 된다
  (2026-07-16 GSC 가지치기 작업의 사이트맵 미러 원칙과 동일).
- 코호트 캡: `lib/seo.ts`에 `INDEX_COHORT_FILMS_KO = 300` 등 **로케일별 상수** 추가 (기존 `INDEX_COHORT_ESSAYS_KO = 300`
  선례와 동일 — 주간 GSC 증거 기반으로만 상향, 코멘트에 근거 기록). **캡 안의 300편 선별 기준은 §6.5.**
- `app/sitemap.xml/route.ts` 인덱스에 새 샤드 등록. 배포 후 `npm run indexnow` (기존 스크립트) 핑.

### 6.4 lang 속성 + 메타데이터·JSON-LD 로컬라이즈
- 루트 `app/layout.tsx`의 `<html lang="en">`을 서브트리에서 바꿀 수 없으므로, 각 로케일 layout에 최소 클라이언트
  컴포넌트 `<SetHtmlLang lang={locale} />` (useEffect로 `document.documentElement.lang` 설정) 추가. 크롤러는 hreflang을
  우선하므로 SSR HTML의 lang 불일치는 치명적이지 않다 — 이 정도로 충분, 루트 레이아웃 개조 금지.
- **metadata의 title/description도 로컬라이즈 대상이다**: `filmMetadata(slug, locale)`가 title에 `locVal(f,"title",locale)`,
  description 조립 템플릿에 `t()`를 쓰도록 — 안 하면 "자국어 본문 + 영어 스니펫"의 반쪽 번역으로 보인다.
- **JSON-LD**: 로케일 페이지의 구조화 데이터에 `inLanguage: locale`을 넣고 `name`은 `locVal` 경유. OG는
  `og:locale = LOCALES[locale].ogLocale` (+ EN 쪽은 건드리지 않음). editor/Organization 노드 등 언어 무관 필드는 공유 그대로.

### 6.5 ⚠️ 혼합 언어·캐노니컬 접힘 리스크 — 코호트 선별과 관측 (이 기획의 최대 SEO 리스크, 전 언어 공통)

Tier-1 영화의 로케일 페이지는 Fantasia를 숨긴 뒤에도 본문 상당 부분이 영어 원문(§1.1 결정 ② — takes·figures·인용)이라,
구글이 EN 쌍둥이의 중복으로 판정하고 **캐노니컬을 EN으로 접을(folding) 위험**이 있다. (§1.1의 `lang="en"` 구획은
언어 판정에 도움을 주지만 접힘을 막아주지는 않는다.) 2026-07-16(56759a6)에 EN에서 "수천 편 동일 템플릿 지문"으로
색인 거절을 정리한 직후이므로, 같은 실수를 다른 언어로 재생산하면 안 된다. 대응 3가지 — 전 언어 공통 시행:

1. **초기 색인 코호트 300은 해당 언어 실질 비중이 높은 페이지로 선별한다.** 우선순위: ① overview_<loc> 보유 + Tier-2
   카탈로그형(피겨/테이크 없이 결정론 다이제스트가 본문 전부 → 템플릿 번역으로 거의 전문 자국어화되는, 역설적으로 최적의
   후보) ② overview_<loc> 보유 + 해당 언어권 관련성 높은 작품(ko면 한국 영화·한국 개봉 흥행작) ③ 그 외 overview_<loc>
   보유작. 선별 로직은 사이트맵 샤드의 정렬+캡으로 구현(별도 테이블 금지).
2. **Phase 3(아틀라스·촬영지)에 힘을 싣는다.** 촬영지 표면은 "번역이 아니라 데이터"로 전문 자국어화되는 유일한 표면이고
   ("화양연화 촬영지" 류 쿼리), 혼합 언어 문제가 구조적으로 없다. 해당 언어 검색 기대값이 필름 메인보다 높다 —
   Phase 2는 코호트 300으로 조심스럽게, Phase 3는 적극적으로.
3. **GSC 관측 지표를 명시**: 각 로케일 경로에서 "중복 — 사용자가 선택한 캐노니컬 없음 / 구글이 다른 캐노니컬 선택"
   항목을 주간 관찰. 이 항목이 해당 언어 색인 요청의 다수를 차지하면 코호트 확대 중단 + 오너 보고(overview_<loc>
   LLM 번역 채우기 결정의 트리거 — §9).

---

## §7 언어 제안 배너 + 로케일 스위처 (Phase 4)

- **배너 `components/i18n/LocaleSuggestBanner.tsx`** (클라이언트, 미들웨어 무변경, 로케일-제네릭):
  조건 = `navigator.language`가 **live 비-EN 로케일 중 하나와 매칭** && 현재 경로가 해당 로케일 밖 && 현재 페이지
  타입이 로컬라이즈됨 && `localStorage.mt_locale_dismissed !== "1"`. 표시 = 상단 슬림 바
  "{LOCALES[l].label}로 보기 → {locPath(l, pathname)}" + 닫기(영구 기억).
  `middleware.ts`는 건드리지 않는다(봇 인포스먼트 로직과의 간섭 리스크 > 이득). IP 리다이렉트 금지 재확인.
- **스위처**: `components/home2/Nav.tsx`에 언어 링크(live 로케일 목록에서 생성 — 웨이브 1에서는 EN↔KO 2개).
  ⚠️ 철학자패널 E6이 placeholder `EN ▾`(:337)를 **제거**한다 — 그 E6 항목에 "/ko 라이브 시 재도입"이 명시돼 있고,
  **이 스위처가 바로 그 재도입**이다. E6가 이미 실행됐으면 새로 달고, 아직이면 E6 실행자와 조율(placeholder를
  실기능으로 교체). 동작하지 않는 토글을 다시 만드는 것은 금지 — 로컬라이즈 안 된 페이지 타입에서는 스위처를 숨긴다.
- **이원 URL 매핑 규칙 (스위처·배너 공통)**: 쌍둥이 URL 계산은 단순 `locPath()`가 아니다 —
  ① 신규 표면: `/film/x` ↔ `/{locale}/film/x` (프리픽스 규칙). ② **기존 KO 에세이: `/film/x/[desk]` ↔ `/film/x/[desk]/ko`**
  (서픽스 규칙, ko 전용 레거시 — 절대 이동 금지 자산). 매핑 함수 `locTwin(locale, pathname): string | null`을
  `lib/i18n/index.ts`에 두고 두 체계를 모두 처리, 매핑 없으면 null(스위처 숨김). 선례: 기존 KO 에세이 페이지의
  "English/한국어" 토글.

---

## §8 실행 순서 요약 + 페이즈별 완료 판정 (AC) — 웨이브 1(ko)

> 각 페이즈 = 1 PR 권장. 모든 페이즈 공통 AC: `npm run build` 통과(경고 무증가), 기존 EN 페이지 스냅샷 무변화
> (이동 커밋의 diff는 순수 이동), `node scripts/i18n-audit.mjs` 정상 실행. 착수 전 §10 시퀀싱 확인.

- **Phase 0 — i18n 코어**: `lib/i18n/{locales,index,values,genres}.ts` + `dict/ko.ts` + `LocaleProvider` +
  `scripts/i18n-audit.mjs`. AC: `t("ko","없는키")`가 원문 반환, `t` 파라미터 치환 동작, live=false 로케일이 어느
  표면에도 안 나옴, audit가 빈 리포트 출력.
  **+ 코어 어휘 매트릭스(§2.2.1, ko 열)를 PR 본문에 실어 오너 승인 획득 — Phase 2의 선행 조건.**
- **Phase 1 — DB/백필**: 마이그 0105(ko) + `worker/tmdb-i18n-backfill.py --locale ko` + 전량 1회 실행.
  AC: 검증 SQL에서 title_ko·overview_ko 채움율 보고 (한국 미개봉 고전은 ko 표기 부재가 정상 — 폴백 대상),
  `--dry`·`--films`·`--locale` 동작.
- **Phase 2 — 필름 메인 /ko**: `_shared.tsx` 추출 → ko 셸 → 결정론 리드 템플릿 `t()` 경유(§4.1 판별 기준 준수) →
  `localeAlternates` 조건부 주입(§6.1) → `films-ko.xml`(§6.2 필터+§6.5 선별) + 코호트 상수.
  AC: 대표 4편 — ①티어1 유명작(영어 프로즈 섹션이 `lang="en"`+"영어 원문" 라벨로 렌더, **Fantasia 섹션·탭 부재**,
  게이트 판정 확인) ②Tier-2 카탈로그형(다이제스트 전면 한국어) ③overview_ko 없는 작품(noindex + EN 쪽 ko alternate 미방출)
  ④한국영화 1편 — 에서 제목/줄거리/리드의 한국어 또는 영어 폴백 확인, EN 쌍둥이 robots와 기저 게이트 판정 일치,
  `curl -s "$KO_URL?v=$(date +%s)" | grep hreflang` 3링크, EN 쪽은 적격 쌍에만 ko alternate.
- **Phase 3 — 아틀라스/촬영지**: `cities/ko.json`(511) → 아틀라스·locations ko 셸 → film_locations 번역 CSV+로더(증분 가능)
  → 관련 ko 샤드. AC: 도시 페이지 한국어 지명 렌더, name_ko 없는 행 영어 폴백, 로더 재실행 멱등.
- **Phase 4 — 감독/카탈로그/홈/배너/스위처**: §10의 E1·E6 선행 확인 후. AC: ko 네비 전체 한국어, 배너 조건·영구 닫기
  동작, 스위처가 이원 URL 두 체계(§7) 모두 정확, 로컬라이즈 안 된 페이지에서 스위처 숨김.
- **Phase 5 — 마감**: sitemap 인덱스 등록 확인, IndexNow 핑, **네이버 서치어드바이저에 ko 사이트맵 제출**
  (등록 자체는 AI 배포표면 작업에서 완료된 것으로 기록됨 — 미등록이면 오너에게 등록 요청; 한국어 서비스에서
  네이버는 구글보다 큰 레버일 수 있다), GSC에 /ko 경로 성능 관찰 시작(§6.5-3 지표 포함), audit 리포트를 Outputs에
  남기고 이 문서 상단에 "SHIPPED" 개정 이력 추가.
- **(웨이브 2+ — ja/fr/es)**: 오너 지시 후 §-2.2 체크리스트로 진행. 언어별 신규 설계 문서 작성 금지 — 이 문서가
  전 언어의 정본이며, 언어별로 남길 것은 어휘 매트릭스 열·문체 결정·검색엔진 제출 기록뿐.

**예상 비용**: API/번역 현금 0원 (TMDB 무료, 번역은 에이전트 세션 내 직접). 작업량 = Phase 0~2가 코어(세션 2~3개),
3~5는 증분, 이후 언어당 세션 1~2개(구조 작업이 없으므로).

---

## §9 리스크 및 미결(오너 결정 필요)

| 항목 | 기본값(이 문서) | 오너가 바꿀 수 있는 것 |
|---|---|---|
| 웨이브 2+ 언어·순서 | ja → fr → es 예약(레지스트리 live=false) | 순서·시점·지역 변형(es-ES vs es-MX 등) — 언어별 착수 지시 필요 |
| 문체 | ko = 평서형 간결체 + 존댓말 CTA (§2.2 — 2026-07-16 검토에서 기본값 승인) | 합쇼체 전환(사전 파일만 수정). ja/fr/es 문체는 각 착수 시 결정 |
| v1 색인 게이트 | `title_<loc> AND overview_<loc>` (§6.2 — 2026-07-16 검토에서 확정) | GSC 안정 후 overview 조건 완화(언어별) |
| 홈 `/{locale}` | Phase 4에서 라이트 버전 | 필름 메인만 먼저 열고 홈은 보류 가능 |
| 사이트맵 초기 캡 | 언어당 300 (§6.5 선별 기준) | GSC 반응 따라 주간 상향 |
| 신작 백필 자동화 | 수동/크론 (`--locale <loc> --missing`) | 공장 manifest 레인 편입 (별도 지시 필요) |
| 필름 서브데스크(/watch 등) | 범위 밖 | Phase 2 반응 좋으면 동일 셸 패턴으로 확장 |
| overview_<loc> 부재 작품의 줄거리 | 영어 폴백 + noindex (§6.2) | LLM 번역으로 채우기 (품질 검수 체제 먼저; §6.5-3이 트리거) |
| TMDB ko 제목 공백 보완 | 영어 폴백 | KOBIS(영화진흥위원회 오픈API) 한국 공식 개봉명 조인 (마스터 계층 C — 별도 소형 워커). 타 언어권 소스는 착수 시 검토 |
| Embedding Fantasia 언어판 | 비-EN 비표시 (§1.1 결정 ① — 오너 확정 2026-07-16) | 마스터 계층 B "13패턴+슬롯 재생성"(LLM 0 유지)으로 언어판 표시 재개 — 문장층 브랜드 계약 때문에 반드시 오너 결정 |
| 롱폼(takes·figures·리셉션) | 영어 원문 병행 — `lang="en"`+"영어 원문" 라벨 (§1.1 결정 ② — 오너 확정 2026-07-16) | 마스터 §6 content_i18n 루프 착수 (~$220/언어, 오너 예산 결정) |

---

## §10 철학자패널 리뷰 반영과의 시퀀싱 (실행 전 필독)

`HANDOFF-철학자패널-리뷰반영.md`(2026-07-16, 구현 대기)가 **영어 원문 리터럴을 다수 변경**한다. P4(사전 키 = 영어 원문)
구조상 순서가 뒤집혀도 언어판은 영어 폴백으로 동작하고 audit가 잡아주지만(설계된 안전망), 번역했다가 키가 바뀌면 그 번역이
낭비된다. **원칙: 영어 카피가 확정된 표면만 사전에 올린다.** 구체 교차점:

| 패널 항목 | 변경 표면 | 본 문서와의 규칙 |
|---|---|---|
| E3 (Bankruptcy→Hollowness) · E4 (범례 문두) · E17 (TS 툴팁) | `components/CinecodexPanel.tsx` — 필름 메인의 TakeScore 패널 | **Phase 2에서 이 컴포넌트의 사전 키를 등록하기 전에 E3/E4/E17이 먼저 반영**되어야 한다. 미반영 상태로 Phase 2에 도달하면: 이 컴포넌트의 로컬라이즈만 보류하고 진행(부분 폴백 허용). E17의 title 툴팁도 로컬라이즈 시 `t()` 경유 |
| E14 (Cost 밴드어 교체) | `lib/takescore_prose.ts` — 필름 페이지 조립 프로즈 | 동일 규칙. E14는 오너 거부권이 걸린 항목 — **E14의 채택/드롭이 확정되기 전에는 cost 밴드어 5개를 사전에 올리지 말 것** |
| E1 (홈 메서드 바) · E2 (About) | `components/HomeClient.tsx`, `app/about/page.tsx` | Phase 4 홈 라이트 버전은 **E1 반영 후의 카피**를 기준으로 사전 등록. About은 본 문서 범위 밖(제외 계약) — 무관 |
| E6 (EN ▾ placeholder 제거) | `components/home2/Nav.tsx:337` | §7 스위처가 E6의 "재도입" — E6 실행 여부를 먼저 `rg "EN ▾" components`로 확인하고 §7 규칙대로 처리 |
| E5 ({" "} 추출 위생) | `app/lineage/page.tsx` 등 | 규칙 자체를 §0 금지사항으로 상속했다 — 로케일 셸 신규 마크업 전부에 적용 |
| E13 (영화 카운트 단일 소스) | `lib/scoredCount.ts` 신설 예정 | 로케일 표면이 카운트를 렌더하면 같은 소스에서 import (숫자는 로케일 무관 데이터) |

패널 작업(P0 일괄)이 아직 미착수 상태에서 이 문서를 실행하게 되면: **Phase 0·1은 교차점이 없으므로 즉시 진행 가능.**
Phase 2 착수 시점에 위 표의 E3/E4/E14 상태를 확인하고, 미반영이면 CinecodexPanel·takescore_prose 로컬라이즈만
뒤로 미룬다(나머지 필름 메인 로컬라이즈는 진행).

공통 가드레일 상속(패널 문서 §1과 동일): 자동배포 워처는 `app/ components/ lib/`을 임의 시점에 스테이징·푸시할 수
있다 — 커밋 단위를 지키려면 작업 전 `.autodeploy-off` 확인, 루트 파일(*.md, 마이그, worker/, scripts/)은 수동 커밋.
로컬 node는 `~/.local/node/bin`(PATH 밖), `tsc --noEmit`으로 타입 확인, 실동작은 Vercel 프리뷰로 검증.

---

## §11 개정 이력

- **v4 (2026-07-16)** — 오너 지시로 **다국어 관리 체계로 일반화** (ja/fr/es 확장 예정, 한국어 = 웨이브 1):
  ① §-2 신설 — 로케일 레지스트리 `lib/i18n/locales.ts`(live 플래그·TMDB/Intl/OG 코드) + 새 언어 추가 7단계
  체크리스트 + "카테고리별 다국어 네이밍" = 코어 어휘 매트릭스(§2.2.1을 다열 표로 개정)
  ② 원시 자재 로케일-제네릭 리네임: koVal→`locVal`, koPath→`locPath`, koTwin→`locTwin(locale,·)`,
  ko.ts→`dict/ko.ts`, genres.ko.ts→`genres.ts`(언어별 맵), cities.ko.json→`cities/ko.json`,
  biAlternates→`localeAlternates`(다국어 languages 맵), KoSuggestBanner→`LocaleSuggestBanner`,
  워커 `tmdb-ko-backfill.py`→`tmdb-i18n-backfill.py --locale`, 로더 `--locale` 플래그
  ③ "ko 하드코딩 금지" 하드 룰 추가, `app/[locale]` 동적 세그먼트 기각 사유 명기(§4.1 설계 노트)
  ④ audit에 언어 간 키 패리티 검사 추가 ⑤ §9에 웨이브 2+ 언어·순서 미결 추가. 웨이브 1(ko)의 실행 내용은 v3와 동일.
- **v3 (2026-07-16)** — 오너 확정 2건 반영: ① Embedding Fantasia 모듈은 비-EN에서 렌더하지 않음(§1.1 결정 ① —
  섹션·탭 생성 조건에 locale 게이트, §0 예외 ②로 등재) ② takes·figures·리셉션 인용은 영어 원문 병행 +
  `lang="en"` 속성 + "영어 원문" 마이크로 라벨(§1.1 결정 ② — 브라우저 번역 지원; 크롬 번역 토글 버튼은 브라우저
  API 부재로 불가함을 명기). §6.5·§8 Phase 2 AC·§9 동기화.
- **v2 (2026-07-16)** — 오너 검토 승인 반영: ① §-1 정본 관계 선언(마스터 문서와 역할 분담·웨이브⓪ 어휘 승인 게이트
  상속 §2.2.1) ② §1.1 Embedding Fantasia·DB 원문 프로즈는 t() 불가 예외 명시(§4.1 판별 기준 추가)
  ③ §6.1 hreflang 조건부 방출(EN은 적격 쌍에만) ④ §6.2 v1 게이트 강화 `title+overview`
  ⑤ §6.5 혼합 언어·캐노니컬 접힘 리스크 + 코호트 선별 기준 + GSC 관측 지표 ⑥ §6.4 metadata·JSON-LD·og:locale
  로컬라이즈 명시 ⑦ §2.6 캐시 규율 ⑧ §7 이원 URL 매핑 규칙 ⑨ Phase 5 네이버 서치어드바이저 추가
  ⑩ §10 철학자패널 리뷰(E1/E3/E4/E5/E6/E13/E14/E17)와의 시퀀싱 ⑪ §9 미결 갱신.
- **v1 (2026-07-16)** — 최초 작성.
