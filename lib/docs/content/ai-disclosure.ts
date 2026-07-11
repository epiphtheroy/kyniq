const body = `
# AI disclosure

People reasonably ask how much of Metatake an AI wrote. The honest answer is that it depends entirely on which layer you are looking at — some parts are AI-drafted and then judged by a human, some are computed by a model, and a good deal of the site touches no language model at all. Rather than give one blanket answer, this page maps it out, layer by layer, so a sceptic can check the claim against the specific thing in front of them.

## In numbers

> **{{n:readings}}**
> close readings
> each AI-drafted, then read, edited or cut by a human before it publishes

> **{{n:kin_edges}}**
> kinship connections
> computed from embeddings and shared tropes, never hand-weighted

## Layer by layer

Here is every layer that produces something you read on a page, and exactly how it is made. We have tried to be precise about the difference between *drafted by AI and approved by a person*, *computed by a model*, and *assembled by fixed rules with no model in the loop at all*.

| Layer | How it is made |
|---|---|
| **Close readings** | AI drafts a first version of each reading under a named interpretive framework. Every one is then read, checked for accuracy and either edited or cut by a human editor before it goes live. If a reading is published, a person has signed off on that specific page. |
| **Desk essays** | AI drafts the longer-form essays that sit beside a film. Each draft is independently verified against the facts and either passed or killed — nothing publishes on the model's say-so alone. |
| **The embedding map and connections** | Computed. Each reading becomes an embedding — a position in meaning-space derived from its own text — and the [connections](/network) between films are worked out from those positions plus shared [tropes](/tropes). A model produces the embeddings; no human hand-tags the lines, and no editor weights a connection. |
| **to.W index notes** | Assembled by fixed rules, **no language model**. Each film is filed on a handful of plain axes — its standing in the critics' canon, how widely it is known, which door it came in through — and those filings are stitched into English by a template. Same filings in, same sentence out. |
| **The sentence layer** | Assembled by fixed rules, **no language model**. The hundreds of thousands of connective sentences across the site are generated directly from the database — every named film, figure and theorist is a real record — with no model writing prose. It is labelled on the page as exactly that, and independent of the filmmakers' intent. |
| **Per-film misreadings articles** | Reassembled by rule from readings that already exist. These articles do not commission new AI writing; they re-arrange close readings the editor has already reviewed into a per-film piece. |
| **Where-to-watch and reception** | Assembled by rule from stored data. Streaming availability and the reception record are compiled from data we already hold and rendered by template — no model authors them. |
| **TakeScore** | AI scores a film's value against its cost and risk; a human audits the result, and the [TakeScore](/takescore) pages publish the reliability of that scoring openly rather than presenting a bare number as settled fact. |
| **Where-to-start director picks** | Curated by a human hand. The "start here" selections for a director are chosen by a person, not generated. |
| **Lineage and locations** | Compiled and verified. [Lineage](/lineage) files each film against awards, canons and national cinemas by complete enumeration, resolved to a single film identity; [locations](/methodology/locations) are researched, geolocated and labelled by precision. Both are records, not readings — no model decides what belongs. |

## What we decided, and why

The line we hold everywhere is simple: **AI may draft and it may compute, but a human decides what stands.** Where a language model writes a first version — close readings, desk essays — a person reads it, checks its factual claims, and takes responsibility for the published page. Where a model computes rather than writes — embeddings, TakeScore — we say so plainly and, in TakeScore's case, publish how reliable the computation is. And a large part of the site deliberately uses **no model at all**: the index notes, the sentence layer, reception, where-to-watch and the lineage and locations records are assembled from stored data by fixed rules, so that the same inputs always yield the same output and nothing drifts.

We keep the rule-assembled layers labelled as such on their own pages, because a reader deserves to know when a sentence was written by a template rather than judged by an editor. Calling everything "AI" would be as misleading as calling nothing AI.

## Limits

This page describes *how* each layer is made, not a guarantee that every line is right. AI-drafted readings can still carry a mistake past review; a computed connection can be built on a mislabelled trope; a rule-assembled note is only as good as the filing behind it. What we promise is the process above and the correction loop below — not infallibility. Interpretations, too, stay open: we correct facts, but we do not flatten a reading because someone disagrees with it.

---

> Every layer here sits under the same [corrections](/methodology#corrections) loop: if something is factually wrong — a date, a credit, a mislabelled source, a note filed under the wrong standing — tell us and we will fix the row.
`;
export default body;
