# HANDOFF — Updates 피드 (/updates): 메타테이크 새소식 스레드

**상태: ✅ SHIPPED + 라이브검증 (2026-07-15)** — 아래 §1~§9는 구현 정본이며 실제 배포와 일치한다.
**이 문서가 정본.** 그대로 따라 하면 완성되도록 썼다. 판단이 필요한 지점은 ★로 표시했고, 나머지는 결정이 끝난 사양이다.

> **AS-BUILT 개정(오너 요청 "디자인 가미 + 30개씩 번호 페이지네이션")**: §2의 순수-정적 텍스트 스레드 위에 디자인·페이지네이션 레이어를 얹었다.
> - **디자인**: `app/updates/updates.css`(upd- 프리픽스, 신문 시스템·단일 레드 유지) — 왼쪽 **타임라인 스파인**+포스트별 링 노드(월 경계=레드 사각 노드, hover=레드 채움), 해어라인 **카테고리 태그**, 마스트헤드에 "THE RECORD" 키커+레드 틱+"N ENTRIES · SEOUL · RSS" 메트릭스.
> - **페이지네이션+필터**: 클라이언트 컴포넌트 `components/UpdatesThread.tsx` — **30개/페이지 번호 페이저**(‹ 1 2 › + "PAGE n OF m") + 카테고리 **필터바**(All+존재 카테고리). **단일 URL 클라이언트 방식**(경로 분할 `/updates/page/2` 아님)을 택한 이유: 새 글이 위로 쌓이면 글의 "페이지"가 밀리므로 경로 분할은 §6.6 영구 앵커(`/updates#id`)를 깬다. 클라이언트 방식은 해시 진입 시 해당 페이지를 노출·스크롤해 앵커를 영구 보존.
> - `app/updates/page.tsx`는 마스트헤드(SSR)+`<UpdatesThread posts={UPDATES} />`로 재구성. §4-2의 인라인 스레드는 이 컴포넌트로 이동(month 그룹핑·renderBody 포함).
> - **⚠️ 스크롤 함정 2건**(수정에 3커밋): ① globals.css `html{scroll-behavior:smooth}` 전역 탓에 프로그래매틱 **smooth** scrollIntoView/scrollTo가 먼 타겟에서 무음 드롭 → 반드시 `behavior:'instant' as ScrollBehavior`. ② setState(setPage) 후 스크롤은 **requestAnimationFrame이 아니라 useEffect**에서(rAF는 React 커밋 전 실행 → 타겟 미존재). 해시 타겟은 `pendingHashRef`로 DOM 등장까지 유지하고 `[safePage,cat]` 이펙트에서 스크롤.
> - 라이브검증: 페이저 하단→상단 착지(6112→242)·페이지2 딥링크 자동 노출+포스트 top=70·필터 POLICY 5건·SSR 페이지1 30개·feed/sitemap 불변.

---

## §0. 왜 만드는가 (의도 — 반드시 읽고 시작)

오너의 주문: **"이 사이트를 중심으로 뭔가 생생하게 살아있는 회사 같은 느낌"**.

metatake.net은 6주 만에 지어진 사이트다. 콘텐츠는 방대하지만, 사이트가 *지금도 자라고 있다*는 사실은 어디에도 기록돼 있지 않다. About은 정적이고, /blog(The Daily)와 /now는 **영화** 뉴스지 **회사** 뉴스가 아니다. 방문자·언론·검색엔진·AI 어시스턴트 누구도 "이 사이트는 살아있는 조직이 운영한다"는 신호를 받을 곳이 없다.

`/updates`는 그 신호다. 회사(프로젝트)의 공적 기록: 기능 추가, 데이터 공개, API/MCP, 정책 변화, 저작권 등록, 검색엔진 등재 상황, 이번 주 추가된 영화. **날짜 + 객관적 사실 + 간략한 취지 + 해당 표면으로의 링크.** 한 줄 한 줄이 "우리는 이걸 했고, 여기서 볼 수 있다"이다.

형태에 대한 오너의 명시적 결정:
- **블로그가 아니라 스레드.** 트위터/쓰레드처럼 **본문 클릭 없이** 날짜순으로 쭉 읽어 내려가는 단일 페이지. 상세 페이지(`[slug]`) 없음.
- 각 항목은 짧은 단신(1~4문장). 뉴스 가치가 있으면 한 줄짜리도 좋다.
- About("회사 소개") 밑에 붙인다 — About 하단 섹션 + 풋터 + 내비에서 진입.

부수 효과(설계에 반영됨): ① E-E-A-T — 운영 주체가 살아있음을 검색엔진에 보여주는 페이지, ② 발행 이력의 공적 타임스탬프(선행 기록 증거), ③ 아웃리치/커뮤니티에 붙일 수 있는 "여기 보세요" 링크.

---

## §1. 확정 결정 (변경 금지)

| 항목 | 결정 | 근거 |
|---|---|---|
| 경로 | **`/updates`** (라이브 확인: 현재 404 = 비어 있음) | "News"는 금지 — Now 층(news-sitemap.xml, NewsArticle, entity-news)이 이미 "news"를 점유. 용어 헌장(1명사=1실체) 위반 방지 |
| 표시명 | **Updates** (내비/풋터 링크 라벨도 "Updates") | 별도 브랜드명(예: "The Ledger") 만들지 말 것 — 코너 브랜드 과잉 |
| 언어 | **영어** (사이트 대외 언어). 한국어판은 비목표(§10) | |
| 구조 | 단일 페이지 스레드, 최신이 위, 월 구분선. 상세 페이지·페이지네이션 없음 | 오너 명시 |
| 저장 | **정적 TS 배열** `lib/updates/posts.ts`. DB 없음, 마이그레이션 없음, 어드민 UI 없음 | 주 1~수 회 발행 빈도에 DB는 과잉. lib/는 auto-deploy 워처가 스테이징하는 경로라 "파일 수정=발행" |
| 색인 | **index, follow** + sitemap core 등재 + RSS `/updates/feed.xml` | 이 페이지의 존재 이유가 공개 신호 |
| 글쓴이 표기 | JSON-LD author/publisher = **Organization Metatake** | SEO 감사 결정(Review author=Organization)과 일치 |

카테고리(7종 고정 — 칩으로 표시):

| key | 라벨 | 쓰임 |
|---|---|---|
| `feature` | Feature | 기능·표면 추가/개편 |
| `films` | Films | 영화 추가(주간 묶음 포함), 카탈로그 확장 |
| `data` | Data | 데이터셋 공개, 데이터 층 확장 |
| `api` | API · MCP | API/MCP/임베드/확장 |
| `policy` | Policy | 정책·라이선스·robots·저작권 등록·프라이버시 |
| `index` | Search index | 구글/빙 등재 상황, 사이트맵, 도메인 |
| `milestone` | Milestone | 리브랜딩·수치 이정표·기념일·이 피드 자체 |

---

## §2. 페이지 설계 (UX 사양)

**전부 기존 디자인 시스템 재사용.** 새 CSS 파일을 만들지 말 것 — `/about`·`/contact`처럼 globals.css의 전역 클래스(`shell`, `disp`, `standfirst`, `seclbl`, `tick`, `rule`, `body reading`, `ui`, `muted`, `accent`)만으로 조립한다. 신문 디자인 v3(백지+먹+단일 레드 `#E3120B`)의 결을 따르고, 트위터 흉내(카드·아바타·그림자) 금지.

```
┌──────────────────────────────────────────────┐
│ SiteNav                                      │
│ <main class="shell">  (744px 단일 칼럼)       │
│                                              │
│ h1.disp  Updates                             │
│ p.standfirst                                 │
│   What is new at Metatake — features, data,  │
│   policy, and the state of the index, dated  │
│   and in order.                              │
│ (ui muted 한 줄) RSS · 항목 수                │
│ ── hr.rule ──                                │
│                                              │
│ div.seclbl  JULY 2026        ← 월 구분선      │
│ div.tick                                     │
│                                              │
│ ── 포스트(article, id=post.id) 반복 ──        │
│  [Jul 15 · SEARCH INDEX]     ← ui muted 소문자 날짜 + seclbl풍 칩│
│  1,167 catalog films promoted into the       │
│  search index                ← disp 17px 굵게, §앵커 링크│
│  A measured-signal gate promoted …           │
│                              ← body reading 15.5~16px, 링크는 .accent│
│  ── hr.rule (헤어라인) ──                      │
│                                              │
│ … (다음 달 구분선) JUNE 2026 …                │
│                                              │
│ (피드 끝 ui muted 각주)                       │
│  Entries before July 15, 2026 were           │
│  reconstructed from the project log when     │
│  this page launched.                         │
│ Footer                                       │
└──────────────────────────────────────────────┘
```

세부 규칙:
- **포스트 = `<article id={p.id} style={{scrollMarginTop:70}}>`**. 개별 공유는 `/updates#2026-07-13-mcp-server` 형태 앵커. 제목 옆(또는 날짜 줄 끝)에 `<a href={'#'+p.id} className="muted">§</a>` 퍼머링크. (`scrollMarginTop:70`은 스티키 내비 회피 — about의 `#strong-misreadings`와 동일 관례. globals.css가 `scroll-behavior:smooth`.)
- 날짜 표기: `Jul 15` (`new Date(p.date + "T00:00:00")` 후 `{month:"short", day:"numeric"}` — /blog의 `mon` 헬퍼와 동일. `T00:00:00`을 붙여야 로컬 파싱으로 날짜 밀림이 없다). `<time dateTime={p.date} title="July 15, 2026">`.
- 칩: 카테고리 라벨을 `.seclbl` 스타일 소형(10.5px)으로 날짜 옆에. 색 입히지 말 것(레드는 브랜드 악센트 전용).
- 월 구분선: 연-월이 바뀌는 지점마다 `seclbl + tick` ("JULY 2026"). 연도가 바뀌면 연도 포함 유지(이미 포함).
- 본문 링크: 내부는 `<Link className="accent" style={{textDecoration:"none"}}>`, 외부는 `<a className="accent" target="_blank" rel="noopener">`.
- 페이지 상단 `ui muted` 한 줄: `{UPDATES.length} entries · <a href="/updates/feed.xml">RSS</a>` — 살아있음의 계기판.
- 접근성: 스레드 전체를 `<section aria-label="Updates timeline">`, 각 article에 `aria-labelledby`는 불필요(제목이 첫 텍스트).

---

## §3. 데이터 모델 — `lib/updates/posts.ts`

```ts
// lib/updates/posts.ts
// Metatake Updates — the public company-news thread at /updates.
// Append-only: prepend new posts at the TOP (newest first).
// Body grammar: plain sentences + [text](href) links ONLY (no other markdown,
// no HTML, no double quotes inside — use straight apostrophes).

export type UpdateCategory =
  | "feature" | "films" | "data" | "api" | "policy" | "index" | "milestone";

export const CATEGORY_LABEL: Record<UpdateCategory, string> = {
  feature: "Feature",
  films: "Films",
  data: "Data",
  api: "API · MCP",
  policy: "Policy",
  index: "Search index",
  milestone: "Milestone",
};

export type UpdatePost = {
  /** permanent anchor: "YYYY-MM-DD-short-slug". NEVER change after publish. */
  id: string;
  /** ship date, KST, YYYY-MM-DD */
  date: string;
  cat: UpdateCategory;
  /** short factual headline, sentence case */
  title: string;
  /** 1–4 sentences, one paragraph. [text](href) links only. */
  body: string;
};

export const UPDATES: UpdatePost[] = [ /* §5의 초기 코퍼스 전문 */ ];

export const LATEST_UPDATE_DATE: string | undefined = UPDATES[0]?.date;
```

**본문 렌더러** (page.tsx 안 또는 `lib/updates/render.tsx`): 미니 문법은 링크 하나뿐이다. ⚠️ 별도 파일로 뺄 경우 파일 상단에 `import Link from "next/link";` 필수(page.tsx 안에 넣으면 §4-2의 import가 커버).

```tsx
// [text](href) → 내부 Link / 외부 <a>. 그 외 문법 없음.
function renderBody(body: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(body))) {
    if (m.index > last) out.push(body.slice(last, m.index));
    const [, text, href] = m;
    out.push(
      href.startsWith("/")
        ? <Link key={k++} href={href} className="accent" style={{ textDecoration: "none" }}>{text}</Link>
        : <a key={k++} href={href} className="accent" style={{ textDecoration: "none" }} target="_blank" rel="noopener">{text}</a>
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}
```

제약(어기면 렌더 깨짐): 본문에 `[`/`]`를 링크 외 용도로 쓰지 말 것, 큰따옴표 대신 아포스트로피, HTML 금지.

---

## §4. 구현 단계 (파일별 — 이 순서대로)

### 4-1. `lib/updates/posts.ts` (신규)
§3 타입 + §5 코퍼스 전문. **§5를 그대로 붙여넣는다** — 사실·수치·링크가 전부 저장소 증거와 라이브 URL(2026-07-15 전수 curl, /movies-like 제외 전부 200)로 검증된 원고다. 임의로 수치를 "개선"하지 말 것.

### 4-2. `app/updates/page.tsx` (신규)
`app/about/page.tsx`를 골격으로 복사(완전 정적 — 콘텐츠가 컴파일 타임 import라 `revalidate` 불필요, 배포마다 재생성).

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { UPDATES, CATEGORY_LABEL } from "@/lib/updates/posts";
// LATEST_UPDATE_DATE는 여기서 쓰지 않는다 — lib/sitemap-data.ts(§4-4)에서만 import.

export const metadata: Metadata = {
  title: "Updates",
  description:
    "What is new at Metatake — features, data releases, API and MCP work, policy, search-index status, and films added. Dated, in order, newest first.",
  alternates: {
    canonical: "/updates",
    types: { "application/rss+xml": "/updates/feed.xml" },
  },
  robots: { index: true, follow: true },
};
```

JSON-LD (하우스 문법 — Blog + blogPost 배열, author=Organization):

```tsx
const siteUrl = "https://metatake.net";
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "Metatake Updates",
  url: `${siteUrl}/updates`,
  description: "The running record of what changes on Metatake.",
  publisher: { "@type": "Organization", name: "Metatake", url: siteUrl, "@id": `${siteUrl}/#org` },
  blogPost: UPDATES.slice(0, 30).map((p) => ({
    "@type": "BlogPosting",
    headline: p.title,
    datePublished: p.date,
    url: `${siteUrl}/updates#${p.id}`,
    articleSection: CATEGORY_LABEL[p.cat],
    author: { "@type": "Organization", name: "Metatake", url: siteUrl },
  })),
};
```

본문 조립: §2 스케치대로. 월 그룹핑은 렌더 시 `p.date.slice(0,7)`이 직전 포스트와 다르면 구분선 삽입(별도 자료구조 불필요). 피드 끝 각주(§2)와 상단 RSS 줄 포함.

### 4-3. `app/updates/feed.xml/route.ts` (신규)
`app/now/feed.xml/route.ts` 골격 복사. 정적 배열이라 DB 불필요.

```ts
import { UPDATES, CATEGORY_LABEL } from "@/lib/updates/posts";

export const revalidate = 600;

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
// [text](href) → text (플레인 텍스트), 상대링크는 절대화해 description에 그대로 못 쓰므로 링크 제거
function plain(body: string): string {
  return body.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
}

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://metatake.net";
  const items = UPDATES.slice(0, 50).map((p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${siteUrl}/updates#${p.id}</link>
      <guid isPermaLink="true">${siteUrl}/updates#${p.id}</guid>
      <pubDate>${new Date(p.date + "T09:00:00+09:00").toUTCString()}</pubDate>
      <category>${escapeXml(CATEGORY_LABEL[p.cat])}</category>
      <description>${escapeXml(plain(p.body))}</description>
    </item>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Metatake Updates</title>
    <link>${siteUrl}/updates</link>
    <atom:link href="${siteUrl}/updates/feed.xml" rel="self" type="application/rss+xml"/>
    <description>What is new at Metatake — features, data, policy, index status, films.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
```

### 4-4. 사이트맵 — `lib/sitemap-data.ts`
`coreEntries()`(98행 부근)의 entries 배열에 한 줄. **이 파일에서만 lastmod를 실제 콘텐츠 날짜와 함께 쓰는 게 하우스 룰** — 최신 포스트 날짜가 정확한 콘텐츠 이벤트다.

```ts
import { LATEST_UPDATE_DATE } from "@/lib/updates/posts";
// entries 배열 안:
{ url: `${siteUrl}/updates`, lastmod: LATEST_UPDATE_DATE },
```
sitemap.xml 인덱스는 수정 불필요(core.xml에 자동 포함). robots.ts도 수정 불필요(차단 목록에 없음 — 확인 완료).

### 4-5. 진입점 3곳
1. **Footer** (`components/Footer.tsx`) — "Metatake" 칼럼, About 바로 다음:
```tsx
<Link href="/updates" className="footer-link">
  Updates
</Link>
```
2. **내비** (`components/home2/Nav.tsx` `buildGroups()`, 48~53행) — Read 그룹, The Daily 다음:
```tsx
{ t: "Updates", h: "/updates" },
```
3. **About 하단** (`app/about/page.tsx`) — "In closing" 섹션 뒤, 통계 블록 앞에 새 섹션("회사 소개 밑에"의 구현):
```tsx
<hr className="rule" />
<div className="seclbl">The record</div>
<div className="tick" />
<p className="body reading" style={{ fontSize: 18, margin: 0 }}>
  What changes here — new features, data releases, policy, the state of the
  index — is logged with dates on <A href="/updates">Updates</A>.
</p>
```
그리고 맨 아래 fine print의 "See also" 줄에 `· <A href="/updates">Updates</A>` 추가.
(⚠️ About의 `#strong-misreadings` 앵커는 7페이지 참조 불변식 — 건드리지 말 것. 위 삽입은 앵커와 무관.)

### 4-6. 배포·검증
- 워처(auto-deploy-watch.sh)가 `app/ components/ lib/`만 스테이징 → 위 파일 전부 자동 배포 대상. 루트 파일 건드릴 일 없음.
- 배포 후: `node scripts/indexnow-ping.mjs https://metatake.net/updates` 1회.
- §8 QA 체크리스트 수행.

---

## §5. 초기 콘텐츠 — UPDATES 배열 전문 (그대로 붙여넣기)

작성 원칙(이 원고에 이미 적용됨): 수치는 **해당 날짜 시점의 문서·커밋 기록** 그대로(이후 성장해도 소급 수정 금지 — 날짜가 박힌 기록이다). 모든 내부 링크는 2026-07-15 라이브 200 확인 완료. 외부 식별자(HF 저장소·Zenodo DOI·라이선스)는 저장소·라이브 /data 페이지와 대조 완료.

**⚠️ 이 코퍼스는 오너 결정(2026-07-15, 보수적 컷)으로 50→37편 재편된 최종본이다.** 원칙: **산문 생산량은 발표하지 않는다**(§6 참조). 글 편수를 자랑하던 포스트(평가문 6,701편·미스리딩 기사 1,932편·문장층 466,974·first-commit 속도 프레임 등)는 삭제·리프레임됐고, 같은 날 6건씩 몰리던 클러스터는 병합됐다. **삭제된 포스트를 "복원"하지 말 것.**

⚠️ 첫 항목(`updates-launch`)의 `date`와 `id`의 날짜는 **실제 배포일**로 바꿔서 발행할 것.

```ts
export const UPDATES: UpdatePost[] = [
  {
    id: "2026-07-15-updates-launch",
    date: "2026-07-15",
    cat: "milestone",
    title: "This page launches: Metatake now keeps its news in public",
    body: "Updates is the running record of what changes on Metatake — features, data releases, API and MCP work, policy decisions, search-index status, films added — one dated entry at a time, newest first. Follow along by [RSS](/updates/feed.xml).",
  },
  {
    id: "2026-07-15-tier2-index-promotion",
    date: "2026-07-15",
    cat: "index",
    title: "1,167 catalog films promoted into the search index",
    body: "A measured-signal gate — enough recorded reception, honors, or canon presence — promoted 1,167 catalog-tier [film pages](/film) to indexable, and the promoted pages grew fuller mains: honors digests, complete release histories, and scholarship notes where they exist. [Director hubs](/director) gained scored filmographies and press digests, with 678 director pages now standing in the index; the sitemaps run on the identical gate, released in weekly cohorts.",
  },
  {
    id: "2026-07-15-filmcurio-retired",
    date: "2026-07-15",
    cat: "index",
    title: "Legacy domain filmcurio.com fully retired",
    body: "Every host of the site's earlier domain now permanently redirects (HTTP 308) to metatake.net, and residual filmcurio.com listings are being removed from Bing. One site, one address.",
  },
  {
    id: "2026-07-14-video-flags",
    date: "2026-07-14",
    cat: "index",
    title: "Video moved to where it belongs",
    body: "Autoplaying trailer heroes on reading pages were replaced with still-image heroes; embedded video now plays only on [Metatake TV](/tv) watch pages. This clears the cause of 3,388 'video is not on a watch page' notices in Google Search Console and made every text page lighter.",
  },
  {
    id: "2026-07-13-open-platform",
    date: "2026-07-13",
    cat: "api",
    title: "Metatake opens up: a free API, an MCP server, and embeds",
    body: "Anyone can now query Metatake programmatically — films, per-film TakeScore, and filming locations at /api/v1, no key required, with an OpenAPI schema ([API & embeds](/api)). AI assistants get the same access through an open MCP server, registered on the official MCP Registry as net.metatake/mcp ([MCP for AI](/mcp)). And a one-line script embeds a live TakeScore badge on any site ([/embed](/embed)). Every response carries a source link; the writing is CC BY-NC 4.0.",
  },
  {
    id: "2026-07-13-locations-dataset",
    date: "2026-07-13",
    cat: "data",
    title: "Open data: 17,341 geocoded filming locations",
    body: "Metatake's filming-locations corpus — 17,341 geocoded locations across 1,917 films in 130 countries, distinguishing where a film was shot from where it is set — is published on [Hugging Face](https://huggingface.co/datasets/wonwooyoon/metatake-filming-locations) and archived with a citable DOI on [Zenodo](https://doi.org/10.5281/zenodo.21336967). CC BY 4.0: reuse freely, including commercially, with attribution. Overview at [Open data](/data).",
  },
  {
    id: "2026-07-13-what-to-watch",
    date: "2026-07-13",
    cat: "feature",
    title: "What to Watch: pick your services, get an answer",
    body: "[What to Watch](/what-to-watch) starts from your country and streaming subscriptions and ranks what is available to you right now by TakeScore, with genre and year filters, five sort axes, and rent/buy badges — a nightly decision surface, not another list.",
  },
  {
    id: "2026-07-13-twenty-films",
    date: "2026-07-13",
    cat: "films",
    title: "Twenty demanding films join the close-read shelf",
    body: "Twenty canonical titles long missing from the close-read tier — films by Béla Tarr, Pedro Costa, Lav Diaz, and Wang Bing among them — arrived with full readings, misreadings, TakeScores, and connections. Browse the shelf at [Films](/film).",
  },
  {
    id: "2026-07-12-method-docs",
    date: "2026-07-12",
    cat: "policy",
    title: "The Method Docs: how Metatake is made, in public",
    body: "The [methodology page](/methodology) grew into a documentation site — dozens of documents covering how films are selected, how figures and readings are made, how TakeScore is computed, how kinship and counterpoint are measured, and where every data source comes from. If you disagree with a number, you can now find the rule that produced it.",
  },
  {
    id: "2026-07-12-poetics",
    date: "2026-07-12",
    cat: "feature",
    title: "Poetics: signed essays by the editor",
    body: "A signed essay corner by editor Wonwoo Yoon opened at [Poetics](/poetics) — essays on the craft of reading films, with every film example drawn from the editor's own viewing log.",
  },
  {
    id: "2026-07-12-copy-for-ai",
    date: "2026-07-12",
    cat: "feature",
    title: "Copy for AI, on every close-read film page",
    body: "Close-read film pages now carry Copy-for-AI buttons that render the page's criticism as a clean Markdown pack for pasting into an AI assistant — free, no login, attribution built in (CC BY-NC 4.0). More ways to take the data with you at [Open data](/data).",
  },
  {
    id: "2026-07-12-metatakebot",
    date: "2026-07-12",
    cat: "policy",
    title: "Our crawler introduces itself — and pays visits back",
    body: "All Metatake crawlers now identify as MetatakeBot/1.0 with a public policy page at [/bot](/bot). Crawlers that declare their own URL when visiting us receive one robots-respecting return visit — a small handshake for an open web.",
  },
  {
    id: "2026-07-11-metatake-tv",
    date: "2026-07-11",
    cat: "feature",
    title: "Metatake TV opens",
    body: "Films as broadcasts: compiled, chaptered TV-style programs playable from their film pages, a program guide organized by the site's own axes — directors, tropes, countries, decades — and an endless On Air channel. Tune in at [Metatake TV](/tv).",
  },
  {
    id: "2026-07-11-screener",
    date: "2026-07-11",
    cat: "feature",
    title: "The Screener: TakeScore becomes an instrument",
    body: "The [TakeScore hub](/takescore) was rebuilt around instant search over all 6,701 scored films — a score-distribution brush, genre and year filters, watch-country and subscription filters, and a comparison tray.",
  },
  {
    id: "2026-07-11-gsc-first-report",
    date: "2026-07-11",
    cat: "index",
    title: "First index report: Google has discovered 40,162 URLs",
    body: "Within a month of opening to search engines, Google Search Console shows 40,162 Metatake URLs discovered plus 7,353 video URLs, with zero manual actions and zero security issues. Indexing is the slow part; the state of the index will be reported here as it moves.",
  },
  {
    id: "2026-07-11-full-inventory",
    date: "2026-07-11",
    cat: "films",
    title: "The full shelf, browsable: 6,975 films, 865 directors",
    body: "The A-Z indexes now list the complete inventory — [6,975 films](/film) and [865 directors](/director) — including the catalog tier beyond the close-read core.",
  },
  {
    id: "2026-07-11-bot-sentinel",
    date: "2026-07-11",
    cat: "policy",
    title: "Automated defense against abusive scrapers",
    body: "An autonomous loop now detects and blocks bulk scrapers at the edge, while search engines and citing AI assistants remain explicitly welcome. The crawler policy is public at [/bot](/bot).",
  },
  {
    id: "2026-07-10-first-party-analytics",
    date: "2026-07-10",
    cat: "policy",
    title: "Measurement without cookies",
    body: "Metatake built an in-house, cookieless measurement pipeline — no cookies, no cross-site trackers, and no ad-tech scripts run on the site. See [Privacy](/privacy).",
  },
  {
    id: "2026-07-10-search-surface",
    date: "2026-07-10",
    cat: "feature",
    title: "Search became a results page",
    body: "[Search](/search) was rebuilt as a full results surface — entity cards, image strips, keyword-in-context snippets — served warm in about 0.4 seconds, on one engine that fuses exact and semantic search so a phrase, a theme, or a feeling can find a film. Korean queries resolve too, via 6,033 Korean name aliases.",
  },
  {
    id: "2026-07-09-now-playing",
    date: "2026-07-09",
    cat: "feature",
    title: "Now Playing: an hourly news desk",
    body: "A desk at [Now](/now) watches film news around the clock and publishes editor's-letter pieces connecting the day's stories to the site's readings, with a daily digest and a public wire.",
  },
  {
    id: "2026-07-09-director-pages",
    date: "2026-07-09",
    cat: "feature",
    title: "Director pages go deeper",
    body: "Every director hub now runs deeper — where to start, what to watch next, the life, honors, reception, and the theory their films attract — with a browsable [directors index](/curious/directors).",
  },
  {
    id: "2026-07-08-reception-chronicles",
    date: "2026-07-08",
    cat: "feature",
    title: "Afterlife: how films are received and remembered",
    body: "Film pages gained a year-by-year chronicle of each film's afterlife — reviews, academic study, re-releases, honors — built from 9,215 curated reception records plus public data sources. Example: [Mulholland Drive's afterlife](/film/mulholland-drive-2001/reception).",
  },
  {
    id: "2026-07-06-my-films-lens",
    date: "2026-07-06",
    cat: "feature",
    title: "See the whole site through your own films",
    body: "A personal lens now overlays every list, index, and graph: highlight what you have seen, dim it, or show only your films. It runs off your imported watch history and works across [the entire site](/my-films).",
  },
  {
    id: "2026-07-05-connections-rebuilt",
    date: "2026-07-05",
    cat: "feature",
    title: "The connection engine, rebuilt",
    body: "Film-to-film kinship was recomputed from shared tropes and taste signals — 46,000 affinity pairs and 11,000 counterpoint links (same trope, opposing readings) — all visible in the [Network](/network) galaxy of 1,941 films and 873 directors.",
  },
  {
    id: "2026-07-05-lineage-honors",
    date: "2026-07-05",
    cat: "data",
    title: "Honors as facts: 10,551 sourced list memberships",
    body: "The lineage corpus — 398 canon, award, and festival lists, every membership fully sourced — got its public read layer at [Lineage](/lineage), including per-film honors records for 895 films.",
  },
  {
    id: "2026-07-04-locations-layer",
    date: "2026-07-04",
    cat: "feature",
    title: "Where was it filmed? The Locations layer opens",
    body: "A geographic read layer opened over a geocoded corpus of more than 17,000 filming locations: per-film location pages, 73 country hubs, and 511 city and region hubs — where films were shot, and where they are set, with coordinates and sources. Start at [Locations](/locations).",
  },
  {
    id: "2026-07-04-sitemaps-indexnow",
    date: "2026-07-04",
    cat: "index",
    title: "Search engines, formally greeted",
    body: "The sitemap became a per-section index of about 13,000 URLs, IndexNow (live since July 2) now pushes new and changed pages to search engines immediately, and the site connected to Google Search Console. Index status will be reported here from now on.",
  },
  {
    id: "2026-07-03-watch-history-import",
    date: "2026-07-03",
    cat: "feature",
    title: "Bring your history: watch-log import",
    body: "[Import](/me/import) accepts Letterboxd, IMDb, Watcha, spreadsheet, and plain-text exports, auto-detects the format, and builds your personal layer over the site — coverage, blind spots, and what to watch next in [My Room](/room).",
  },
  {
    id: "2026-07-01-takescore-live",
    date: "2026-07-01",
    cat: "milestone",
    title: "TakeScore goes live",
    body: "Metatake's thirteen-dimension critical index — Value, Cost, Risk — went live across the site at [TakeScore](/takescore). It is computed from the criticism itself and never blended with audience ratings or box office; the divergence is the information.",
  },
  {
    id: "2026-06-27-map-explorer",
    date: "2026-06-27",
    cat: "feature",
    title: "The map of meaning becomes explorable",
    body: "A full-screen graph explorer over films and directors opened — click any node to recenter and follow shared meanings outward, ring by ring. It lives on today as [Network](/network).",
  },
  {
    id: "2026-06-26-theory-axis",
    date: "2026-06-26",
    cat: "feature",
    title: "Film theory becomes a browse axis",
    body: "Theorists, concepts, and traditions each received hubs and pages — [Theorists](/theorist), [Concepts](/concept), [Traditions](/tradition) — every one linked from the readings that cite it, so the theory behind a reading is always one click deep.",
  },
  {
    id: "2026-06-23-strong-misreadings",
    date: "2026-06-23",
    cat: "milestone",
    title: "Strong Misreadings: the house framework arrives",
    body: "The site's readings were rebuilt around the Strong Misreading — a reading pushed to full strength, after Harold Bloom's claim that reading is always misreading. The name is the disclaimer; what a reading keeps is what it lets you see. The credo is on [About](/about#strong-misreadings).",
  },
  {
    id: "2026-06-18-the-daily",
    date: "2026-06-18",
    cat: "feature",
    title: "The Daily begins",
    body: "A daily editorial connecting the world's news to films began publishing at [The Daily](/blog), with a newsletter to follow along.",
  },
  {
    id: "2026-06-17-opens-to-search",
    date: "2026-06-17",
    cat: "milestone",
    title: "Metatake opens to search engines",
    body: "Indexing was switched on and the first sitemap published. Public from here on.",
  },
  {
    id: "2026-06-17-tropes",
    date: "2026-06-17",
    cat: "feature",
    title: "Tropes: recurring figures become a browse axis",
    body: "When the same reading recurs across films it becomes a trope — and [Tropes](/tropes) opened as a first-class way to browse the site, from per-trope hubs to trope rows on every figure page.",
  },
  {
    id: "2026-06-16-robots-stance",
    date: "2026-06-16",
    cat: "policy",
    title: "First policy: welcome answer engines, decline training crawlers",
    body: "From before launch, robots.txt has welcomed search and answer engines while declining AI-training crawlers, with [llms.txt](/llms.txt) describing the site to machines. Metatake wants to be cited, not absorbed.",
  },
  {
    id: "2026-06-14-metatake-pivot",
    date: "2026-06-14",
    cat: "milestone",
    title: "Metatake gets its name and its spine",
    body: "The project took its final name and its critical architecture: the figure (what a film keeps returning to), the take (a reading of it), and the meta take (the pattern across films). Everything since is built on that spine — see [About](/about).",
  },
];
```

(총 37항목. 6월은 성기게, 7월은 하루 최대 2~3건 — 병합·삭제를 거친 최종 밀도다.)

---

## §6. 편집 계약 (앞으로 쓸 모든 포스트의 규칙)

**목소리**: 객관·구체·담백. 뉴스 와이어 톤. 숫자는 기록 그대로, 형용사는 아끼고("amazing/revolutionary" 금지), 취지는 필요할 때 한 절로("so that…", "— a small handshake for an open web" 수준). 자기 자랑 대신 사실이 말하게 한다.

**형식 규칙**
1. 1~4문장, 한 문단. 제목은 사실 진술(sentence case).
2. `date` = 실제 라이브된 날(KST). 소급 발행 금지, 예약 발행 금지.
3. 표면이 존재하면 **반드시 링크 1개 이상**. 발행 전 모든 링크 curl 200 확인.
4. 수치는 포스트 날짜 시점 값으로 동결. 나중에 커져도 옛 포스트 수정 금지.
5. **append-only**: 발행된 포스트의 id·date·본문은 불변. 정정은 새 포스트로, 경미한 오타만 조용히 수정 가능. 큰 정정은 본문 끝에 "Update (Jul 20): …" 한 줄 추가도 허용.
6. id는 `YYYY-MM-DD-slug` — 영구 앵커다. 발행 후 변경 절대 금지(공유 링크가 깨진다).

**★ 산문 물량 금지 (오너 결정 2026-07-15 — 이 피드의 제1원칙)**
날짜가 박힌 피드에서 독자는 산수를 한다: 6주 만에 평가문 수천 편·기사 수천 편 = "AI 대량생산 사이트"라는 자백이 된다. 그래서 —
- **기능·데이터·정책·색인은 발표한다. 글(산문) 생산량은 발표하지 않는다.** 리딩·평가문·기사·에세이·문장 등 *생성된 글의 편수/문장수*는 제목에도 본문에도 쓰지 않는다.
- **데이터 수치는 허용**(오히려 신뢰 신호): 촬영지·수상 레코드·필름/감독 수·플레이리스트·GSC 수치·DOI 등 검증 가능한 사실.
- 하루 최대 2~3건. 같은 날 여러 출시는 한 포스트로 병합.
- 기능은 "몇 편 만들었나"가 아니라 **사용자가 무엇을 할 수 있게 됐나**로 서술한다.

**공개 수위 (위반 금지 — 오너 결정과 결부됨)**
- 비용($), 내부 도구명(factory.py, 워커, 에이전트 세션), 운영 스택 세부는 **쓰지 않는다**. AI 관여의 공개 수위는 About의 문장("Every page is drafted by a machine and answered for by a person")과 /methodology가 이미 공개한 범위까지만. 근거: For-Developers 독스 보류 결정(오너: "vibe coding" 공개 = 콘텐츠 권위 오염).
- **보류·대기 중인 프로젝트는 발표 금지**: 개발자 독스(오너 보류), 키워드 레이더(구현 대기), Tier-2 공장 라인(구현 대기), 크롬 확장(스토어 등록 전 — 등록되면 그때 발표). 로드맵/약속("coming soon") 금지 — 이 피드는 **된 것**의 기록이다.
- 보안 세부(WAF 규칙, 탐지 시그널)는 고수준으로만.
- 개인 식별 데이터·사용자 수치(가입자 수 등)는 오너 승인 전 금지.

**앞으로의 정기 장르 — 견본 문안 (이대로 변주해서 쓰면 됨)**

주간 영화 추가 (films):
```ts
{
  id: "2026-07-20-films-week",
  date: "2026-07-20",
  cat: "films",
  title: "This week on the shelf: 14 films added",
  body: "Fourteen titles joined the close-read tier this week, including [Film A](/film/slug-a) and [Film B](/film/slug-b) — each with full readings, misreadings, and a TakeScore. Browse the newest at [Latest](/latest).",
}
```

구글 등재 상황 (index — 월 1회 권장, GSC 수치 그대로):
```ts
{
  id: "2026-08-01-index-report",
  date: "2026-08-01",
  cat: "index",
  title: "Index report: N pages indexed, up from M",
  body: "Google now indexes N Metatake pages (M a month ago); Bing indexes K. No manual actions. The biggest mover was the catalog-film promotion of July 15.",
}
```

저작권 등록 (policy):
```ts
{
  id: "2026-08-05-copyright-registration",
  date: "2026-08-05",
  cat: "policy",
  title: "Copyright registration: the TakeScore corpus",
  body: "Metatake's original written corpus — readings, TakeScore appraisals, and essays — was registered with the Korea Copyright Commission (registration no. XXXX). The license stays the same: CC BY-NC 4.0, quote freely with attribution.",
}
```

---

## §7. 운영 — 새 소식 추가하는 법 (5분 레시피)

1. `lib/updates/posts.ts` 열기 → 배열 **맨 위**에 새 객체 prepend (§6 규칙 준수).
2. 링크 전부 `curl -s -o /dev/null -w '%{http_code}' -L https://metatake.net<path>` → 200 확인.
3. 저장 → auto-deploy 워처가 lib/를 자동 커밋·배포 (워처 꺼져 있으면 `git add lib/updates/posts.ts && git commit && git push`).
4. 배포 후 `https://metatake.net/updates?v=<아무값>`으로 캐시 우회 확인(ISR 구캐시 오진 함정).
5. (선택) `node scripts/indexnow-ping.mjs https://metatake.net/updates`.

세션 운영 팁: 굵직한 것을 SHIPPED 처리하는 세션은 마지막에 "이거 /updates에 실을까?"를 오너에게 한 줄로 물어보라. 오너가 승인한 문안만 발행.

---

## §8. QA 체크리스트 (배포 전후)

- [ ] **저장소 루트에서** `PATH="$HOME/.local/node/bin:$PATH" npx tsc --noEmit` 통과. (⚠️ `~/.local/node/bin/npx tsc`처럼 전체경로만 쓰면 npx의 shebang이 PATH에서 node를 못 찾아 실패 — PATH 주입이 필수. 루트 밖에서 실행하면 npx가 가짜 'tsc' 패키지를 받아옴. **로컬 `next dev`로 확인 금지**: turbopack이 globals.css @import에 500 — 알려진 함정이며 프로덕션 빌드는 정상.)
- [ ] 라이브 `/updates` 200, 본문 37항목, 월 구분선(JULY/JUNE 2026) 존재.
- [ ] 앵커 동작: `/updates#2026-07-13-mcp-server` 진입 시 해당 항목으로 스크롤(스티키 내비에 안 가림).
- [ ] `/updates/feed.xml` 200 + XML 파스 가능(브라우저나 `xmllint --noout`), item 37개, description에 `[`, `](` 잔재 없음.
- [ ] `view-source:`로 JSON-LD Blog 노드 확인 (⚠️ grep 검증 시 React 주석 노드가 텍스트를 쪼개는 함정 — 문자열 grep 오진 주의, 느슨한 패턴 사용).
- [ ] `https://metatake.net/sitemaps/core.xml`에 `/updates` + lastmod 포함.
- [ ] Footer·Nav(Read 그룹)·About 하단 3곳에서 링크 렌더·클릭 확인.
- [ ] 본문 내부 링크 전수 curl 200 (특히 /movies-like는 인덱스가 없어 404 — 코퍼스에서 이미 제외했음. 재발 주의).
- [ ] 모바일 뷰포트(375px)에서 날짜·칩·제목 줄바꿈 자연스러움.

---

## §9. 함정 목록 (이 저장소 특유 — 어기면 사고)

1. **"News"라는 단어로 라우트·컴포넌트 이름 짓지 말 것** — Now 층이 news-sitemap.xml·NewsArticle·EntityNews를 점유. 이 피드는 어디까지나 "Updates".
2. **로컬 dev 500은 정상** (turbopack + globals.css @import). globals.css 수정 금지. 검증은 tsc + 라이브.
3. **워처 스코프**: 자동 배포는 `app/ components/ lib/`만. 이 프로젝트는 루트 파일을 건드릴 필요가 없게 설계했다 — middleware·robots 등 루트/특수 파일에 손대지 말 것.
4. **ISR 구캐시 오진**: 배포 직후 감사는 캐시버스터 필수.
5. **About의 `#strong-misreadings` 앵커 불변식** — About 수정 시 앵커·id 절대 보존.
6. **unstable_cache 불필요** — 이 페이지는 순수 정적. DB를 붙이고 싶어져도(비목표 §10) null-포이즌 404 함정부터 읽을 것.
7. 코퍼스 문자열 안에 백틱·`${`·큰따옴표 넣지 말 것(§3 문법 제약).
8. 커밋 메시지 관례: `feat(updates): company-news thread at /updates — page, feed, corpus, entry links` 정도. 워처가 자동 커밋하면 그대로 둬도 무방.

---

## §10. 비목표 (지금 하지 말 것 — 후일 후보)

- 한국어판(/updates는 i18n 마스터 플랜의 웨이브에 편입될 때 처리).
- 상세 페이지·페이지네이션·연도 아카이브(150항목 초과 시 재검토).
- DB 저장·어드민 발행 UI·자동 포스트 생성(공장/GSC에서 자동 초안은 후일 매력적이지만, 지금은 사람이 쓴다).
- 뉴스레터 연동, X/스레드 자동 크로스포스트.
- 전용 OG 카드(기본 사이트 카드로 충분. 원하면 후일 `/api/og`류 확장).
- 크롬 확장 발표(스토어 등록 완료 후 별도 포스트로).

---

## 부록 A. 사실 검증 대장 (2026-07-15, 이 문서 작성 시점)

- 코퍼스의 모든 내부 링크: 라이브 curl 전수 200 확인(/updates·/news만 404 = 신설 경로 비어 있음). `/movies-like` 인덱스는 404라 코퍼스에서 제외.
- Hugging Face `wonwooyoon/metatake-filming-locations`, Zenodo DOI `10.5281/zenodo.21336967`, 지오데이터 CC BY 4.0 / 글 CC BY-NC 4.0: `app/data/page.tsx`·`lib/docs/content/locations.ts`와 대조 확인.
- 날짜·수치 출처: git 커밋 기록(1,773커밋 전수 스캔) + 루트 HANDOFF 문서군 + 메모리. 두 소스가 갈린 항목은 커밋 날짜 우선, 라이브 검증일(07-15)로 통일한 것은 Tier-2 승격·통합 2건.
- MCP 레지스트리 등록명 `net.metatake/mcp`: docs/MCP-DIRECTORY-SUBMISSION.md 확인.
- **보수적 컷 재편(2026-07-15, 오너 결정)**: "AI 대량생산으로 보일 위험" 검토 후 50→37편. 산문 물량 포스트 삭제(first-commit·평가문 6,701·미스리딩 기사 1,932·문장층 466,974·카탈로그 5,041편 개방·공유카드·리네임·About개정·검색엔진통합·TV방송1,794건), 리프레임(감독 도시에→기능 서술, Poetics→편수 제거, 리셉션→레코드 수만, TV→카운트 제거 병합), API/MCP/임베드 3건→1건 병합, Tier-2 승격+메인통합→1건 병합. 제1원칙 "산문 물량 금지"는 §6에 명문화.
- **적대적 검증 패스 완료(2026-07-15, 독립 검증 에이전트 2)** — 반영된 정정: ① TakeScore 라이브일 07-03→**07-01**(커밋 fa1a3d9~a981982; 07-03은 구경로 308화뿐) ② Tier-2 승격 수치를 당일 게이트 완화(커밋 6793119, availability 요건 제거 +62) 반영해 **1,167편/≈3,126**으로, "사이트맵 정확 미러"→"동일 게이트+주간 코호트 방출"로 정정(INDEX_COHORT_FILMS_T2=300) ③ 애널리틱스 포스트: `@vercel/analytics`가 root layout에 아직 마운트(app/layout.tsx:149)라 "서드파티 대체/타사 스크립트 없음" 절대문 삭제 — 현재 문안("no cookies, no cross-site trackers, no ad-tech scripts")이 검증 가능한 상한. **오너가 Vercel Analytics를 제거하기로 하면 그때 문구 강화 가능** ④ IndexNow 라이브일=07-02 ⑤ 카운터포인트 11k는 양방향 행 수→"links" ⑥ GSC 플래그는 "resolved"→"clears the cause"(구글 재검증은 자체 일정) ⑦ 06-17 사이트맵 "submitted"→"published"(GSC 연결은 07-04).
