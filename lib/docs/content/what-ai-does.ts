const body = `
# What AI does, and doesn't do

People reasonably ask whether an AI wrote the readings on Metatake, and what a human had to do with them. We would rather answer plainly than let the question hang. The short version: AI drafts and connects, and what it drafts publishes; a named person designed the method it works to and answers for what it produces. This page draws the line between the two — what the AI actually produces, what it never gets to decide, and who is on the record for every page that stands. It covers the readings and the connections; for a layer-by-layer accounting of the whole site, including the parts that touch no model at all, see the [AI disclosure](/methodology/ai-disclosure).

## In numbers

> **{{n:readings}}**
> close readings
> each one drafted by the AI under a named framework, and published without a human reading it first

> **1**
> editor of record
> one named person designed the method and answers for what stands on the site

## What the AI does

Two things: it writes, and it measures.

First, it **writes**. Metatake AI, our purpose-built system, drafts the first version of every reading — it takes a figure a film keeps returning to and produces an interpretation of it under one of our interpretive frameworks. That draft is the reading: what it writes is what publishes.

Second, it **connects**. Separately from the prose, the AI produces the embedding that places a reading among all the others — the point in meaning-space that lets one film sit near another because they are thinking about the same thing, not because someone filed them under the same label. The lines you follow between films, the kinship lists, the [counterpoints](/network): those are computed from these embeddings, not hand-drawn.

That is the whole of the machine's job. It writes prose, and it measures distances.

## What the AI does not do

It does not decide the terms it works on.

Be clear about what this does not mean. It does not mean a person reads each reading before it publishes: nobody does. A reading is drafted under a framework and goes live as drafted, and there is no queue where a human sits between the draft and the page. We could claim otherwise and few readers could check it; the claim would be false, and a site that argues for reading closely should not need to be read carelessly to be believed.

What the AI does not get to decide is the standard. The frameworks a reading is written under, what counts as a figure worth reading, what the site is for and what it will not do — those were set by [Wonwoo Yoon](/editor) before any draft existed, and he answers for what they produce. He can retire any reading at any moment. Corrections land on his desk and the fix is public. That is a narrower promise than a per-page signature, and it has the advantage of being true.

The embeddings get the same treatment at the layer above the individual reading. The AI computes the distances, but the rules for what counts as a connection, what gets shown, and how the whole thing is framed are editorial decisions, documented in the open. The machine measures; it does not set the policy on what the measurements mean.

The rule we keep repeating to ourselves is short enough to fit on a line: **the AI writes it; a named person answers for it.**

## What that means for a credit

A page that carries a reading carries a credit naming how the reading was made — and the credit follows the layer that made it. Not one line repeated everywhere: the site is not made one way, and a single stamp across all of it would be its own kind of lie. A catalog record assembled out of dates and credits gets no authorship credit at all, because nobody and nothing authored it.

Where a language model drafted the prose — the readings, the desk essays, the letters — it reads **Written by Metatake AI · designed by [Wonwoo Yoon](/editor), who answers for it**.

Where the sentences on the page were assembled by rule rather than written — the sentence layer, the catalogue records, the availability reports — it reads **Composed by the Metatake method — no language model · designed & supervised by Wonwoo Yoon**. The claim is about the assembly, and it is exact: a rule wrote the sentence you are reading. It is not a claim that no model touched anything upstream, and where such a layer quotes a written line it marks it as a quotation rather than passing it off as assembly.

Where the machine produced a number rather than a sentence — TakeScore, the embeddings behind every connection — it reads **AI-computed by Metatake AI against a version-locked rubric · designed and calibrated by Wonwoo Yoon**.

And where a person sat down and wrote the thing themselves, it carries that person's name and no machine credit at all.

Both halves of a credit are load-bearing. The first says what made the page. The second names the human who designed the method, directed it, and answers for what it produced. A credit with only the first half would be an abdication; one with only the second would be the dressing-up we refuse.

That refusal is the older half of this argument. This section used to say Metatake carried no per-page bylines at all — on the grounds that a byline implies a single author sat down and wrote from scratch, and we would not dress an AI draft as a human essay or hide a human's judgement behind a machine's output. That reasoning still holds. The conclusion drawn from it was too blunt: the answer to *don't pass a machine draft off as a human essay* is not to print nothing, it is to print what actually happened. The principle has not moved. It is now on the page instead of buried in a document like this one.

## What we decided, and why

A few calls here were not obvious, so here is how we settled them.

We let the AI **write and publish**, and we say so rather than implying a reader we do not have. The alternative was not a slower, more careful site; it was the same site with a sign-off ritual bolted to the front of it, and a claim we could not honour on a corpus this size. The failures that matter — a wrong date, a misattributed critic, a plot detail that is simply not in the film — do not announce themselves, so we put the effort into the correction loop, which runs forever, rather than into a gate we would have had to fake.

We keep the prose and the embedding **as two separate outputs**, not one. A reading can read well and still sit in the wrong place, or sit in the right place and still get a fact wrong. Splitting the two lets each be corrected on its own terms: a bad fact can be fixed without moving the film in the map, and a film can be moved without rewriting the reading.

We name **one editor**, not a masthead. Distributed accountability tends to become no accountability. One person answering for the whole standard is a stronger promise, even though it is a slower one.

## Limits

Nothing here guarantees a reading is right. No one read it before you did, so an error can reach the page and sit there until someone reports it — that is the cost of the arrangement, and we would rather name it than dress it. Nor does a reading settle anything: it is one interpretation a film can sustain, offered as a provocation, not a ruling, and a film sustains more than one. What we do promise is narrower and, we think, more useful: the method is published, the credit says a machine wrote the page, one named person answers for it, and a fact we get wrong gets fixed in public.

---

> This page sits under the same [corrections](/methodology#corrections) loop as everything else: if a reading states a fact wrongly, tell us and we will fix it — facts get corrected, interpretations stay open.
`;
export default body;
