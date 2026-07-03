# /me × TakeScore — implementation plan (started 2026-07-01)

Bring **TakeScore** (TS = Value − λ·Risk; the public name of Cinecodex, computed for all
6,701 films) into the live personal page `/me`. Decisions taken with the user:
enhance **live `/me`** (not the /my_room mockups) · **Watchlist pipeline first** ·
show **TS + a risk flag** per film (not the full V/C/R breakdown).

Principles kept (from `HANDOFF-FINAL.md`): non-blending one-way (TS output only, never
mixes external/standing), monotonic/non-punishing, explainable, DB-respect (additive
read-only RPCs; public tables untouched; cinecodex stays an isolated schema read via a
security-definer bridge).

## Shipped — Slice 1: Watchlist as a pipeline
- **RPC `public.me_watchlist_scored()`** (security-definer, `auth.uid()`-scoped, read-only):
  user's watchlist ⋈ `cinecodex.scores` best panel → per film `v/c/r` (+ rating, poster).
- **`components/WatchlistPipeline.tsx`** (client): λ (risk-aversion) dial re-ranks by
  net TS; two callouts — **"Tonight's safe bet"** (high net, R≤20) and **"The ambitious one"**
  (highest Value); each row = poster + title + **risk flag** (Safe ≤15 / Divisive ≤35 /
  Risky) + big **TS box**. Unscored films sink to the bottom ("not yet scored").
- Wired into `/me` watchlist section (replaces the v1 Why-Watch list); CSS `.wp-*`.

## Shipped — Slice 3: Watched × TakeScore + Portfolio panels
- **RPC `me_watched_scored()`** + **`WatchedScored`**: watched films with TS + value gap
  (your ★ vs our Value), sortable (TakeScore / your rating / riskiest).
- **RPC `me_takescore_summary()`** + **`PortfolioQuality`**: median TS, value/risk lean,
  best & riskiest seen, value gap; cold-start "forming" < 3 scored.

## Shipped — Slice 4: Fix-A · Taste vector · NAV (2026-07-01)
- **Standing Fix-A** — `compute_film_scores` v2: canon uses the rank-grade curve DIRECTLY
  (`aw·(0.45+0.50·pos_norm)`, no listed=0.45 double-penalty); facets limited to recognition;
  Discovery (Fix-B) = prestige·(1−pop_norm) from imdb votes. Recomputed 5,977. **Vertigo 40.3→84.5.**
- **Taste vector** — `film_taste_vector` (L2-normalized mean of a film's take embeddings, HNSW
  cosine) + **RPC `me_taste_neighbors()`** (centroid of films rated ≥3.5 → nearest UNSEEN by
  cosine, with TS). `/me` **"Recommended for you · by taste"** rail (`TasteRail`). Verified:
  There Will Be Blood→Boogie Nights/Magnolia, sci-fi→Tenet.
- **NAV v2** — `me_portfolio_nav()` monotonic saturating index from decayed Standing of seen
  films + essentials(≥70) + lineage lines + avg Standing. `/me` **Portfolio index** strip
  (`PortfolioNav`). Cold-start < 8 seen → "forming".

Test data seeded on thinkartist1@gmail.com: 21 watched (rated) + 5 watchlist.

## Shipped — Slice 5: Eval card · Pass-2 confidence · WWI (2026-07-01)
- **Cinecodex Pass 2 (reliability)** — `public.cinecodex_confidence` (film_id pk): a MEASURED,
  limits-stated confidence, not luck. conf = 0.62·Evidence + 0.20·Attention + 0.18·Sample − flag,
  where Evidence = log(critical-take corpus depth), Attention = log(imdb votes), Sample = panel/pass
  strength (single-pass sonnet-n1 = 0.40). Tiers High ≥65 / Moderate 40–64 / Limited <40. Result:
  1,879 High (avg 76, ~38 takes), 4,763 Limited (avg 9, 0 takes — corpus-less single-pass judgments).
  Honest: only the corpus-grounded films earn High; the visible catalogue is all High/Moderate
  (Limited films are the hidden thin-content batch). Exposed via `cinecodex_for` (+conf,conf_tier,n_takes).
- **Evaluation card** (`CinecodexPanel` rewrite) — the 13 sub-scores are now ALWAYS visible
  (Value/Cost/Risk grid, no `<details>`), plus a **Confidence meter** (tier + /100 bar + a plain
  grounding note: "grounded in N critical takes"). External metrics still alongside, never blended.
  Verified live: Parasite High 89/100, 13 subs, no crash.
- **WWI (Worth-Weighted Index) — the formal recommendation** — `me_recommend_wwi(λ,limit)`:
  a DASHBOARD combiner ranking unseen films by **Confidence · (0.45 Utility + 0.35 Taste + 0.20 Standing)**;
  Utility = TakeScore (Value−λ·Risk), Taste = loved-signature cosine, Standing = Prestige, gated by
  confidence so shaky scores never recommend with false certainty. One-way: taste/standing shape the
  RECOMMENDATION only, never TakeScore itself. `/me` "Recommended for you · the balanced call" rail
  (`WWIRail`, three mini-bars + TS/taste chips + confidence dot). Verified live (thinkartist1): Passion
  of Joan of Arc WWI 64 (TS 84), Third Man, Chinatown, Barry Lyndon, Citizen Kane — all High confidence.
  The pure-taste rail remains as a cold-start fallback.

## Shipped — Slice 6: WWI λ dial · Value×Popularity 2×2 (2026-07-01)
- **WWI λ dial** — `WWIRail` is now a client component with a **risk-appetite (λ) slider**.
  It recomputes Utility = (Value − λ·Risk)/100, then WWI = Confidence·(0.45·U + 0.35·Taste +
  0.20·Standing), and re-sorts the top 12 live from a 48-film λ-neutral pool (`me_recommend_wwi`
  now orders the pool by confidence·(taste+standing+best-case value) so the dial has room).
  Low λ = adventurous (bold high-value), high λ = cautious (low-risk rises). TS chip updates too.
- **Value × Popularity 2×2** — eval card gains a divergence plot: our durable **Value** (y) vs the
  crowd's **attention** (x = normalized log IMDb votes; `cinecodex_for` now returns `votes`). Four
  quadrants (Hidden gem / Consensus classic / Popular·lighter / Minor) with the film's dot and a
  one-line verdict. "The gap is the point" — never blended into the score.
  (Slices 5–6 deployed via auto-deploy.)

## Next slices (not yet built)
2. **Portfolio quality panel** (watched films): median TS, your value/risk lean,
   best & riskiest seen, **value gap** (your ★ vs our Value = 가치뱃지), a NAV-lite headline.
   Needs an RPC `me_takescore_summary()` (watched ⋈ scores, aggregates).
3. **Film-row TS everywhere on /me** (watched list, saved) — reuse the badge.
4. **Deeper (per HANDOFF-FINAL §9):** Standing Fix-A (v2 `compute_film_scores`), taste
   vector (Phase 2) → then true NAV v2 + WWI-with-risk blend, evaluation cards, and
   eventually the dark `/my_room` command-center shell.

## Notes
- Public wording is **TakeScore / TS**; "Cinecodex" stays internal.
- Cinecodex Pass 2 (flagged N=3) still recommended for reliability but not required here.
