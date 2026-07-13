> 📍 **정본 인덱스: [`HANDOFF-now-플레잉.md`](../HANDOFF-now-플레잉.md)** — Now Playing 전체 체계·불변식·결정 로그. 작업 전 먼저 읽으세요.

# Now Playing — production spec v2 (beat-first, data-deep)

**What this is.** metatake.net's live layer: `/now`. When something spikes in the film-and-culture territory, Now Playing publishes — within the hour — the piece only Metatake can write: the news, verified, plus **the archive's record of the entities involved**, assembled from the corpus (lineage & honors, TakeScore, tropes & figures, connections, atlas, reception history). Not a hot take, not a political verdict: *the data-deep film-history read, timestamped.*

v2 supersedes v1's fusion recipe after the case-evidence review (`FORECAST.md`): beat-first, trends-second; **2–4 pieces/day**, not 8–14; the AVAULT verdict layer is retired from this product. The two parent specs still inform craft: figure-anchor discipline and live-verified links from `../substack/README.md`; research mandate, Smart Brevity, and the defamation firewall from the AVAULT spec.

**Publish time is part of the product.** Every piece displays its published and updated timestamps prominently; freshness claims ("as of 14:00 UTC") are explicit; corrections are edits with a note, never silent.

---

## The beat — what qualifies (selection territory)

1. **Direct beat (default lane):** any spiking keyword whose entity exists in the corpus — films, directors, actors, theorists. Deaths and tributes, awards and festivals, castings and releases, restorations and re-releases, anniversaries, controversies, box-office moments, adaptations of known properties.
2. **Adjacent beat:** arts/culture/tech/politics stories with a *load-bearing* film hook (a film everyone is invoking, a director speaking, a festival as the stage).
3. **Exception lane (max 1/day):** a general news event with a figure-rhyme so strong (5/5, never forced) that the corpus genuinely illuminates it — the old *Between Film and the World* move. This lane is the exception that must earn its slot, never the default.

**The entity gate — HARD RULE.** Every piece anchors on **one primary entity** (one film or one person) that exists live in the corpus. Verify before drafting (Supabase, project `jvgarcqrtsmgfimdcwgo`): films by `slug`, people via credits, theorists via `theorists`. No corpus entity → not our story → PASS. This gate is mechanical: the selector matches trending keywords against the entity tables first.

## The hourly loop (detection hourly; publishing 2–4/day by threshold)

| Minute | Stage | What happens |
| :-- | :-- | :-- |
| :00–:05 | **DETECT** | Poll the signal stack (`TREND-SOURCES.md`). Build candidate clusters: keyword(s) + best sources + spike score. |
| :05–:12 | **SELECT** | Entity-match against the corpus (the beat gate). Score the survivors (rubric below). Publish only if top candidate clears the **publish threshold** AND today's count < 4. Otherwise **PASS the hour** (log why). Expect most hours to pass — that is the design, not a failure. |
| :12–:38 | **RESEARCH & DRAFT** | Fetch the anchor entity's corpus data (data pack, below). One Opus 4.8 call, web search on: ≥2 searches to verify facts beyond the primary source, then write to the format. Anti-repetition digest injected. |
| :38–:45 | **GATE** | Automated: defamation firewall, unverified assertions, copyright overlap, **every data claim checked against the data pack**, link resolution (200s), length bounds, timestamp block present. One regeneration on failure; two → kill, log. |
| :45–:50 | **PUBLISH** | Insert to `now_articles` → `/now/<slug>` live. Distribution burst (`DISTRIBUTION.md`): news-sitemap + RSS regenerate, IndexNow, Bluesky/Telegram posts. **No X.** |
| :50–:60 | **DEPOSIT** | `ledger.md` append (keyword · entity · lane · data modules used · channel status). Signal snapshot to `signals/`. |

## Selection rubric (1–5 each; publish threshold: total ≥ 16 AND no dimension < 3)

1. **Spike** — genuinely surging now; are we early on the curve?
2. **Corroboration** — ≥2 independent authoritative outlets, consistent core facts.
3. **Corpus depth** — can the archive contribute **≥3 distinct data modules** on the anchor entity? (This replaces v1's "rhyme" for the direct beat; the exception lane still scores rhyme here.) Thin corpus coverage → PASS: the data layer is the product.
4. **Novelty** — not covered in 48h (`ledger.md` cluster check); a genuine development may requalify, framed as the development.
5. **Search shape** — is there a query a reader actually types where we can be the best page (person/film name + the event, "why", "explained")?

## The piece — fixed functions, fresh wording every time (500–900 words + data modules)

| Order | Function | Spec |
| :-- | :-- | :-- |
| Headline | The trending query's own words + the archive's angle | Proper nouns forward; no formulaic patterns |
| Timestamp block | Published + last-updated, timezone-explicit | Rendered prominently; matches JSON-LD `datePublished`/`dateModified` |
| Dek + one-line summary | What happened + what the record shows | Dek one sentence; summary 1–2 sentences, **bolded** |
| Hero image | The anchor film's TMDB backdrop | One header image (site already serves TMDB, no new rights risk); caption links the film page. Never a still implying it depicts the *news* event |
| The facts | What happened, verified | 2–3 short paragraphs; ≥2 independent sources, **each attributed to an outlet AND a reporting date** ("Deadline reported on July 7 that…") — publish time ≠ news date; confirmed-vs-reported language; minimal evaluation |
| **The record** | The corpus data layer — the differentiator | Structured modules assembled from the DB (pick the ≥3 that genuinely illuminate): honors/lineage timeline · TakeScore + component scores · reception-year arc · **shooting locations (atlas)** · **strong misreadings** · **essays on file** · filmography-in-corpus · theorist links. Every number/claim must come from the data pack — nothing remembered, everything retrieved |
| The reading | What the pattern means in film history | Interpretive but data-grounded: the through-line the modules reveal. One named theorist/concept max, only if corpus-linked. Wit welcome; structures, not private individuals |
| Bottom line | Re-tighten | 1–2 sentences; no new points |
| Sources + deposit | Attribution + the Metatake edge | Outlets actually used; end `→ In Metatake:` naming what this piece deposits (figure/connection) |
| Keep reading in the archive | The anchor's other live pages | Collected footer built from the data pack: film page · TakeScore · lineage/honors · shooting atlas · misreadings · director. Only links known to resolve |
| On the cutting-room floor | The hour's rejected spikes | Up to 8 keywords we passed on this hour — each a source link + one dry editor's-note line on why it's off the beat. The anti-abuse posture made visible: we chose, and here's what we cut |

**Voice.** Wonwoo Yoon's studio voice: declarative, front-loaded, short paragraphs, zero filler, no em-dashes. Anthony Lane wit is welcome in the reading; it never touches the facts. Criticism targets works, structures, institutions — never private individuals' character (non-negotiable at any speed).

**Live-verified links only.** Films `metatake.net/film/<slug>` · readings `/take/<slug>` (published only) · tropes `/trope/<slug>` (published only) · lineage `/film/lineage/<slug>` · TakeScore `/takescore/film/<slug>`. Never invent a slug; the data pack carries the verified URLs.

## Anti-repetition (every generation call)

Digest of last 12 pieces: headline, anchor entity, modules used, opening/closing sentences. No entity reuse within 7 days (a true development excepted); no repeated headline shape or closing type; vary which modules lead.

## Publishing & review model

Auto-publish after the hard gate; Wonwoo reviews asynchronously (morning + evening sweep); `HOLD` file in this folder stops all publishing; pulled pieces logged with reason. The daily email (Substack) curates from this stream per its own 30-minute rules. Outreach emails remain 100% human-approved.

## The hold rule (FORECAST.md §4 — binding)

Daily cap stays at 4 until BOTH: (a) GSC shows `/now` pieces earning impressions/clicks at a materially better rate than the archive, and (b) ≥30% of section traffic is non-Google. Review at 12 weeks on leading indicators (impressions curve, Discover first-appearance, internal-link flow), not raw visits.

## SEO posture

`NewsArticle` JSON-LD (author → Wonwoo Yoon Person entity), visible timestamps, `max-image-preview:large`, news-sitemap (48h window) + `now.xml`, IndexNow. Target the query the searcher types (entity + event + "why/explained") — plus the film-history long tail no outlet writes. Prune or noindex zero-impression pieces after 14 days. Never index a killed piece.

---

*Signal stack: `TREND-SOURCES.md` · architecture: `DESIGN.md` · post-publish: `DISTRIBUTION.md` · evidence & expectations: `FORECAST.md`. Tune the recipe here; the pipeline reads this file at the start of every run.*
