const body = `
# The live desk

Now Playing is Metatake's live desk. When a film or film-maker spikes in the world's attention, it publishes a letter within the hour — written by Metatake AI, cleared by a machine gate, and published unattended — anchored to one film already in our corpus. The editor reads the stream after the fact, twice a day, and pulls what does not hold. This page explains what has to be true before a letter goes live, what only gets checked afterwards, and what we deliberately refuse to let it do.

The point of the desk is to have the reflexes of a news operation and write the opposite of news: not what happened, but why it matters and where it sits in film history — argued, dated, and checkable.

## Detection runs on public signals

Nothing is invented into existence. The desk watches the open web — search-trend feeds and a set of RSS feeds from the major film and general-news publications — and looks for a subject that is spiking now. These are public signals anyone could read; we are reading them against our own library. A trending term is only ours to write about if it resolves to a film or film-maker we already hold. Most spikes do not, and those are logged and left alone.

## It must resolve to a film we hold

Before a letter is even attempted, the candidate has to pass through the same **embeddings** that power the rest of the site — the map of meaning behind kinship, counterpoints, and every ranked list. The spike must resolve to a specific film in the corpus. If it does not resolve, there is no letter. We would rather stay silent on a story than write around a film we have not actually read.

## Every figure is retrieved, not remembered

Once a film is anchored, the letter is allowed to cite it — but only from what the database can hand over. Every figure it uses is **retrieved, not remembered**: the film's [TakeScore](/takescore) verdict, its reception arc, its place in the [lineage](/lineage), the places it was shot, the readings it deposits — each pulled live at the moment of writing and linked back so a reader can follow it to its source. The letter may caption what the corpus already knows; it may not reach past that. Nothing archival is invented, and no fact goes in without a link a reader can check.

## Two gates before it is public

Every letter clears one gate before it publishes, and it is a **machine gate**: it checks that the piece rests on at least two independent sources, that the internal links it carries actually resolve, and that the shape of the letter is what a letter should be. A piece that fails is held, not smoothed over.

Then it publishes — unattended, within the hour. Be clear about what that means, because it is the weakest guarantee on the site and the one most worth stating plainly: no person reads a letter before you can. The gate checks structure and sourcing, never judgement, and it deliberately does not touch the prose — a letter reaches the page in the voice the model wrote it in. Human review here is **after** publication: the editor sweeps the stream morning and evening, and pulls what does not hold, with the reason logged. A standing hold file stops the whole desk when it needs stopping. That is a real check and a real accountability, but it runs behind the reader rather than in front of them, and it is the reason this desk is held to a narrower promise than the readings: anchored to the corpus, sourced twice, never inventing a film — rather than reviewed before you see it.

## What we decided, and why

A few calls were not obvious, so here is how we settled them.

We **timestamp every letter to the minute**, for both when it was written and when it was published, and we keep those two moments distinct. The dateline leads with where the news broke and the day it broke — not the hour we happened to publish — because the honest frame is "we read this, and this is what we think", not a pretence of being first.

We show TakeScore as a **verdict, not a rank**. A letter says "high value, high risk" or "solid but not peak" rather than assigning a number's place in a league table, because a corpus rank invites an argument the number cannot settle. A rank is named only when a film stands inside the top thousand — where the standing is unambiguous enough to state plainly.

We write to **wound no one**. A letter takes positions on works, ideas and institutions; it never attacks a person's character. Praise and criticism from the world's reception are reported as reported facts, from a neutral distance — never turned into an attack on the people who made or appear in the film. Neutrality is the default, and it is a rule, not a mood.

And **no day goes dark**. A quiet day — nothing spiked, nothing published — still gets a short digest, filed under its date, so the record has no gaps. A silent day is recorded as a silent day rather than skipped.

## Limits

The desk measures attention, not importance. A spike tells us a film is being talked about today; it does not tell us the film is good, and a letter never pretends the two are the same. We only write about films we already hold, so a genuinely new release with no reading in the corpus will pass without a letter until it earns one the slow way. And a letter is a first take under time pressure — argued in good faith from the record as it stood that hour, not a final verdict. When the record moves, so can we.

---
> The live desk sits under the same [corrections](/methodology#corrections) loop as everything else: if a letter gets a date, a credit, or an anchored film wrong, tell us and we will fix the row.
`;
export default body;
