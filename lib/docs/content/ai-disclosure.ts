const body = `
# AI disclosure

People reasonably ask how much of Metatake an AI wrote. The honest answer is that it depends entirely on which layer you are looking at — some parts are AI-drafted and publish as drafted, some are computed by a model, and a good deal of the site touches no language model at all. The system that does the drafting and the computing is called **Metatake AI** (formerly styled Metatake Editorial); the method it works to is designed and directed by [Wonwoo Yoon](/editor), who answers for what publishes. Rather than give one blanket answer, this page maps it out, layer by layer — with the credit each layer carries — so a sceptic can check the claim against the specific thing in front of them.

## In numbers

> **{{n:readings}}**
> close readings
> each drafted by Metatake AI under a named framework, and published without a human reading it first

> **{{n:kin_edges}}**
> film-to-film connections
> computed from embeddings and shared tropes, never hand-weighted

## The worry, and where we stand

We know why people flinch at "AI-written," and we do not think the flinch is silly. The open web is filling with machine-made text produced for no reason except to exist — pages spun up by the thousand to catch a search query, say nothing, and move on. That concern is well founded, and we share it. But look closely at what the worry is actually about: it is about *indiscriminate mass-production* — writing with no reader in mind and no one answering for it. On inspection, it is not about the tool.

Our position is that the tool itself matters, and nowhere more than here. Film interpretation is among the most abstract and most human things we do with our minds: it runs on imagination, on emotional intelligence, on the ability to hold a whole work in view and say what it is *really* about. Watching a language model reach into that domain — not to summarise a plot but to venture a reading, to seize a small figure and press it until it yields something the film never says aloud — is genuinely worth doing, and worth watching with care. The narrow question was never "did a machine write this?" The real one is whether a machine can help *build, systematise and deepen a whole field of thought* — and what the picture looks like when it tries to draw in a register this human.

So we treat Metatake as a sustained experiment in exactly that, run in the open and under a person's responsibility. We are not defending AI writing in the abstract; we are refusing indiscriminate mass-production while keeping the tool, and we would rather show the difference than assert it. The rest of this page is the accounting — layer by layer — of where a model drafts, where it computes, and where it never appears at all.

## Layer by layer

Here is every layer that produces something you read on a page, and exactly how it is made. We have tried to be precise about the difference between *drafted by AI*, *computed by a model*, and *assembled by fixed rules with no model in the loop at all*. The last column is the credit that layer carries on the page, so you can match the line at the foot of what you are reading to the row that made it.

| Layer | How it is made | Credit |
|---|---|---|
| **Close readings** | Metatake AI drafts each reading under a named interpretive framework, and it publishes as drafted. No person reads it before you do: at this scale nobody vets tens of thousands of pages one by one, and we will not pretend otherwise. What stands behind the page is the method rather than a signature — the frameworks are [Wonwoo Yoon](/editor)'s, he answers for what they produce, and he will retire a reading that cannot survive a correction. | **A** — Written by Metatake AI |
| **Desk essays** | Metatake AI drafts the longer-form essays that sit beside a film. Each draft is independently verified against the facts and either passed or cut — nothing publishes on the model's say-so alone. | **A** — Written by Metatake AI |
| **The embedding map and connections** | Computed. Each reading becomes an embedding — a position in meaning-space derived from its own text — and the [connections](/network) between films are worked out from those positions plus shared [tropes](/tropes). A model produces the embeddings; no human hand-tags the lines, and no editor weights a connection. | **C** — AI-computed by Metatake AI |
| **to.W index notes** | Assembled by fixed rules, **no language model**. Each film is filed on a handful of plain axes — its standing in the critics' canon, how widely it is known, which door it came in through — plus a verdict that follows in the first place from its computed [TakeScore](/takescore) value. Those filings are stitched into English by a template: same filings in, same sentence out. The letter reads out a filing; no model writes its prose. | **B** — Composed by the Metatake method |
| **The sentence layer** | Assembled by fixed rules, **no language model**. The hundreds of thousands of connective sentences across the site are generated directly from the database — every named film, figure and theorist is a real record — with no model writing prose. It is labelled on the page as exactly that, and independent of the filmmakers' intent. | **B** — Composed by the Metatake method |
| **Per-film misreadings articles** | Reassembled by rule from readings that already exist. These articles do not commission new AI writing; they re-arrange close readings that already stand on the site into a per-film piece. The readings they are built from are AI-drafted, as the first row says. | **B** — Composed by the Metatake method, from **A** material |
| **Where-to-watch and reception** | Assembled by rule from stored data. Streaming availability and the reception record are compiled from data we already hold and rendered by template — no model authors them. | **B** — Composed by the Metatake method |
| **TakeScore** | Metatake AI scores a film's value against its cost and risk, against a rubric locked to a version; a human calibrates and audits the result, and the [TakeScore](/takescore) pages publish the reliability of that scoring openly rather than presenting a bare number as settled fact. | **C** — AI-computed by Metatake AI |
| **Where-to-start director picks** | Drafted by Metatake AI. The route through a director's films — which titles, in which order, the part each one plays, and the reason attached to it — is drafted by a model from that director's filmography as we hold it, and the same is true of the reasons on the who's-next picks. The model chooses only from films already in the database; it cannot invent a title. Nothing is generated when you load the page: the page reads a stored draft. | **A** — Written by Metatake AI |
| **Lineage and locations** | Compiled and verified. [Lineage](/lineage) files each film against awards, canons and national cinemas by complete enumeration, resolved to a single film identity — no model in the loop at any stage. [Locations](/methodology/locations) are researched from public sources and production records, geolocated and labelled by precision. A pin ships only if independent sources agree: two different domains corroborate it or it does not publish — a single-source claim is quarantined, not printed. The scene a pin holds is extracted from those records by a model upstream, so the record carries model-written fields even though nothing is generated at render; the corroboration rule is what stands behind them. Both are records, not readings — no model decides what belongs. | **B** — Composed by the Metatake method |

**A** means a language model wrote the first version. **B** means no language model wrote the sentence you are reading — fixed rules assembled it out of stored data, and the same inputs always produce the same sentence. It is not a claim that no model ever touched a value inside those rows: some inputs are extracted by a model upstream, and where that is true the layer's own page says so. **C** means a model computed a number or a position and wrote nothing. Each credit carries a second half naming the person who designed the method and answers for the page — [Wonwoo Yoon](/editor). The wording changes with the work, because the work differs: he sets the frameworks the readings are drafted under, supervises the assembled layers, and calibrates the computed ones. In every case he answers for the result; in none of them does he read the page before you do.

## What we decided, and why

The line we hold everywhere is simple: **AI may draft and it may compute, but a person designs the method and answers for what it produces.** Where a language model writes a first version — close readings, desk essays, the director routes — the page says so in the credit at its foot, and that credit names the person accountable for it rather than implying he wrote the page or read it first. How that line is drawn, and the credit each layer earns because of it, is set out in [What AI does, and doesn't do](/methodology/what-ai-does). Where a model computes rather than writes — embeddings, TakeScore — we say so plainly and, in TakeScore's case, publish how reliable the computation is. And a large part of the site deliberately uses **no model at all** for the writing: the index notes, the sentence layer, reception, where-to-watch and the lineage and locations records are assembled from stored data by fixed rules, so that the same inputs always yield the same output and nothing drifts. That is a claim about the prose, not about every number behind it — an index note is written by rule, but the verdict it reads out is computed.

We keep the rule-assembled layers labelled as such on their own pages, because a reader deserves to know when a sentence was written by a template rather than drafted by a model. Calling everything "AI" would be as misleading as calling nothing AI.

## Limits

This page describes *how* each layer is made, not a guarantee that every line is right. An AI-drafted reading can carry a mistake onto the page with nobody having read it first; a computed connection can be built on a mislabelled trope; a rule-assembled note is only as good as the filing behind it. What we promise is the process above and the correction loop below — not infallibility. Interpretations, too, stay open: we correct facts, but we do not flatten a reading because someone disagrees with it.

---

> Every layer here sits under the same [corrections](/methodology#corrections) loop: if something is factually wrong — a date, a credit, a mislabelled source, a note filed under the wrong standing — tell us and we will fix the row.
`;
export default body;
