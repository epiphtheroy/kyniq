const body = `
# The embedding map

The lines you follow between films on Metatake are not hand-tagged categories. They are distances in a high-dimensional space. Each reading we publish becomes a point positioned by what it is actually about, so two films thinking about the same thing drift close together even when they share no genre, director, or decade. This page explains what that map is made of, what gets embedded, and what we ask you not to read into it.

## In numbers

> **{{n:readings}}**
> close readings placed
> each one becomes a point on the map, positioned by its own text

> **{{n:films}}**
> films with a place in the space
> a film's readings average into a single position for that film

## What an embedding is

An embedding is a position in meaning-space, computed from a piece of text rather than assigned by a person. When we embed a reading, we are asking a simple question of it: *what is this about?* Two readings that turn out to be about the same thing land near each other, and two that are about different things land far apart — regardless of whether the films agree on anything a catalogue would notice. Nothing here is a keyword count. A reading of colour as grief and a reading of a doorway as grief can sit close even though they share no word in common, because the *meaning* is what gets placed, not the vocabulary.

That is the whole trick, and it is why the map can surprise you. You can start at one figure and land somewhere you would not have thought to look — not because a human filed both films under the same tag, but because their readings sit near each other in meaning. It is a map built from content, not from taxonomy.

## What we embed

The map is not only readings. Several kinds of thing get their own position in the same space, which is what lets connections cross from one layer to another.

| What is placed | What its position means |
|---|---|
| Close readings | what a single reading is about |
| Figures | the object, gesture, or device the readings hang on |
| Tropes | the shared pattern a figure belongs to across films |
| A per-film taste vector | one film's readings averaged into a single point |
| Directors | a body of work reduced to one position |
| The theory canon | the scholarship our anchored readings point back to |
| Taxonomy nodes | the named categories the site is organised around |

Because all of these live in the same space, a question asked in one layer can be answered in another. A [trope](/tropes) can find the films whose readings sit most centrally within it. A film's taste vector can find its nearest neighbours even when they share no trope at all. And a search can match a phrase against readings, figures, and the theory canon at once, because they are all placed by the same measure.

## What we decided, and why

A few choices shaped the map, so here is how we settled them.

We place **readings, not films directly**. A film is not one idea; it is many. So we embed each reading on its own terms and only then average a film's readings into a single [taste](/network) position. The film's point is a summary of its readings, never a substitute for reading them.

We build the map from **what the readings say, not from how films were made or watched**. There is no genre, no release year, no box office, and no viewing behaviour in these positions. Those facts matter, and we keep them — but in the [lineage](/lineage) layer, plainly labelled, not folded silently into the map. A connection here means *these two readings are about the same thing*, and nothing else.

The map is **recomputed, not curated**. Every position is derived from text by the same measure, so the same reading always yields the same point. When a new reading is published, the space shifts a little, and neighbours can change. We do not freeze a layout or hand-place a film to make a list look better.

## Limits

The map measures how films *read*, not what they *are*. Two films can sit close because their readings circle the same idea while sharing nothing a viewer would call similar — and that is the point, not a fault, but it is worth knowing before you treat proximity as resemblance.

It is also only ever as good as the readings underneath it. A film with few readings has a thin position; a figure we have not yet read closely is not on the map at all. The space grows and sharpens with every reading added, which means it is honestly incomplete at any given moment rather than finished. And distance is a suggestion to look, not a verdict — the map tells you where two readings sit, not whether the connection is worth your time. That judgement stays yours.

---

> The embedding map sits under the same [corrections](/methodology#corrections) loop as everything else: if a reading is factually wrong, tell us and we will fix it, and the map recomputes from the corrected text.
`;
export default body;
