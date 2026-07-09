> 📍 **정본 인덱스: [`HANDOFF-now-플레잉.md`](../HANDOFF-now-플레잉.md)** — Now Playing 전체 체계·불변식·결정 로그. 작업 전 먼저 읽으세요.

# Traffic forecast & case evidence — read before building

*Researched and adversarially verified 2026-07-08 (two independent research passes; load-bearing claims checked against primary sources). This document exists because the honest answer changes the design. Decision points at the bottom.*

---

## 1. Our baseline (the number everything else must be scaled to)

metatake.net GSC as of 2026-07-04: **46 impressions/day, 2 clicks** (HANDOFF-SEO-마스터.md §4). The domain has 20K+ indexed pages and real film-entity depth, but in Google's eyes it is at the very start of its search life. Every success case below sat on massive existing authority. Estimates that assume "mid-authority domain" must be discounted for us in months 0–6.

## 2. The genre's track record — every success ended in a Google-update collapse

| Case | Rise | Fall | Relevance |
| :-- | :-- | :-- | :-- |
| **Sportskeeda** | 15M→80M+ MAU in ~2 yrs (2020–22), trend-chasing + freelancer army | Mar 2025 core update: FY26 revenue −38.6%, EBITDA −73% | The scale-up template; needed ~50 staff + thousands of contributors |
| **Newsweek** | 30M→109M visits/mo (2019–24) via news-SEO + Discover, 300 stories/day, 200-person newsroom | Dec 2025 update: May 2026 −74% YoY, worst in US top-50 three months running | Best-executed version of exactly our tactics; still crashed |
| **HITC / The Focus (GRV)** | ~100M pageviews/mo network peak (2023); writers required 15–20 articles/day | The Focus dead (Nov 2024, sold for ~£84K trailing revenue); GRV −65% uniques, 60/156 staff cut (Sept–Dec 2025) | The pure "answer the trending query" model — our closest structural analog at industrial scale |
| **Screen Rant** | ~48M visits/mo, survivor | −40% visibility in Mar 2024 update alone (biggest loser of ~70 tracked) | Film-beat trend coverage specifically got hit |
| **Giant Freakin Robot** | 20M views/mo (film/TV news + commentary) | → "a few thousand"; shut down Nov 2024 | Film-adjacent trend desk, named authors — dead |
| **Ready Steady Cut** | Film/TV explainers, ~20 named human critics, RT-approved, $400–500K/yr, real research, no affiliate junk | −50% overnight (Sept 2023 HCU); $20K spent on remediation bought nothing; never recovered; team laid off | **Our mirror image.** Named authors + genuine quality demonstrably did not protect |
| Entertainment cohort (Sistrix 2023) | — | −44% average visibility across 140 entertainment domains | The beat itself is a demotion target |

Verified regime facts (2026): Discover is now 65–68% of Google traffic to news publishers (Chartbeat + NewzDash independently); **breaking news is the only growing content type** (+103% since Nov 2024) while evergreen explainers fell ~40%; zero-click = 68% of US searches; page-2 positions capture 0.63% of clicks *in total*; Top Stories requires algorithmic news-publisher classification that takes **~2 years** (Barry Adams) and there is no application path (Publisher Center submissions removed Apr 2024 — the DISTRIBUTION.md checklist item is corrected accordingly: news sitemap still matters for crawl speed, but there is nothing to "apply" to).

Velocity itself is officially neutral (Mueller: "publishing frequency alone does not make something spam") — the deindexed cohort was 86–100% AI/templated unoriginality. Genuinely argued, named-author work has no documented manual action. **The risk is not penalty; it is suffocation (never ranking) and classifier lookalike-suppression.**

## 3. Probability-weighted forecast for the planned form (8–14/day, general world trends)

| Outcome | Probability (evidence-based) |
| :-- | :-- |
| Never achieves meaningful organic traction (brand-gated fresh SERPs, AIO, zero-click) | **~50–60% — modal outcome** |
| Traction, then HCU-style site-level suppression within 18 months | ~25–35% |
| If suppressed: recovery (typical lag ~21 months; full recoveries rare) | ~20% partial |
| Manual action / deindexing | ~5% (only if drafting drifts toward paraphrase-at-scale) |
| Durable success as a Google-traffic business in the planned form | **≤10%** |

**Traffic scenarios** (per the case math: median trend article 5–50 clicks lifetime; long-tail #1s 200–500; power-law everything):

- **Months 0–3** (no Discover, no Top Stories, our baseline): median piece ≈ single-digit-to-tens of clicks. At ~300–400 pieces/mo: **realistically hundreds to a few thousand visits/mo** (the research's 5–25K/mo figure assumed a mid-authority domain we are not yet).
- **Months 3–6+, if Discover picks up** (solo benchmark: Lucid Insider, in Discover in 4 weeks, ~150 clicks/day): most pieces still ~0, occasional Discover hits 5K–100K each; sustained **30K–200K visits/mo is the documented upside band** — and documented to be revocable to ~zero in 48h at any core update.
- **The film-entity advantage is real:** 80% of Discover traffic concentrates on entity-strong content, and our 20K film/people pages are exactly that — but it applies to film-adjacent trends, not to general world news, where the domain has no authority signal at all.
- **X auto-posting:** for a <1K non-Premium account, median link post = <100 impressions and **0% median engagement** (Buffer, 18.8M posts); bulk bare-link posting matches X's stated spam pattern; URL posts cost $0.20 each. Expected yield: **single-digit clicks/day**. Test cheaply if at all; native-post formats (text + image, link in reply) over bare links.

## 4. What the evidence does to our design

Already right in the current design: publishing on metatake.net (not a fresh domain) · subfolder section · pass discipline · rhyme gate · named author · research mandate · pruning/indexation discipline · no ad-stack (losers averaged 17.6 ads/page).

What the evidence says to change:

1. **Invert the architecture: beat-first, trends-second.** The graveyard is "everything trending"; the only moats that show up independently in the winner data are focused topical authority + branded demand. Selection should *weight trends inside our entity territory* (film, TV, celebrity-adjacent culture, arts, awards, obituaries of film figures, tech/politics stories with strong culture hooks) and treat far-afield general news as the exception that must earn its slot, not the default.
2. **Cut launch velocity: 2–4/day, not 8–14/day.** Hourly *detection* stays (the whole poller/selector design is unchanged — being early matters). Hourly *publishing* doesn't: a higher publish threshold protects the 20K-page site from the sitewide classifier (the biggest asymmetric risk: the trend layer can drag down the existing, growing search equity) and matches the evidence that thin misses accumulate into the killer profile.
3. **Hold rule before scaling:** don't raise the daily cap until (a) GSC shows the trend pieces earning impressions/clicks at a materially better rate than the archive, and (b) ≥30% of the section's traffic is non-Google (newsletter/Telegram/direct). Every named shutdown was ~100% Google-dependent.
4. **Reframe the KPI.** In months 0–6 the trend layer's realistic value is not raw traffic: it is freshness signals, entity coverage, internal-link equity into film pages, Discover eligibility building, and the daily-email/outreach feedstock. Judge it on those + leading indicators (impressions curve, Discover first-appearance), not on visits.
5. **X plan revised:** small credit test is fine, but measure against the 0%-engagement base rate; prefer native formats; Bluesky/Telegram remain the free defaults.

## 5. Decision points (Wonwoo)

- **A. Launch shape:** beat-weighted 2–4/day (recommended) vs. original 8–14/day general-trends. The pipeline is identical; only the selector's territory weighting and the publish threshold differ.
- **B. Scaling trigger:** adopt the hold rule above? (recommended)
- **C. Timeline expectation:** commit to judging at 12 weeks on leading indicators, with the explicit understanding that the modal documented outcome for this genre is failure-by-suffocation, and plan the effort accordingly.
