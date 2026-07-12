const body = `
# TakeScore: the three axes

Most ratings measure satisfaction — whether a crowd enjoyed a film — and then stop. They are good at telling you what is popular and silent on the question a committed viewer actually carries out of the cinema: was *that* worth it, and will the next one be? TakeScore is our attempt at the number those sites leave out. It measures the lasting value a film offers a serious viewer, the prior knowledge it asks in return, and the chance it disappoints — three things no rating we could find weighed together. This page explains the three axes, how they combine into the single **TS** number, and the principles we hold to when we score.

## In numbers

> **6,700+**
> films scored
> every film in the visible catalogue carries a TakeScore, each judged on its own terms

> **58 / 100**
> average Value
> what a typical film gives back — before its cost and risk are weighed in

> **8 – 57**
> where most scores land
> the middle four-fifths of the catalogue by net TakeScore; the median sits near 36, and only the strongest clear 80

## Three axes

A TakeScore is built from three independent readings of a film.

**Value** is what you keep — the durable yield of watching. It gathers what a film gives you cognitively, emotionally, formally and morally, and how much of that survives after the credits. Higher is better. Legibility is not punished: a clear, accessible film can score very high on value. Difficulty is never rewarded here.

**Cost** is the prior knowledge a film asks before it opens up — film-history literacy, formal difficulty, outside context, familiarity with a director's earlier work. We treat this as a *cost, not a flaw*. A demanding film is not a worse film; it simply asks more of you before it pays out, and a reader deserves to know that in advance.

**Risk** is the chance a serious viewer walks away disappointed. It weighs how hollow, insincere or artistically timid a film may be, together with how sharply informed audiences split over it. A film can be beloved by one camp and dismissed by another; that division raises risk without making the film empty.

## Two summary numbers

The headline number fuses value and risk:

**TS = round(Value − λ · Risk).** Lambda is a risk-aversion dial you can turn. Its default is **1.0**: value and risk weighed evenly. Raise lambda and risky films fall away; lower it and you reward ambition even where it might not land. The dial is yours — the same film has a different TS for a cautious viewer than for an adventurous one, by design.

Alongside TS we show an **efficiency** reading: value earned per unit of risk. It favours films that deliver a great deal with little downside, and it reads differently from the net score — a modest, dependable film can be efficient without being essential.

## What we decided, and why

A few calls shaped the whole scale, so here is how we settled them.

**Difficulty is a cost, not a virtue.** A hard film that gives little back scores *low* value and *high* cost — the two do not cancel. We refuse the common slippage where obscurity is mistaken for depth. The reward has to be in what the film yields, not in how much work it demanded.

**Ambition is not achievement.** Scale, spectacle and reach are not scored as value in themselves. A film is credited for what it accomplishes, not for what it reached toward. Announced intentions do not earn points.

**External ratings are ignored.** Box office, star averages and aggregator scores are never inputs to a TakeScore. Where we show them, they sit *beside* the score for comparison and are labelled as not part of it. The full case for keeping them out is set out in [What TakeScore ignores](/methodology/what-takescore-ignores).

**Every film is scored on its own.** No film's score depends on the films around it. Each is judged against a fixed, calibrated set of reference points, so the scale means the same thing across the whole catalogue and a film's number does not drift when its neighbours change.

## Limits

TakeScore is a rubric-anchored estimate, not a human-consensus verdict. It is produced against a version-locked rubric, each film judged independently and aggregated across samples, then checked for drift over time — but it remains a well-calibrated opinion, not a fact, and we publish it as one.

Two honest caveats follow from that. The risk axis leans partly on how audiences have divided, which is sensitive to sample and moment and needs periodic refreshing. And coverage is uneven: the scale was calibrated on a largely cinephile catalogue, and non-Western, documentary and animated work deserve continued auditing to be sure the same rubric treats them fairly.

Read TakeScore as a considered second opinion built to spare you a wasted evening — not as a ceiling on any film's worth.

---

> TakeScore sits under the same [corrections](/methodology#corrections) loop as everything else: if a film's score rests on a fact we got wrong, tell us and we will look again.
`;
export default body;
