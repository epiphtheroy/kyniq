const body = `
# The sentence layer

On many pages you will find a small module of short, factual sentences — a film "was filmed at" somewhere, "carries the trope" of something, "draws four readings through" a given frame, or shares a lens with another film. We call it the sentence layer, and it is built entirely by rule. There is no language model in it and no randomness: each sentence is assembled directly from the database by a fixed template, and every value it names is a link to a real entity you can click through to. This page explains what the layer is, how it is made, and where its limits are.

## In numbers

> **hundreds of thousands**
> factual sentences
> assembled by rule across the catalogue, each carrying links to the entities it names

> **6,700+**
> films covered
> nearly every film in the catalogue has at least one sentence about it

## How a sentence is made

Every sentence comes from a template filled with values already in the database. When we say a film "was filmed at" a place, the place is a location record; when we say two films are kin, the pairing is a computed edge; when we say a film "carries the trope" of something, the trope is a [trope](/tropes) record that other films also stage. Nothing is paraphrased or summarised by a model — the sentence is the shortest true statement we can make from the rows we hold, and the words that would normally go stale (a title, a name, a count) are pulled live at render time.

Because every named value is a foreign key to a real entity, each sentence can render with working links. That is the point of the layer: it makes explicit a connection you could otherwise only find by running a query — that this film and that one were shot in the same city, or read through the same theorist's lens — and it turns that connection into something a reader, and a search engine, can follow.

## Thirteen patterns, eight themes

There are thirteen sentence patterns, grouped into eight themes:

| Theme | What it says |
|---|---|
| Kinships | how strongly two films connect, and the bridge that joins them |
| Readings | what a critic or theorist has argued about a film |
| Twin Lenses | two films read through the same idea or the same reader |
| Tropes & Frames | the recurring figures a film stages, and the frames its readings fall under |
| The Record | awards, honours, and where a film ranks |
| Filmography | films set beside others by the same director |
| Locations | where a film was filmed |
| Questions | an open question a film's connections raise |

The [kinship](/methodology/kinship) theme is the same fused signal documented in its own doc; the rest draw on [readings](/takescore), the trope and frame layers, the [lineage](/lineage) and honours record, [director](/director) filmographies, and [location](/locations) data. Each pattern has a rule for which sentences matter most on a given page, so the module leads with the ones that are rarest or most specific rather than the most generic.

## The brand contract

The module is signed. It is credited as **a data fantasia by Wonwoo Yoon**, and it carries a disclaimer that its sentences are **not AI-written and are independent of the filmmakers' intent**. We never remove either line. They are part of the contract of the layer: the credit says who designed the rules, and the disclaimer is a promise about what the sentences are and are not. They are computed statements of record and connection, not interpretations we attribute to the people who made the films.

## What we decided, and why

A few calls were not obvious. We chose the plain, factual voice over a more rhetorical one: the sentences state what is true and stop, because their job is to be trustworthy at a glance, not to persuade. We generate them from readings and records we already hold, never from viewing behaviour. We anchor every sentence to the film it is about, so the subject is never in doubt. And we only publish sentences drawn from published readings — retired or draft material is gated out, so nothing leaks into the layer that we would not stand behind elsewhere.

We also let scarcity guide ordering. A sentence that names something only a handful of films share tells you more than one that names something common, so the module surfaces the rarer connection first. None of these choices involves a model deciding what to say — they are rules about which true sentence to show.

## Limits

The sentence layer only knows what the database knows. If a location, an award, or a trope is missing from our records, no sentence about it will appear — absence in the module is not evidence of absence in the film. The sentences describe how films connect in our data, not the intentions behind them, and a connection the rules surface is a starting point for your own reading, not a verdict. And because the layer is regenerated as the catalogue changes, a sentence you saw once may be rephrased or drop away when its underlying rows change.

---

> The sentence layer sits under the same [corrections](/methodology#corrections) loop as everything else: if a sentence is factually wrong — a mislabelled location, the wrong award — tell us and we will fix the row it was built from.
`;
export default body;
