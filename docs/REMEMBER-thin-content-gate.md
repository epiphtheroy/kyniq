# REMEMBER — thin-content gate (temporary hide of figure-less films)

> **⚠️ 2026-07-14 이후 정본 게이트는 `lib/seo.ts filmIndexBar` (코드 SSOT) + `HANDOFF-SEO-스타터가이드-작업지시서.md §2`.**
> 이 문서 본문의 "figures≥3 = 색인 경계(meetsBar)" 모델은 **더 이상 색인 정본이 아니다.** 현재 상태:
> - **`visible` ≠ 색인 가능.** `visible`(=figures≥3 트리거)은 이제 Tier-1 편집 페이지 표시 플래그일 뿐. **색인 여부는 `filmIndexBar`**: Tier-1(visible) + **승격 Tier-2 1,105편**(is_analyzed=false·visible=false지만 reception≥3 OR lineage≥3 OR wd_honors≥3 AND provider≥1). 색인 메인 1,959→~3,064.
> - **서브페이지 불변식**: takescore/reception/lineage/… 는 `filmMainIndexable && ownBar`로 게이트. 마이그 0097 `film_index_signals_json` 로스터.
> - **`hold`은 게이트 입력이 아니다** — 팩토리 "미승격 스텁" 플래그(Tier-2 4,723/4,997에 걸림). 진짜 미해결 스텁만 `slug LIKE 'tmdb-%'`.
> - 감독 허브도 자체 게이트 신설(`lib/directorGate.ts`, 858→678/180 — `HANDOFF-Tier2-메인통합.md §4 D6`).
>
> ⚠️ **아래 §"AUTO-REVERSING"의 `films.visible`=DB 트리거(figures≥3) 사실은 여전히 유효**하고 SEO 스타터가이드 §0가 인용함 — 유지. 나머지 "숨김/meetsBar 색인" 수치·절차는 역사 기록으로만 읽을 것. (2026-07-06 배너: Tier-2는 이용자 표면 전면 노출·PLAN-tier2-almanac.md.)

*Created 2026-06-18, during the +405 big bang. Read this before deciding the films are "done".*

## What's hidden, and why
The +405 expansion created ~400 film rows that have TMDB metadata but **no figures/takes yet**.
To avoid a thin-content SEO penalty and empty-looking pages, any film with **fewer than 3
approved figures** is currently:
- **hidden** from UI listings (/film, /director, /genre, home random wall, search, random, prev/next),
- **noindex** for search engines, and **excluded from sitemap.xml**.

As of 2026-06-18: visible **571**, hidden **394** (the ~400 new minus the canary, plus ~9 old seed films that were always thin).

## ★ It is AUTO-REVERSING (the important part)
A film flips back to **visible + indexable + in sitemap the moment it has ≥3 approved figures.**
Both gates read the live figure count (`films.visible` is kept current by a DB trigger; the
noindex/sitemap gate counts figures at render). So as `film-extract` fills the 400, **they reappear
on their own — no manual unlock needed** for any film that gets extracted.

## Post-big-bang check (do this once extraction is finished)
1. `select visible, count(*) from films group by visible;` → expect almost all `true`.
2. `select slug from films where not visible order by slug;` → whatever's left has <3 figures
   (an extraction gap, or a genuinely thin old seed film). For each: re-extract
   (`film-extract.py --persist --reset --film <slug>`) or enrich, or accept it staying hidden.

## Mechanism (all already live)
- **DB**: `films.visible` (bool, default false) + trigger `trg_films_refresh_visible` on `figures`
  recomputes it as (approved figures ≥ 3). Migration **0049**.
- **RPCs** filter `visible`: `home_pool`, `search_site`, `random_film_slug`, `seq_nav`. Migrations **0050, 0051**.
- **App listings** filter `.eq("visible", true)`: `app/film/page.tsx`, `app/director/[slug]/page.tsx`,
  `app/genre/page.tsx`, `app/genre/[slug]/page.tsx`.
- **noindex + sitemap** gate (figures ≥ 3): `app/film/[slug]/page.tsx` (`meetsBar`), `app/sitemap.ts`.
- Deploy: `deploy-thin-content-noindex.command`.

## To FULLY remove the gate later (show every film regardless of figures)
Only if you decide thin films should be shown/indexed (e.g. a deliberate policy change):
1. **App**: remove `.eq("visible", true)` from the four listing files above; set `meetsBar = true`
   in `app/film/[slug]/page.tsx`; restore `app/sitemap.ts` to list all films. Redeploy.
2. **RPCs**: re-create `home_pool` / `search_site` / `random_film_slug` / `seq_nav` without the
   `visible` filter (the pre-gate definitions are in git history; the gate lines are marked in 0050/0051).
3. **Optional cleanup**: `drop trigger trg_films_refresh_visible on figures; drop function films_refresh_visible(); alter table films drop column visible;`
4. **Or just relax**: change the threshold from `3` to `1` in the trigger (0049) and in the two app gate files.

*Delete this note once the gate is either accepted as permanent policy or fully reverted.*
