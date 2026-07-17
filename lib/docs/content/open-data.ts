const body = `
# Open data and reuse
Most of what Metatake compiles is meant to be built on, not fenced off. This page says plainly what we have published as open data, and how you may reuse anything you find on the site.

## The filming-locations dataset
The one layer we hold that does not really exist elsewhere as open data is the map of *where films were shot and set* — and rather than keep it behind a wall, we have published it. It is a structured, geocoded record of 17,341 locations across 1,917 films and 130 countries, each with coordinates, and — the part that makes it unusual — each labelled as either where a film was physically **filmed** or where its story is **set**. The two are kept apart, the same way they are on the [Locations](/methodology/locations) layer.

It lives in two places:

> **[Hugging Face](https://huggingface.co/datasets/wonwooyoon/metatake-filming-locations)** — for anyone who wants to load it into a notebook or a model.

> **[Zenodo](https://doi.org/10.5281/zenodo.21336967)** — archived with a DOI, so it can be cited in a paper. Cite the dataset as *Metatake Film Filming-Locations Dataset*, DOI 10.5281/zenodo.21336967.

It is curated interpretive data, not a complete production registry — coverage follows the films we have read closely — and it inherits the same precision honesty as the map: a city-level place is a real answer, not a precise one, and it is labelled as such.

## The licence, plainly
We would rather you use this work with credit than not use it at all. Two licences apply, and the line between them is simple.

**Facts and geodata are CC BY 4.0.** The filming-locations dataset — and the same data served through the [API](/methodology/api) — is free to use, share, adapt, and even build a commercial product on, on one condition: **attribute Metatake and link back.** That is the whole of it.

**Our writing is CC BY-NC 4.0.** The original criticism — the readings, the essays, the scored assessments — is free to quote and reuse **with attribution**, but **not commercially**.

Be precise about what that licence rests on, because the obvious answer is the wrong one. It does not rest on a person having typed these sentences. A person did not: Metatake AI writes them, and this site says so on the page. What it rests on is the part that took the judgement and the investment — **which films get read at all, under which of fourteen frameworks, which figure a reading follows, how the readings are placed against each other, and what the record has to survive before it ships.** That selection, that arrangement, that corpus, and the corroboration behind the factual layers are the work of a named person and years of it. That is the thing we license, and the thing we ask you not to sell.

So: quote a reading, with attribution, and we are glad — that is what it is for. Take the collection, or a substantial part of it, strip the source link, and present it as your own reading of cinema, and you are not taking a sentence. You are taking the part someone actually made, and you are taking from the reader too — the link is what lets them check the method behind the claim, and without it your version is exactly the unsourced verdict this whole site exists to refuse.

In both cases attribution is not a formality but the point: every surface on the site, and every response the machines return, carries a source link for exactly this reason. Keep it, and you are free to go.

## Why open it at all
The honest answer is that an open, cited record is worth more to us than a hoarded one. A dataset researchers can cite becomes a small piece of the scholarly record; a link a writer can follow becomes a reader. We are a small, independent project, and being *the* place a fact traces back to is a better position than being the place that guarded it.

---
> If you use the dataset or the API in something, we would like to hear about it — see [working with Metatake](/methodology/collaborate). Corrections to a location go through the same [corrections](/methodology#corrections) loop as everything else.
`;
export default body;
