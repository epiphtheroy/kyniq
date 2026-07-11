const body = `
# Credits and collaborations

The [Credits](/credits) explorer treats a filmography as a set of relationships, not a flat list. Pick what you liked in a film — the directing, the writing, the cinematography, the editing, the score, the production design — and we open the person behind it as a body of work: their films ranked by a weighted consensus, the collaborators who recur across them, and the troupe that forms over time. This page explains where the record comes from, how it is ranked, and the rules we follow when we turn it into sentences.

## Where the record comes from

The credit data — casts, full crews, images, release years, vote counts and ratings — comes from **The Movie Database (TMDB)**, and we attribute it on every screen: *this product uses the TMDB API but is not endorsed or certified by TMDB.* TMDB is unusually complete below the line, which is why crew members can be first-class here rather than a footnote.

Award histories are a separate matter. TMDB carries no award data, so where we show honours we draw them from **Wikidata**, which is released under a public-domain dedication. We look a person up by their IMDb identifier and read back the awards recorded against them, most recent first.

## Ranking by weighted consensus, not popularity

We never rank a person's films by popularity. A popularity figure moves with the day's page views; it tells you what is being looked at, not what holds up. Instead each film is scored by a **Bayesian weighted rating** — the same idea behind our [TakeScore](/takescore) work — which pulls a thinly-voted title back toward a prior rather than letting a handful of votes crown it.

The textbook form is:

**WR = (v·R + m·C) / (v + m)**

Here **v** is the number of votes a film has, **R** is its raw rating, **C** is a prior mean — for us, the average rating across this person's own films — and **m** is a smoothing weight. When a film has many votes, WR sits close to its own rating; when it has few, WR is dragged toward the person's baseline, so a single glowing vote cannot outrank a career. The exact clamp on **m** and the vote thresholds that sort films into the shortlists are ours and not published, but the shape is exactly the one above.

## Matching roles

To gather a person's work in one craft, we have to read TMDB's department-and-job strings, and these are noisier than they look. We match **exactly and by department gate**: a job counts only if it is one of an explicit set of job titles *and* it sits in the expected department. So a cinematographer is someone credited as Director of Photography (or Cinematographer) in the Camera department — not anyone whose job string happens to contain the word "camera". Two department quirks trip up naive matching, so we hard-code them: composers live under **Sound**, not a "Music" department, and production designers live under **Production** or **Art**. Getting the gate wrong does not just misrank a person — it fails to find them at all.

## Troupes and reunions

Once we have a person's films, we read the full crew and leading cast of each and count who reappears. A **troupe** is a collaborator paired with our subject on **at least two films** — three, for producers and recurring cast, where a single shared credit means less. Every count is exact within the set of films we analysed, and we say so on screen: "N of M films analysed", with any films we failed to load shown honestly rather than hidden.

A **reunion** is a re-teaming after a real gap: the subject made other films without that collaborator in between, and **five or more years** passed, before they worked together again. We mark it because it is a story — a partnership resumed — not because it changes any score.

## When there is no award record

Absence is reported as absence, never guessed. If Wikidata holds no awards for a person, we say the record is empty rather than implying they won nothing; if we cannot even resolve their identifier, we say we could not look. Empty is not the same as zero, and neither is the same as unknown — a distinction we keep everywhere the crew record thins out, which it does most for pre-2000 and non-English-language films.

## Verbalisation is deterministic

Where we render credits as prose — a person's collaborations written out as readable sentences — no language model is involved. Every sentence is assembled by rule from the data, and the rules are strict. Each sentence is self-contained and names people **in full**, with no pronouns and no dropped subjects. When we mention a number of people we list all of them by name, because "three collaborators" hides who they were. We use only deterministic operations — counting, first and last, grouping, spans of years — and we forbid evaluative words entirely: no "masterpiece", no "peak", no "late start", nothing about ratings or rank. Missing data is marked **unknown**, and "nobody recurred" is written only when crew data exists and simply held no returning names.

## What we decided, and why

A few calls were not obvious. We rank on **weighted consensus rather than popularity** because popularity is a traffic number and we wanted a durability number. We match roles **exactly** rather than by keyword because the loose version silently files a casting director under directing and poisons everything downstream. And we keep the verbalised sentences **rule-written** rather than generated, so that every claim traces to a row and none is invented for fluency.

## Limits

The record is only as complete as TMDB's crew data, which is uneven; the same person occasionally appears under more than one identifier, which can split a body of work; and a film with two cinematographers may surface only the first. Collaboration counts are exact within the films we read, not across an entire career. We show what the sources hold and mark the rest unknown.

---

> Credits sit under the same [corrections](/methodology#corrections) loop as everything else: if a name, role or year is wrong, tell us and we will fix the row.
`;
export default body;
