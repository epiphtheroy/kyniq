const body = `
# Bots and crawlers

Metatake both runs a small web crawler and receives a great many of them. This page explains how our own crawler behaves when it reads other sites, and how we treat the bots that come to read us — because the same courtesy ought to run in both directions.

## How we crawl

Metatake runs one small, identified crawler, **MetatakeBot**. It never browses anonymously: every request it makes carries a User-Agent that links back to a public page at [/bot](/bot) explaining who it is, what it fetches, and how to turn it away. It reads only the public reference sources our research needs — credits, release history, honours, reception, geography — a page at a time, slowly, never from behind a login, and it collects no personal data.

And it extends to every other site the same courtesy we ask for our own. It reads and obeys each site's **robots.txt**, and a single line there is enough to send it away for good. There is no clever workaround, no second User-Agent, no pretending to be a browser; a site that says no is left alone.

## How we treat crawlers that visit us

We try to treat the bots that visit *us* the way we would want MetatakeBot treated. When an identified crawler — one that says plainly who it is — calls on Metatake, we may pay a single courtesy visit back to the homepage it publishes about itself: an honest "you visited us, here we are" handshake. That visit is made only to an address the crawler advertised, at most once per site, and only where that site's **robots.txt** permits it. It is a greeting, not spam, and it carries nothing false.

## Citation welcome, wholesale scraping declined

Not every bot is equal, and we do not pretend otherwise. We keep an open door for the search engines and citation bots that index us or quote us to readers, because they carry people *toward* the writing — that is the point of publishing it. What we decline are the bulk scrapers and training harvesters that would take the entire site to resell or to feed a model wholesale. The reading here is meant to be read, cited and linked — not copied out in bulk.

We keep the exact machinery of that gate to ourselves, for the ordinary reason that publishing the lock helps the people trying to pick it. But the principle is public, and it is simple: identify yourself, respect **robots.txt**, send readers our way, and you are welcome.

## Limits

None of this is a wall against people. A policy tuned to decline abusive automated traffic will occasionally be too cautious, or not cautious enough, and a crawler's stated identity is only as trustworthy as the crawler. So there is always a human door: anyone can email a real person to ask our crawler to slow down or stop, or to tell us a good bot was turned away by mistake, and we will look into it.

---

> This policy sits under the same [corrections](/methodology#corrections) loop as everything else: if MetatakeBot has misbehaved on your site, or a well-behaved crawler of yours was wrongly turned away, tell us at [wonwoo@metatake.net](mailto:wonwoo@metatake.net) and we will fix it.
`;
export default body;
