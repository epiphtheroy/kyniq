# HANDOFF — 공유·저장 시스템 (Share & Save Everywhere)

> **이 문서가 정본이다.** 목표: **공유가 많이 되는 것.** 슬러그가 있는 모든 페이지에
> 공유·저장을 배치하고, 공유된 순간 각 매체(X·페이스북·카카오톡·왓츠앱 등)에서
> 매체 특성에 맞는 헤드라인·이미지 카드가 완벽하게 뜨게 한다.
> 기획: 2026-07-11 (Claude, 원우 지시). 구현: 이 문서를 받은 AI가 수행한다.
> 작업 전 필독: 루트 `CLAUDE.md`류 관례 + §9 불변식. 워처가 app/components/lib를
> 자동 커밋·배포하므로 **다중 편집 전 `touch .autodeploy-off` → 편집 → 타입체크 →
> `rm .autodeploy-off`** 순서를 반드시 지킬 것.

---

## 0. 한 줄 전략

공유는 **③좋은 카드 → ①낮은 마찰 → ②공유할 이유** 순으로 결정된다.
- **좋은 카드**: 받은 사람의 피드에서 클릭되는 OG 이미지·헤드라인 (§5·§6) — 최우선.
- **낮은 마찰**: 어느 페이지든 1탭 공유 (§3·§4).
- **공유할 이유**: 숫자·순위·연도 등 "데이터 반전 훅"이 담긴 공유 문구 (§5.3).

---

## 1. 현황 실사 (2026-07-11 기준)

| 자산 | 상태 | 갭 |
|---|---|---|
| `components/ShareRow.tsx` | 존재 — 네이티브 share/copy만, **question 페이지 1곳에서만 사용** | 채널별 버튼 없음, 배치 전무 |
| 동적 OG 이미지 (`opengraph-image.tsx`) | **5개 라우트만**: film, film/figure, director, take, concept | 나머지 40+ 라우트는 정적/누락 |
| `generateMetadata` openGraph | 44개 파일에 존재 | title/desc가 매체 최적화 안 됨, twitter card 미통일 |
| 저장 인프라 | `SaveButton`+`UserSavesProvider`(user_saves), `MovieListActions`(user_movies), My Room(/room) | director/trope/lineage/film에만 산발 배치 |
| 퍼스트파티 분석 | `/api/metrics` → mt_events (HANDOFF-사이트분석-퍼스트파티.md) | 공유 이벤트 스키마 없음 |
| 슬러그 라우트 | 약 45개 패밀리 (아래 §7 배치맵에 전체 목록) | — |

---

## 2. 컴포넌트 설계 — `ShareDock` (신규, 기존 ShareRow 대체·흡수)

`components/ShareDock.tsx` — **"use client"**, 단일 컴포넌트 + variant. 서버 페이지는
props(title, url 경로, hook 문구, pageType, slug)만 내려준다. **개인화·window 접근은
전부 클라이언트에서** (ISR 캐시 불변식, §9).

### 2.1 해부도 (anatomy)

```
[variant="bar"]  ── 기사류 본문 상단·하단용 (가로 한 줄)
  ⌁ X ⌁ Facebook ⌁ (모바일: 카카오톡·왓츠앱) ⌁ 링크복사 ⌁ ⋯더보기 │ ☆ Save

[variant="rail"] ── 데스크톱 롱리드 좌측 세로 고정 (스크롤 따라옴, IntersectionObserver로 히어로 지나면 표시)
  X / FB / 복사 / ⋯ / ☆   (아이콘만, 44px 터치타깃)

[variant="fab"]  ── 모바일 전용 우하단 플로팅 1버튼 → 탭하면 네이티브 share sheet
                    (navigator.share 없으면 바텀시트 폴백: 채널 그리드 + 복사 + Save)

[variant="chip"] ── 카드·리스트 아이템 호버용 (작은 ⌁ 아이콘 1개 → 네이티브/복사)
```

### 2.2 동작 규칙

- **모바일 = 네이티브 우선**: `navigator.share` 가능하면 fab·bar의 "⋯더보기"는 무조건 OS 시트.
  1탭 공유가 최대 전환. 단 X·카카오톡 등 상위 2-3개는 직접 버튼도 병행(사용자 관성).
- **링크복사**: 클립보드 성공 시 토스트 "Link copied — paste it anywhere"(1.8s). 실패 폴백:
  `prompt()` 금지(브라우저 다이얼로그 차단 관례) → 인라인 input+select.
- **복사되는 URL은 항상 canonical + UTM** (§8.2). `window.location.href` 그대로 쓰지 말 것
  (쿼리 오염 방지) — 서버가 내려준 `path`로 조립.
- **Save(☆)**: 로그인 시 기존 `UserSavesProvider`/`user_saves`에 저장(엔티티 종류·슬러그),
  film 페이지는 기존 `MovieListActions`와 중복되지 않게 ShareDock의 ☆를 숨기고 기존 버튼 유지.
  **비로그인**: localStorage `mt:anon-saves`에 저장 + "Sign in to keep this forever" 넛지 1회,
  로그인하면 머지 업로드(이미 /me/import 패턴 있음 — 유사하게).
- **접근성**: 모두 `<button>`/`<a>`, aria-label, 키보드 포커스 링. 다크모드: 기존 var(--) 토큰만.
- **성능**: 아이콘은 인라인 SVG(외부 스크립트·SDK 절대 금지 — FB/카카오 SDK 넣지 말 것.
  전부 **URL 스킴 공유**로: 카카오톡도 `https://sharer.kakao.com/talk/friends/picker/link` 대신
  모바일 네이티브 시트가 처리. SDK 없이).

### 2.3 채널 목록과 URL 스킴 (`lib/share.ts` 신규)

| 채널 | URL 템플릿 | 노출 조건 |
|---|---|---|
| X | `https://x.com/intent/post?text={text}&url={url}` | 항상 |
| Facebook | `https://www.facebook.com/sharer/sharer.php?u={url}` | 항상 |
| WhatsApp | `https://wa.me/?text={text}%20{url}` | 모바일 UA 우선 |
| Telegram | `https://t.me/share/url?url={url}&text={text}` | ⋯더보기 안 |
| Reddit | `https://www.reddit.com/submit?url={url}&title={text}` | ⋯더보기 안 (영화 커뮤니티 강함) |
| LinkedIn | `https://www.linkedin.com/sharing/share-offsite/?url={url}` | ⋯더보기 안 |
| Email | `mailto:?subject={title}&body={text}%0A{url}` | ⋯더보기 안 |
| 링크복사 | clipboard | 항상 |
| 네이티브 | `navigator.share({title,text,url})` | 지원 시 (모바일 사실상 전부) |

카카오톡: 별도 버튼 대신 **모바일 네이티브 시트**가 담당 (한국 사용자는 시트에서 카톡 선택).
SDK·JS키 관리 비용 제로. (추후 트래픽 데이터로 직접 버튼 승격 검토.)

---

## 3. 배치 맵 (어디에, 어떤 variant)

**원칙**: 읽기형(기사) 페이지 = 시작·끝 2회 노출 + 데스크톱 rail. 허브·카드형 = bar 1회.
모바일 = 전 페이지 fab (스크롤 25% 지나면 등장, 푸터 근처에서 숨김).

| 페이지 유형 (라우트) | 데스크톱 | 모바일 |
|---|---|---|
| **기사형** — film/[desk](+ko), misreadings, q/[question], reception(film·director), director/{life,start,next,theory,honors,locations}, take/[slug], figure, now/[slug], blog/[slug] | 바이라인 옆 `bar` + 본문 끝 `bar` + 좌측 `rail` | 히어로 아래 `bar` + `fab` |
| **엔티티 허브** — film/[slug], director/[slug], theorist, concept, trope, genre, tradition, lineage, movements, catalog/[seg]/[slug], credits/[person], frame, idea(→concept) | 히어로 액션열(기존 🎞·🖼 옆) `bar` | 동일 + `fab` |
| **점수·데이터** — takescore/film/[slug], film/lineage, movies-like, atlas/[slug], film/atlas | 헤드라인 아래 `bar` | 동일 + `fab` |
| **검색** — /search?q= | 결과 상단 우측 `chip`(쿼리 공유) | 시트 |
| **카드 컴포넌트**(선택, Phase 3) — FilmCard·기사 카드 | 호버 `chip` | 생략 |

- film/[slug]는 Tier-1·Tier-2(minimal 분기) **양쪽 모두**에 배치할 것 (분기 2곳).
- /room·/me 등 개인 페이지는 제외(사적 데이터). /admin 제외.

---

## 4. 공유 문구 공식 (`lib/share-text.ts` 신규) — "매체 특성에 맞는 헤드라인"

**서버에서 pageType별로 hook을 조립해 ShareDock에 내려준다.** 원칙: 숫자·순위·연도가
든 문장이 무맥락 제목보다 클릭된다 (데이터 반전 = 우리 해자).

| pageType | X/텍스트 채널용 hook 공식 (영문) |
|---|---|
| film | `{title} ({year}) — TakeScore {u}, ranked #{rank} of {total} on Metatake` |
| takescore | `{title} scores {u}/100 on TakeScore — value {v}, risk {r}. Agree?` |
| reception | `{title} in {y0} vs now: {n} reviews, {honors} honors — the full afterlife, year by year` |
| desk essay | `{essay_title}` (에세이 제목이 이미 훅) + ` — on {film} ({year})` |
| misreadings | `{n} deliberate misreadings of {film} — each one an argument` |
| director | `{name}: {films}편, 시그니처 트로프 {n} — where to start` 영문화 |
| theorist | `{name} through {n} films — the cinema view of {name}` |
| now | 기사 headline 그대로 (이미 뉴스 헤드라인) |
| q/question | question title 그대로 (스포일러 마스킹 display_title 존중 — **원제 노출 금지**) |
| 기본값 | `og:title` 재사용 |

- X는 `text`(hook)+URL, 280자 내 자름. FB/LinkedIn은 URL만(카드가 말함) — text 생략.
- 해시태그: X만 `#{film_hashtag}` 1개 이하(과다 금지). 예: `#Parasite`.

---

## 5. OG/Twitter 카드 표준 — **가장 중요한 파트**

### 5.1 메타 규칙 (전 슬러그 페이지 공통 감사·통일)

```ts
openGraph: { title, description, type: "article"|"website", url: canonical, siteName: "Metatake",
             images: [{ url: OG이미지, width:1200, height:630 }] }
twitter: { card: "summary_large_image", title, description }
```
- `metadataBase` 확인(vercel URL 아닌 metatake.net). canonical과 og:url 일치.
- description 155자 내, 숫자 훅 포함(§4 공식 재사용).

### 5.2 동적 OG 이미지 시스템 (`app/og/` 또는 각 라우트 `opengraph-image.tsx`)

기존 5개(film·figure·director·take·concept)의 **템플릿 스타일을 추출해 공용화**
(`lib/og-template.tsx`): 좌측 포스터/프로필, 우측 큰 세리프 헤드라인 + 데이터 배지
(TakeScore 링, 순위, 연도, 수상 수), 하단 `METATAKE` 워드마크. 신규 필수 대상(우선순위순):

1. `takescore/film/[slug]` — 점수 링 + #랭크 (가장 공유 유인 큰 카드)
2. `film/[slug]/reception` — "Reviews & Afterlife {y0}–{y1}" + 백드롭
3. `film/[slug]/[desk]` — 에세이 제목 + 포스터 (essay_plain에서 dek 훅)
4. `film/[slug]/misreadings`, `q/[question]`(스포일러 마스킹 제목 사용)
5. `now/[slug]` — 헤드라인 + image_path
6. director 서브페이지들(honors/start/theory…) — director OG 변형 재사용
7. theorist / trope / genre / lineage / movements / tradition / atlas — 텍스트+데이터 배지형

기술: `next/og` ImageResponse(edge). TMDB 이미지는 fetch→ArrayBuffer 삽입.
폰트는 로컬 번들(서체 1-2개). **각 이미지 route는 revalidate 캐시**(하루)로 비용 절감.

### 5.3 검증 (QA 필수)

- X Card Validator, FB Sharing Debugger, 카카오톡 실기기(모바일 시트→카톡 전송) 3종 실검.
- FB는 첫 공유 전 Debugger로 스크레이프 강제 갱신. 배포 후 대표 슬러그 10개 체크리스트.

---

## 6. 저장(Save) 설계

- **모델**: 기존 `user_saves`(엔티티 kind+slug) 확장 사용. film은 기존 user_movies 유지.
- **위치**: ShareDock 우측 끝 ☆ (분리감 있게 구분선). 저장됨 상태 ★ + "Saved to your Room".
- **비로그인**: localStorage 큐 + 넛지 → 로그인 시 서버 머지. 머지 API는 기존 saves API 재사용.
- **Room 노출**: /room의 기존 Saves 표면이 자동 수용(스키마 동일하면 작업 불필요 — 확인만).

---

## 7. 측정 — 공유가 늘었는지 어떻게 아는가

- **이벤트**: 기존 비콘(`/api/metrics`, mt_events)에
  `{ type: "share", channel, page_type, slug }` / `{ type: "save", ... }` 추가.
  네이티브 시트는 채널 식별 불가 → `channel: "native"`.
- **UTM 규약**: 공유 URL에 `?utm_source={channel}&utm_medium=share` (링크복사는 `copy`).
  ⚠️ canonical은 UTM 없는 URL 유지(중복 색인 방지 — 이미 canonical 있음, 확인만).
- **성공지표**: 주간 share 이벤트 수, 채널별 분포, utm_medium=share 유입 세션, 저장 수.
  /admin/metrics(기존)에 share 패널 1개 추가.

---

## 8. 구현 순서 (권장 3 phase)

- **Phase 1 (효과 최대)**: lib/share.ts + share-text.ts + ShareDock(bar·fab) →
  기사형 전 페이지 + film/director 허브 배치 + share 이벤트 비콘.
- **Phase 2**: OG 이미지 신규 7종(§5.2 순서대로) + 전 페이지 메타 감사·통일 + QA 3종 실검.
- **Phase 3**: rail·chip variant, 비로그인 저장 머지, /admin/metrics share 패널, 카드 chip.

---

## 9. 불변식·함정 (구현 AI는 반드시 지킬 것)

1. **ISR 불변식**: 서버 HTML에 개인화 금지. ShareDock는 클라이언트 컴포넌트, 페이지가
   내려주는 건 정적 props뿐. `unstable_cache` 페이로드 shape을 바꾸면 **캐시 키 bump 필수**.
2. **워처**: 다중 편집 전 `.autodeploy-off` 생성, 끝나면 제거. 중간 상태가 배포되면 500 실사고 전례 있음.
3. 타입체크 베이스라인: `tsc --noEmit` 기존 에러 18(+스테일 .next 몇 개) — **신규 0 유지**.
4. 외부 SDK 금지(FB/카카오 JS SDK·공유 위젯 서드파티). URL 스킴 + 네이티브 시트만.
5. 스포일러: question류는 `display_title`(마스킹) 사용 — 공유 문구·OG에 원제 금지.
6. `/film/[slug]` Tier-2 minimal 분기 별도 배치 잊지 말 것 (분기 2개).
7. React 보간 텍스트는 주석 노드로 쪼개짐 — 라이브 검증 grep은 부분 문자열로.
8. OG 이미지 route는 무거움 — edge + 캐시, 실패 시 정적 폴백 이미지(브랜드 카드) 반환.
9. 다크모드·모바일(360px) 확인. 터치타깃 44px.
10. 배포 후 라이브 검증: 대표 10 슬러그에서 ShareDock 렌더 + OG 디버거 3종 통과를 확인하고 보고할 것.

## 10. 완료 정의 (DoD)

- 슬러그 전 페이지(§3 표)에서 공유 1탭 가능 + 모바일 네이티브 시트.
- 대표 페이지 유형 전부가 X·FB·카톡에서 이미지 카드+훅 헤드라인으로 미리보기됨.
- mt_events에 share/save 이벤트 적재, /admin/metrics에서 확인 가능.
