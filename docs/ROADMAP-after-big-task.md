# Metatake — remaining roadmap (resume after the big task)

Saved 2026-06-23. Done in this batch: **S2** (home_bundle lazy-refresh cache = materialized counts,
self-refreshing), **tz fix** (Trending/Latest date → Asia/Seoul), **/strong-misreadings sitemap +
canonical/og meta**. Everything below is **deferred until after the big task**.

## Deferred from the perf batch (do right after the big load)
- **takes HNSW index** — build once on the FINAL dataset (vector indexes belong after a bulk load).
  Recommended: `create index concurrently idx_takes_emb_hnsw on takes using hnsw (embedding vector_cosine_ops)
  where status='published';` then `drop index idx_takes_emb_ivf;`. Helps semantic search (`readings_semantic`),
  `trope_related`, and `/ask`. ~1 min build; one migration. (User chose to defer until after the big task.)
- After big load, also run `select refresh_home_cache();` once (or just wait ≤15 min for the lazy TTL) so the
  home counts reflect the new data immediately.

## Strong Misreadings polish
- **Framework SEO intro paragraphs** — a 2–3 sentence editorial/SEO blurb at the top of each
  `/strong-misreadings/[fw]` page (what the lens is, why it matters). Store per-framework copy in
  `lib/frameworks.ts` (a `seo` field) or a small table; render under the header; feeds metadata description.
- **Trope filter restore in the feed** — v1 had top-trope chips under the search to narrow a framework's
  readings by trope; v2 replaced that spot with the featured rotator. Re-add a trope filter that coexists
  with the featured cards (e.g., a "Filter by trope" dropdown using `framework_facets.top_tropes`, which the
  RPC still returns). `readings_by_framework` / `readings_semantic` already accept `p_trope`.
- **Hub featured rotator** — put a rotating random-reading strip on `/strong-misreadings` too.
- **Sort default tuning** + maybe a maturity/decade sort.

## Theory / concept layer
- **Figure alias** — short_label + category tags on figures for better search/grouping.
- **Surface theorist/concept** — `takes.theorist_name` + `takes.concept` exist; link to the theory canon
  and show on figure/reading + framework pages (esp. Psychoanalysis/Ethics/Politics).

## Search & AI chat alignment (audited 2026-06-23)
- **AI chat (`ask_retrieve`)** retrieves over `takes` (new Strong Misreadings) — OK. But it left-joins the
  retired reading hub via `meta_take_id` (always null now). Switch the hub citation to `trope_id` →
  `meta_takes(kind='figure_type')` so answers can cite the trope; link to `/trope/{slug}` and figure pages.
- **Global search (`search_site`)** returns trope/film/figure/director on the new model — OK. Gaps:
  (1) the `kind='reading'` branch is dead code (returns 0) — remove it + the "Meta take" label in SearchBox;
  (2) individual Strong Misreadings (take_title/rationale) are NOT in global search — add a `take` branch
  (trigram on take_title) so the nav/home search can find a reading by its title, linking to its figure page.

## Discovery / recommend (new model)
- Use **trope centroid embeddings** more widely: better "movies like", related-reading suggestions on
  figure pages, recommend surfaces.
- Refresh **film_affinities** on the new (Strong Misreading / trope) model — currently old-model.

## Identity / home
- **Home redesign** (deferred earlier) — hero vs text-first wiki identity.
- **Framework demotion-to-facet UX** and **similar-trope UX** decisions.

## Data hygiene
- Old `/meta-takes` and `/take/*` routes → tidy redirects (meta-takes retired).
- ~775 old figures with 0 takes — optional backfill of Strong Misreadings, or leave hidden.

## Notes / invariants
- `takes.framework` keys are stable (PSYCHOANALYTIC, SIGNIFIER→SIGNIFIED, …); only labels+slugs changed.
- Framework slugs: subtext, ontology, semiotics, enigma, production, location, context, reception,
  psychoanalysis, ethics, politics, counterpart, parallel, title (INVITATION excluded from browse).
- Trope maturity is derived from film count (2–3 Fresh · 4–8 Emerging · 9–25 Established · 26+ Cliché).
