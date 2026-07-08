# Trend-signal services — comprehensive comparison & the chosen stack

*Researched and endpoint-verified 2026-07-08 (live curl tests on the key feeds). This is the poller's contract: what we poll, why, and the upgrade path. Prices as of July 2026 — recheck before upgrading.*

---

## The chosen stack (start at $0/mo, one pre-validated $25 upgrade)

| Layer | Source | Role | Cadence | Cost |
| :-- | :-- | :-- | :-- | :-- |
| **1. Primary detector** | **Google Trends "Trending Now" RSS** — `https://trends.google.com/trending/rss?geo=US` (+ `GB`, others) | The object of the chase itself: what the world is *searching*. 10 items/geo, ~10-min refresh, ~10–40 min event→visibility. Each item ships keyword + traffic bucket (`500+`…`500K+`) + trend start time + 2–3 news links | every 10 min | $0 |
| **2. News tripwire + sources** | **Outlet RSS fleet** (BBC, Guardian, NYT, CNN, Al Jazeera, FT, WaPo, NPR, CBS, Sky, Politico + AP mirror) | Fastest channel at any price (~1–5 min from publication). Rule: same entity in **≥3 feeds within 45 min** = candidate. The hits double as the ≥2-authoritative-sources requirement | every 10 min | $0 |
| **3. Early warning** | **Reddit** `/r/all/rising`, `/r/news`, `/r/worldnews` (free OAuth, 100 QPM) | Social surfaces spikes minutes before search does. Score-velocity + comments/min = magnitude. Raises a candidate's score; never qualifies one alone | every 10 min | $0 |
| **4. Magnitude confirmer** | **GDELT DOC 2.0** `timelinevol` / `timelinevolinfo` | Globally normalized coverage-% at 15-min resolution: separates "world story" from "one-country blip", and hands over the driving articles. Query-based — runs on candidates, not open discovery | per candidate | $0 |
| **5. Entity confirmer** | **Wikipedia Current Events portal** (hourly fetch); later **Wikimedia EventStreams** edit-spike rule (≥5 edits, ≥2 editors, <60s) | High-precision corroboration + the *canonical entity name* for the story (Trends keywords are often misspelled fragments) | hourly / stream | $0 |
| **6. Source harvest** | **Google News RSS search** `rss/search?q=<kw>+when:12h&hl=en-US&gl=US&ceid=US:en` | Per-candidate article harvesting only — **never a detector** (without `when:` median item age is ~6.6 days). Follow redirect tokens to real URLs | per candidate | $0 |
| **7. Advisory** | **Bluesky** `app.bsky.unspecced.getTrendingTopics` (no auth) | Free extra social read, US-skewed; endpoint officially "unspecced" — wrap defensively | hourly | $0 |
| **Upgrade #1 (recommended after week 1)** | **SerpApi `google_trends_trending_now`** (`hours=4`, `only_active=true`) | The full ~480-trend list with **integer volumes + % increase + start timestamps** — ranks candidates by magnitude and catches spikes *before* they crack the RSS top-10. 1 geo hourly ≈ 744 calls/mo → the $25 Starter (1,000 searches) covers it; free tier (250/mo) = every-3-hours pilot | 1–2×/hour | **$25/mo** |
| Free alternative to #1 | **trendspyg** (v0.7.0, 2026-07-07) RSS mode; CSV mode = 480+ trends via headless Chrome | Same data, $0, unofficial endpoints — can break silently. Keep RSS layer 1 as the safety net | — | $0 |

**Feedback loop (not detection):** Google Search Console's 24-hour hourly view — "did the 1-hour piece catch the wave?" — plus Discover traffic as the prize.

**Design rule the whole stack obeys:** search demand (layer 1) is the *qualifier*; news corroboration (layers 2/4/6) is the *verifier*; social (layers 3/7) only *accelerates* a score. A candidate needs layers 1-or-3 **and** 2 to reach the selector.

---

## Full comparison — everything examined

### Search-demand signals (Google ecosystem)

| Service | Latency | Magnitude | Cost | Verdict |
| :-- | :-- | :-- | :-- | :-- |
| **Trending Now RSS** (verified live) | ~10–40 min, 10-min refresh, 125 countries | Bucketed | $0 | ✅ **Primary detector** |
| **SerpApi Trending Now** | same source + API call | **Integer volume + %growth**, ~480 trends | $25/mo (1K searches); free 250/mo | ✅ **Upgrade #1** |
| **trendspyg / trendspy** (open source) | same | full CSV data | $0 | ✅ Free alternative; unofficial-endpoint breakage risk (pytrends' fate) |
| Official Google Trends API | **alpha still (Jul 2026); data lags ~2 days; no trending-now endpoint** | consistently-scaled interest | free, application-gated | ⏳ Apply now (free), useless for detection — analysis only |
| DataForSEO Trends | explore-style only, no discovery feed | interest curves | ~$2.25/1K tasks | ○ Cheap enrichment, not a detector |
| Glimpse | alerts on *already-tracked* keywords only | absolute volume | $99+/mo | ✗ Wrong shape (no open discovery), eats half the budget |
| pytrends | — | — | — | ☠️ **Dead** — archived Apr 2025, do not build on it |

### News-side detection & retrieval

| Service | Latency | Clustering | Cost | Verdict |
| :-- | :-- | :-- | :-- | :-- |
| **Outlet RSS fleet** | **1–5 min** — fastest at any price | DIY co-occurrence rule | $0 | ✅ **Tripwire + citation source.** Reuters (2020) & AP have no official RSS — their wire reaches you via BBC/Guardian/AJ pickups |
| **GDELT DOC 2.0** | 15–45 min, 15-min cycle | none (query-based) | $0 | ✅ **Magnitude confirmer.** 1 req/5s + **User-Agent header required**; 2.0 API committed to stay unchanged |
| **Google News RSS** | fast *only* with `when:` operator | no | $0 | ✅ Source harvest only. Topic feeds 302-redirect to hash URLs since May 2026; article links are redirect tokens — follow redirects |
| Guardian Open Platform / NYT API | retrieval only | — | free (500/day each) | ✅ Add for deep quoting/metadata |
| **NewsAPI.ai / Event Registry** | events form in ~30–90 min | **native event clustering**, trending-events endpoint | free pilot → **$90/mo** (5K tokens; trending calls cost 10) | 💰 **Upgrade #2** if DIY clustering proves noisy |
| Perigon | minutes; best-in-class stories + velocity | ✅ best | $250/mo (15-day trial) | 💰 The perfect commercial fit, over budget — Upgrade #3 |
| NewsAPI.org | free tier delayed **24h**; real-time only at $449/mo | no | bad | ✗ Worst value in category |
| NewsData.io | free tier delayed 12h; real-time $199.99/mo | no | poor | ✗ |
| Mediastack | real-time at $24.99/mo | none, no NLP | cheap | ○ Only if the free fleet somehow fails |
| Currents / TheNewsAPI / Finlight | unremarkable / financial-only | no | $49–69/mo | ✗ |
| Bing News API | **retired Aug 2025**; Grounding-with-Bing is LLM-only, 40–483% pricier | — | — | ☠️ |
| HN Algolia + Techmeme feed.xml | real-time / minutes | Techmeme = human-curated clusters | $0 | ✅ Add for the tech beat |
| BuzzSumo | ~hours (24h window) | partial | $199/mo min | ✗ Social-engagement lens, duplicates Reddit for 40× the price |
| NewsWhip Spike / Meltwater | ~90s / real-time | yes, predictive | ~$12K–25K/yr | ✗ The category we're rebuilding for free |

### Social attention signals

| Service | Latency | Cost | Verdict |
| :-- | :-- | :-- | :-- |
| **Reddit API** (rising/hot) | **minutes** | $0 (free OAuth; even commercial rate ≈ $0.05/mo at our volume) | ✅ Best free early-warning |
| **Wikimedia EventStreams** | **seconds–minutes**, stable public infra | $0, no auth | ✅ Best free confirmer + canonical entity names (edit-spike rule from the Wikipedia Live Monitor literature) |
| Wikipedia Pageviews API | hours–24h (daily granularity) | $0 | ○ Next-day analytics only |
| **Bluesky trending** | minutes, US-skew | $0, no auth | ✅ Advisory (unspecced endpoint) |
| **X official trends** `GET /2/trends/by/woeid` | minutes — fastest, most geo-granular | pay-per-use (~$0.01/req ⇒ ~$15/mo hourly, Worldwide+US); **no free tier; pricing restructured twice in 4 months** | 💰 Optional. Buy a small credit block, verify billing actually works, design to degrade to Reddit+Bluesky when it breaks |
| twitterapi.io / Apify getdaytrends actors | ~15–60 min behind X | <$5/mo | ○ Gray-market fallback; can vanish |
| YouTube trending | **news removed from product & API July 2025** (Music/Movies/Gaming only) | — | ✗ Skip |
| TikTok | Research API = academic-only; Creative Center filters news/politics | — | ✗ Skip |
| Threads | no trends API (Apr 2026 API update added none) | — | ✗ Skip |
| Exploding Topics / Treendly | weeks-to-months timescale | $39–249/mo | ✗ Wrong timescale entirely |

---

## Operational gotchas (poller must implement)

1. **GDELT:** max 1 request/5s, send a real `User-Agent`, exponential backoff on 429 — IP blocks outlast the violation.
2. **Google News RSS:** always `when:1h`/`when:12h`; follow `CBMi…` redirect tokens to publisher URLs; topic feeds 302 since May 2026.
3. **Trends RSS:** `pubDate` = trend start time (not fetch time) — use it for freshness scoring; invalid geo → HTTP 400.
4. **Reddit:** unique descriptive User-Agent or you get throttled at 10 QPM.
5. **Bluesky:** `unspecced.*` namespace may change without notice — failures are expected, non-fatal.
6. **Every source is optional:** a source returning empty/error 3 consecutive runs → alert line in `ledger.md`, keep running on the rest. No single source may be load-bearing.
7. **Velocity needs memory:** keep every poll snapshot in `signals/` (timestamped JSON); spike = diff against the previous 2–3 snapshots, not absolute size.

## Upgrade path (spend only on proven pain)

```
$0/mo  ── week 1 dry run ──▶  $25/mo SerpApi Trending Now   (integer volumes; catch pre-top-10 spikes)
                              +$15/mo X trends pay-per-use   (only if Reddit misses X-native stories)
                              +$90/mo NewsAPI.ai              (only if DIY clustering is demonstrably noisy)
                              $250/mo Perigon                 (only if this becomes a real business line)
```

Also do now, free: **apply for the official Google Trends API alpha** (analysis/retro use later) and register a **Reddit OAuth app**.
