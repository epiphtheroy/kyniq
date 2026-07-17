/**
 * Dataset & offer JSON-LD builders — single source of truth for the machine-
 * readable "what Metatake licenses" objects (HANDOFF-AI봇맞이하기.md §2.2).
 *
 * Why this exists: a Dataset node with no `license` + no `distribution` is
 * invisible to Google Dataset Search and to a vendor-research agent deciding
 * "is this real, licensed, downloadable?". Every Dataset here carries license +
 * DataDownload[] + creator + identifier(DOI). Reused by /locations, /data and
 * /partners so the same facts render identically everywhere (fact-consistency is
 * the ③-trust invariant — contradictory copies get dropped by answer engines).
 *
 * ⚠️ License split (mirrors /data and the site footer): the filming-locations
 * GEODATA is CC BY 4.0 (commercial reuse OK, attribution). The CRITICISM corpus
 * (readings, TakeScore) is CC BY-NC 4.0 — non-commercial; commercial partners
 * need a separate licence. Never let a `license` field imply the writing is
 * commercial-free.
 */
export const ORG_ID = "https://metatake.net/#org";
export const ZENODO_DOI = "10.5281/zenodo.21336967";
export const ZENODO_URL = "https://doi.org/10.5281/zenodo.21336967";
export const HF_LOCATIONS = "https://huggingface.co/datasets/wonwooyoon/metatake-filming-locations";
export const CC_BY = "https://creativecommons.org/licenses/by/4.0/";
export const CC_BY_NC = "https://creativecommons.org/licenses/by-nc/4.0/";

export const orgRef = { "@type": "Organization", "@id": ORG_ID, name: "Metatake" } as const;

type LocationsOpts = { pins?: number; films?: number; countries?: number; updated?: string | null };

/** Filming-locations dataset — CC BY 4.0 geodata. Defaults match /data copy. */
export function filmingLocationsDataset(opts: LocationsOpts = {}) {
  const pins = opts.pins ?? 17341;
  const films = opts.films ?? 1917;
  const countries = opts.countries ?? 130;
  return {
    "@type": "Dataset",
    "@id": "https://metatake.net/data#filming-locations",
    name: "Metatake Film Filming-Locations Dataset",
    url: "https://metatake.net/locations",
    description:
      `${pins.toLocaleString()} geolocated film locations across ${films.toLocaleString()} films and ` +
      `${countries} countries, each labelled as filmed vs set, researched and compiled by Metatake ` +
      `Editorial from public sources (production records, press kits, encyclopedic references).`,
    creator: orgRef,
    publisher: orgRef,
    license: CC_BY,
    isAccessibleForFree: true,
    identifier: ZENODO_URL,
    keywords: ["film", "cinema", "filming locations", "film settings", "geodata", "movie map"],
    variablesMeasured: [
      "film title", "location name", "country", "filmed vs set", "scene role", "narrative setting",
    ],
    ...(opts.updated ? { dateModified: opts.updated } : {}),
    distribution: [
      { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: HF_LOCATIONS, name: "Hugging Face (CSV / Parquet)" },
      { "@type": "DataDownload", encodingFormat: "application/zip", contentUrl: ZENODO_URL, name: "Zenodo archive (citable, DOI)" },
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: "https://metatake.net/api/v1/locations", name: "Live REST API (by film or country)" },
    ],
  };
}

type CorpusOpts = { films?: number; readings?: number };

/** Criticism corpus dataset — CC BY-NC 4.0 writing, delivered live via API + MCP. */
export function filmCriticismDataset(opts: CorpusOpts = {}) {
  const films = opts.films ?? 6700;
  const readings = opts.readings ?? 70000;
  return {
    "@type": "Dataset",
    "@id": "https://metatake.net/data#criticism-corpus",
    name: "Metatake Film Criticism Corpus",
    url: "https://metatake.net/data",
    description:
      `Structured film-criticism data for ${films.toLocaleString()}+ films: multi-framework close ` +
      `readings (${readings.toLocaleString()}+), the 13-dimension TakeScore, canon standing, motifs and ` +
      `figures, tropes, and a meaning-based kindred-film graph. Original interpretive work — written and ` +
      `computed by Metatake AI, to a method designed and directed by Wonwoo Yoon, who answers for it.`,
    creator: orgRef,
    publisher: orgRef,
    license: CC_BY_NC,
    isAccessibleForFree: true,
    keywords: ["film criticism", "film analysis", "TakeScore", "film theory", "close reading", "film ratings"],
    variablesMeasured: [
      "TakeScore (13 dimensions)", "framework readings", "canon standing", "figures & motifs", "tropes", "kindred films",
    ],
    distribution: [
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: "https://metatake.net/api/v1/films", name: "REST API (no key)" },
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: "https://metatake.net/api/mcp", name: "MCP server (live, for AI assistants)" },
    ],
  };
}

/**
 * Data-licensing Service/WebAPI node — the B2B "offer object" (the JobPosting
 * equivalent). Two Offers: the free open tier, and a paid commercial licence for
 * reuse the CC BY-NC writing does not permit. The commercial Offer carries NO
 * price (contact-for-terms) — never imply a number we haven't set.
 */
export function dataLicensingService() {
  return {
    "@type": ["Service", "WebAPI"],
    "@id": "https://metatake.net/partners#service",
    name: "Metatake film-criticism data licensing",
    serviceType: "Film-criticism data licensing",
    provider: orgRef,
    areaServed: "Worldwide",
    url: "https://metatake.net/partners",
    documentation: "https://metatake.net/api",
    termsOfService: "https://metatake.net/terms",
    offers: [
      {
        "@type": "Offer",
        name: "Open tier",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: "https://metatake.net/data",
        description:
          "Free, no-key REST API, a public MCP server, and CC-licensed dataset downloads " +
          "(filming locations CC BY 4.0; criticism CC BY-NC 4.0). Attribution required.",
      },
      {
        "@type": "Offer",
        name: "Commercial licence",
        availability: "https://schema.org/InStock",
        url: "mailto:wonwoo@metatake.net",
        description:
          "Bespoke feeds, bulk cuts, and commercial reuse of the CC BY-NC criticism corpus. " +
          "Priced per engagement — contact for terms.",
      },
    ],
  };
}
