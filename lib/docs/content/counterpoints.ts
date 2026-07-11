const body = `
# Counterpoints

A counterpoint is the opposite of a [kinship](/methodology/kinship) connection. Kinship finds the films most alike; a counterpoint finds two films that share the very same [trope](/tropes) yet read it in opposite directions. This page explains how we compute that disagreement, what the divergence number means, and why a similarity engine cannot find one.

## In numbers

> **{{n:counterpoints}}**
> counterpoints
> pairs that stage the same trope but read it in opposite directions

## The connection only a reading-level database can make

Most "related films" tools measure resemblance: they find the film that looks most like the one in front of you. That is a useful thing to compute, and it is what kinship does. But resemblance can only ever return lookalikes. It cannot return an *argument* — two films that reach for the same device and mean opposite things by it.

A counterpoint needs something a resemblance engine does not have: a written reading of what each film is *doing* with the trope. Because every figure on Metatake carries a close reading, and every reading becomes a point in meaning-space, we can hold two films up to the same trope and measure how far apart their readings of it sit. That is the whole idea. Films that read the trope the same way are kin. Films that read it in opposite directions are counterpoints.

## How a counterpoint is built

We start from a shared trope — two films whose figures both belong to it. For that trope, each film has a reading, and we average the film's readings of it into a single vector: this film's *take* on the trope. Two films sharing a trope therefore give us two takes, and we compare them.

Where the two takes sit close together in meaning, the pair is unremarkable — they agree, so there is nothing to show. Where they sit far apart, the pair is interesting: same device, opposed reading. We keep the pairs whose takes are **farthest apart in meaning**, and we weight rarer tropes more heavily, so a clash over an unusual device counts for more than a clash over a common one. Each film keeps a handful of its sharpest counterpoints.

The distance is turned into a plain **divergence percentage** — how far apart the two readings point — and both takes are shown side by side on the page, each linking to the figure it came from. The point of displaying them together is that the disagreement should be legible: you can read one film's take, then the other's, and see the argument for yourself rather than take our number on faith.

## What we decided, and why

A few calls were not obvious.

We compute counterpoints **from the readings, not from metadata**. Two films can look unrelated by genre, decade or country and still stage the same trope in flatly opposed ways — that opposition is exactly what we want to surface, and only the readings reveal it.

We compare each film's take **per shared trope**, not film-to-film as a whole. A single film can be kin to one neighbour and a counterpoint to another over a different trope entirely; forcing a single verdict per pair would flatten that. The trope is the ground the two films are arguing over, and we name it so the disagreement can be checked.

We keep the **sharpest** disagreements rather than everything past a line. A ranked handful per film holds the real oppositions and leaves out the merely-slightly-apart.

## Limits

A counterpoint measures how two films *read* a shared trope — not that their makers were in dialogue, and not that one is right and the other wrong. It is a disagreement in meaning-space, drawn from our readings; a different reading of either film could move the pair. The divergence percentage compares two positions, it does not score quality: a high number means the two takes point in opposite directions, nothing more.

And a counterpoint only exists where both films share a trope in the first place. A film with few figures read, or one standing on unusual ground no other film shares, may have no counterpoints at all — the absence is a gap in the corpus, not a judgement that the film has no opposite.

---

> Counterpoints sit under the same [corrections](/methodology#corrections) loop as everything else: if a pairing rests on a factually mislabelled trope, tell us and we will fix the row.
`;
export default body;
