const body = `
# What TakeScore ignores

Every film on Metatake sits beside its IMDb rating, its Rotten Tomatoes scores, and its Metascore. You can see all of them on the same page as our own [TakeScore](/takescore). What you cannot see is any of those numbers *inside* TakeScore. They are shown next to it and never fed into it. This page explains why that separation is deliberate, and what else we leave out on purpose.

## Two kinds of number, kept apart

There is a real choice between building a **dashboard** and building a **composite**. A dashboard shows several measures side by side and lets you read the gaps between them. A composite crushes everything into one blended figure. The standard guidance on composite indicators is clear that blending is only honest when the parts you are combining share a single underlying thing you are trying to measure. IMDb, Rotten Tomatoes and Metascore do not share ours. They are, broadly, aggregates of popularity and satisfaction. TakeScore is trying to measure something else. So we keep a dashboard, and we own the one number on it that is ours.

## Why we never blend the external ratings

Two independent reasons point the same way.

The first is **double-counting**. IMDb, Rotten Tomatoes and Metascore are strongly correlated with one another because they are, in the end, different ways of counting the same crowd. If we folded them into TakeScore, the blend would quietly re-weight itself toward popularity, and our own signal would be diluted by the very thing it was built to stand apart from.

The second is **discriminant validity** — the plain reason a separate index is worth having at all. A distinct score earns its place only if it measures something the popularity numbers do not. The moment you mix a popularity signal into it, you mathematically force it to converge on popularity, and you destroy the one property that justified building it. An index that ends up agreeing with IMDb by construction is not a second opinion. It is a slower way of reading IMDb.

## The divergence is the product

Because the two axes are kept independent, the *gap* between them carries information, and that gap is the point rather than a defect to be smoothed away.

| When you see | What it tends to mean |
|---|---|
| High TakeScore, low IMDb | A film that reads far richer than its crowd reception — often a quiet find worth a second look |
| High Metascore, low TakeScore | Critics of its moment were warm, but the film yields less on sustained reading |

If we averaged the two together, every one of these pairs would collapse into a single dot and the tension would vanish. Keeping the axes apart is what lets the interesting cases stay visible.

## The critics' canon is a check, not an ingredient

We also hold a canon signal — the accumulated weight of festivals, awards and all-time lists. It is tempting to pour that into the score too, and we do not, for the same family of reasons under a sharper name: **circularity**.

If the canon went into the formula, two bad things would follow. First, we would import the canon's own well-known leanings — its Western, auteurist and male tilt — straight into our number and call the result independent. Second, any later claim that "TakeScore predicts the canon" would be a tautology dressed up as a finding, because we would have built the canon into the score and then congratulated it for agreeing.

So the canon stays outside the formula and does one honest job instead: it is a **validation benchmark**. We can report how closely TakeScore tracks it as a single, plainly stated relationship, and we treat the places where the two *disagree* as a feature — the moments where our reading parts company with received prestige — not as an error to correct.

## What we decided, and why

A few calls here were not obvious, so here is where we landed.

We show the external ratings prominently even though we refuse to blend them, because context matters and a bare score left naked is easy to misread. The rule is only that they inform the *reader*, never the *number*.

We keep our own weights and internal workings private while publishing the policy — what goes in, how it is normalised, and what is deliberately excluded. That is the ordinary settlement for a rated opinion: the method is open, the judgement is ours to own.

And we resist the pull toward one tidy figure. A single blended number would be easier to display and easier to rank by. It would also be the exact mistake the composite-indicator literature warns against: a simple number that invites a simple, and often misleading, conclusion.

## Limits

TakeScore measures how a film reads, not how much it is loved, and not how it performed. It will sometimes sit far from the crowd. That distance is intended, but it does mean the number is only as good as the reading behind it, and readings are a point of view rather than a fact of the world. The external ratings on the same page are there precisely so you never have to take ours alone.

---

> If an external rating is displayed against the wrong film, or a TakeScore looks plainly mislabelled, that falls under the same [corrections](/methodology#corrections) loop as everything else — tell us and we will fix the row.
`;
export default body;
