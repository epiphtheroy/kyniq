const body = `
# Corrections
Every page on Metatake is meant to be checkable, and checkable means correctable. This page explains what we treat as a fact worth fixing, what we treat as a reading worth leaving open, and how to tell us when we've got the first kind wrong.

## Facts get corrected
If something on the site is factually wrong — a date, a credit, a plot detail, a mischaracterised scholarly source — tell us and we'll fix it. Email the page and the issue to [wonwoo@metatake.net](mailto:wonwoo@metatake.net), and the correction is made as soon as it's verified. We don't batch these or wait for a release; a fact is checked against the record and the row is changed.

This is the same loop every layer of the site sits under. A [kinship](/methodology/kinship) connection that's mislabelled, a [lineage](/lineage) film filed under the wrong award, a [Locations](/locations) pin dropped in the wrong place, a [to.W](/methodology/why-a-film-is-in-the-index) note that has a film's standing wrong — each is a factual claim, and each gets the same treatment. Nothing is exempt because it was computed rather than typed.

## Readings stay open
What we will *not* do is flatten an interpretation because a reader disagrees with it. A close reading is not a fact, and it isn't meant to be the last word. A film sustains more than one strong reading, and the site is built to hold several rather than to settle on one.

So the two kinds of change are handled differently. A factual error is corrected — quietly, permanently, and in our favour to fix. A disagreement about meaning is not corrected; it's added to. Logged-in readers can write their own reading beneath any figure, and that reading stands next to ours rather than replacing it. Argument is the point, not the failure mode.

The line between the two is usually clear. **"The scene is set in 1962, not 1965"** is a fact — send it. **"You've read this shot too generously"** is a reading — write yours underneath. When a claim sits on the border, we treat the checkable part as a fact and leave the interpretive part open.

## What we decided, and why
A few calls here weren't obvious, so this is how we settled them.

We keep corrections **continuous rather than versioned**. There's no correction queue that fills up and gets cleared on a schedule; a verified fix goes in when it's verified, because a page that's wrong today shouldn't stay wrong until some later date. The cost of that is that we don't publish a running changelog of every small fix — the record of the corpus is the corpus as it currently stands.

We correct **the underlying data, not just the visible page**. Because so much of the site is computed — rankings, connections, maps — a fact that's wrong at the source is often wrong in several places at once. Fixing the row it's drawn from fixes all of them together, and is why we ask for the specific claim rather than a general note that a page feels off.

And we hold a **bias toward openness on readings**. When we're unsure whether a reader is reporting an error or a disagreement, we default to treating a reading as a reading — that is, we leave it standing and invite the counter-reading — rather than quietly deleting an interpretation because one person found it unpersuasive. Deleting is easy and often wrong; the harder, better default is to let both readings sit there.

## Limits
This loop depends on readers telling us. We check pages against the facts ourselves, continuously, but the corpus is large and we don't catch everything — a correction that never reaches us can't be made. If you see something wrong, the single most useful thing you can do is send the page and the specific claim.

Corrections also can't do the job that *reading* does. Fixing a wrong date makes a page accurate; it doesn't make an interpretation right, because interpretations aren't the sort of thing that get made right. Those get argued, and the place to argue them is on the page itself.

---
> Corrections run through the same channel as the whole [methodology](/methodology#corrections): send the page and the issue, and a verified factual error is fixed at the source it's drawn from.
`;
export default body;
