const body = `
# Close readings and catalogue records

Not every film on Metatake gets the same kind of page. Some have been read closely — broken into figures, each carrying published readings. Most have not; they are catalogue records that carry facts and a short editor's note. We keep the two kinds visibly different, and only one kind is offered to search engines. This page explains the two tiers, how a film moves from one to the other, and why we do not dress a stub up as an essay.

## In numbers

> **6,900+**
> films in the catalogue
> the full universe we hold — most as catalogue records

> **{{n:films}}**
> read closely
> broken into figures with published readings; these are the pages we index

> **6,700+**
> carrying a TakeScore
> almost every catalogue film is scored, read closely or not

## Two kinds of page

A **close-reading page** is a film we have actually written about. Its figures — characters, objects, locations, forms — carry published [readings](/tropes), and those readings feed everything else on the site: the connection graph, the [lineage](/lineage) ribbons, the trope hubs. These are the pages we put in the sitemap and offer to search engines.

A **catalogue record** is a film we hold data for but have not yet read. It carries syndicated metadata — a synopsis, a poster, external ratings, where you can watch it — plus a short **editor's digest**: a deterministic paragraph built from the facts we do hold (its place in any canon lists, one recommendation reason quoted from a film that points to it, its ratings, filming locations, viewing regions). The digest is honest about what it is. It is a record, not an essay, and it says so.

Catalogue records are kept **noindex**. They are fully usable inside the site — they appear in search here, in the [network](/network), on people's filmographies, on the [locations](/locations) map — but we ask search engines not to list them. A page whose only content is syndicated metadata adds nothing to the open web that a dozen other sites do not already carry, so we do not compete for it.

## How a film promotes itself

The line between the two tiers is not drawn by hand. A film promotes itself. Once it has at least **three approved figures**, a database trigger flips it to a full close-reading page: indexed, added to the sitemap, and pulled into every module that surfaces read films. There is no editorial switch to throw, no manual review of the sitemap, no separate publish step. The moment the reading work crosses the bar, the plumbing rearranges itself around the new page.

This matters because it keeps the promise honest in both directions. A catalogue record cannot be quietly promoted to look like an essay without the essay actually existing; the figures have to be there. And a film that has been read closely cannot be left languishing as a stub — the trigger surfaces it automatically.

## What we decided, and why

A few calls here were deliberate.

**We index what we have read, and only that.** It is tempting to open the whole catalogue to search engines — more pages, more surface. We decided against it. Thin, syndicated pages at scale read as doorway content, and they are, so we hold them back rather than pad them into something they are not.

**We keep the two templates visibly distinct.** A catalogue record does not borrow the close-reading layout. It leads with the editor's digest, marks itself as a record, and demotes the raw synopsis to the bottom. The point is that a reader — and a crawler — can tell at a glance which kind of page they are on.

**Catalogue records still carry real editorial signal.** Even unread, a film sits inside curated [lineage](/lineage) lists, gets recommended by films we *have* read, and may carry our own filming-location data. The digest draws only on those held facts. It carries the credit that fits what it is — composed by the Metatake method, designed and supervised by a named editor — and it is stamped with the date its underlying data last changed: never back-dated, never invented. A record does not get a writer's byline here, because the sentences around it were assembled rather than written. One thing inside it *was* written, and it is marked as a quotation: where a film we have read recommends this one, the digest quotes that recommendation's reason in full, and that line is model-drafted prose like any other reading on the site.

**Promotion is a data fact, not a marketing decision.** The bar is the reading work itself, expressed as approved figures. Nothing about traffic, ratings, or fame moves a film across the line.

## Limits

The tier a film sits in reflects **where our reading has reached, not the film's worth**. A great film we simply have not written about yet lives as a catalogue record, indistinguishable in that respect from a minor one. The number of read films grows as the writing does; it is not a ranking.

The digest on a catalogue record is assembled from data, so it is only as complete as that data. Where we hold little — a film with no canon placement, no inbound recommendation, no location pins — the digest is short, and we would rather it be short than filled out with generic prose. And because promotion is automatic, a film can cross into the indexed tier the day its third figure is approved, which means the set of indexed pages is always moving.

---

> Tiering sits under the same [corrections](/methodology#corrections) loop as everything else: if a catalogue record carries a fact that is wrong, tell us and we will fix the row.
`;
export default body;
