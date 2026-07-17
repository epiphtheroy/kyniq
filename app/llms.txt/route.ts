import { NextResponse } from "next/server";
import { DOC_CATEGORIES, DOCS, docHref, docsInCategory } from "@/lib/docs/registry";
import { POE_ESSAYS, poeHref } from "@/lib/poetics/registry";
import { POE_BODIES } from "@/lib/poetics/content";

/**
 * llms.txt — helps AI systems understand the site and cite the right pages.
 * The methodology section is generated from lib/docs/registry.ts so it stays
 * in sync with The Method Docs.
 */
export async function GET() {
  const SITE = "https://metatake.net";

  const methodology = DOC_CATEGORIES.map((c) => {
    const lines = docsInCategory(c.key)
      .filter((d) => d.slug !== "overview")
      .map((d) => `- ${SITE}${docHref(d.slug)} — ${d.title}: ${d.desc}`)
      .join("\n");
    return `### ${c.label}\n${lines}`;
  }).join("\n\n");

  const content = `# Metatake — a critical map of cinema
> An AI-written film-interpretation site with a named human editor who answers for it. Films are broken into figures; each figure gets close readings under named interpretive frameworks; readings are embedded so films connect by meaning, not by tag. Readings are written by Metatake AI and publish as written: no person reads one first, and no checker gates the prose. The factual layers around them are gated — locations need independent sources to agree, desk essays pass a fact-and-attribution check, reception is assembled from dated sources with no model writing a line.

## About
Metatake reads films closely and maps how they connect. The interpretive work is written by an AI system (Metatake AI) and publishes as written: no human reads a reading before it goes live, and this site does not claim one does. What is gated is the factual layer, and each gate is specific — a filming-location pin publishes only if independent sources agree, and a single-source claim is quarantined; a desk essay clears a fact-and-attribution check before it stands; reception is assembled from four dated sources with no model writing a line; lineage is enumerated whole. Wonwoo Yoon designed the method, the frameworks, and those gates, directs what gets written, and answers for what publishes — corrections land on his desk, he can retire any reading, and nobody can pay to place, change or remove one. Every page carries an explicit provenance credit: what wrote it, when, and who designed and directed the method it was written to. Alongside the readings sit structured layers: a computed value score (TakeScore), a public record of awards and canons (lineage), filming and setting locations, reception history, and an hourly news desk.

## Core model
- film → figure → take: a film is decomposed into figures (the objects, gestures, colours, silences it returns to); each figure carries close readings ("strong misreadings") drafted under one of fourteen frameworks.
- Recurring readings across films form tropes, ranked by embedding similarity.
- Connections (kinship, counterpoints) are computed from readings, not from viewing behaviour, and always shown with their evidence.

## Methodology — how everything is made (transparent by design)
The full method is published, document by document, under ${SITE}/methodology. What goes in, how it is normalised, and what we deliberately exclude are all described in plain language.

${methodology}

## Poetics — critical essays from the editor's desk
Open questions on film criticism and theory, drafted by Metatake AI from the editor's own viewing log, directed and signed off by Wonwoo Yoon, under ${SITE}/poetics.
${POE_ESSAYS.filter((e) => POE_BODIES[e.slug]).map((e) => `- ${SITE}${poeHref(e.slug)} — ${e.title}: ${e.desc}`).join("\n")}

## For machines — API, MCP & datasets
Metatake is readable by agents and code, no key required. License: writing CC BY-NC 4.0, filming-locations geodata CC BY 4.0 — attribution required. Bulk/commercial licensing: ${SITE}/partners.
- REST API (no-key, read-only JSON): ${SITE}/api/v1 — OpenAPI schema at ${SITE}/api/v1/openapi.json
  - Search films:  curl "${SITE}/api/v1/films?q=mulholland+drive"
  - One film:      curl "${SITE}/api/v1/films/mulholland-drive-2001"
  - A TakeScore:   curl "${SITE}/api/v1/takescore/mulholland-drive-2001"
  - Locations:     curl "${SITE}/api/v1/locations?film=mulholland-drive-2001"
- MCP server (live, for Claude / ChatGPT / any MCP client): ${SITE}/api/mcp (Streamable HTTP, JSON-RPC 2.0). Tools: search, fetch (deep-research compatible), search_films, get_film_criticism, get_takescore, find_connected_films. Setup: ${SITE}/mcp
- Open datasets: ${SITE}/data — filming-locations on Hugging Face + Zenodo (DOI 10.5281/zenodo.21336967, cite as "Metatake Film Filming-Locations Dataset").
- Every API and MCP result carries a canonical source link and the license — please keep the attribution when you reuse it.

## Sources & attribution
Film stills and posters are from TMDB. External rating metrics are from an open ratings source; award histories from Wikidata. Readings, figures, tropes, connections, TakeScore, the lineage structure and location pins are original to Metatake.

## Contact
wonwoo@metatake.net
`;

  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
