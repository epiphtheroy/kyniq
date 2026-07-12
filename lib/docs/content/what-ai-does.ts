const body = `
# What AI does, and doesn't do

People reasonably ask whether an AI wrote the readings on Metatake, and what a human had to do with them. We would rather answer plainly than let the question hang. The short version: AI drafts and connects; a human judges and answers for it. This page draws the line between the two — what the AI actually produces, what it is never allowed to decide, and who is on the record for every page that stands.

## In numbers

> **{{n:readings}}**
> close readings
> each one drafted by the AI, then read and signed off by a human before it publishes

> **1**
> editor of record
> one named person reviews every draft and answers for what stands on the site

## What the AI does

Two things, and they are both first drafts, not final words.

First, it **writes**. Metatake Editorial, our AI system, drafts the first version of every reading — it takes a figure a film keeps returning to and produces an interpretation of it under one of our interpretive frameworks. That draft is where a reading begins.

Second, it **connects**. Separately from the prose, the AI produces the embedding that places a reading among all the others — the point in meaning-space that lets one film sit near another because they are thinking about the same thing, not because someone filed them under the same label. The lines you follow between films, the kinship lists, the [counterpoints](/network): those are computed from these embeddings, not hand-drawn.

That is the whole of the machine's job. It proposes prose, and it proposes distances.

## What the AI does not do

It does not decide what stands on the site.

A draft is not a published page. Every reading, without exception, passes through the editorial desk — led by [Wonwoo Yoon](/editor) — before it goes live. In practice a human reads the draft, checks its factual claims — dates, credits, plot details, scholarly attributions — and then does one of three things: edits it, cuts it, or signs off on it. That final read sits on top of automated checks that flag the risky drafts first, so human attention lands where it is most needed rather than being spread thin across everything at once; the [full review pipeline is described here](/methodology/editorial-responsibility). Nothing publishes without that pass. If a reading is live on Metatake, a person has looked at it and taken responsibility for that specific page.

The embeddings get the same treatment at the layer above the individual reading. The AI computes the distances, but the rules for what counts as a connection, what gets shown, and how the whole thing is framed are editorial decisions, documented in the open. The machine measures; it does not set the policy on what the measurements mean.

The rule we keep repeating to ourselves is short enough to fit on a line: **the AI proposes; the editor disposes.**

## What that means for a byline

There are no individual per-page bylines on Metatake, and that is deliberate rather than evasive. A byline on each reading would suggest a single author sat down and wrote it from scratch, which is not what happened. Instead, every page states plainly how it was made and when, and points to the [editor](/editor) — the one person accountable for the method and for the standard each reading is held to. We would rather be honest about the process than dress an AI draft as a human essay, or hide a human's judgement behind a machine's output.

## What we decided, and why

A few calls here were not obvious, so here is how we settled them.

We let the AI **write and connect, but never publish**. It would have been faster to trust well-behaved drafts and spot-check a sample. We do not do that. Review is per-reading, because the failures that matter — a wrong date, a misattributed critic, a plot detail that is simply not in the film — do not announce themselves, and a sample would miss exactly the ones worth catching.

We keep the prose and the embedding **as two separate outputs**, not one. A reading can read well and still sit in the wrong place, or sit in the right place and still get a fact wrong. Splitting the two lets each be checked on its own terms rather than bundled into a single verdict.

We name **one editor**, not a masthead. Distributed accountability tends to become no accountability. One person answering for the whole standard is a stronger promise, even though it is a slower one.

## Limits

Human review catches factual errors and cuts drafts that do not earn their place. It does not turn a reading into settled truth — a reading is one interpretation a film can sustain, offered as a provocation, not a ruling, and a film sustains more than one. Review also does not make the editor the author of every sentence; the AI wrote the draft, and we say so. What review guarantees is narrower and, we think, more useful: that a person read the page, checked what could be checked, and put their name behind it.

---

> This page sits under the same [corrections](/methodology#corrections) loop as everything else: if a reading states a fact wrongly, tell us and we will fix it — facts get corrected, interpretations stay open.
`;
export default body;
