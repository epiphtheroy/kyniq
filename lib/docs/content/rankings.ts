const body = `
# The numbers on ranked lists

Wherever Metatake shows a percentage or a ranked list — a trope page ordering its films, an archetype page ordering its figures, a "% match" badge on a card — the number is computed, never typed in by hand. This page explains what each number means, how it is derived, and why a ranking you see today can honestly change next month.

## In numbers

> **{{n:tropes}}**
> cross-film tropes
> each one ranks its member films live, from the readings, at the moment you load the page

## Every number starts from an embedding

Every reading, figure and trope on Metatake carries an *embedding* — a position in meaning-space derived from its actual text, with nothing hand-assigned; [the embedding map](/methodology/embedding-map) explains how those positions are built. The rankings you see are distances measured in that space, reported as percentages.

Because the number comes from the text and only the text, the same input always yields the same output. Nothing is shuffled, nothing is promoted by hand, and no ranking is ever frozen into the page.

## What each number means

**Match %.** A match percent is the cosine similarity between two embeddings. On a trope page it measures how centrally a film's reading sits in that trope's meaning. The consequence is worth stating plainly: the number-one film is *not* the most famous one — it is the film whose reading is most purely *about* what the trope is about. Fame does not enter the calculation, so a small film can top a list a canonical one sits lower on.

**Kin %.** A kin percent between two tropes, or between two figures, is the same cosine applied to their own embeddings. It answers "how close in meaning are these two patterns?" — again from the text, not from any tag or category a person attached.

**Confidence.** On archetype pages, confidence is how surely a figure belongs to its classification. It is set when the figure is classified, on a 0–100% scale, and it orders the member list. A high-confidence member is a clear case of the archetype; a low-confidence one is a member with reservations.

**Coherence.** On trope pages, coherence measures how tightly a trope's readings cluster in meaning-space. A high-coherence trope is a sharp, well-defined idea; a low-coherence one is still finding its edges — a loose family rather than a single thought.

**Maturity badges.** The Fresh → Emerging → Established → Cliché badges are the simplest number here: plain member-count tiers, nothing more. They say how many films carry a trope, not how good or important it is.

## What we decided, and why

A few calls shaped these numbers, so here is how we settled them.

We rank films on a trope **by the meaning of their readings, not by the surface of their figures**. A figure's own text tends to cluster with other figures from the same film, which would stack one movie at the top of every list it appears on. The *reading* — the interpretation of the figure — is where the trope's actual meaning lives, so that is what we measure the distance against.

We keep the ordering **deterministic**. Ties are broken by fixed rules, never at random, so the same corpus produces the same page every time and the ranking can be trusted to mean something rather than reshuffle on each visit.

We let a **short list stay short**. When a trope has only a handful of members, the page ranks the handful it has rather than padding the number to look complete.

## Limits

These numbers measure how films *read*, not how they were made or how well they were received. A high match percent means a reading sits close to a trope's centre — it is not a quality score, a box-office figure, or a critical verdict, all of which live elsewhere on the site. Confidence and coherence are about clarity of classification, not merit: a low-coherence trope can be a genuinely interesting one that simply spans a wide range.

And every one of these rankings recomputes as the corpus grows. When a new film's reading enters the space, it can shift where existing films sit relative to a trope. So a ranking you saw last month may legitimately read differently today — not because anyone edited it, but because the space it is measured against has moved.

---
> Ranked lists sit under the same [corrections](/methodology#corrections) loop as everything else: if a figure is filed under the wrong trope or archetype, tell us and we will fix the row — the ranking will recompute itself once the underlying filing is right.
`;
export default body;
