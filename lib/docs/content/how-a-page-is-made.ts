const body = `
# How a page is made

A film page on Metatake is not written in one pass. It is built up from small readings, each of which travels the same route before you ever see it. This page describes that route: the five stages every reading passes through, and the separate, harder gate the longer desk essays have to clear.

## In numbers

> **{{n:readings}}**
> close readings
> each drafted under a named framework, and published without a human reading it first

> **{{n:figures}}**
> figures read closely
> the unit we work on — an object, gesture, colour or recurring device pulled out of a film

## The five stages

Every reading passes through the same five stages, and nothing skips a step. There are five and not six because there is no human review stage: the route from a model's draft to the page in front of you has no person standing in it, and the honest way to describe a route is to leave out the checkpoint that isn't there.

**1. Film breakdown.** We decompose a film into its *figures* — the objects, gestures, colours and recurring devices worth reading closely. Figures are the unit of analysis; a page is only as good as the figures it is built on.

**2. Drafting, by framework.** Our editorial engine writes a first version of a reading of each figure under one of fourteen interpretive frameworks. Different frameworks read the same figure differently, on purpose, so a film sustains more than one honest reading rather than a single settled verdict.

**3. Scholarly anchoring, where it applies.** Some readings are anchored to a specific piece of published film scholarship, and where they are, we credit the source rather than passing the idea off as our own. Most readings are original interpretations in their own right, built the way this page describes.

**4. Publication.** The reading publishes as drafted. There is no review queue and no sign-off: the draft the model wrote is the page you read, and no person read it in between. At this scale the alternative was never a careful human pass over every reading — it was the pretence of one, and we would rather describe the route we actually run. What stands behind the page instead is the design of stages 1–3 and the correction loop in stage 5. Who answers for that, and how one person can, is covered in [editorial responsibility](/methodology/editorial-responsibility).

**5. Audit and correction.** Publication is not the end; on this route it is where the scrutiny starts. We and our readers keep checking pages against the facts, the editor can retire any reading at any moment, and this loop runs continuously — see [corrections](/methodology#corrections).

## The desk essays: an adversarial second pass

Alongside the short readings, some films carry longer [desk essays](/network) — a fan-theory piece, a decoding of a puzzling scene, an accuracy audit. These are held to a stricter standard than any single reading, because they make more claims: unlike a short reading, an essay has to clear a gate before it publishes.

Once a draft is written, an **independent verifier reads it adversarially** — its job is to break the piece, not to bless it. The draft has to clear two different kinds of gate.

The first is a **content and fact check**, and it hard-fails. A concept attributed to the wrong theorist, a term the theorist never coined, a claim about what happens on screen that is simply wrong, a real-world claim that cannot be sourced — any one of these fails the essay outright. These are not style notes; they are grounds for rejection.

The second is a set of **lightweight machine checks** — that the piece has the structure its desk requires, that its internal links resolve, that it hasn't padded itself into a listicle. These catch the mechanical faults cheaply, so the fact check spends its attention on the claims.

A failing draft is sent back with its violations attached and **rewritten at most twice**. If it still fails, it is killed — the film simply doesn't get that essay, rather than getting a weak one. Roughly **one draft in five fails its first check**; most are recovered on rewrite, and the rest are dropped without appeal.

What survives is what you read. A desk essay's prose is not edited after it has been verified, so the page you see is the version that actually passed. Each one carries its **verification date and the name of the engine that wrote it**, printed on the page, so the record of how it was made travels with it.

## What we decided, and why

A few calls here were deliberate. We chose to **kill rather than salvage** an essay that fails twice, because a corner that fills a quota with weak pieces stops being worth reading; an empty slot is more honest than a padded one. We chose to keep the **verifier independent of the writer** rather than let a draft mark its own work. And we chose to **publish the engine name and the failure rate** rather than imply the pages wrote themselves — a reader is owed the knowledge that a machine drafted the words and a person stood behind them.

## Limits

This process guards provenance more than it guards accuracy, and it does not turn a reading into the truth. On the short readings there is no gate before publication at all: a wrong date or a misattributed idea can reach the page and stay there until stage 5 catches it, which is a real cost and the reason the corrections loop is not decoration. What the route does not do, deliberately, is flatten an interpretation because someone would read the figure differently. A film sustains more than one strong reading, and we would rather show a defensible one than pretend to the last word. The machine checks confirm that a page is well-formed, not that it is wise. And coverage is uneven by design: a desk only commissions an essay a film can genuinely hold, so a bare page usually means we had nothing worth saying, not that we forgot.

---

> Everything here sits under the same [corrections](/methodology#corrections) loop: if a page states something factually wrong — a date, a credit, a plot detail, a mischaracterised source — tell us and we will fix it.
`;
export default body;
