const body = `
# Reception and the afterlife

A film's release is the start of its public life, not the end. Each film's *Reception and afterlife* page — "What critics said, and everything since" — is a dated record of how a reputation was made and remade: reviews, releases, honours and revivals, in order and sourced. This page explains the four sources we assemble it from, the copyright-safe rule that governs every line, and what we deliberately leave out.

## In numbers

> **Four**
> dated sources
> critic headlines, release events, award statements and a film's place in our lineage record — fused into one timeline.

> **One quote per outlet**
> the ceiling, not the target
> we never carry more than a single verbatim fragment from any one publisher, so the page can never reconstitute a review.

## What goes in

Every entry on the page is a dated row from one of four sources, and nothing on the page is written by a model. The assembly is deterministic: we place real rows on a real timeline.

**Critic headlines.** For each film we gather review pages from a standing list of criticism outlets. From each page we take only fields the publisher itself makes public: the *headline*, the *link-preview text* (the og:description a publisher embeds so its link renders as a card elsewhere), and, for scholarship, the *abstract*. We do not fetch, parse, or store the body of any article.

**Release events.** When and where a film opened — premieres, theatrical runs, digital and home-video windows, television — come from public release ledgers, dated by country and territory.

**Honours.** Awards and nominations come from the open, structured statements on Wikidata, each carried with its date where the statement records one.

**The lineage record.** A film's place in our own [lineage](/lineage) archive — the canons, festivals and award editions it belongs to — links each honour back to the list it sits in.

Academic reception is drawn from open scholarly indexes that redistribute abstracts as metadata. Where an index carries no abstract — some book chapters and interviews never have one — we keep the paper's title and stop there rather than invent a summary.

## The copyright-safe rule

This is the part we care about most, and it is deliberate. **We never collect or store article bodies.** The only text we touch is text a publisher has itself chosen to make public and portable: a headline, a link-preview dek, an abstract.

When we show a critic's *verdict* — a short quoted fragment — it is a verbatim substring, machine-verified to appear exactly in that public text. It is never paraphrased, never generated, never stitched together. If the fragment cannot be verified as an exact substring, no verdict is shown and the headline stands alone.

Three further limits hold on every page:

| Rule | What it means |
|---|---|
| One citation per outlet | at most a single quoted fragment from any one publisher |
| Every item links out | each entry is a link to its own source, credited by name |
| Robots respected | we honour publishers' crawling preferences; where a source declines, we simply carry less |

None of this is legal advice, and it is a policy we hold ourselves to rather than a claim about what the law requires. But the shape of it is the point: a reader gets a true, attributed pointer to what a critic said, and a click to read the rest at the source. We keep nothing that would let the page stand in for the original.

## What we decided, and why

A few calls were not obvious. We chose **headlines and link previews over full text** even though full reviews would read richer, because storing bodies is exactly the line we will not cross. We cap quotes at **one per outlet** so the page can never be reassembled into a substitute for a publication. And we keep **negative verdicts verbatim too** — a sour headline is part of a film's reception, and trimming it to flatter the film would falsify the record.

We also separate the *release date* of a review from the release date of the film. A review published years after a premiere belongs to the year it was written, so a revival or a reappraisal lands in its own place on the timeline rather than collapsing into the opening weekend.

## Limits

This is a record of what was *said and awarded*, not a verdict of our own — for that, see [TakeScore](/takescore). It is only as complete as the public record: an outlet that blocks crawlers, a paper with no abstract, a festival with no structured entry all leave gaps, and we would rather show a smaller true record than pad it. Dates are as good as the source's dates; where a source gives none, the item is listed plainly without a year claim rather than guessed. And the list of outlets we draw from is finite — roughly 150, enumerated in [the sources we monitor](/methodology/sources-we-monitor) — so the page reflects where a film was written about, which is not always where it mattered most.

---

> Reception sits under the same [corrections](/methodology#corrections) loop as everything else: if an item is misattributed, misdated, or points at the wrong source, tell us and we will fix the row.
`;
export default body;
