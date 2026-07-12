const body = `
# Reliability and confidence
Every [TakeScore](/takescore) is produced by a language model, and language models are not bit-deterministic. We do not pretend otherwise. Instead of claiming the score is fixed, we measure how much it moves, publish those numbers, and tell you on each film how much to trust the figure. This page explains the machinery: how we test that repeated scoring agrees, how borderline scores get a second look, and what the three confidence tiers mean.

## Why we do not claim determinism
A hosted model does not return the same answer every time, even with sampling turned all the way down. The cause is not our code; it is the way requests are batched and routed on shared inference hardware, so the order of operations shifts with other traffic. Studies of repeated runs find that a large share of tasks never reproduce their output exactly. Hosted models also change underneath you when the version moves. So the honest question is not "is it deterministic" — it is not — but "how far does it vary, and can we hold that variance small enough to publish."

## How we measure agreement
We answer that with two tests, both run on real films rather than in theory.

**Repeat agreement.** We score the same films several times and compare the runs. Because each film is judged on thirteen separate sub-dimensions rather than one holistic number, the variation is penned into small slots. In our checks the runs agree very tightly — an intraclass correlation near **0.99**, with the spread of any single film's Value across runs close to a single point on a hundred-point scale.

**Cross-model agreement.** A single model can quietly favour its own style, so we also compare a panel of models from different makers scoring the same films. The panel agrees strongly, at a Krippendorff's alpha around **0.96**. When several independent models land in the same place, the score is much less likely to be a quirk of any one model.

## In numbers
> **~0.99**
> repeat-run agreement
> intraclass correlation when the same film is scored again — the figure barely moves

> **~0.96**
> cross-model agreement
> Krippendorff's alpha across a panel of models from different makers

## Flag, then rescore
Most films are settled in one pass. The exceptions are caught and sent back for more work, without our hand on the scale.

- A score sitting **near a band boundary** — where a small wobble would flip it into the neighbouring grade — is flagged and rescored several times, and we take the median so no single run decides it.
- A score that came back with **high run-to-run spread** gets the same treatment: more samples, median kept.
- When the **panel disagrees** with itself beyond what we consider settled, the film is escalated, and if it still will not converge it goes to a person.
- A **random audit slice** of the catalogue is rescored with a stronger model than the one used for the main pass, purely to check the main pass against a harder judge.
- Anything the parser cannot read cleanly is retried and, failing that, held out rather than published as a guess.

## The drift gate
Because the model can shift when its version changes, we keep a fixed control set of films whose grades we already agree on. Before each large batch, and whenever the model version or the prompt changes, we rescore that control set and compare it to the known answers. If the scores have moved too far from where they should be, the gate fails and the pipeline **halts** — we do not keep scoring on a model that has drifted — until the cause is found and the run is recalibrated. When the control set holds, the batch proceeds and the check is logged.

## What the confidence tier means
A stable score is not the same as a well-founded one. A film can be scored consistently and still rest on almost nothing. So alongside the score we publish a separate, measured confidence, shown as one of three tiers:

| Tier | What it means |
|---|---|
| **High** | Grounded in a real body of critical writing about the film, scored under the fuller reliability machinery. |
| **Moderate** | Some grounding, but a thinner corpus or a lighter pass. |
| **Limited** | Little or no critical corpus to lean on — a judgement made largely without external evidence. |

Confidence is built mostly from **how much critical writing exists** about the film, with smaller contributions from how much attention it has drawn and how heavily it was scored. It is shown as a plain grounding note — *grounded in N critical takes* — so you can see the basis, not just a badge. Only films with a genuine critical corpus earn **High**. Films with none fall to **Limited**, and those are exactly the thin ones we keep out of the visible catalogue; what you browse is High and Moderate.

## What we decided, and why
Two calls shaped this page. First, confidence is a **separate number from the score**, never folded into it — a shaky judgement stays visible as shaky rather than being quietly downgraded, so nothing recommends a film with false certainty. Second, the confidence signal shapes what we surface and recommend but **never edits the TakeScore itself**; the score reports the film, and confidence reports how much to trust that report.

## Limits
These figures describe *agreement and grounding*, not final truth. High repeat-agreement means the model is consistent, not that it is right; a film every critic has misjudged can be scored confidently and still be misjudged. Cross-model agreement narrows single-model bias but cannot remove a bias the whole field shares. And a High tier means there is a corpus to stand on — not that the corpus is correct. We publish these numbers so you can weigh the score, not so you can retire your own judgement.

---
> Reliability sits under the same [corrections](/methodology#corrections) loop as everything else: if a score looks wrong or a film is graded on the wrong evidence, tell us and we will look at the row.
`;
export default body;
