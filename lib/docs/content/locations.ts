const body = `
# Locations: setting and filmed
Every pin on Metatake's map belongs to one of two geographies, and we keep them strictly apart. There is the world a film is *set in* — the places its story names and claims to inhabit — and there is the world a film was *shot in* — the real streets, rooms and landscapes a crew actually stood on. These are not the same thing, and conflating them is the commonest mistake a film map can make. This page explains how each layer is compiled, what a pin carries, and where we stop rather than guess.

## In numbers
> **{{n:locations}}**
> mapped locations
> geocoded places behind the Locations layer, each filed with the scene it carries and how sure we are of it

## Two geographies, never merged
A film set in Vienna may have been photographed on a backlot in California; a film that names no city at all may have been shot in three real countries. Because the two answers diverge so often, the map colours them differently and lets you toggle between them.

**Setting** is the narrative geography — the places a film is about, references, or pretends to be. We build it from the real, mappable places already named in a film's own [figures](/network) and overview: a landmark a scene turns on, a neighbourhood a character comes from, a country the plot crosses into. Invented places — planets, fictional towns, dream-realms — get no pin; they are not on any real map, and we will not put them on ours.

**Filmed** is the production geography — where the camera actually was. This layer is compiled separately, from public sources and production records, and it answers the plain question a reader arrives with: where was this filmed?

## What a pin carries
A location on Metatake is compiled, not scraped. Each place is researched from public sources, geolocated, and filed with four things: the **scene or role** it carries in the film, a **precision label**, a **confidence score**, and its provenance.

The precision label is the honest core of it. A pin is marked at the level we can actually stand behind — an exact spot, a named venue, a smaller area, or, where the record is thin, simply the **city level**. We would rather say "somewhere in this city" and mean it than invent a street address to look precise. Accuracy is favoured over coverage throughout: **where we are not confident of a place, there is no pin at all.** A sparse map that is right beats a dense one that is guessing.

## Verified by independent agreement
Filmed places are the harder of the two layers to get right, because the loose facts that circulate online are often wrong or copied from each other. So we collect them through more than one **independent pass** and fuse the results. When two independent sources land on the same place, that place is marked **verified**; a place that only one pass found is held at lower confidence rather than presented as settled. Agreement between sources that did not consult each other is the closest thing to corroboration a compiled record can offer, and it is the bar we hold filmed pins to.

## What we decided, and why
A few calls shaped this layer, so here is how we settled them.

We **describe places in our own words.** Every scene note and place description on the map is reconstructed from what we learned, not lifted; no third party's sentence and no third party's photograph is copied onto a pin. What travels from a source is the underlying fact — a location, a coordinate — never its phrasing.

We chose **granularity honesty over uniform detail.** It would be tidy if every pin sat on an exact address, but the true record is uneven: some places are documented to the doorway, others only to the district. Rather than smooth that over, the precision label exposes it, so a reader can see how firm each pin is.

And we let the **two layers disagree in public.** When a film's setting and its filming location fall on opposite sides of the world, the map shows both, plainly labelled, instead of collapsing them into one answer. The gap between where a story lives and where it was made is often the interesting part.

## Limits
This is a map of *places*, not a complete production history. Coverage is uneven by design — a film with a thin public location record gets a thin, honest set of pins, and some films yield none because their real geography could not be confidently established. A city-level pin is a real answer, not a precise one, and it is labelled as such. And because both layers are compiled from public sources, they inherit whatever those sources got wrong; the correction loop below is how those errors leave the map.

---
> Locations sit under the same [corrections](/methodology#corrections) loop as everything else: if a pin is in the wrong place, or filed under the wrong layer, tell us and we will move it.
`;
export default body;
