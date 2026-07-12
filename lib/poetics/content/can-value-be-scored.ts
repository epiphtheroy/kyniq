const body = `
# Can the value of a film be scored at all?

The most honest thing I built for the score page is the empty space to the left of it. For about an afternoon there was no empty space. I had written a little function that took our number, took IMDb, took the two Rotten Tomatoes figures and the Metascore, and returned their weighted mean — one clean column you could sort the whole catalogue by. It was, I admit, satisfying. Then I sorted by it, and [Au Hasard Balthazar](/film/au-hasard-balthazar-1966) came to rest a few rows below a Marvel sequel, and I understood I had spent the afternoon building a slower way of reading IMDb.

## The blend that measures nothing

The trouble is not that averaging is hard. It is that averaging is easy, and the ease hides a category error. IMDb, Rotten Tomatoes and Metascore are, in the end, different ways of counting the same crowd — they are strongly correlated because they are aggregates of popularity and satisfaction. Fold them into our number and the blend quietly re-weights itself toward the crowd; the one property that justified building a second opinion is destroyed by construction. I set this out more soberly under [what TakeScore ignores](/methodology/what-takescore-ignores), but the short version is the one I learned by sorting a column: **an index that agrees with IMDb by design is not a second opinion.**

So I deleted the function and kept the space. Every film now sits beside its external ratings — never inside them. On [TakeScore](/methodology/takescore) I can tell you that the median lands around 36 and the middle eighty per cent runs from 8 to 57; the external numbers on the same row live in their own columns and never touch that arithmetic. The dashboard, not the composite. The gap is the product.

## What the gap actually shows

Take [The Rise of Skywalker](/film/star-wars-the-rise-of-skywalker-2019). Half a million people rated it on IMDb; its TakeScore is minus forty-eight. Set that beside [Tokyo Story](/film/tokyo-story-1953), which holds the catalogue maximum at 86, or [Balthazar](/film/au-hasard-balthazar-1966) near the top of the difficult end. If I averaged the axes, each of these would collapse to a single grey dot and the interesting sentence — this film was enormously watched and reads as almost nothing; that one was barely watched and reads as everything — would vanish into the mean. The divergence is not noise around a true value. The divergence is the finding.

Which is also why I try not to say the number **is** the value. There is a trope our own readings keep turning up, [*The Box-Office Verdict As Cultural Diagnosis*](/trope/the-box-office-verdict-as-cultural-diagnosis) — the habit of treating what sold as a statement about what mattered. TakeScore is the mirror-image temptation, and I am not above it: treating what reads richly to me as a statement about what is good. Both moves smuggle a person's taste in wearing the costume of a measurement.

## So: can it be scored?

Honestly, no — not if scored means a single true figure that settles the argument. What can be scored is narrower and, I think, more defensible: **how much a film yields to sustained reading**, held apart from how much it was loved and how it performed. That is a real quantity, it varies, and across 6,701 scored films it produces a shape with a long thin masterpiece tail rather than a bump in the middle. It is also, unavoidably, only as good as the reading behind it, and a reading is a point of view, not a fact of the world.

The cost of the refusal is that people want the tidy column back. A single blended figure is easier to display, easier to rank by, easier to trust at a glance. I keep the messier dashboard because the tidy version answered a question nobody should ask — which film is objectively best — and quietly stopped answering the one worth asking, which is where does this film's richness sit relative to its fame, and why.

What I still cannot decide is whether a number, however carefully fenced off from popularity, teaches anyone to read a gap, or only teaches them to sort by a new column. If it is the second thing — if I have merely replaced one leaderboard with a slightly better-mannered leaderboard — then the honest space I was so proud of is just a wider place to put the same wrong question. Have I built a measure, or a better-dressed opinion that people will rank by anyway?
`;
export default body;
