const body = `
# Where to start, who is next

Most of what Metatake computes, it computes without a human in the loop. The two surfaces on this page are the exception, on purpose. **Where to start** is a hand-built route into a director's work; **Who is next** is a hand-built set of directors to explore afterwards. Neither is a similarity score dressed up as a recommendation. Each pick carries a specific, written reason — the exact thing that makes a film the way in, or the exact kinship that joins one film-maker to another. This page explains how those two lists are made, why we chose to curate them, and what that choice costs.

## In numbers

> **over two hundred**
> director routes
> "Where to start" pages, each an ordered walk through one film-maker's work

> **both directions**
> next-director links
> a recommendation from A to B also shows on B's page as pointing back

## The route in

A **Where to start** page is an ordered list of a director's films — a first stop, a second, a third — chosen for what each film opens rather than by box office or by rank. The first pick is labelled as the place to begin; the ones that follow are arranged so that each prepares you for the next. Every stop carries a short paragraph of prose that says, in plain words, why this film and why here: what it introduces, what it rewards, what it sets up.

A route never claims to cover everything. It walks through a handful of the films we have read closely, and the films it leaves out are listed afterwards, by year, so nothing is quietly hidden. The order is a reading, not a ranking. We favour the film that teaches you how to watch the others over the one that happens to be most celebrated.

## Who is next

A **Who is next** page answers the question every filmography ends on: after this director, who? Each entry names one film-maker and spells out a single, specific kinship with the work you have just finished — a shared preoccupation, an inherited method, a conversation across decades. Not "fans also watched", not a nearest-neighbour in some space of features. One reason, written out, under every name.

Some of the directors we point to are already read closely on Metatake, and those names link through to their own pages and routes. Some are not on Metatake yet, and we say so plainly rather than pretend the link exists. Either way the recommendation is a judgement we are willing to sign, not a correlation we noticed.

### Both directions

The next-director links run **both ways**. When one director's page recommends another, that other director's page shows the recommendation pointing back at it — a "pointed to from" list of every film-maker for whom this director is the answer to *who is next*. The graph of recommendations is therefore something you can walk in either direction, and a director who is a frequent destination reads as one, visibly.

## What we decided, and why

A few calls were not obvious, so here is how we settled them.

We **curate these by hand** while computing almost everything else. The temptation was to generate routes and recommendations the way we generate connections — from the readings, at scale, for every director at once. We did not, because the value of "start here" is a judgement about a person's whole body of work, and the value of "watch next" is a claim about an affinity between two film-makers. Both are the kind of thing a knowledgeable editor can say well and a distance metric says badly. A number can tell you two directors overlap; only a person can tell you the overlap is worth your evening, and why.

We **require at least three picks** before a page appears at all. A route of one or two stops is not a route, and a next-list that short is a stub, not a recommendation. Below that threshold the page simply does not exist — better absent than thin.

We **write the reason into the data, not around it**. Every pick and every recommendation stores its own sentence of prose. The rest of the page — the counts, the titles, the years, the ordering — is assembled from that, deterministically, with no language model in the loop. What you read as the reason is a human sentence, not a generated one.

## Limits

Hand-curation is honest about its own reach. These pages exist only for directors an editor has actually sat with, which is a fraction of the film-makers on Metatake and a smaller fraction of everyone who has ever made a film. Coverage grows one director at a time, slowly, and that is the trade we accepted when we chose judgement over automation: fewer pages, each one meant.

A route is also one editor's way in, not the only one. Another reader might start elsewhere and be right. We publish the reasoning precisely so you can disagree with it — the point of writing the reason down is that you can see it and take a different door.

---

> These pages sit under the same [corrections](/methodology#corrections) loop as everything else: if a pick names the wrong film or year, or a recommendation is factually mislabelled, tell us and we will fix the row.
`;
export default body;
