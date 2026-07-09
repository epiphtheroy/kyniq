# Metatake TV — strategy, format & pipeline

**Canonical entry point is the root `HANDOFF-metatake-tv.md`** (status, file map, decision log,
invariants, traps, owner's part). THIS doc owns the enduring strategy detail: 2026 format
benchmarks, the Short↔long decision rubric, storyboards, SEO, and the anti-slop rationale.
Sister system: `HANDOFF-now-플레잉.md` (the text pieces this channel turns into video).

**Status (2026-07-09):** concept locked · **cinematic prototype built, deployed & self-verified**
(https://metatake.net/tv/marie-antoinette.html) · render+upload loop NOT yet wired
(blocked on: ffmpeg install + TTS choice + YouTube OAuth + channel).

---

## 1. The concept — one funnel, two formats

Metatake TV turns each Now Playing editor's letter (news spike + one archive film + the
data modules: poster/backdrop, TakeScore 0–100 with 13 sub-dimensions + corpus rank, honors
timeline, reception-by-year arc, connections graph) into faceless video.

**The drama is the data reversal, not a face.** No shouting, no reaction-face, no "ending
explained" recap. The archive's proprietary numbers ARE the story and ARE the anti-slop moat.

**Run Shorts and long-form as ONE funnel, not two channels:**
- **Short (20–45s, vertical)** = keyword-preemption net + discovery + subs volume. One data
  reveal, one reversal. Ends pointing at the long form.
- **Long (3–8 min, horizontal)** = the argued take + monetization (mid-roll ads unlock at 8 min).
  The data modules become chapters; each chapter title is a secondary keyword target.
- Each long-form seeds 3–5 Shorts (mine its single best number). Target mix 3–5 Shorts per long
  while under 100k subs.

## 2. Short-vs-long decision rubric (first "long" answer wins)

| Test | → SHORT | → LONG |
|---|---|---|
| Payload | resolves to ONE startling number/reversal | needs ≥3 data modules |
| Structure | a fact ("booed → Oscar, 9 months") | an argument with a turn ("...because the frame changed") |
| Data legibility | one figure readable at a glance in 9:16 | a table/timeline/graph to walk through |
| Search intent | high-volume curiosity ("why was X booed") | deliberate ("X explained / analysis / reception") |
| Spoiler load | spoiler-safe / teaser | needs full spoilers |
| Job in funnel | reach + keyword net + subs | depth, loyalty, watch-time, monetization |

## 3. Format craft (verified 2026 benchmarks — directional)

**Short:** hook complete by 2–2.5s (pattern-interrupt / bold-claim / question — faceless has no
face to carry a weak hook). Retention gates: past-3s >75%, midpoint >60%, avg %viewed >70%.
Pacing ~140 WPM (slower end so numbers land); new visual beat every 3–6s, never static past ~8s.
Burned-in **karaoke** captions (mute-first: 60%+ watched silent). No thumbnail, no end-screen
under 60s — bake one visual CTA into the last 3–5s; make the end loop back to frame one.

**Long:** cold-open hook (news spike + most surprising number) in 0–15s, hold 60%+ through it.
Stakes → data-modules-as-chapters (progressive reveal) → the take (the turn) → payoff + CTA.
Retention: <5min 65–75%, 5–10min 50–60%. Chapters add ~11% watch time AND are keyword real
estate. Watch-time math: 35% of 10min beats 60% of 3min — a rich take is worth 6–10 min.

**Data presentation:** reveal ONE number at a time (dial count-up 0→N, chart draws L→R, bars
grow). Never render all 13 sub-dims at once in 9:16 — show the 2–3 that carry the argument,
link the rest. Dim everything except the active row/edge.

**Music:** low, sparse, non-melodic bed under reveals; silence on the key number. (Controlled
studies find default music does NOT reliably beat none for data videos — restraint fits the brand.)

**Voice:** one consistent expressive neural narrator across the channel (flat TTS is a slop tell).

## 4. Titles / thumbnails / SEO (keyword preemption)

- Titles: keyword FIRST, 50–60 chars, first ~40 weighted most; keyword + angle beats bare keyword.
  Patterns: `Marie Antoinette (2006): Booed at Cannes, Then an Oscar` · `Marie Antoinette's TakeScore, Explained: 5,882 of 6,701`.
- **"[Film] ending explained" — use sparingly.** Highest-volume film keyword BUT most templated
  (slop silhouette), pulls low-loyalty spoiler intent, saturated by incumbents (The Take). Only
  when the ending is genuinely ambiguous AND you add an argued reading; differentiate as
  "…Explained by the Data." Don't build channel identity on it.
- Thumbnails (long only): one subject, one message, ≤3 words (<4 words ≈ +30% CTR; >3 elements ≈
  −23% CTR). Poster/backdrop crop + one data element (dial/reversal chart) + spotlight on THE number.
  Subtlety beats shock-face in 2026 — matches the brand. A/B up to 3 in Studio.
- Description: first 2 lines carry primary keyword; 3–7 links, lead with the film's record page on
  metatake.net; 3–5 hashtags; timestamped chapters on every long-form.
- Put site links in BOTH Shorts and long descriptions (separate ecosystems).

## 5. Platform risk (the real one)

YouTube's **July 15, 2025 "inauthentic content"** policy (renamed from "repetitious content") makes
mass-produced / templated / robotic-narration material monetization-ineligible, enforced
**channel-wide** (one bad batch taints the channel). It does NOT ban AI and explicitly does NOT
limit commentary / transformative work. Our defensible position = transformative analysis over
original data. Mitigations, all built into the format:

| Slop signal | Our counter |
|---|---|
| 50 near-identical templated videos | different archive film + different live spike each time; the argument changes |
| robotic narration over a slideshow | named author byline + an argued *turn* no template produces |
| stock assets, no research | proprietary TakeScore / 13 dims / rank / reception arc / connections graph |
| flat neutral TTS | one expressive consistent voice; deliberate silence |
| no creative fingerprint | consistent visual system (gilt, drawing charts, dimmed-graph reveals) |

Guardrails: keep a visible methodology/source line; vary structure so episodes aren't clones;
keep a human on the *take*; cadence **<10 uploads/day**, curate — do NOT auto-fire one video per
now-piece. **Reddit auto-posting stays OFF** (standing project rule). Add a synthetic-media
disclosure. Health signal to watch: return-viewer rate >10%. Most faceless channels monetize
between video 15–40 — plan ~30 before revenue.

## 6. Tech stack (near-zero cost)

| Stage | Choice | Cost |
|---|---|---|
| Script | Fable 5 rewrites the now-piece → VO + storyboard JSON | ~1–2¢/video |
| Voice | **Kokoro-82M** local neural TTS (Apache-2.0) — one consistent voice | $0 (one-time install) |
| Captions | **from our own script timing** — we author words + timings, so NO whisper needed | $0 |
| Visuals | **this HTML composition** rendered headless (Chrome screenshot loop, or Remotion) | $0 |
| Mux | ffmpeg: frames + VO + music bed → MP4 | $0 |
| Upload | YouTube Data API v3 `videos.insert` (1,600 units; 10k/day ≈ 6 uploads/day) | $0 |

Realistic all-in ≈ **$0–2 per video**. The whole thing stays inside the existing pure-Python-stdlib
pattern except: ffmpeg (system binary) and Kokoro (needs a Python venv with torch).

## 7. The pipeline (to build)

```
now_articles row  ──►  tv/script.py   (Fable 5 → {vo_lines[], timings[], on_screen[], title, desc, tags})
                                            │
                         tv/voice.py   (Kokoro → voiceover.wav, per-line durations feed back to timings)
                                            │
              tv/compose.html + tv/render.py  (headless Chrome captures the DOM at N fps → frames/)
                                            │
                          tv/mux.py     (ffmpeg: frames + voiceover.wav + bed.mp3 → out.mp4)
                                            │
                        tv/upload.py    (YouTube Data API v3 videos.insert, from title/desc/tags)
                                            │
                     back-write youtube_url onto now_articles  →  embed on /now/[slug] + film/director "In the news"
```

`prototype-marie-antoinette.html` IS the `compose.html` template, parameterized per film.

## 8. Prototype (done — cinematic rebuild, deployed, self-verified)

Live: **https://metatake.net/tv/marie-antoinette.html** (`public/tv/marie-antoinette.html`;
source `hourly/tv/prototype-marie-antoinette.html`). A ~39s 9:16 Short over **5 real film stills**
(base64-embedded to beat the image CSP), **Didot** display type, film grain + vignette + letterbox,
**hard-cut** scenes, data drawn ON the imagery (TakeScore dial 0→53, craft/polarizing bars,
reception arc 2006→2013), karaoke captions, optional browser-speech voice. This HTML IS the
render template. First (flat-gradient) draft was rejected on quality and fully replaced.

Self-verification (via Chrome MCP, all 6 scenes) caught & fixed: scene-bleed (→ hard cuts +
`visibility:hidden`), scene-4 too dark / low-contrast data (→ stronger scrim + white labels +
shadow + thicker bars), scene-6 end-card illegible over bright dress (→ dark end-card + repositioned
✦). See root handoff §3b (scene map) and §6 (invariants/traps). Real numbers verified 2026-07-09;
no fabrication (the research example's "Palme d'Or" is wrong — MA was booed at Cannes but did NOT
win it; true arc = booed → Oscar 2007 → reappraised).

## 9. Open decisions / owner's part

- [ ] Install **ffmpeg** (`brew install ffmpeg`) — required to render any MP4.
- [ ] Choose voice: **Kokoro** local ($0, one-time venv+torch) vs a cheap TTS API. Recommend Kokoro.
- [ ] Create the **Metatake TV** YouTube channel + a Google Cloud project → OAuth client (Data API v3).
      Only the owner can do this; agent cannot.
- [ ] Confirm launch film + whether episode 001 ships as Short-only or Short+long pair.
- [ ] Decide cadence (recommend: curate 1–3/day, never auto-one-per-piece).
