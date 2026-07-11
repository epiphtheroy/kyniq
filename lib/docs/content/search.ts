const body = `
# How search works

One engine powers every search box on Metatake — the global search page, the navigation type-ahead, the command palette, the home hero, the map. There is no separate index behind any of them. When you type, the same engine runs, and it answers by fusing two independent ways of finding things: matching your words, and matching your meaning.

## In numbers

> **{{n:readings}}**
> critical readings, searchable by meaning
> the semantic leg searches these passages for sense, not just wording

> **{{n:films}}**
> films reachable by title
> including original, non-English titles alongside the English ones

## Two legs, fused

Every query runs down two legs at once, and the two rankings are then combined.

**The lexical leg** is the familiar one: a fuzzy text match across twelve kinds of entity — films, directors, tropes, readings, figures, theorists, concepts, traditions, lineages, movements, archetypes, and more. It tolerates typos and partial words, and it rewards a match that begins the way you typed. A film is findable by its title, by its director, and by its *original* title — so a film released under a non-English name is reachable whether you type the English title or the one it opened with at home.

**The semantic leg** is the weapon. Instead of matching characters, it matches meaning. Your query is turned into a mathematical representation of what it is *about*, and that is compared against the same representation computed for tens of thousands of critical passages. This is what lets a search for an idea — say, the ethics of watching — surface readings that never use those exact words but circle the same thought.

Two properties of the semantic leg are worth stating plainly. It searches the **readings**, our largest body of writing, so a vague or conceptual query lands on real critical prose rather than on titles alone. And it is **cross-language**: a query written in Korean can find English content, because meaning is compared in a space that is not tied to the surface language. You do not have to translate your question before you ask it.

## Combining the two rankings

The lexical leg returns a ranking. The semantic leg returns a ranking. These are different currencies — one measures how closely your letters matched, the other how closely your meaning matched — so they cannot simply be added together. We combine them by their *positions*: an entity that ranks highly on either leg rises, and one that ranks highly on **both** rises further. Each result carries a small badge saying whether it was found by text, by meaning, or by both, so you can see which leg brought it to you.

A third, small contribution comes from an in-memory match over places and genres, so a query like a city or country name jumps straight to the map.

## What we decided, and why

A few calls were not obvious.

We let the semantic leg **fall back** when the text match is thin. If your words match almost nothing literally, we lean harder on meaning and widen the net, because that is exactly the case — a half-remembered idea, a phrase in another language — where meaning search earns its keep. When the text match is already strong, we keep the meaning leg stricter, so a precise title search is not diluted by loose thematic neighbours.

We deliberately include our **Tier-2 catalogue** — films we hold but have not yet written up — in text results, marked as such, so a search can tell you the film exists here even before we have covered it. It is labelled honestly rather than hidden.

And we made the whole thing **one engine on purpose**. When every surface shares the same logic, a fix or an improvement reaches all of them at once, and results never disagree between the palette and the page.

## Limits

Meaning search is powerful and imprecise in a specific way: it finds what is *near* your query, which is not always what you meant. A conceptual search can surface a reading that is thematically adjacent but not the one you had in mind. The text leg is the opposite — exact when your words are exact, unhelpful when they are not. Fusing them covers a lot of ground, but neither leg understands your intent the way a person would, and we do not pretend otherwise.

Semantic coverage also depends on what has been written. A film with rich readings is easy to reach by meaning; a thinly covered one is mostly reachable by title alone. That is a coverage gap, not a judgement about the film.

---

> Search sits under the same [corrections](/methodology#corrections) loop as everything else: if a result is mislabelled or points to the wrong place, tell us and we will fix it.
`;
export default body;
