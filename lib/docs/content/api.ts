const body = `
# The API
Everything a reader can see, a program can read too. Metatake publishes a small, free, read-only web API so that the criticism can be used inside other tools — a research script, an agent, a Custom GPT — without anyone having to scrape the pages. There is no key and no sign-up.

## What it exposes
Four things, each a plain web address that returns structured data:

- **Search** — find films by title, original title or director.
- **A film's record** — its [TakeScore](/methodology/takescore), the multi-framework [readings](/methodology/strong-misreadings), kindred films and more, as one document.
- **A film's TakeScore** — the [thirteen dimensions](/methodology/takescore-dimensions) on their own.
- **Filming locations** — the [geodata](/methodology/open-data), by film or by country, with coordinates.

The full list, with live examples you can click, is at **[metatake.net/api](/api)**. Every response carries the film's link back and a line on how to cite it.

## Made for citation, not scraping
The design goal is narrow: the API is here so that a machine using our work is nudged to *credit* it, the opposite of anonymous bulk scraping. Each response says where it came from and under which [licence](/methodology/open-data) — the factual data free to reuse with attribution, including commercially; the writing free with attribution, non-commercially. Wholesale harvesting is rate-limited; ordinary use is not.

## Drop it into a Custom GPT
Because the API ships an OpenAPI description, you can turn it into a ChatGPT "Action" in one step — paste the schema address, no code — and make an assistant that knows Metatake. The how-to is on the [API page](/api). The same description works for other agent frameworks.

---
> The API is the machine-readable face of the same record described throughout these docs; nothing in it is generated on demand — it reads what is already compiled and assembled by rule. To read it *inside* an AI assistant conversationally rather than call it, see [Metatake in your AI](/methodology/mcp).
`;
export default body;
