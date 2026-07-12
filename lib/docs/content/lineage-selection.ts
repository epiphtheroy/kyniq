const body = `
# How a list earns its place

Every awards shelf, canon and national honour on a Metatake film page comes from a [lineage](/lineage) list, and every list on the site had to earn its way in. This page explains the bar a list has to clear before we file a single film under it, and what we turn away on purpose.

The short version: what earns a list its place is not fame but **authority you can check**. A prize that everyone has heard of but nobody can enumerate is worth less to us than a modest national poll whose full membership is published in plain sight. Three tests decide it.

## In numbers

> **{{n:lineage}}**
> film-to-list memberships
> every list enumerated whole, then each film resolved to the same identity the rest of the site uses

> **over a hundred**
> award and canon lists
> complete winner histories and ranked canons, each entry citing where it came from

## The three tests

**First, it is issued by a body whose judgement shapes film culture.** A Cannes, Venice or Berlin jury; a national film academy; a critics' association; a preservation archive like the Library of Congress; a landmark poll like *Sight & Sound*. The point is that the body's verdict already carries weight in the world, so recording it adds a real fact about the film rather than an opinion of ours.

**Second, its full membership is publicly documented, end to end.** We do not add a list we cannot enumerate whole. If the complete membership can be read off a public record and checked against that record, it can go on the site; if only a fragment survives, we hold it rather than ship half a list dressed up as the thing itself. This is the selection side of the complete-enumeration rule described in [The lineage record](/methodology/lineage).

**Third, it earns its keep by adding a tradition.** A list that only restates honours we already carry adds little. What we look for in particular is coverage the global-prestige lists tend to overlook — a national cinema that sits far from the Cannes-and-Oscars centre of gravity. A country's own highest film award, or its own canon, tells you something the Western circuit never will, and those are the lists we go out of our way to include.

## What we keep out, and why

A few things are refused on purpose, and the reasons are the mirror image of the tests above.

| Kept out | Why |
|---|---|
| Fan tallies and black-box aggregators | No accountable body behind them, and no way to check how the ranking was reached |
| Full nominee slates | We record winners and ranked members rather than whole slates — a Best Picture list holds the film that won, not the four it beat |
| Vast, low-discrimination catalogues | A distributor's back catalogue or a community thousand-best barely tells one entry from another; it would swell the totals without adding meaning |

The aggregator line has one honest exception worth naming. A **transparent meta-poll** — one that names every source it pools, so the pooling can itself be audited — does clear the bar, even though it aggregates. TSPDT is the case in point: it is a poll of polls, but it publishes what went into it, so it is checkable in exactly the way a black box is not. The test was never "does it aggregate"; it was "can you see how it decided".

## What we decided, and why

Two calls were not obvious. We chose to record **winners and ranked members, not full nominee slates**, because nomination data is not uniformly public across bodies and eras — and we would rather under-claim than pad a page with a slate we cannot verify end to end. And we chose to treat mere **selection** as the lighter fact it is: being shown at a festival is not the same as winning it, and a bare selection is filed and weighed accordingly — see [Weights and decay](/methodology/lineage-standing).

## Limits

A lineage list records where a film sits in cinema's public honours record — what it *won* and where it is *ranked*. It is not a measure of quality, and it says nothing about box office or audience ratings, which live where they belong and not in this layer. A handful of lists on the site are partial, and where that is true the page says so plainly; how unmatched entries are counted and held is described in [The lineage record](/methodology/lineage).

---

> Lineage sits under the same [corrections](/methodology#corrections) loop as everything else: if a film is filed under the wrong award, or missing from a canon it belongs to, tell us and we will fix the row.
`;
export default body;
