import { NextResponse } from "next/server";
import { DOC_CATEGORIES, DOCS, docHref, docsInCategory } from "@/lib/docs/registry";

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
> An AI-drafted, human-edited film-interpretation site. Films are broken into figures; each figure gets close readings under named interpretive frameworks; readings are embedded so films connect by meaning, not by tag. Every reading is reviewed and signed off by a human editor before it publishes.

## About
Metatake reads films closely and maps how they connect. The interpretive work is drafted by an AI system (Metatake Editorial) and reviewed by a named human editor, Wonwoo Yoon, who checks every reading's facts and takes responsibility for the page. Alongside the readings sit structured layers: a computed value score (TakeScore), a public record of awards and canons (lineage), filming and setting locations, reception history, and an hourly news desk.

## Core model
- film → figure → take: a film is decomposed into figures (the objects, gestures, colours, silences it returns to); each figure carries close readings ("strong misreadings") drafted under one of fourteen frameworks.
- Recurring readings across films form tropes, ranked by embedding similarity.
- Connections (kinship, counterpoints) are computed from readings, not from viewing behaviour, and always shown with their evidence.

## Methodology — how everything is made (transparent by design)
The full method is published, document by document, under ${SITE}/methodology. What goes in, how it is normalised, and what we deliberately exclude are all described in plain language.

${methodology}

## Sources & attribution
Film stills and posters are from TMDB. External rating metrics are from an open ratings source; award histories from Wikidata. Readings, figures, tropes, connections, TakeScore, the lineage structure and location pins are original to Metatake.

## Contact
wonwoo@metatake.net
`;

  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
