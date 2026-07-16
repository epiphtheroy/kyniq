# HANDOFF — KO 프로젝션 (한국어 사이트 /ko) 구축 지시서

> **한 줄**: 영어 사이트를 단일 정본(SSOT)으로 유지한 채, Tier-2 수준 표면(필름 메인·아틀라스·촬영지·감독·카탈로그)을
> `/ko` 프리픽스 아래에 **프로젝션(투영)** 한다. 번역비가 드는 롱폼 콘텐츠(poetics·figures·takes·misreadings 본문)는
> 범위에서 제외. TMDB·지명은 다국어 값 불러오기 + 소량 사전 번역으로 해결. 목표: 현금 비용 ~0원, 영어만 관리해도
> 디자인·DB 구조 변경이 한국어 사이트에 자동 반영.
>
> **작성 2026-07-16.** 브랜치: `claude/korean-site-localization-27lciv`. 이 문서는 에이전트가 그대로 실행할 수 있는
> 수준의 지시서다. 실측 근거: `lib/tmdb.ts`(language 파라미터 미사용, films 테이블 캐시), `app/film/[slug]/[desk]/ko/page.tsx`
> (기존 KO 에세이 표면), `lib/seo.ts filmIndexBar`(색인 게이트 SSOT), `components/room/strings.ts`(사전 패턴 선례),
> `app/sitemaps/essays-ko.xml`(KO 사이트맵 선례), `lib/atlas_cities.json`(도시 511개), `supabase/migrations/0104_*`(최신 마이그).

---

## §0 대원칙 — "영어 단일 정본, 한국어는 투영"

오너 요구사항의 핵심: **영어 글·디자인·DB 구조만 관리한다. 한국어 사이트는 별도 관리 대상이 아니다.**
이를 보장하는 5개 불변식(invariant). 모든 작업은 이 불변식을 깨지 않는 방향으로만 진행한다.

| # | 불변식 | 구현 수단 | 깨지면 생기는 일 |
|---|---|---|---|
| P1 | **포크 금지** — ko 라우트 파일은 얇은 셸(≤20줄). 본문 렌더 코드는 EN과 공유 | 페이지 본문을 `_shared.tsx`로 추출, EN/KO page.tsx는 래퍼 | 디자인 변경이 ko에 반영 안 됨 (이중 관리 시작) |
| P2 | **폴백 필수** — 모든 한국어 값(UI 사전, DB `_ko` 컬럼)은 부재 시 영어로 폴백 | `t()` 헬퍼 + `koVal()` 액세서 (§2) | 영어만 갱신했을 때 ko 페이지가 깨지거나 빈 값 노출 |
| P3 | **가산적 DB만** — 기존 테이블·컬럼 절대 변경 금지. nullable `_ko` 컬럼 추가만 허용 | 마이그레이션 규칙 (§3) | 기존 EN 쿼리·공장·워커가 깨짐 |
| P4 | **사전 키 = 영어 원문** — UI 사전의 키는 영어 문자열 그 자체 | `KO["Watch now"] = "지금 보기"` (§4) | 영어 카피 변경 시 ko가 낡은 번역을 계속 보여줌. 키=원문이면 자동으로 영어 폴백 + 감사 스크립트에 잡힘 |
| P5 | **색인 게이트 상속** — ko 페이지의 robots/사이트맵 판정은 영어 쌍둥이와 동일한 게이트를 그대로 import | `filmIndexBar` 재사용, ko 코호트 캡 별도 (§6) | thin 페이지 대량 색인 → 사이트 전체 품질 신호 훼손 |

**왜 이 구조면 "영어만 관리"가 성립하는가**: 디자인 변경 → 공유 컴포넌트 수정 → ko도 같은 컴포넌트라 즉시 반영(P1).
DB 구조 변경 → ko는 테이블을 포크하지 않고 `_ko` 컬럼+폴백만 얹으므로 새 컬럼·테이블은 그대로 통과(P2·P3).
영어 카피 변경 → 사전 키 미스매치 → 자동 영어 폴백, `i18n-audit` 리포트에 미번역으로 표시(P4).
새 페이지 타입·새 콘텐츠 → ko 셸을 만들기 전까지는 ko에 존재하지 않을 뿐, 아무것도 깨지지 않음.

**금지사항 (하드 룰)**
- IP 기반 강제 리다이렉트 금지 (Googlebot은 미국 IP — EN 페이지를 못 보게 됨). 제안 배너만 (§7).
- 영화 제목을 직접 번역하지 말 것 — **TMDB ko-KR 공식 표기만** 사용, 없으면 영어 제목 폴백. `original_title`은 원문 유지.
- 제품 어휘는 번역 금지: NAV, TakeScore, Tier, WWI, V/C/R/U, Metatake, Engine Room, Strong Misreadings. (`components/room/strings.ts` 헤더 주석의 기존 규칙과 동일.)
- 번역 작업 중 영어 원문을 "개선"하지 말 것 — 영어 수정은 별도 커밋/별도 판단.
- EN 쌍둥이가 noindex인 ko 페이지를 색인시키지 말 것 (P5).
- ko 전용 컴포넌트 파일 생성 금지. `if (locale === "ko")` 분기로 레이아웃을 바꾸는 것도 금지 — 텍스트/값만 달라진다.
- **기존 KO 에세이 URL(`/film/[slug]/[desk]/ko`)은 절대 이동 금지** — 이미 색인·hreflang·`essays-ko.xml`이 걸려 있다.
  신규 표면은 `/ko` 프리픽스를 쓰므로 URL 체계가 이원화되는데, 이는 의도된 비일관성이다(색인 자산 보호 > 일관성).

---

## §1 범위 (Tier-2 프로젝션 대상)

**포함** (페이즈 순서대로):
1. `/ko/film/[slug]` — 필름 메인 (Tier-2 통합 본문: 수상·개봉·촬영지·문장층 리드는 결정론 조립이라 템플릿 번역으로 커버)
2. `/ko/atlas/[...]`, `/ko/film/[slug]/locations` — 아틀라스·촬영지 (도시 511 + film_locations 지명)
3. `/ko/director/[slug]` — 감독 메인
4. `/ko` 랜딩, `/ko/catalog/*`, 공유 네비/푸터 사전화, 로케일 스위처, 제안 배너
5. 사이트맵/hreflang/GSC 마감

**제외** (계약): poetics 에세이 44편, figures/takes/misreadings **본문**, docs/methodology, /room·/me·admin·crm (인증 영역),
ASK/chat (LLM 실시간 표면), blog. 롱폼은 기존 `essays.lang='ko'` 트랙이 이미 담당한다 — 건드리지 않는다.

---

## §2 i18n 코어 — `lib/i18n/` (Phase 0)

새 디렉터리 `lib/i18n/`에 4개 파일. **외부 라이브러리(next-intl 등) 도입 금지** — 199개 라우트 전체 리팩터링을 유발한다.

### 2.1 `lib/i18n/index.ts` — 타입과 t()
```ts
export type Locale = "en" | "ko";

import { KO } from "./ko";

/** UI 문자열 투영. 키 = 영어 원문(P4). ko 미번역/영어 로케일이면 원문 그대로(P2). */
export function t(locale: Locale, en: string, vars?: Record<string, string | number>): string {
  const s = locale === "ko" ? (KO[en] ?? en) : en;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export function koPath(path: string): string {
  return path === "/" ? "/ko" : `/ko${path}`;
}
export function enPath(koPathname: string): string {
  return koPathname === "/ko" ? "/" : koPathname.replace(/^\/ko/, "");
}
```

### 2.2 `lib/i18n/ko.ts` — UI 사전 (영어 원문 → 한국어)
```ts
/** KO UI 사전. 키는 코드에 등장하는 영어 원문과 바이트 단위로 동일해야 한다.
 *  파라미터는 {n}, {title} 형태. 이 파일만이 한국어 UI 문자열의 유일한 서식지다. */
export const KO: Record<string, string> = {
  "Watch now": "지금 보기",
  "Where to watch": "볼 수 있는 곳",
  "Filming locations": "촬영지",
  "Awards & honors": "수상 이력",
  "Release history": "개봉 연혁",
  "Directed by {name}": "{name} 감독",
  "{n} min read": "{n}분 분량",
  // …페이지 로컬라이즈 진행에 따라 증분 추가
};
```
채우는 방식: **페이지 타입을 로컬라이즈하는 페이즈에서, 그 페이지가 렌더하는 컴포넌트의 리터럴만** `t()`로 치환하며
그때그때 이 사전에 추가한다. 235개 컴포넌트 전수 추출을 선행하지 말 것 — 범위 밖 컴포넌트는 건드리지 않는다.
번역은 에이전트(Claude)가 세션 내에서 직접 수행한다(별도 API 비용 없음). 어투: 평서형 간결체, 존댓말 CTA("보기", "더 보기"),
`room/strings.ts`의 terse+honest 톤 유지.

### 2.3 `lib/i18n/values.ts` — DB 값 폴백 액세서
```ts
import type { Locale } from "./index";

/** DB 행의 한국어 값 투영. row에 `${field}_ko`가 있으면 쓰고 없거나 null이면 영어 폴백(P2·P3).
 *  새 컬럼이 EN 쪽에 추가돼도 이 함수는 영향받지 않는다 — 구조 변경 자동 통과의 핵심. */
export function koVal<T extends Record<string, unknown>>(
  row: T, field: keyof T & string, locale: Locale
): string | null {
  if (locale === "ko") {
    const v = row[`${field}_ko` as keyof T];
    if (typeof v === "string" && v.trim()) return v;
  }
  const en = row[field];
  return typeof en === "string" ? en : null;
}
```
사용 예: `koVal(film, "title", locale)`, `koVal(film, "overview", locale)`, `koVal(loc, "name", locale)`.

### 2.4 `lib/i18n/genres.ko.ts` — TMDB 장르 정적 맵
TMDB 장르는 고정 19종이므로 DB 컬럼 대신 코드 맵: `{"Drama":"드라마","Thriller":"스릴러", …}` (TMDB
`/genre/movie/list?language=ko` 공식 표기 기준으로 작성). `genreKo(name, locale)` 헬퍼 export.

### 2.5 클라이언트 컴포넌트용 로케일 전달
서버 컴포넌트는 `locale` prop을 명시적으로 내려보낸다 (컨텍스트보다 추적 용이).
클라이언트 컴포넌트가 필요한 경우에만 `components/i18n/LocaleProvider.tsx` (React context + `useLocale()` 훅)를 만들고
ko 셸에서 `<LocaleProvider locale="ko">`로 감싼다. **기본값은 "en"** — Provider가 없는 기존 트리 전체는 무변경으로 동작.

---

## §3 DB — 가산적 마이그레이션 + TMDB ko-KR 백필 (Phase 1)

### 3.1 마이그레이션 `supabase/migrations/0105_ko_projection.sql`
```sql
-- KO 프로젝션: 가산적 nullable 컬럼만. 기존 스키마/RLS/뷰 무변경 (P3).
alter table films add column if not exists title_ko text;
alter table films add column if not exists overview_ko text;
alter table films add column if not exists ko_fetched_at timestamptz; -- 백필 워커 증분 커서
alter table film_locations add column if not exists name_ko text;
comment on column films.title_ko is 'TMDB ko-KR 공식 표기. 직접 번역 금지. null이면 title로 폴백.';
```
`NOT NULL`·default·인덱스·트리거 추가 금지. 기존 `select("*")` 호출들이 새 컬럼을 자동으로 받으므로 타입 정의
(`lib/tmdb.ts FilmRow` 등)에 `title_ko: string | null; overview_ko: string | null;` 필드를 추가한다.

### 3.2 백필 워커 `worker/tmdb-ko-backfill.py`
기존 worker 컨벤션(`worker/tmdb-fetch.py`, `--films` 패턴은 `worker/asset-gen.py` 상단 `FILMS_ARG` 참조)을 따른다.

- **입력 코호트**: 기본 = `films where tmdb_id is not null and (ko_fetched_at is null or ko_fetched_at < now() - interval '90 days')`.
  `--films slug1,slug2`(스코프 지정), `--missing`(title_ko null만), `--limit N`, `--dry` 지원.
- **동작**: 편당 `GET /movie/{tmdb_id}?language=ko-KR` 1콜 →
  `title_ko = resp.title if resp.title != films.title else null` (ko 표기가 영어 원제와 동일하면 저장 안 함 — 폴백에 맡김),
  `overview_ko = resp.overview or null` (TMDB ko 줄거리 없는 작품이 흔함 — null이면 영어 폴백),
  `ko_fetched_at = now()`.
- **레이트리밋**: TMDB ~40 req/s. 안전하게 20 req/s 스로틀. 5,000편 ≈ 5분. 비용 0원.
- **인증**: `TMDB_READ_TOKEN` env (lib/tmdb.ts와 동일한 v3/v4 분기).
- **증분 운영**: 신작이 공장 인테이크로 들어오면 이 워커를 `--missing`으로 돌리면 된다. 공장 스테이지로 편입하지
  말 것(신축 금지 원칙) — 초기엔 수동/크론 실행, 오너가 원하면 나중에 manifest 레인 추가를 별도 결정.
- **검증 SQL**: `select count(*) filter (where title_ko is not null), count(*) filter (where overview_ko is not null), count(*) from films where tmdb_id is not null;`

### 3.3 지명 데이터
- **도시 511개**: `lib/atlas_cities.json`을 수정하지 말 것(공장·맵 스크립트가 소비). 대신 병렬 파일
  `lib/i18n/cities.ko.json` 생성: `{ "los-angeles": {"name":"로스앤젤레스","country":"미국"}, … }` (키 = 기존 slug).
  에이전트가 세션 내 직접 작성 — 국립국어원 외래어 표기법 + 통용 표기 우선(뉴욕, 도쿄, 파리 등). 헬퍼
  `cityKo(slug, locale)` → 없으면 영어 name 폴백.
- **film_locations.name_ko (~2,500행)**: 에이전트가 배치 번역해 `data/i18n/film-locations-ko.csv`
  (`id,name_ko` 2컬럼)로 저장 → `scripts/load-locations-ko.mjs`가 Supabase service key로 500행 단위 upsert.
  번역 규칙: 주소급 문자열("Hanam, Gyeonggi Province" → "경기도 하남시")은 한국 행정구역 표기로, 해외 지명은 외래어
  표기법으로, 확신 없는 고유명사(소규모 상호 등)는 **원문 유지**(오역보다 원문이 낫다). 여러 세션에 나눠 진행 가능 —
  CSV는 증분 append, 로더는 upsert라 재실행 안전.

---

## §4 라우트 프로젝션 — 셸 패턴 (Phase 2~4)

### 4.1 본문 추출 + 이중 셸 (페이지 타입당 1회 리팩터링)
대상 페이지(예: `app/film/[slug]/page.tsx`)의 본문 전체를 같은 디렉터리의 `_shared.tsx`로 옮긴다
(Next는 `_` 프리픽스 파일을 라우트로 취급하지 않음):

```tsx
// app/film/[slug]/_shared.tsx  — 기존 page.tsx 내용 전체가 이사. locale 파라미터만 추가.
import type { Locale } from "@/lib/i18n";
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
// app/ko/film/[slug]/page.tsx — KO 셸 (동일 형태, locale만 "ko")
import { FilmPage, filmMetadata } from "@/app/film/[slug]/_shared";
export const revalidate = 3600;
export async function generateMetadata({ params }: Props) { return filmMetadata((await params).slug, "ko"); }
export default async function Page({ params }: Props) { return FilmPage({ slug: (await params).slug, locale: "ko" }); }
```

리팩터링 규칙:
- `_shared.tsx`로 옮길 때 **로직·마크업을 1바이트도 바꾸지 않는다**. 이동 커밋과 로컬라이즈 커밋을 분리한다
  (리뷰에서 diff가 "이동"임이 보이도록).
- 이동 후 로컬라이즈 커밋에서: 사용자 노출 리터럴 → `t(locale, "…")`, DB 텍스트 값 → `koVal(row, "field", locale)`,
  장르 → `genreKo()`, 지명 → `cityKo()`/`koVal(loc,"name",locale)`, 날짜 포맷 →
  `new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", …)`.
- 페이지가 렌더하는 공유 컴포넌트(SiteNav, 푸터, 섹션 컴포넌트)에 리터럴이 있으면 그 컴포넌트에 `locale?: Locale = "en"`
  prop을 추가하고 `t()`로 치환 — **기본값 "en"이므로 이 컴포넌트를 쓰는 다른 195개 라우트는 무변경**.
- 결정론 문장층 리드(필름 페이지 #5/#6/#8/#9/#11/#13 섹션, `HANDOFF-필름페이지-보강-작업지시서.md` 참조)의 조립
  템플릿 문장도 전부 `t()` 경유 — 템플릿 하나 번역이 수천 페이지를 커버한다. 조립 로직(부분집합·문장형 선택)은 공유.
- `generateStaticParams`는 ko 셸에서 `return []` (기존 KO 에세이 페이지와 동일 — 온디맨드 ISR).

### 4.2 페이즈별 대상 라우트
| Phase | EN 원본 | KO 셸 | 비고 |
|---|---|---|---|
| 2 | `app/film/[slug]/page.tsx` | `app/ko/film/[slug]/page.tsx` | 최우선. Tier-2 통합 본문 포함 |
| 3 | `app/atlas/**`, `app/film/[slug]/locations/page.tsx` | `app/ko/atlas/**`, `app/ko/film/[slug]/locations/` | cities.ko.json 선행 |
| 4 | `app/director/[slug]/page.tsx`, `app/catalog/**`, `app/page.tsx`(홈) | `app/ko/director/…`, `app/ko/catalog/…`, `app/ko/page.tsx` | 홈은 라이트 버전 가능(오너 판단) |

필름 서브데스크(reception/watch/honors/credits/gallery 등)는 v1 범위 밖 — 필름 메인의 섹션 리드로 충분. 반응 보고 확장.

### 4.3 `app/ko/layout.tsx`
`<html lang>`은 루트 레이아웃 소관이라 ko 서브트리에서 못 바꾼다. `app/ko/layout.tsx`는
`<LocaleProvider locale="ko">` 래핑 + (가능하면) 메타데이터 기본값만 담당. lang 속성은 §6.4의 방식으로 처리.

---

## §5 자동 전파 로직 — 감사 스크립트 (Phase 0에서 골격, 이후 증분)

`scripts/i18n-audit.mjs` — "영어만 관리" 체제의 관측 도구. 실패시키는 CI 게이트가 아니라 **리포트**다.

1. **사전 커버리지**: `lib/i18n/` 하위와 로컬라이즈된 `_shared.tsx`/컴포넌트에서 `t(locale, "…")` 첫 문자열 인자를
   정규식 추출 → `KO` 맵에 없는 키 목록 출력 = "현재 영어로 폴백 중인 문자열". 영어 카피를 바꾸면 여기 자동 표시.
2. **DB 커버리지**: Supabase anon으로 `films`(visible 또는 filmIndexBar 통과 코호트) 중 `title_ko is null` 카운트,
   `film_locations` 중 `name_ko is null` 카운트 출력 = 백필 큐.
3. **셸 두께 검사**: `app/ko/**/page.tsx` 각 파일 줄 수 > 25면 경고 (P1 위반 조짐 — 본문이 셸로 새기 시작한 것).
4. 출력은 stdout 요약 + `Outputs/i18n-audit-YYYYMMDD.md` (기존 Outputs 컨벤션 따름).

운영 리듬: 배포 전 1회 실행. 신작 유입 후 `worker/tmdb-ko-backfill.py --missing` 실행. 이 두 개가 한국어 사이트
유지관리의 전부여야 한다 — 그 이상이 필요해지면 P1~P4 위반을 의심할 것.

---

## §6 SEO 배선 (각 페이즈에 포함)

### 6.1 hreflang — `lib/i18n/seo.ts`
```ts
import { koPath } from "./index";
/** 로컬라이즈된 페이지 타입의 EN/KO 셸 양쪽 metadata에 동일하게 주입 */
export function biAlternates(enAbsPath: string, locale: Locale): Metadata["alternates"] {
  return {
    canonical: locale === "ko" ? koPath(enAbsPath) : enAbsPath,
    languages: { en: enAbsPath, ko: koPath(enAbsPath), "x-default": enAbsPath },
  };
}
```
기존 선례: `app/film/[slug]/[desk]/page.tsx:191`이 정확히 이 형태를 이미 쓴다. canonical은 **자기 자신** —
ko 페이지의 canonical을 EN으로 걸면 ko 색인이 원천 차단되므로 절대 금지.

### 6.2 robots — 게이트 상속 (P5)
ko 셸의 metadata는 EN과 **같은 신호 로더, 같은 게이트 함수**를 호출한다. 필름 메인이면
`film_index_signals_json()` RPC → `filmIndexBar(s)` → `pageRobots(passed)` 그대로. ko 전용 게이트 신설 금지.
추가 조건 하나만 얹는다: **`title_ko is null`이면 ko 페이지는 noindex** (영어 제목만 있는 반쪽 페이지 색인 방지;
페이지 자체는 렌더됨 — 폴백 표시 + noindex).

### 6.3 사이트맵
- 새 샤드: `app/sitemaps/films-ko.xml/route.ts` (Phase 2), `cities-ko.xml`·`locations-ko.xml` (Phase 3),
  `directors-ko.xml` (Phase 4). 구현은 대응 EN 샤드의 엔트리 생성 함수를 재사용하되 URL에 `koPath()` 적용 +
  `title_ko is not null` 필터 추가. `essays-ko.xml`(기존)이 참조 구현.
- 코호트 캡: `lib/seo.ts`에 `INDEX_COHORT_FILMS_KO = 300` 등 별도 상수 추가 (기존 `INDEX_COHORT_ESSAYS_KO = 300`
  선례와 동일 — 주간 GSC 증거 기반으로만 상향, 코멘트에 근거 기록).
- `app/sitemap.xml/route.ts` 인덱스에 새 샤드 등록. 배포 후 `npm run indexnow` (기존 스크립트) 핑.

### 6.4 lang 속성
루트 `app/layout.tsx`의 `<html lang="en">`을 서브트리에서 바꿀 수 없으므로, `app/ko/layout.tsx`에 최소 클라이언트
컴포넌트 `<SetHtmlLang lang="ko" />` (useEffect로 `document.documentElement.lang = "ko"`) 추가. 크롤러는 hreflang을
우선하므로 SSR HTML의 lang 불일치는 치명적이지 않다 — 이 정도로 충분, 루트 레이아웃 개조 금지.

---

## §7 언어 제안 배너 + 로케일 스위처 (Phase 4)

- **배너 `components/i18n/KoSuggestBanner.tsx`** (클라이언트, 미들웨어 무변경):
  조건 = `navigator.language.startsWith("ko")` && 현재 경로가 `/ko` 밖 && 현재 페이지 타입이 로컬라이즈됨 &&
  `localStorage.mt_locale_dismissed !== "1"`. 표시 = 상단 슬림 바 "한국어로 보기 → {koPath(pathname)}" + 닫기(영구 기억).
  `middleware.ts`는 건드리지 않는다(봇 인포스먼트 로직과의 간섭 리스크 > 이득). IP 리다이렉트 금지 재확인.
- **스위처**: SiteNav에 EN↔KO 링크 (현재 경로의 쌍둥이 URL로). 로컬라이즈 안 된 페이지 타입에서는 숨김.
  선례: 기존 KO 에세이 페이지의 "English/한국어" 토글.

---

## §8 실행 순서 요약 + 페이즈별 완료 판정 (AC)

> 각 페이즈 = 1 PR 권장. 모든 페이즈 공통 AC: `npm run build` 통과(경고 무증가), 기존 EN 페이지 스냅샷 무변화
> (이동 커밋의 diff는 순수 이동), `node scripts/i18n-audit.mjs` 정상 실행.

- **Phase 0 — i18n 코어**: `lib/i18n/{index,ko,values,genres.ko}.ts` + `LocaleProvider` + `scripts/i18n-audit.mjs`.
  AC: `t("ko","없는키")`가 원문 반환, `t` 파라미터 치환 동작, audit가 빈 리포트 출력.
- **Phase 1 — DB/백필**: 마이그 0105 + `worker/tmdb-ko-backfill.py` + 전량 1회 실행.
  AC: 검증 SQL에서 title_ko 채움율 보고 (한국 미개봉 고전은 ko 표기 부재가 정상 — 폴백 대상), `--dry`·`--films` 동작.
- **Phase 2 — 필름 메인 /ko**: `_shared.tsx` 추출 → ko 셸 → 섹션 리드 템플릿 `t()` 경유 → `biAlternates` EN/KO 주입 →
  `films-ko.xml` + 코호트 상수. AC: 대표 3편(티어1 유명작·티어2 색인작·title_ko 없는 작품)에서 ko 페이지가
  한국어 제목/줄거리/리드 또는 영어 폴백을 렌더, EN 쌍둥이 robots와 게이트 판정 일치 + title_ko null → noindex,
  `curl -s $KO_URL | grep hreflang` 3링크 확인.
- **Phase 3 — 아틀라스/촬영지**: `cities.ko.json`(511) → 아틀라스·locations ko 셸 → film_locations 번역 CSV+로더(증분 가능)
  → 관련 ko 샤드. AC: 도시 페이지 한국어 지명 렌더, name_ko 없는 행 영어 폴백, 로더 재실행 멱등.
- **Phase 4 — 감독/카탈로그/홈/배너/스위처**. AC: ko 네비 전체 한국어, 배너 조건·영구 닫기 동작, 스위처 쌍둥이 URL 정확.
- **Phase 5 — 마감**: sitemap 인덱스 등록 확인, IndexNow 핑, GSC에 /ko 경로 성능 관찰 시작, audit 리포트를 Outputs에 남기고
  이 문서 상단에 "SHIPPED" 개정 이력 추가.

**예상 비용**: API/번역 현금 0원 (TMDB 무료, 번역은 에이전트 세션 내 직접). 작업량 = Phase 0~2가 코어(세션 2~3개),
3~5는 증분.

---

## §9 리스크 및 미결(오너 결정 필요)

| 항목 | 기본값(이 문서) | 오너가 바꿀 수 있는 것 |
|---|---|---|
| 홈 `/ko` | Phase 4에서 라이트 버전 | 필름 메인만 먼저 열고 홈은 보류 가능 |
| ko 사이트맵 초기 캡 | 300 | GSC 반응 따라 주간 상향 |
| 신작 ko 백필 자동화 | 수동/크론 (`--missing`) | 공장 manifest 레인 편입 (별도 지시 필요) |
| 필름 서브데스크(/watch 등) ko | 범위 밖 | Phase 2 반응 좋으면 동일 셸 패턴으로 확장 |
| overview_ko 부재 작품의 줄거리 | 영어 폴백 노출 | LLM 번역으로 채우기 (품질 검수 체제 먼저) |
