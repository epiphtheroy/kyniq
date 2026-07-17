/**
 * GET /api/v1 — the machine-readable discovery index for Metatake's public API
 * (HANDOFF-AI봇맞이하기.md §2.5, the discover→query→cite chain). A single authless
 * JSON entry point that an agent hits first: it names every endpoint, the OpenAPI
 * schema, the MCP server, the open datasets, the license, and the attribution
 * requirement — so a crawler can walk registry → /.well-known → openapi → llms.txt
 * → here → /partners without guessing URLs.
 */
import { NextResponse } from "next/server";
import { API_CORS } from "@/lib/apiGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS });
}

const SITE = "https://metatake.net";

export function GET() {
  return NextResponse.json(
    {
      name: "Metatake Film Criticism API",
      description:
        "Read-only, no-key access to Metatake — original film criticism, AI-drafted and human-reviewed, for 6,700+ films: " +
        "multi-framework readings, the 13-dimension TakeScore, canon lineage, filming locations, tropes and kindred films.",
      version: "1.0.0",
      documentation: `${SITE}/api`,
      openapi: `${SITE}/api/v1/openapi.json`,
      endpoints: {
        search_films: { url: `${SITE}/api/v1/films?q={query}`, method: "GET", description: "Search films by title, original title, or director." },
        film: { url: `${SITE}/api/v1/films/{slug}`, method: "GET", description: "One film's full record: readings, TakeScore, figures, tropes, kindred." },
        takescore: { url: `${SITE}/api/v1/takescore/{slug}`, method: "GET", description: "A film's 13-dimension TakeScore." },
        locations: { url: `${SITE}/api/v1/locations?film={slug}`, method: "GET", description: "A film's (or a country's, via ?country=) filming locations." },
      },
      mcp: {
        endpoint: `${SITE}/api/mcp`,
        transport: "streamable-http",
        docs: `${SITE}/mcp`,
        tools: ["search", "fetch", "search_films", "get_film_criticism", "get_takescore", "find_connected_films"],
        deep_research_compatible: true,
      },
      datasets: {
        hub: `${SITE}/data`,
        filming_locations: { license: "CC BY 4.0", doi: "10.5281/zenodo.21336967" },
        criticism_corpus: { license: "CC BY-NC 4.0" },
      },
      partners: `${SITE}/partners`,
      license: "CC BY-NC 4.0 (writing) / CC BY 4.0 (filming-locations geodata) — attribution required",
      attribution: "Metatake",
    },
    { headers: { ...API_CORS, "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}
