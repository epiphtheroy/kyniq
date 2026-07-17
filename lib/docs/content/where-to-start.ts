const body = `
# Where to start, who is next

Most of what Metatake connects, it connects with a distance metric. The two surfaces on this page do not. **Where to start** is an ordered route into a director's work; **Who is next** is a set of directors to explore afterwards. Neither is a similarity score dressed up as a recommendation: each pick is made as an argument and carries a specific, written reason — the exact thing that makes a film the way in, or the exact kinship that joins one film-maker to another. Both are written by Metatake AI against a fixed brief the editor set, and stored as data. This page explains how those two lists are made, what the model is asked for, and what the choice costs.

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

Some of the directors we point to are already read closely on Metatake, and those names link through to their own pages and routes. Some are not on Metatake yet, and we say so plainly rather than pretend the link exists. Either way the recommendation is a judgement we publish under our own name and answer for, not a correlation we noticed.

### Both directions

The next-director links run **both ways**. When one director's page recommends another, that other director's page shows the recommendation pointing back at it — a "pointed to from" list of every film-maker for whom this director is the answer to *who is next*. The graph of recommendations is therefore something you can walk in either direction, and a director who is a frequent destination reads as one, visibly.

## What we decided, and why

A few calls were not obvious, so here is how we settled them.

We **make these as arguments, not as distances**. The temptation was to generate routes and recommendations the way we generate connections — from the readings, at scale, as a similarity score. We did not, because the value of "start here" is a judgement about a person's whole body of work, and the value of "watch next" is a claim about an affinity between two film-makers. Both are the kind of thing a distance metric says badly. A number can tell you two directors overlap; it cannot tell you the overlap is worth your evening, or why.

So each route is written by **Metatake AI** reading the whole filmography at once against a brief the desk sets: cover the way in, the peak, and the deep cut; choose only from films we actually hold; name the film; say specifically what it does and who it is for; never rank by box office. The desk writes that brief and answers for what it produces. Be clear about how these are made, though, because it differs from the rest of the site. Most of what we publish is generated per-item and answered for after the fact; these routes were generated in one batch and loaded as they came, with no per-route check at all. That is a weaker guarantee, and it is why an occasional route reads better than it judges — and why the [corrections](/methodology#corrections) loop matters more here than anywhere else on the site. This is the same system that drafts the readings, pointed at a different question — not an editor working through a filmography by hand.

We **require at least three picks** before a page appears at all. A route of one or two stops is not a route, and a next-list that short is a stub, not a recommendation. Below that threshold the page simply does not exist — better absent than thin.

We **write the reason into the data, not around it**. Every pick and every recommendation stores its own sentence of prose, drafted once and written to the database. The page that renders it then runs no language model at all: the counts, the titles, the years, the ordering are assembled from stored rows, deterministically, the same way every time. That distinction is worth stating exactly, because it is easy to blur. The reason you read was drafted by Metatake AI and held to the brief above; it was not improvised at the moment you loaded the page, and it is not a distance score rewritten as a sentence.

## Limits

These pages are honest about their own reach. A route exists only where a director has at least three films in our catalogue — a row count in the code, not a verdict that the others are unworthy. Below that bar there is nothing to draw a route through, so no page appears. Coverage therefore follows the catalogue, and the catalogue follows the reading work: far fewer routes than there are film-makers, and the gap closes as the corpus grows rather than as an editor finds time.

A route is also one reading, not the only one. Another viewer might start elsewhere and be right. We publish the reasoning precisely so you can disagree with it — the point of writing the reason down is that you can see it and take a different door. And because the reasons are drafted by a model against a brief, a reason can fail in ways a sentence about a film should not: a title mangled, a kinship overstated. Those are errors, not opinions, and they go through the loop below.

---

> These pages sit under the same [corrections](/methodology#corrections) loop as everything else: if a pick names the wrong film or year, or a recommendation is factually mislabelled, tell us and we will fix the row.
`;
export default body;
