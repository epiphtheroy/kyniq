const body = `
# How the corpus grows

Metatake holds more films than it has close-read. This page explains why the catalogue is deliberately larger than the set of films we have written figures and readings for, how a new film turns into live pages, and what our monthly update does and does not touch.

## In numbers

> **6,900+**
> films in the catalogue
> each is at least an anchor: a resolved identity we can name and link to

> **{{n:lineage}}**
> lineage memberships
> a film's place in awards, canons, movements and national records

## The catalogue is wider than the readings

When we build a [lineage](/lineage) record — a festival's winners, a critics' poll, a national canon — we enumerate it *whole*. Every film a list names is entered, resolved against its identity on The Movie Database, whether or not we already held that film.

This is a decision, not an accident. If a list names a film we have not yet close-read, we do not skip it. We create an **anchor record** for it — a real, resolvable film with a stable identity — and mark it as not yet on screen. Local presence is never a gate on membership. A canon that dropped every film we happened not to hold would be a distorted canon, and the distortion would silently favour the well-trodden titles we had already covered.

So we keep two ideas separate. One is *membership*: is this film part of this record, yes or no. The other is *coverage*: have we written its figures and readings yet. A film can be a fully attested Palme d'Or winner in our data while still waiting for its own close reading. We record which films arrived through the catalogue we started with and which arrived through a canon later — but that flag is a note to ourselves, not a filter that hides anything.

## How a new film becomes live pages

A title becomes a set of pages through an ordered chain. Each step depends on the one before it.

| Step | What happens |
|---|---|
| **Identity** | The title, disambiguated by director, is resolved to a single unambiguous film on The Movie Database. Everything downstream hangs off that identity, so a wrong match here would attach the wrong film's whole graph. |
| **Metadata** | We pull the film's overview, genres, runtime, release and imagery. Without this a film collapses into a genre of "Other" and later steps lose their context. |
| **Figures** | We extract the film's [figures](/tropes) — its characters, objects, places and motifs — the units everything else is built on. |
| **Readings** | Each figure is given distinct interpretive readings across different critical frameworks. |
| **Connections** | Once the readings exist, the film enters the [connection](/network) engine: shared-figure and taste-distance signals are recomputed so the new film links to its neighbours, and its neighbours link back. |

Only when a film carries enough of its own readings to stand on its own do we let it be indexed. Until then the anchor record exists, is linked, and counts toward the record it belongs to — it simply is not yet offered as a finished page.

## What we decided, and why

Two calls here were not obvious.

**We enumerate against a shared identity, not against our own stock.** Resolving every film to the same public identifier is what lets a list we build today line up with a film we ingest next month. It is also what makes the "create an anchor rather than skip" rule safe: the anchor is not a placeholder guess, it is a real, resolvable film.

**Recomputing connections re-touches the whole graph, so we do it carefully.** Adding films can re-cluster and re-rank things that are already live. We keep incremental additions *additive* — a new film is fitted to the neighbours and groupings that already exist wherever it fits — and reserve any renaming or re-linking of existing pages for a separate, supervised pass, so a live page's address does not quietly change under a reader.

## The monthly update

Once a month we check the previous month's major awards for newly confirmed results. The rule is narrow and fixed: **we only add newly confirmed wins.** If the winning film is already in the catalogue, we add its new membership row. If it is not, we stage it and report it rather than guessing.

We never edit or delete an existing lineage row in this pass. A record of who won something is a historical fact; once entered and sourced, it stays. Corrections are a separate, deliberate act — never a side effect of an automatic update.

## Limits

An anchor record is thin by design: it can tell you a film exists and what record it belongs to, but not much more, until its readings are written. And because the catalogue grows from the lists we choose to enumerate, its shape reflects those choices — the selection of records is itself an editorial judgement, described in our [lineage method](/methodology).

---

> This layer sits under the same [corrections](/methodology#corrections) loop as everything else: if a film is misidentified or a membership is wrong, tell us and we will fix the row.
`;
export default body;
