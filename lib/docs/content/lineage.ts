const body = `
# The lineage record

Alongside the readings, Metatake keeps a second, plainer kind of knowledge about each film: where it sits in cinema's public record. **Lineage** is a separate structured layer — not embeddings, not close readings — that files a film against the traditions it belongs to: national cinemas, film movements, award histories, ranked canons, and auteur lines. Where a reading tells you what a film is thinking about, lineage tells you what company it keeps. This page explains how a list gets in, how each entry is matched to a film, and what we hold back.

## In numbers

> **{{n:lineage}}**
> lineage memberships
> films filed to awards, canons and national honours — each list enumerated whole, then resolved to a film identity

> **over a hundred lists**
> awards, canons and national records
> complete winner histories and ranked canons, each entry citing the source it was drawn from

## Complete enumeration, not sampling

The method is deliberate: when we add an award, we add all of it. When we add the Palme d'Or we add *every* Palme d'Or; when we add a ranked canon — a thousand-greatest poll, a national preservation registry — it goes in whole and in order, not as a hand-picked highlight reel. A list is either the real thing end to end or it isn't on the site. This is slower than skimming the famous entries, but it is the only way the total can be checked against the record rather than trusted on our say-so.

Most deliberately, the layer reaches for the traditions the global-prestige lists tend to overlook — national cinemas and critics' polls from outside the Cannes-and-Oscars centre — so that a film's recognition can be seen in its own terms and not only in Western hardware.

## Matched to a film, or held

Once compiled, every entry is **resolved to a film's identity** — the same identity the rest of the site is built on, so that a lineage membership and a close reading point at the same film. Where a title can't be matched with confidence, it is **held rather than guessed**. That is why a list may honestly read **"N of M matched"** instead of pretending to be complete: a canon can say *994 of 1,000* rather than quietly resolving the last six to the wrong films. A short count is a real count, not a rounded one.

Every entry also names where it came from. Lists are compiled from official records — award bodies and festival archives — and from public reference databases, cross-read against the canon-owners' own published lists, and each entry cites the specific list and source it was drawn from.

## Verification before anything shows

Nothing is published until it has been checked. Every row is structurally validated, and each list's size is **checked against its known real length**, so a poll that should hold fifty entries can't quietly ship with forty. Partial lists are **labelled partial** rather than dressed up as whole. And a few subjective national critics' polls, for which no clean public source exists, are **held back pending verification** rather than shown as authoritative.

## What we decided, and why

A few calls weren't obvious, so here is how we settled them. We record **winners and ranked members, not full nominee slates** — a Best Picture list holds the film that won, not the four it beat — because nomination data isn't uniformly public and we would rather under-claim than pad a page. We keep **prestige separate from likeness**: a film isn't *better* for belonging to a movement or a style, so movements are used to find kin, not to inflate a standing. Because pure prestige tilts hard toward Cannes and Hollywood, the national honours are a **deliberate counterweight**, not an afterthought — a film honoured at a small, fiercely selective festival is credited for it rather than penalised for carrying no familiar hardware. And where a source turned out mislabelled or thin — a single year's critics' list once sat under the title of a century-long poll — we relabel it honestly or hold it back rather than let the error stand.

## Limits

Lineage records what a film *won* or where it is *listed*, not the fuller shape of a ceremony: these are winners and ranked members, not the complete field of nominees. A handful of lists are partial and say so. Box office and audience ratings aren't kept here; those live where they belong, on the databases built for them, not in the lineage layer. And because the record grows as new ceremonies are held, each page carries its own date — a lineage is a snapshot of the public record at the moment it was last compiled.

---

> Lineage sits under the same [corrections](/methodology#corrections) loop as everything else: if a film is filed under the wrong award, or missing from a canon it belongs to, tell us and we will fix the row.
`;
export default body;
