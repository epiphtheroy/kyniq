# Trope Re-formation — design (critic-gated, Strong-Misreading clusters)

_Phase B of the new model. Replaces the old figure_type tropes (1,421, many giants) with
critic-gated coded tropes formed from the 26,975 Strong Misreadings. Canon: CONCEPT-tropes-and-strong-misreadings.md._

## The unit
A **trope = a recurring CODE** read off the Strong Misreadings. The atomic input is the
**misreading** (a non-invitation take: `take_title` + thesis), not the figure. A misreading that
recurs across films *is* a trope-in-the-making. Singular misreadings = **Noble** (no trope).

## Pipeline as built (worker `trope-form.py` + `trope-gate-batch.py`), run in order

**A. Embed** (`mt-embed.py`, done) — 25,041 misreadings on take_title+thesis · 18,168 figures. ✓

**Stage 1 — candidate clusters** (`cluster`/`sweep`, numpy, no LLM). **Method = `twopass`** (chosen
over leader/knn): leader **cores at τ_core=0.64** (clusters never merge → no giant blob), then
**edge-absorb** singletons into the nearest core at **τ_attach=0.50** (knn union-find was rejected —
single-linkage percolated into one 20k blob). Result: **3,610 multi-clusters + 731 Noble**, cohesion
median 0.80, largest 103. Writes `trope-clusters.json`.

**Stage 2 — critic gate + naming** (`emit` → `trope-gate-batch.py submit/fetch`, Opus Batch ≈50%).
- `emit`: small clusters (≤25) sent whole; **big clusters (>25) k-means pre-split** by cohesion into
  ≤~18 so naming stays focused (82 split). **3,725 requests, ≈$16.** Writes requests + a
  `custom_id→take_ids` map.
- The critic, per cluster: is this ONE code, SEVERAL, or bare/incoherent? Evocative **≤8-word name**
  stating the code (Thompson/Bloom strikingness) + laconic + **note (the code, 1–2 sentences)** + the
  member indices that belong (drop the rest). Pilot confirmed naming quality is high.
- `finalize`: applies results; **a trope needs ≥2 members AND ≥2 distinct films** (single-film pairs
  and 1-member split-offs → Noble). Computes cohesion; writes `trope-plan.json`.

**Stage 4 — global harmonize** (`harmonize`, Opus, content-aware) — *the "one intelligence remembers
& revises" layer, run over the compact name layer, not the 25k readings.* Finds near-identical tropes
by **centroid embedding** (catches same-code/different-name), then the LLM, given each trope's
**name+laconic+note+sample readings**, **merges** true duplicates / **differentiates** collisions /
leaves the rest **linked as similar**. Conservative (won't undo deliberate gate splits — the notes
show the distinction). Writes `trope-plan-harmonized.json` (final tropes + `similar_edges`). Resumable.

**Maturity** (in finalize/harmonize) from **distinct-film count** + cohesion: Fresh 2–3 · Emerging
4–8 · Established 9–25 · Cliché >25 (Noble = singular, not a trope row). **trope_kind=`misreading`**.

## Persistence (reversible; replaces old tropes)
- Migration: add `maturity text`, `trope_kind text`, `cohesion real`, `member_count int` to
  meta_takes; snapshot old figure_type tropes + members.
- Retire old `kind='figure_type'` tropes (`status='retired'`) + clear their `figure_type_members`.
- Insert new tropes as `kind='figure_type'` (so existing UI keeps working) + `trope_kind`,
  `maturity`, `critic_approved_by='trope-form/opus'`.
- **Membership is at the reading (take) level.** Each Strong Misreading belongs to exactly one
  trope (the cluster it fell in) → store `takes.trope_id` (nullable; null = Noble). The trope hub
  then shows the *actual readings* (take_title + film), not just figure labels.
- **One figure → many tropes (by design).** A figure carries several Strong Misreadings (one per
  framework), and those readings can land in different clusters — so a figure belongs to as many
  tropes as its readings do. (Already true in the old model; now it falls out naturally.)
- Also populate `figure_type_members` = the **distinct figures** per trope (derived from
  `takes.trope_id` → figure_id), so the existing figure-page "Type" line / film-page Tropes /
  connected-figures keep working unchanged.
- `meta_take_edges` ← similar-trope links.

## App (Phase B app step)
- Trope hub + /tropes: **maturity badge** + kind + members (films/figures) + **many similar tropes**.
- Figure/film "Type" links already target `/trope/[slug]` → now resolve to new tropes.
- **Noble** misreadings: a "Noble" badge on the figure-page card (no separate page), per canon.

## Knobs to tune in DRY (Stage 1 first)
τ (leader threshold) · min cohesion for Fresh · max sample members sent to critic · model
(Opus vs Sonnet) · whether to also form convention/device tropes from figure clusters.

## Decided with the editor (2026-06-23)
- **No count cap.** The 70 target is dropped — meaningless under the new model. Trope count is
  emergent from the strikingness gate + maturity bands.
- **Cohesion held at a sound level, naturally.** Tune τ so clusters are genuinely tight, but
  **never force a split or a merge** to hit a number. A cluster is whatever coheres; a singleton
  stays Noble. We do not break a coherent large cluster just because it is large, nor glue weak
  ones together.
- **Naming is the priority.** The ≤8-word name must state the *code* (Bloom/Thompson strikingness),
  evocative and exact — this is where the critic's effort goes. A trope earns its place by a name
  that makes the gathered set feel uncanny, not by size.

---
## The whole MetaTake pipeline (where this sits)
1. **Films → Figures → Strong Misreadings.** 1,957 films; each film broken into figures; each figure
   carries bold readings (14 frameworks) + one spoiler-free **Invitation**. ✓ generated (Batch) +
   ✓ **loaded** (26,975 published takes; 46,503 old serial takes retired; +3,974 figures).
2. **App on the new model.** ✓ live: film page (Invitation + Strong Misreadings by framework family),
   figure page (reading cards), About manifesto, `lib/frameworks.ts`. *Pending:* secondary surfaces
   (Latest/Trending/Home/Ask) + footer/nav still on old register style.
3. **Embeddings.** ✓ takes + figures embedded.
4. **Trope re-formation (THIS doc).** cluster(twopass) → gate(batch) → finalize → harmonize. ⏳ in
   progress (batch submitted).
5. **Persist tropes** — snapshot; retire old figure_type tropes; insert new (kind=figure_type +
   trope_kind + maturity); `takes.trope_id` + derived `figure_type_members`; `meta_take_edges`
   (similar). Reversible. ⏳ next, after harmonize review.
6. **Theory layer** — theorist/concept on takes → canon/families → `/concept`·ScholarHeader.
7. **Rank / recommend / affinities** on the new layer.
8. **App overhaul finish** — trope hub (maturity/kind/similar), Noble badge, secondary surfaces,
   nav, footer.
9. **SEO + deploy + integrity verify.**
_Deferred (editor): home/identity redesign, framework demotion-to-facet UX, similar-trope UX._

## Status / run order (current)
✓ embed · ✓ cluster(twopass 0.64/0.50) · ✓ gate pilot (naming good) · ⏳ **gate batch submitted** →
next: `run-trope-gate-fetch.command` (re-run until ended; auto-finalizes) → review `trope-plan.json`
→ `run-trope-harmonize.command` → review → **persist** (build next).
