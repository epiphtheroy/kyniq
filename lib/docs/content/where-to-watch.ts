const body = `
# Where to watch: sources and freshness

Every "where to watch" page on Metatake answers one plain question — how can I legally see this film, in my country, right now? The answer is assembled from stored data, sentence by sentence, with no language model in the loop. This page explains where the availability comes from, what we add on top of it, and why each page carries a date.

## In numbers

> **6,900+**
> films with a watch page
> each one built from a stored country matrix plus whatever we could verify beyond it

> **dozens of countries**
> per film
> subscription, ad-supported, free, rent and buy, split out country by country

## The base matrix

The backbone of each page is a country-by-country availability matrix drawn from **TMDB** and **JustWatch**. For every country they cover, an entry is filed under one of five headings: **subscription** (a flat-rate service that carries the film), **ad-supported** (free to watch with ads), **free**, **rent**, and **buy**. This is the same data most streaming-finder sites lean on, and we treat it the same way — as a starting point, refreshed on a schedule, not as the last word.

We keep this layer honest about its own origin. Every page that shows the matrix stamps it plainly: *availability via TMDB and JustWatch, updated on a date*. If the underlying feed has not been refreshed, the date tells you so.

## The verification layer

A provider matrix misses things that matter to the people who read Metatake — the legal free copy of a silent classic, the film that sits on MUBI in one country and not its neighbour, the disc edition that is the only good way to see a restoration. So on top of the base matrix we keep a second, hand-checked layer.

It carries four kinds of finding, each with the date it was checked and the sources that were consulted:

| What we verify | What it records |
|---|---|
| Legal free archives | Public-domain and national-archive streams — Internet Archive, film-archive channels, cultural-nonprofit sites — with the reason each is legal and whether it carries subtitles |
| MUBI by country | Whether the film is streaming, rotating in and out, or absent — checked separately for each country, because MUBI's catalogue differs everywhere |
| Disc editions | Criterion spine numbers and other editions on file, noted because a restoration transfer is a different object from a free public-domain copy |
| Rotation and leaving alerts | When a service is flagged as dropping a title, so a page can warn that a door is about to close |

When we find nothing, we say so: a page can state that we checked the archives and there is no legal free stream right now, rather than leaving a silence you have to interpret.

## Assembled, not written

The prose on these pages is built by rule from the stored fields. A sentence such as "streaming on MUBI in three of the countries we check, Criterion spine on disc" is not composed by a model — it is a template filled from the verification record and the matrix. This keeps the page fast, keeps it faithful to the data, and means that when the data changes the sentence changes with it. Nothing is asserted that is not on file.

## What we decided, and why

A few calls shaped what these pages will and will not claim.

**Free means legal, and legal means verified.** We only surface a free source when we have checked why it is free — a lapsed copyright, a rights-holder's own upload, a public archive — and recorded the evidence. An unofficial upload of a film that is still in copyright is not a "free way to watch", however easy it is to find, and we leave it out.

**We check MUBI, and rotation, per country.** A single global "is it on MUBI" answer would be wrong for most readers. The verification layer stores a separate reading for each country, and the page shows your country's answer.

**The reader sets the country.** Availability is meaningless without a place. Each page lets you choose your watch country, and the matrix and the summary re-read for it. We do not guess your location silently and then present its answer as the truth.

**A disc is not a stream.** Where the only faithful version of a film is a physical edition, we record that plainly rather than pretend a scratchy free copy is equivalent.

## Limits

This is a map of doors, and doors move. A service adds a title the week after we checked; a free archive takes one down; a licence changes hands. The date on each page is the honest bound on how current it is — read it as "true as of," not "true forever." The base matrix refreshes on its own schedule and can lag a platform's own listing. The verification layer is deeper but narrower: it is strongest on the films our readers ask about most, and thinner in the long tail. And some perfectly legal free tiers — library-card services among them — sit outside what this layer tracks, so their absence here is not a claim they do not exist.

---

> Where to watch sits under the same [corrections](/methodology#corrections) loop as everything else: if a link is dead, a country is wrong, or a film has moved, tell us and we will re-check the row and re-date it.
`;
export default body;
