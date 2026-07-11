# WORKORDER — Sentence Surfaces Tier 1 (film module · ticker · map captions)

**Status: SHIPPED 2026-07-11 (live & verified). Two small items deferred — see "Shipped vs deferred" below.**

## Shipped vs deferred (2026-07-11)
**Live & verified on prod:**
- **W0**: RPCs `film_sentences_for`, `sentences_ticker` (migration 0062) + `/api/sentences/for`, `/api/sentences/ticker`. Verified: ticker/for return real rows.
- **W1**: `components/FilmSentences.tsx` "Did you know" module on `/film/[slug]` (both Tier-1 + Tier-2 branches) + `df-know` tab (gated rows≥2) + CSS in `read.css` + `lineageUrl` added to `lib/urls.ts`. Verified: `id="df-know"` live on `/film/parasite-2019`.
- **W2**: `components/SentenceTicker.tsx` (marquee + reduced-motion/mobile rotator fallback, pause-on-hover, fixed height) mounted on home (`HomeClient.tsx`, below `hm-ticker`) and `/room` (`DeskWorkspace.tsx`, top of `v2wrap`, `variant="room"`). Verified: ticker API live.
- **W3-A**: `map_film_ego` (migration 0063) now carries `w`=`film_kinship.kin` on film↔film `like` edges; `EntityGraph.tsx` scales stroke width by `w`. Verified: `/api/map?mode=films&key=parasite-2019` returns like edges with w (38.7–67). Powers the **/map "Films" mode** graph.
- **W3-B**: `components/GraphCaptions.tsx` "why connected" strip mounted under the film-page connection map (`df-map`), keyed to `film.slug`.

**Deferred (documented, low value / higher risk):**
- **map_film_overview kin weights** — only `map_film_ego` was weighted (the ego graph is what users focus on). The global overview graph is unweighted. Follow-up if desired.
- TypeScript: `tsc --noEmit` clean (0 errors). Migration files 0061/0062/0063 mirrored to `supabase/migrations/` and committed manually (watcher doesn't stage `supabase/`).

## Phase 1.5 — SentenceLexicon rail (SHIPPED 2026-07-11, same day)
원우 직접 요청: /map과 film 커넥션 섹션 **우측에 아틀라스풍 회전 문장 그리드** — 화면 속 엔티티를 설명하는 글자들이 박스 안에서 계속 바뀌고, 클릭하면 그 엔티티 중심으로 재호출.
- **`components/SentenceLexicon.tsx`** — 340px rail, 4 cells, staggered rotation (one cell advances every 3.4s to the next unshown sentence), pause-on-hover, reduced-motion → static. Atlas typography (uppercase micro-labels, hairline rules, serif body, tabular index numbers, navy #16233F / amber #E0922A). Every entity name = recenter button; ‹ back / ⌂ home / ↗ open-page.
- **RPC `sentences_for_entity(type,key,key2,limit)`** (migration **0064**, plpgsql branches per type so indexes are always used): film · director · theorist · trope/take/idea (meta_takes slug) · figure. Returns the SAME projection as `film_sentences_for` **plus the anchor `film`** per row (recenter target). film/figure pools share one anchor → per-anchor diversity cap disabled there (fix applied same day). New indexes: GIN on `meta_take_ids`, partial btree on `theorist_id`/`figure_id`.
- **API `/api/sentences/entity`** (s-maxage=300).
- **Mounts:** film `df-map` → **`components/ConnectionDesk.tsx`** (2-col flex: EntityMap + lexicon; graph recenter re-roots the rail via new `EntityMap onCenter` callback — **replaces GraphCaptions there**; component kept in repo, unused). `/map` (MapExplorer) → rail beside EntityGraph for films/directors/critical modes, keyed to the live center node (`egoParams`); overview/galaxy hide it.
- CSS: `.cmap-cols/.map-cols/.lexi-*` in globals.css; ≤900px stacks below the graph.

---

**Original spec (written 2026-07-11, for a fresh agent):**
**Goal:** surface the shipped `film_sentences` layer (454,555 entity-linked sentences, 12 patterns — see `sentence-engine/MASS-PRODUCTION.md`) on three Tier-1 surfaces approved by 원우:
- **W1** — Film page "Did you know" module (SSR, SEO internal-link mesh) ← highest value
- **W2** — `SentenceTicker` shared component, mounted on home + `/room` (the "재난방송 띠")
- **W3** — Connection graph: kin-weighted edges + "why connected" caption strip

Read first: `sentence-engine/MASS-PRODUCTION.md` (data + gates), `sentence-engine/README.md`. Do NOT regenerate any sentences — the table is live and final. All three workstreams are independently deployable; ship in order W0 → W1 → W2 → W3.

---

## Locked decisions (원우/설계 — do not relitigate)
1. Sentences render **as-is** (v1 factual style, English). No LLM, no rewriting, no truncation mid-sentence.
2. Film module is **server-rendered** (SEO is half the point: descriptive-anchor internal links). Ticker + map captions are client-fetched (no SEO need).
3. Entity links are built in TS with **`lib/urls.ts` helpers only** (its docstring mandates this). The RPC returns slugs, not hrefs.
4. Rotation is **deterministic per hour** (md5 seed), never `random()` per request — protects edge caching (ISR invariant).
5. Render sentence text plain + **link chips after the text**. Do NOT try to linkify substrings inside the sentence (hydration/i18n brittleness).
6. `/room`에는 기존 티커가 없다 (ROOM-LOGIC-AUDIT의 "ticker partly hardcoded" 메모는 stale — 유일한 티커는 홈 `components/HomeClient.tsx:252` `hm-ticker`). W2는 신규 공용 컴포넌트다. 홈의 기존 `hm-ticker`/`home_bundle_cached` RPC는 **건드리지 않는다**.

## W0 — Shared plumbing (migration 0062 + API routes)

### 0062 migration: two RPCs (via MCP `apply_migration`, project `jvgarcqrtsmgfimdcwgo`, then mirror the file to `supabase/migrations/0062_sentence_rpcs.sql`)

```sql
-- film_sentences_for: diverse top-k for one film, entity slugs included for linking
create or replace function public.film_sentences_for(p_slug text, p_limit int default 8, p_patterns text[] default null)
returns jsonb
language sql stable
set statement_timeout = '8s'
as $$
with me as (select id from public.films where slug = p_slug),
base as (
  select fs.* from public.film_sentences fs, me
  where fs.film_id = me.id
    and (p_patterns is null or fs.pattern = any(p_patterns))
),
dedup as (
  select b.*,
    row_number() over (partition by b.pattern order by b.salience desc, b.id) rp,
    row_number() over (partition by coalesce(b.other_film_id::text, b.id::text) order by b.salience desc, b.id) rf
  from base b
),
pick as (
  select * from dedup
  where rp <= 2 and rf = 1
  order by salience desc, id
  limit greatest(coalesce(p_limit, 8), 1)
)
select coalesce(jsonb_agg(jsonb_build_object(
  'id', p.id, 'pattern', p.pattern, 'sentence', p.sentence,
  'salience', p.salience, 'kin', p.kin,
  'other',   case when o.id  is not null then jsonb_build_object('slug', o.slug, 'title', o.title, 'year', o.year) end,
  'node',    case when mt.id is not null then jsonb_build_object('slug', mt.slug, 'title', mt.title, 'kind', mt.kind) end,
  'figure',  case when fg.id is not null then jsonb_build_object('slug', fg.slug, 'label', fg.label) end,
  'theorist',case when th.id is not null then jsonb_build_object('slug', th.slug, 'name', th.name) end,
  'lineage', case when ll.id is not null then jsonb_build_object('slug', ll.slug, 'label', ll.label) end,
  'framework', p.framework
) order by p.salience desc, p.id), '[]'::jsonb)
from pick p
left join public.films o          on o.id  = p.other_film_id
left join public.meta_takes mt    on mt.id = p.meta_take_ids[1]
left join public.figures fg       on fg.id = p.figure_id
left join public.theorists th     on th.id = p.theorist_id
left join public.lineage_lists ll on ll.id = p.lineage_list_id;
$$;

-- sentences_ticker: hourly-deterministic diverse sample across the catalog
create or replace function public.sentences_ticker(p_n int default 40)
returns jsonb
language sql stable
set statement_timeout = '8s'
as $$
with pool as (
  select fs.id, fs.pattern, fs.sentence, f.slug as film_slug,
    md5(fs.id::text || to_char(now() at time zone 'utc', 'YYYYMMDDHH24')) as h
  from public.film_sentences fs
  join public.films f on f.id = fs.film_id
  where fs.salience >= 25
    and fs.pattern in ('A_affinity','B_bridge','D_award','E_rank','G_theorist_twin','H_dense','J_location','L_trope')
),
per as (
  select *, row_number() over (partition by pattern order by h) rn from pool
)
select coalesce(jsonb_agg(jsonb_build_object(
  'id', id, 'pattern', pattern, 'sentence', sentence, 'slug', film_slug
) order by h), '[]'::jsonb)
from (select * from per where rn <= 6 order by h limit greatest(coalesce(p_n,40),1)) q;
$$;
```

Notes: single-row `jsonb_agg` sidesteps the PostgREST 1000-row cap (house pattern, cf. `geo_overview_json`). Function-level `set statement_timeout` is required — anon default is 3s (tv_watch lesson). `coalesce(other_film_id::text, id::text)` gives NULL-other rows their own partition (each rf=1). Same-signature `create or replace` is safe; **if you change arg lists later, drop the old signature first** (create-or-replace overload trap). After applying: `select film_sentences_for('parasite')` (adjust to real slug), `select sentences_ticker(40)`, and `explain analyze` the ticker (< ~1.5s; it window-scans ~450k rows once per hour per edge miss — acceptable, verify).

### API routes (mimic `app/api/tv/reel/route.ts` shape — anon `createClient`, `NextResponse.json`, cache-control headers)
- `app/api/sentences/for/route.ts` — GET `?slug=&limit=&patterns=A_affinity,B_bridge` → rpc `film_sentences_for`; headers `public, s-maxage=300, stale-while-revalidate=3600`.
- `app/api/sentences/ticker/route.ts` — GET `?n=` → rpc `sentences_ticker`; headers `public, s-maxage=3600, stale-while-revalidate=86400` (matches the hourly seed).

### Link building (used by W1/W3; W2 links only to the film)
From `lib/urls.ts`: `filmUrl(other.slug)`, `takeUrl(node.slug)` when `node.kind='reading'`, `tropeUrl(node.slug)` when `node.kind='figure_type'`, `figureUrl(filmSlug, figure.slug)`, `theoristUrl(theorist.slug)`, lineage → `/lineage/${lineage.slug}` (add a `lineageUrl` helper to `lib/urls.ts` if missing — check first). `framework` has no reliable slug mapping — render as text, no link. Skip `concept` links (concept registry ≠ takes.concept text).

## W1 — Film page "Did you know" module (SSR)

**New file** `components/FilmSentences.tsx` (server component, follows `Film*` section conventions):
- Props: `{ slug: string; title: string; rows: SentenceRow[] }`.
- Renders `<section className="df-sec" id="df-know">` with entity-specific heading (SEO lesson from TV hero work): `<h2>Did you know — {title}</h2>` + one-line dek ("Computed connections from the Metatake graph.").
- List of up to **6** rows: sentence text, then link chips (small pill links; reuse an existing chip class from the film page if one exists, else minimal `.df-know-chip` in the page CSS). Chip order: other film → node/trope → theorist → figure → lineage.
- Return `null` if `rows.length < 2`.

**Wiring in `app/film/[slug]/page.tsx`:**
- Add a cached loader next to the existing ones (do NOT touch `load7`/`loadChrome` cache keys — payload-shape trap):
  ```ts
  const loadSentences = (slug: string) => unstable_cache(
    async () => { const { data, error } = await db().rpc("film_sentences_for", { p_slug: slug, p_limit: 8 });
      if (error) throw error;   // null-poison trap: throw, never cache an error as empty
      return (data ?? []) as SentenceRow[]; },
    ["film-sentences-v1", slug], { revalidate: 300, tags: [`film:${slug}`] })();
  ```
- **Full branch**: render `<FilmSentences …/>` immediately after the CONNECTION MAP section (`df-map` ends ~line 1301) — thematic adjacency. Add tab `{ id: "df-know", label: "Did you know", zone: "free" }` to the tabs array (~line 969-999) **only when rows ≥ 2** (compute before tabs). ⚠️ id must NOT be `df-map`/label "Connections" — that tab already exists for the graph.
- **Tier-2 minimal branch**: same component after `FilmRecommendedBy` (~line 822), before the "Explore from here" `RelatedBoxes`. Tier-2 films have D/E/F/J sentences — this thickens thin pages (tier2-bare lesson).

**QA (W1):** ① RPC smoke on 3 slugs: a Tier-1 hit (e.g. `parasite`… verify actual slug via `select slug from films where title='Parasite'`), a Tier-2 film, a film with 0 sentences (262 exist → module absent, tab absent, no crash). ② Post-deploy, `curl` live HTML **with a cache-buster** and grep a distinctive substring (`df-know`) — remember React comment nodes split interpolated text; grep static markup only (live-audit lessons). ③ Chips resolve 200 (spot-check take/trope/theorist/lineage hrefs). ④ Verify anon REST can call the RPC (RLS is on; policies exist — but confirm `film_sentences_for` runs as anon via a curl with the anon key).

## W2 — `SentenceTicker` (client component) + mounts

**New file** `components/SentenceTicker.tsx` (`"use client"`):
- Fetches `/api/sentences/ticker?n=40` once on mount; renders a **single-line horizontal marquee**: duplicated track (`track track` pattern), CSS `@keyframes` translateX loop, duration ≈ 8s per item (≈320s full loop), `will-change: transform`.
- Each item: `pattern` as a tiny colored tag (reuse the `TICK_COLOR`-style map idea from `HomeClient.tsx:19`, extend for our patterns) + sentence as a link to `/film/${slug}`.
- **Guardrails (must-have):** fixed container height (~36px — zero CLS); pause animation on hover/focus (`:hover { animation-play-state: paused }`); `@media (prefers-reduced-motion: reduce)` → no marquee, fall back to a 7s single-item rotator (copy `useRotator` from `HomeClient.tsx:69-78`); mobile (`max-width: 640px`) → rotator mode too (marquee is unreadable + battery); links keyboard-focusable, `aria-label="Cinema connection ticker"`.
- Empty/error fetch → render nothing (height collapses only before mount; reserve height with CSS on the mount wrapper to avoid CLS).
- Variant prop `variant?: "home" | "room"` for tone-matching styles only (room = terminal dark, home = editorial).

**Mounts:**
- Home: inside `components/HomeClient.tsx`, directly **below** the existing `hm-ticker` block (~line 257). Keep "Just added" untouched.
- Room: `app/room/page.tsx` dashboard, top strip (room uses `@/lib/supabase/server` for auth but the ticker is self-contained client fetch — no client-type conflict). Match `/room` visual language (monospace, dark).

**QA (W2):** CLS check on home (Lighthouse or DevTools perf overlay) — must be 0 from the ticker; reduced-motion emulation shows rotator; hover pauses; every item click lands on the right film; `/api/sentences/ticker` returns `cache-control: s-maxage=3600` and the same body within the hour (determinism).

## W3 — Connection graph: kin edge weights + caption strip

**A. kin-weighted edges.**
1. Locate the current definitions of `map_film_ego` and `map_film_overview` (search `supabase/migrations/` — connections-overhaul era, ~0040s; read the LATEST definition of each). They return jsonb consumed by `app/api/map/route.ts:47-77`.
2. New migration `0063_map_kin_weights.sql` (apply via MCP + mirror file): re-create both functions with links additionally carrying `w` = `film_kinship.kin` for film↔film links (join `film_kinship k on k.film_id = <src uuid> and k.related_film_id = <tgt uuid>`; leave `w` null when absent). **Same signature → `create or replace` is fine; changed signature → drop first** (overload trap). Do not touch director/grouped RPCs in this pass.
3. `components/EntityGraph.tsx`: extend `GraphLink` (`:29`) with `w?: number`; stroke width (`:157`) `l.arrow ? 1.5 : l.w ? 1 + 1.5 * Math.min(l.w, 100) / 100 : 1.1`; optional: opacity floor 0.5 + w/200. Keep `kind` colors as-is.

**B. "Why connected" caption strip.**
- New tiny client component `components/GraphCaptions.tsx`: props `{ slug: string }`; fetches `/api/sentences/for?slug=${slug}&limit=3&patterns=A_affinity,B_bridge,H_dense,G_theorist_twin`; renders up to 3 one-line sentences with chip links (same chip builder as W1 — extract a shared `components/SentenceChips.tsx` if cleaner).
- Mount under the graph in **`components/EntityMap.tsx`** (film-page `df-map` embed) and in **`components/MapExplorer.tsx`** film mode, keyed to the current seed/recenter slug (`MapExplorer.tsx:171-181` recenter state) so captions follow navigation.
- Galaxy mode (`GalaxyMap.tsx`) is out of scope (no edges by design).

**QA (W3):** `/api/map?...` payload now carries `w` on film-film links (curl check); graph renders with visibly varied stroke widths; recentering updates captions; a seed with no pair sentences hides the strip; no regression in director/grouped modes (their RPCs untouched → links just lack `w`).

## Global traps (memory-sourced — read before coding)
- **unstable_cache null-poison**: loaders must `throw` on error; never cache empty-on-error (404-poison incident).
- **ISR live audit**: post-deploy HTML checks need cache-busters; code-first verification.
- **React comment nodes** split interpolated text in served HTML — grep static class names/ids, not sentence fragments.
- **anon 3s statement timeout** → function-level `set statement_timeout` (already in the RPC SQL above; keep it).
- **PostgREST 1000-row cap** → jsonb_agg single-row returns (already).
- **Autodeploy watcher stages only `app/ components/ lib/`** → `supabase/migrations/0061_sentence_engine.sql` (아직 미커밋!), `0062`, `0063`, and this workorder need **manual commit**.
- **MCP timeout ≠ rollback**: after any timed-out apply/insert, verify with a count/`select proname from pg_proc` before retrying.
- `to_jsonb` alias=column trap when writing RPC SQL.

## Definition of done
1. 0062 + 0063 applied to prod AND mirrored under `supabase/migrations/` (+ 0061 committed).
2. `/film/[slug]` shows "Did you know" (Tier-1 + Tier-2 branches), tab present only when module renders, verified live on ≥3 slugs incl. one Tier-2 and one zero-sentence film.
3. Home + `/room` tickers live: deterministic hourly rotation, pause-on-hover, reduced-motion + mobile fallbacks, zero CLS.
4. Map film mode: kin-scaled edge widths + caption strip following recenter.
5. Docs: flip this workorder's Status line to SHIPPED + date; update `docs/BACKLOG.md` §C sentence-engine line (render surface → shipped); add one line to `sentence-engine/MASS-PRODUCTION.md` "Remaining" section; update auto-memory `sentence-engine-poc`.

## Explicitly out of scope (Tier 2+, do not build now)
Peek-a-boo corner animations · N_question pattern generation · OG-card hook lines · Surprise 21st mode · TV lower-thirds · new assembled document pages.
