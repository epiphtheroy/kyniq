const body = `
# Criticism as a database (and what that does to it)

The first time I saw [La Haine](/film/la-haine-1995) and [Play](/film/play-2011) sitting on the same page, under the same named trope — "Insurgency Turned On Itself" — I felt a small, illicit thrill, and then a longer unease. Nobody had written that pairing. No critic sat down and argued those two films against each other. A distance function did. The machine had held both up to the trope, measured how far apart their readings of it pointed, and set them side by side as a **counterpoint** because they were farthest apart. I had, in effect, generated a critical comparison that no human had thought — and the thrill was that it was a good one, and the unease was that I could make eleven thousand more before lunch.

## The unit used to be one film

For most of its life a review is about one film. You watch the thing, you think about the thing, you write the thing. Relation was decorative: an "if you liked this" line at the bottom, a lazy adjective — *Bergmanesque*, and off we go. The standalone review is the atom, and everything else is gossip about atoms.

A database inverts that. When every figure carries a reading, and every reading becomes a point in [meaning-space](/methodology/embedding-map), the relation between two films stops being decoration and becomes a thing you can compute and stand behind. [Kinship](/methodology/kinship) finds the films most alike; a [counterpoint](/methodology/counterpoints) finds two films that reach for the same device and mean opposite things by it. Across the corpus that comes to **46,440 connections** and **11,213 counterpoints**, each one auditable back to the shared trope it was built from. The relation became the content.

## The genre this makes possible

This is, I think, a genuinely new genre, and I do not say that lightly. Not "related films." An argument. [GoodFellas](/film/goodfellas-1990) held against [Guardians of the Galaxy Vol. 3](/film/guardians-of-the-galaxy-vol-3-2023) over "The Perfectionist Whose Beauty Requires Slaughter" is a sentence no anthology would ever have printed, because no anthology shelves those two together. The database does not know they are not supposed to meet. It only knows they stand on the same ground facing opposite ways — and that is exactly the comparison a good critic would kill for and never find, because a person cannot hold six thousand films in their head at once. I held them in a table instead.

## The cheapening, which is real

And here is what I stand to lose. A comparison that costs nothing to generate is a comparison that means less. When I write one pairing by hand it carries the weight of my having chosen it out of everything I know. When a distance function emits eleven thousand, each individual one is lighter — it was selected by a threshold, not by a mind. There is a trope our own readings keep finding, [*The Reception As Proof Of The Thesis*](/trope/the-reception-as-proof-of-the-thesis), and I am wary that "look how many connections we hold" is a boast that measures the machine's appetite and not the criticism's worth. Forty-six thousand of anything quietly invites you to stop reading any single one.

So I built two guards against my own volume. Kinship keeps only the strongest two dozen kin per film, never the full noise floor. Counterpoints keep only the sharpest disagreements, and weight a clash over a rare trope above a clash over a common one — so the scarce, telling pairs rise and the merely-slightly-apart are dropped. The aim of both is to make the corpus behave less like a firehose and more like an editor with taste.

But the guards are mine, and they are arguable, and that is the honest end of this. I can prove [La Haine](/film/la-haine-1995) and [Play](/film/play-2011) point in opposite directions: the divergence number says so, and both readings are on the page for you to check. What I cannot prove is that this pairing **matters** more than the ten thousand I pruned — only that it survived a rule I wrote. A human critic's comparison is scarce because a human is scarce. Mine is scarce because I capped it.

Which leaves the question I cannot close. When relation becomes something you can manufacture by the tens of thousands, does the ten-thousandth counterpoint still count as criticism — or only the first one somebody actually reads?
`;
export default body;
