const body = `
# Why a film is in the index

Every film Metatake catalogues carries a short letter — addressed *To W.H.*, signed *W. Yoon* — saying plainly why it earned a place in the index. This page explains what goes into that letter, how the verdict is decided, and why we keep it apart from the [TakeScore](/takescore) number it sits beside.

The letter is **assembled by rule, not written by an AI**. Each film is filed on a handful of plain axes, and those filings are stitched into English by a fixed template. Same filings in, same sentence out — the letter is a readout of the filing, not an opinion generated on the spot.

## In numbers

> **{{n:films}}**
> catalogued films
> each carries one assembled letter saying why it was collected

## What we file

Before any sentence is written, a film is recorded on a few honest axes. **Standing in the critics' canon** — whether it appears on the long-standing canon lists, on their secondary tiers, or nowhere on them. **How widely it is known** — from a household name down to a title few have heard of. **Which door it came in through** — a canon list, a festival's top prize, a national cinema, or an auteur's larger body of work. And a **one-line verdict** that follows from the rest.

These filings are deliberately coarse. They are meant to be things we can defend in a sentence, not fine-grained scores. An award and a canon listing are different doors, and we keep them different: appearing on a festival prize roll is not the same as sitting on the standing critics' lists, and the filing records which one is true.

## The verdict ladder

The verdict is the honest part. It follows from standing and reach, and it comes in five rungs.

| Verdict | What it means |
|---|---|
| **Essential** | Sits in the critics' canon proper — the standing lists. An award alone does not earn this. |
| **Start here** | Canonical, but approachable — a sensible way in. |
| **Deep cut** | For when you are digging further, not a first stop. |
| **Popular, not canon** | Widely seen, but not required viewing for a cinephile. |
| **Optional** | Not a canon title, not a festival standout, not a household name. |

The rung that matters most to guard is the top one. It would be easy to let a big prize stand in for canonical standing, and we do not: a film reaches **essential** only when it actually sits on the standing lists, so that the word keeps its meaning.

**Optional is not hidden.** A film that lands there gets the same courtesy as any other — an honest, understated line rather than silence. Saying a film is not for everyone is a filing, not a verdict against it, and it belongs in the letter like the rest.

## When the lists and the number disagree

Some films sit high on the canon lists and still land low on [TakeScore](/takescore). When that happens we do not call them "canon" in the letter. We describe them for what is plainly true instead — much-seen and much-talked-about — because that is the accurate thing to say about a title that everyone knows and few would place among the greats. The standing is real; the letter just declines to borrow the canon's prestige for it.

This is the same instinct throughout: the letter should never claim more than the filing supports.

## What we decided, and why

A few calls were not obvious, so here is how we settled them.

We keep **to.W separate from the TakeScore appraisal** it sits next to. TakeScore weighs a film's value against its cost and risk; to.W only says where the film stands in the catalogue and why it was collected. The two answer different questions, so we let them disagree on the page rather than forcing one number to settle it. A canon title can score low, and both facts stay visible.

We also allow a small number of **hand corrections** to the automatic verdict. When an editor judges that the rule produces a misleading label for a particular film, the filing can be locked by hand so a later recomputation does not quietly overwrite it. These are rare and deliberate, and a recomputation is written to leave a locked filing alone.

## Limits

The letter measures where a film stands and how it is known — not whether it is good, and not what it is about. Standing shifts as canon lists are revised and as a film's reputation moves, so a filing is a snapshot, not a permanent verdict. And because the same template is applied to every film, the letters are plain by design: they will never surprise you with a reading, only tell you, honestly, why the film is here.

---

> to.W sits under the same [corrections](/methodology#corrections) loop as everything else: if a film is filed under the wrong standing, tell us and we will re-file the row.
`;
export default body;
