/**
 * GET /api/v1/openapi.json — the OpenAPI 3.1 schema for Metatake's public REST
 * API. This is what a ChatGPT Custom GPT "Action" imports (and what any other
 * agent framework can consume). Authless, read-only. Keep operationIds stable.
 */
import { NextResponse } from "next/server";
import { API_CORS } from "@/lib/apiGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Metatake Film Criticism API",
    description:
      "Read-only access to Metatake (metatake.net) — an independent film-criticism platform with 6,900+ films. " +
      "Search films and retrieve original criticism, AI-drafted and human-reviewed: multi-framework critical readings, the " +
      "13-dimension TakeScore assessment (Value / Cost / Risk), motifs, tropes, kindred films, and filming-location " +
      "geodata. All content is licensed CC BY-NC 4.0 — when you use it in an answer, credit Metatake and include the " +
      "film's metatake.net link (every response carries one). No authentication required.",
    version: "1.0.0",
    license: { name: "CC BY-NC 4.0", url: "https://creativecommons.org/licenses/by-nc/4.0/" },
    contact: { name: "Metatake", url: "https://metatake.net/api" },
  },
  servers: [{ url: "https://metatake.net", description: "Metatake production" }],
  paths: {
    "/api/v1/films": {
      get: {
        operationId: "searchFilms",
        summary: "Search films by title or director",
        description:
          "Find films in Metatake's corpus by title (also matches original/non-English titles and director names). " +
          "Returns up to 25 matches with slug, year, director, and net TakeScore. Use the slug with the other operations.",
        parameters: [
          { name: "q", in: "query", required: true, description: "Film title, original title, or director name (diacritic-insensitive).", schema: { type: "string" } },
          { name: "year", in: "query", required: false, description: "Optional 4-digit release year to narrow the match.", schema: { type: "integer" } },
          { name: "limit", in: "query", required: false, description: "Max results, 1–25 (default 10).", schema: { type: "integer", default: 10 } },
        ],
        responses: { "200": { description: "Matching films", content: { "application/json": { schema: { $ref: "#/components/schemas/FilmSearch" } } } } },
      },
    },
    "/api/v1/films/{slug}": {
      get: {
        operationId: "getFilm",
        summary: "Get a film's full critical record",
        description:
          "Full public record for one film: metadata, the TakeScore breakdown, and Metatake's original criticism — " +
          "multi-framework readings (each pushes one interpretive framework as far as the film allows), motifs & figures, " +
          "tropes, and kindred films. Resolve the slug with searchFilms first.",
        parameters: [{ name: "slug", in: "path", required: true, description: "Film slug, e.g. mulholland-drive-2001.", schema: { type: "string" } }],
        responses: {
          "200": { description: "Film record", content: { "application/json": { schema: { $ref: "#/components/schemas/Film" } } } },
          "404": { description: "No such film" },
        },
      },
    },
    "/api/v1/takescore/{slug}": {
      get: {
        operationId: "getTakeScore",
        summary: "Get a film's TakeScore",
        description:
          "Metatake's 13-dimension critical assessment for one film: net TakeScore plus the Value / Cost / Risk axes and " +
          "every sub-dimension. Value = what the film delivers, Cost = prior knowledge it demands, Risk = how it can fail as art.",
        parameters: [{ name: "slug", in: "path", required: true, description: "Film slug from searchFilms.", schema: { type: "string" } }],
        responses: {
          "200": { description: "TakeScore", content: { "application/json": { schema: { $ref: "#/components/schemas/TakeScore" } } } },
          "404": { description: "No score for this film" },
        },
      },
    },
    "/api/v1/locations": {
      get: {
        operationId: "getFilmingLocations",
        summary: "Get filming-location geodata",
        description:
          "Filming locations and narrative settings with coordinates (name, role, layer, country, latitude, longitude, precision). " +
          "Filter by ?film=<slug> for one film, or ?country=<name> for a country. A dataset that does not exist elsewhere.",
        parameters: [
          { name: "film", in: "query", required: false, description: "Film slug to get all locations for.", schema: { type: "string" } },
          { name: "country", in: "query", required: false, description: "Country name to list locations in (either film or country is required).", schema: { type: "string" } },
          { name: "limit", in: "query", required: false, description: "Max rows, 1–200 (default 50).", schema: { type: "integer", default: 50 } },
        ],
        responses: { "200": { description: "Locations", content: { "application/json": { schema: { $ref: "#/components/schemas/Locations" } } } } },
      },
    },
  },
  components: {
    schemas: {
      FilmSearch: {
        type: "object",
        properties: {
          query: { type: "string" },
          count: { type: "integer" },
          films: {
            type: "array",
            items: {
              type: "object",
              properties: {
                slug: { type: "string" }, title: { type: "string" }, original_title: { type: ["string", "null"] },
                year: { type: ["integer", "null"] }, director: { type: ["string", "null"] },
                takescore: { type: ["number", "null"] }, analyzed: { type: "boolean" }, url: { type: "string" },
              },
            },
          },
        },
      },
      TakeScore: {
        type: "object",
        properties: {
          slug: { type: "string" }, title: { type: "string" }, year: { type: ["integer", "null"] },
          score: { type: ["number", "null"] }, value: { type: ["number", "null"] }, cost: { type: ["number", "null"] }, risk: { type: ["number", "null"] },
          low_confidence: { type: "boolean" },
          dimensions: { type: "object", additionalProperties: { type: "object", properties: { label: { type: "string" }, group: { type: "string" }, score: { type: ["number", "null"] } } } },
          url: { type: "string" }, cite_as: { type: "string" },
        },
      },
      Film: {
        type: "object",
        properties: {
          slug: { type: "string" }, title: { type: "string" }, year: { type: ["integer", "null"] }, director: { type: ["string", "null"] },
          takescore: { $ref: "#/components/schemas/TakeScore" },
          readings: { type: "array", items: { type: "object", properties: { framework: { type: "string" }, title: { type: ["string", "null"] }, text: { type: "string" } } } },
          kindred: { type: "array", items: { type: "object", properties: { title: { type: "string" }, year: { type: ["integer", "null"] }, slug: { type: ["string", "null"] } } } },
          url: { type: "string" }, license: { type: "string" }, cite_as: { type: "string" },
        },
      },
      Locations: {
        type: "object",
        properties: {
          count: { type: "integer" },
          locations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                film_slug: { type: "string" }, film_title: { type: "string" }, name: { type: "string" },
                role: { type: ["string", "null"] }, layer: { type: ["string", "null"] }, country: { type: ["string", "null"] },
                lat: { type: ["number", "null"] }, lng: { type: ["number", "null"] }, precision: { type: ["string", "null"] },
              },
            },
          },
          license: { type: "string" },
        },
      },
    },
  },
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS });
}

export function GET() {
  return NextResponse.json(SPEC, {
    headers: { ...API_CORS, "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
