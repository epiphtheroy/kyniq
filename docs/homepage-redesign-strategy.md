# Metatake Homepage Redesign — Strategy & Concepts

*Prepared 2026-06-17. Design brief by a dedicated design-strategy pass, grounded in the live codebase (NodeGraph, RandomShowcase, `surp_rank` "unexpected kin", editorial CSS, `home_payload` RPC).*

**Problem:** today's homepage reads as a *table of contents for a database* — the eye lands on labels ("Latest readings," "Tropes," "Explore"), not on meaning. Nothing demonstrates the one thing only Metatake can do: show that two films you'd never pair are secretly the same film underneath. **The homepage should BE a take, not a menu that points at takes.**

## Design principles (rules every concept must obey)
1. **Prose is the hero; labels are the servant.** The first thing read is *real criticism*, never a section header.
2. **Perform an "unexpected kinship" in the first screen.** Show two surprising films + the connecting sentence at once (we already rank surprise via `meta_take_rankings.surp_rank`).
3. **No dead ends.** Every film/figure/reading/trope is a doorway with a count or connection visible ("connects 93 films," "×7") — counts signal infinite depth.
4. **One repeatable mechanic owns the page** (pull / shuffle / trace). Not five equal CTAs (that's the sitemap reflex).
5. **Motion proves the data is alive, never decorates** (reuse `take-flash`, `ngLineIn`; respect `prefers-reduced-motion`).
6. **Stay in the magazine, not the dashboard** — PT Serif, one red (#E3120B), hairlines, entity color-coding (readings red, figures blue), no emoji, no SaaS cards.
7. **Server-render the hook; hydrate the loop.** Wow content in SSR HTML (ISR `revalidate`); shuffle/redraw is a small client island.

## Concept A — The Constellation  *(effort: L)*
The homepage IS a living map. Center = one reading; hairline curves tie it to the films/readings/trope it relates to, drawing in on load. **Loop = pull a node:** click any node and the graph re-centers and redraws around it (reuses `graph_*_neighbors` + NodeGraph's animated redraw), surfacing a fresh connecting sentence each time. Not a sitemap: one self-reorganizing object, one verb, no sections. *Needs:* new `home_constellation()` RPC + a 2D/radial renderer (NodeGraph is currently a vertical rail). *Risk:* graph can read as "tech-demo/hairball" and is hard on mobile → cap nodes, precomputed radial layout, collapse to a "pull" list on mobile.

## Concept B — The Reveal  *(effort: S–M)* — RECOMMENDED hero
A full-screen, ever-changing "these two films are the same film." Hero = **Film A ↔ Film B** in big serif, the shared reading, and one real take from each side, so you *see* the kinship in the criticism. **Loop = one more reveal:** a single "Show me another →" cross-dissolves to a new improbable pairing drawn from high-surprise kinships (reuses the `RandomShowcase` shuffle + anon RPC, reconceived to shuffle a *pairing*, the most surprising unit we have). A slot machine for "huh, I never thought of those two together." Not a sitemap: one bold claim + a button that makes another. *Needs:* new `random_kinship()` RPC (two films under one reading + a take each, biased by `surp_rank`); seed the first card server-side. *Risk:* repetition fatigue → weight by surprise + recency de-dup; "Follow this thread" off-ramp into real depth.

## Concept C — The Reading Room  *(effort: M)*
A confident literary front page where the criticism IS the layout (New-Yorker-meets-Economist). Lead = a figure as a standfirst with a drop-capped take; every noun in the prose is a live color-coded thread; a margin note shows "also in 92 films →." **Loop = trace the thread:** tap an inline figure → the same figure's takes in three other films appear in the margin (reuses `graph_meta_take_siblings`), each itself threaded — TVTropes' blue-link compulsion, but every link pays out in *criticism*. Not a sitemap: it lists *ideas* in full sentences, the rabbit hole is *inside the text*. *Needs:* inline "figure peek" client component + a prose-dense `home_room()` RPC. Most of the editorial CSS already exists. *Risk:* "beautiful but static" if the trace is hidden → pre-expand one figure on load.

## Recommendation — B-led hybrid on a C foundation
Ship **Concept B's ↔ Reveal as the hero**, **Concept C's broadsheet below the fold.** B gives the strongest single WOW with the least new infrastructure (the shuffle already exists; only a new `random_kinship()` RPC). C's body — almost entirely pre-built CSS, fully server-rendered for SEO — turns "one more click" into "now I'm reading." The progression *toy hooks you above the fold → magazine keeps you below it* IS the rabbit hole. A (Constellation) is the most spectacular but riskiest/most expensive — keep as a later signature, not v1.

**Prototype first:** `random_kinship()` RPC + the static ↔ card (server-seeded, no animation). Then add the cross-dissolve shuffle. Then drop in C's broadsheet.

## Signature flourish (later) — "The Thread"
A detective's-corkboard red string, executed with restraint: as a visitor travels (reading → film → figure → film), a thin red line accumulates in a slim bottom rail, recording the path they pulled — *their own* constellation, drawn live. A "this is the thread you pulled tonight" share-card turns a session into an artifact. Session-memory now (no localStorage); syncs for signed-in users later via the existing follow/like plumbing. This is where Concept A's graph energy eventually lives — earned through use, literary not techy, unmistakably Metatake's "thing."
