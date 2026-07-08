# Now Playing — architecture & design rationale

*Companion to `README.md` (the editorial recipe, v2), `TREND-SOURCES.md` (signal-service comparison), `DISTRIBUTION.md` (post-publish), `FORECAST.md` (case evidence that shaped v2). Decisions locked 2026-07-08 (Wonwoo): beat-first · data-deep (no political verdict layer) · 2–4 pieces/day · hold rule · section brand containing "now" → **Now Playing at metatake.net/now**, featured big on the home page · no X.*

---

## 1. What is being built, in one paragraph

A beat-first keyword-chasing pipeline: detect, within minutes, what the world is searching in the film-and-culture territory, and publish within the hour the page only Metatake can produce — verified news facts plus the corpus's data record of the entities involved (honors, scores, tropes, connections, reception), under a named author with prominent timestamps. Detection is code (free RSS/API polling + entity matching against our own DB); the data pack is deterministic SQL; the writing is one Fable 5 call; publishing is automated behind a hard gate with async human review. Volume is capped at 2–4/day by threshold, per the hold rule.

## 2. Components

```
launchd/cron
   │  poller: every 10 min (free RSS/API polls, no LLM — velocity needs frequent snapshots)
   │  pipeline trigger: hourly at :00, max one piece/hour
   ▼
poller (Python, no LLM) ──────────── signals/YYYY-MM-DD-HHMM.json
   │  polls signal stack, clusters keywords↔articles, scores spikes vs prior snapshots
   │  threshold not met at :00 → exit (log PASS)
   ▼
selector (mechanical entity-match first, then one cheap LLM call)
   │  keyword ↔ corpus entity matching (films/people/theorists, REST read-only)
   │  rubric scoring; publish threshold + daily cap (< 4) enforcement
   │  no candidate survives → exit (log PASS + reason)
   ▼
data-pack builder (deterministic SQL, no LLM)
   │  anchor entity → honors/lineage, TakeScore, tropes/figures,
   │  connections, filmography-in-corpus, atlas, reception — with verified URLs
   ▼
writer (one Fable 5 call, web_search tool on)
   │  production prompt = README.md v2 format + data pack + anti-repetition digest
   │  every corpus claim must come from the pack (nothing remembered)
   ▼
gate (one light-model call + deterministic checks in code)
   │  defamation / unverified facts / copyright overlap  → LLM checks
   │  link 200s, length bounds, front-matter contract     → python checks
   │  fail → 1 regeneration with failure report; fail ×2 → kill
   ▼
publisher
   │  writes drafts/YYYY-MM-DD-HH.md → pushes to site → IndexNow ping
   ▼
ledger.md append + signals snapshot
```

- **Poller is code, not LLM.** 24 runs/day of RSS+API polling and scoring costs nothing and never hallucinates a trend. LLM spend only happens when a threshold-passing spike exists.
- **Existing plumbing reused:** Supabase MCP/REST for film verification (same queries as substack README), metatake.net's IndexNow key + sitemap infra, the auto-deploy watcher for site content, the Cowork-style scheduled-job pattern for the daily curation pass.
- **Model calls per published piece:** 1 selector (light) + 1 writer (Fable 5 + web search) + 1 gate (light). At 8–14 pieces/day this is real-time API territory, not Batch (matches the standing rule: pilots and low-volume runs are sync).

## 3. Signal stack (summary — full comparison in TREND-SOURCES.md)

Layered fusion, all polled by the poller (endpoint-verified 2026-07-08; details and gotchas in TREND-SOURCES.md):

1. **Primary spike detector: Google Trends "Trending Now" RSS** per geo set (US, GB, …) — measures the actual object of the chase: search demand. 10-min refresh, ~10–40 min event→visibility, ships traffic bucket + associated news links per keyword.
2. **News tripwire + citation sources: outlet RSS fleet** (BBC, Guardian, NYT, CNN, Al Jazeera, FT, WaPo, NPR, +) — the fastest channel at any price (~1–5 min); "same entity in ≥3 feeds within 45 min" = candidate, and the hits satisfy the ≥2-sources rule. (Google News RSS is *harvest-only* with `when:` — its default ranking is days stale.)
3. **Magnitude confirmer: GDELT `timelinevol`** — globally normalized coverage-% at 15-min resolution, run per candidate (1 req/5s + User-Agent).
4. **Early warning: Reddit rising (r/all, r/news, r/worldnews) + Wikipedia Current Events/EventStreams + Bluesky trending** — social runs minutes ahead of search; raises a candidate's score, never qualifies it alone. Wikipedia also supplies the canonical entity name.
5. Paid upgrades on proven pain only: **SerpApi Trending Now $25/mo (recommended after week 1** — integer volumes, full ~480-trend list), X trends pay-per-use ~$15/mo, NewsAPI.ai clustering $90/mo. Dead/skipped: pytrends (archived), Bing News API (retired 2025), YouTube trending (news removed 2025), TikTok/Threads (no usable API), Exploding Topics/Glimpse (wrong timescale/shape), BuzzSumo/NewsWhip/Meltwater (enterprise).

**Clustering rule:** a candidate = (keyword set, story cluster). Same event across outlets and queries collapses to one candidate with the best primary source; the ledger stores the cluster so a 48h dedupe works at event level, not string level.

## 4. Scoring

`score = spike × corroboration × depth-potential × novelty`, with the film-rhyme test applied only to the top few (it needs a model + DB check, so it runs in the selector, not the poller). All five dimensions are 1–5 in the rubric (README); the poller computes spike/corroboration/novelty mechanically, the selector judges depth and rhyme.

Spike is measured as *velocity*, not size: a keyword at 200K searches still climbing beats one at 2M already peaked. The poller keeps the previous snapshots in `signals/` precisely so it can difference them.

## 5. Publishing surface — DECIDED

**Now Playing · `metatake.net/now` (index) + `/now/[slug]` (pieces) + a large featured module on the home page.** Not a fresh domain.

- Newsjacking SEO is a race decided in hours; metatake.net has the domain history, the sitemap/IndexNow plumbing, GSC verification, and 20K+ interlinked film/trope/reading pages. A zero-authority new domain loses every race for months.
- Every piece links a film page — internal linking flows both ways (film pages can surface "this film in the news"), compounding the corpus.
- AVAULT branding can live *inside* the piece (byline block: "from AVAULT, the studio of Wonwoo Yoon") so the brand accrues while riding the working domain. Migrating later to avault.* with canonicals stays possible.
- ISR/edge-cache pattern already solved on this stack; new section must follow the same `generateStaticParams` + `unstable_cache` rules and be added to the sitemap index + IndexNow ping list.

## 6. Cost estimate (steady state, ~12 published/day)

| Item | Est. |
| :-- | :-- |
| Signal polling (Trends RSS, outlet RSS fleet, GDELT, Reddit OAuth, Wikipedia, Bluesky) | $0 |
| Writer: 2–4 Fable 5 calls/day with web search (~15–40K tok each) | ~$1–4/day |
| Selector + gate light-model calls | ~$0.5/day |
| Data-pack builder (SQL only) | $0 |
| Distribution: Bluesky/Telegram/Mastodon (X dropped — decision 2026-07-08) | $0 |
| SerpApi Trending Now Starter (recommended from week 2) | $25/mo |
| Optional: NewsAPI.ai clustering $90/mo | $0 until proven needed |
| **Total** | **≈ $70–160/mo** |

Lever if cost bites: publish threshold up (fewer, better pieces), not model down — the spec's "do not substitute smaller models for the column-writing step" survives the fusion.

## 7. Risks and their controls

| Risk | Control |
| :-- | :-- |
| **Google scaled-content-abuse penalty** (this is literally a trend-chasing pipeline) | The rhyme gate + verdict layer = genuine value-add per page; 14-day zero-impression pruning; pass discipline caps volume; never index a killed/thin piece |
| **Defamation at speed** | Hard automated gate (kills, never warns); structures-not-individuals rule; async human sweep twice daily |
| **First-hour facts wrong** | ≥2 independent sources to qualify; confirmed-vs-reported language; visible timestamps; correction-with-note norm |
| **Forced rhymes eroding the brand** | Rhyme < 4/5 → pass; pass log is public-able proof of discipline |
| **Auto-publish without per-piece human gate** (deviation from AVAULT §3/§9.6) | Owned deviation, documented in README; HOLD kill switch; outreach emails stay 100% human-gated; daily email stays curated |
| **Signal source rot** (RSS endpoints change, APIs die) | Poller treats every source as optional; alerting when a source returns empty ×3 runs; comparison doc records the upgrade path |
| **Hour-boundary pileups** (two spikes in one hour) | One piece per hour, best candidate wins; the loser re-scores next hour (novelty rule allows it — it wasn't published) |

## 8. Relationship to the two parent products (what changes, what survives)

| | Between Film and the World (substack) | AVAULT master spec | The Hourly |
| :-- | :-- | :-- | :-- |
| Cadence | weekdays, 1 edition | daily, 3 columns | 24 polls → 8–14 pieces/day |
| Unit | ≤7 events/edition | 1 story/column | 1 story + **1 film** |
| Film layer | figure-anchor, ≤7 films | none | figure-anchor, exactly 1, rhyme gate |
| Judgment layer | none (the rhyme is the point) | verdict + intervention + steelman | verdict + intervention + steelman (compressed) |
| Length | 90–130 words/item | 800–1,400 | 550–900 |
| Human gate | 30-min silence = approval | per-piece mandatory | auto-publish + async review + kill switch |
| Channel | Substack email | AVAULT site, 6am opening | metatake.net web (SEO); feeds the daily curated email |
| Story source | day's major news | authoritative-outlet pool | **spiking keywords** (the chase) |

The daily edition doesn't die: it becomes the human-curated best-of of the hourly stream (the vault still opens once a day; the hourly layer is the workshop floor).

## 9. Decisions log

**Decided 2026-07-08 (Wonwoo):** brand **Now Playing**, section `/now`, big home-page module + dedicated slugs · beat-first, data-deep (no political-verdict layer) · 2–4 pieces/day · hold rule adopted (FORECAST §4) · no X.

**Still tunable in operation:** geo set (start US + GB, tune after week 1) · 24/7 vs windowed (start 24/7; async review absorbs timezone) · daily-email fold-in (run substack deposit job in parallel one week, then curate from the /now stream).

## 10. Build order

1. **Phase 0 — poller + dry run (no publishing).** Poll, cluster, score, log candidates hourly for 3–5 days. Tune thresholds against what it *would* have chased. Zero LLM cost until selector testing.
2. **Phase 1 — full loop to drafts only.** Selector + writer + gate produce `drafts/` files; Wonwoo reads them like the substack drafts. Measure: rhyme quality, pass rate, latency.
3. **Phase 2 — site section + auto-publish.** `/now` pages, sitemap/IndexNow wiring, kill switch, ledger. GSC watch begins.
4. **Phase 3 — fold the daily.** Daily email = curated hourly best-of; outreach loop attaches to curated pieces only; pruning job for zero-impression pages.
