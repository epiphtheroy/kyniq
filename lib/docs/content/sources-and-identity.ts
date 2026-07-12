const body = `
# Sources and identity

Metatake is a mix of things we borrowed and things we made, filed against one shared spine. This page draws the line between the two: which facts about a film come from outside sources, which judgements are ours, and how every layer of the site is pinned to the same film so that a reading, a lineage membership, and a location pin can never drift onto different movies. The concrete lists, outlets and databases we track are enumerated separately in [the sources we monitor](/methodology/sources-we-monitor).

## The spine: one TMDB identity

Every film on Metatake is anchored to its entry on [TMDB](https://www.themoviedb.org/), the open community film database. That single identity is the spine the whole site is built on. When we compute a close reading, file a film into a canon, or drop a pin where it was shot, all three point back at the *same* TMDB film — not at a title string, not at a year, not at our best guess. This is what lets the layers agree with one another: a reading and a lineage entry are talking about one movie because they resolve to one identity.

The discipline that keeps the spine honest is a rule about doubt. When we bring in an outside list and a title cannot be matched to a TMDB film with confidence, it is **held rather than guessed**. A list may honestly show fewer entries than it started with rather than pretend a rough match is a real one. We would rather a page admit a gap than quietly file a film against the wrong record.

## What we borrowed

Some of what you see on a Metatake page did not originate with us, and we say so.

| Borrowed | Source | Note |
|---|---|---|
| Posters and stills | TMDB media | attributed to TMDB wherever shown |
| External rating metrics | an open ratings source | shown as reference numbers, not our appraisal |
| Awards and honours facts | official records and Wikidata | linked to the award's entity where one exists |
| Critic links | the outlets themselves | we link to the article; we never reproduce its body |

Two of these deserve a word. The critic links point *outward* — we send a reader to the review at its home, and the argument stays with the writer who made it. And where a reading leans on published film scholarship, we credit that scholarship rather than passing the idea off as our own; that is what an *anchored* reading means. Most readings are not anchored, and those are original interpretations built here.

## What is ours

Everything that carries a judgement is our own work, made on the site and answerable to a named editor.

The readings and the figures they read; the [tropes](/tropes) that connect figures across films and the [connections](/network) computed from them; [TakeScore](/takescore), our appraisal of a film's value against its cost and risk; the [to.W](/methodology#index) notes that say why a film earned its place in the catalogue; the [lineage](/lineage) structure that files a film against canons, awards and national cinemas; and the location pins that place where a film was shot and where it is set. None of these is borrowed. They are the part of the site that has an opinion, and the opinion is ours to defend.

## What we decided, and why

A few calls shaped how the borrowed and the made fit together.

We anchor on TMDB **because it is open and shared**, not proprietary to us — which means a Metatake identity is one anyone can look up and check, and one that other film databases already speak. Borrowing an open identity keeps our judgements auditable against the outside world.

We keep **ratings and appraisal apart**. The external rating metrics we borrow describe how a film was received; TakeScore is our own reading of what it is worth watching. We show both and let them disagree, rather than blending someone else's number into ours and calling the result objective.

We link to critics **instead of absorbing them**. It would be easy to fold a review's substance into a page; we do not. The link honours the writer and keeps our pages honestly ours — an argument we made, sitting next to a door to arguments others made.

## Limits

Borrowed data carries borrowed gaps. Where TMDB is thin — a poster missing, a credit incomplete — our page is thin in the same place, because we do not invent metadata to fill it. External rating metrics are only as current as the source we read them from, and they measure popularity and reception, not merit. And the TMDB spine means a film effectively does not exist on Metatake until it has a TMDB identity to hang on; a title with no clean entry is one we hold back rather than fabricate a record for.

---
> Sources and identity sit under the same [corrections](/methodology#corrections) loop as everything else: if a film is matched to the wrong TMDB record, or a source is misattributed, tell us and we will fix the row.
`;
export default body;
