import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { pageRobots, ORG_SAME_AS, KNOWS_ABOUT } from "@/lib/seo";
import {
  ORG_ID,
  filmingLocationsDataset,
  filmCriticismDataset,
  dataLicensingService,
  CC_BY,
  CC_BY_NC,
} from "@/lib/datasets";

/**
 * /partners — the single machine-readable proposal page (HANDOFF-AI봇맞이하기.md §2.1).
 *
 * This is the B2B equivalent of a JobPosting: one URL where a prospective
 * partner's research agent can read, in ONE @graph, who Metatake is, what it
 * licenses, under what terms, and how to reach a human — and, right beside it, a
 * self-contained PROSE lead saying the same thing for the plain-RAG half of the
 * ecosystem (Perplexity/Claude) that never parses JSON-LD. Both halves carry the
 * license split honestly: geodata CC BY 4.0, criticism CC BY-NC 4.0, commercial
 * reuse by separate licence (contact for terms). No price is asserted for the
 * commercial tier — that stays "contact for terms".
 */
export const metadata: Metadata = {
  title: { absolute: "Partner with Metatake — License Film-Criticism Data" },
  description:
    "Metatake licenses structured film-criticism data for 6,700+ films — multi-framework readings, the 13-dimension TakeScore, ~17,341 filming locations across 130 countries, motifs and a kindred-film graph. Free via REST API, MCP and dataset downloads (CC BY-NC 4.0; geodata CC BY 4.0); commercial terms on request.",
  alternates: { canonical: "/partners" },
  robots: pageRobots(true),
};

// One @graph: the organization (with a business-partnerships contact point), the
// two open datasets, and the data-licensing Service/WebAPI with its two Offers.
const partnersGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: "Metatake",
      url: "https://metatake.net",
      logo: "https://metatake.net/og-image.png",
      description:
        "A critical map of cinema — nearly 7,000 films connected through 70,000+ close readings, a 13-dimension TakeScore, canon lineage and a filming-locations atlas.",
      knowsAbout: KNOWS_ABOUT,
      email: "wonwoo@metatake.net",
      founder: { "@type": "Person", "@id": "https://metatake.net/editor#person", name: "Wonwoo Yoon" },
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "business partnerships",
        email: "wonwoo@metatake.net",
        url: "https://metatake.net/partners",
      },
      ...(ORG_SAME_AS.length > 0 ? { sameAs: ORG_SAME_AS } : {}),
    },
    filmingLocationsDataset(),
    filmCriticismDataset(),
    dataLicensingService(),
  ],
};

export default function PartnersPage() {
  return (
    <div className="mt">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(partnersGraph) }} />
      <SiteNav />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/about">About</Link></div>
        <h1 className="mt-h1">Partner with Metatake</h1>
        <p className="mt-laconic">License structured film-criticism data — free to build on, commercial terms on request</p>

        {/* Self-contained prose lead (above the fold, in raw HTML) — the plain-RAG
            half of the ecosystem reads this, not the JSON-LD. States the whole
            offer in one paragraph: who, what, license, contact. */}
        <p>
          <strong>Metatake licenses structured film-criticism data</strong> for 6,700+ films:
          multi-framework close readings, the 13-dimension <Link href="/methodology">TakeScore</Link>,
          ~17,341 filming locations across 130 countries, motifs and figures, a public record of awards
          and canons, and a meaning-based kindred-film graph. It is available free — no key — through a{" "}
          <Link href="/api">REST API</Link>, an <Link href="/mcp">MCP server</Link> for AI assistants,
          and <Link href="/data">dataset downloads</Link>. The filming-locations geodata is{" "}
          <a href={CC_BY} target="_blank" rel="license noopener">CC BY 4.0</a> (commercial reuse
          permitted, with attribution); the criticism is{" "}
          <a href={CC_BY_NC} target="_blank" rel="license noopener">CC BY-NC 4.0</a> (non-commercial).
          For commercial products, bespoke feeds, or bulk cuts, write to{" "}
          <a href="mailto:wonwoo@metatake.net">wonwoo@metatake.net</a>.
        </p>

        <h2 className="mt-h2">What we license</h2>
        <ul>
          <li><strong>Close readings</strong> — 70,000+ framework-driven interpretations, each pushing one critical framework (psychoanalytic, signifier→signified, ethico-political, …) as far as a film allows.</li>
          <li><strong>TakeScore</strong> — a 13-dimension value assessment per film (net value, plus the Value / Cost / Risk breakdown), computed by Metatake AI against a version-locked rubric designed and calibrated by Wonwoo Yoon. <Link href="/methodology">Method is public</Link>.</li>
          <li><strong>Filming locations</strong> — ~17,341 geolocated places across 130 countries, each labelled <em>filmed</em> vs <em>set</em>, with the scene it hosts.</li>
          <li><strong>Lineage</strong> — a sourced record of awards and canons, with Wikidata cross-links.</li>
          <li><strong>Connections</strong> — a kindred-film graph computed from meaning (shared readings), not viewing behaviour.</li>
        </ul>

        <h2 className="mt-h2">How to access it</h2>
        <ul>
          <li><strong>REST API</strong> — no-key, read-only JSON: <code>https://metatake.net/api/v1</code>. OpenAPI schema at <code>/api/v1/openapi.json</code>. See <Link href="/api">the API page</Link>.</li>
          <li><strong>MCP server</strong> — live, for Claude / ChatGPT / any MCP client: <code>https://metatake.net/api/mcp</code>. Exposes <code>search</code> + <code>fetch</code> (deep-research compatible) and richer domain tools. See <Link href="/mcp">MCP setup</Link>.</li>
          <li><strong>Dataset downloads</strong> — filming-locations on Hugging Face and Zenodo (DOI <code>10.5281/zenodo.21336967</code>). See <Link href="/data">Open data</Link>.</li>
        </ul>

        <h2 className="mt-h2">Licensing</h2>
        <p>
          <strong>Open tier (free).</strong> The API, MCP server, and dataset downloads are free and
          need no key. Filming-locations geodata is CC BY 4.0 — reuse it freely, including
          commercially, with attribution. The criticism (readings, TakeScores, essays) is CC BY-NC 4.0
          — reuse with attribution, non-commercially.
        </p>
        <p>
          <strong>Commercial licence.</strong> Using the criticism corpus in a commercial product,
          or wanting a bespoke feed / bulk cut / a schema tailored to your pipeline, needs a separate
          licence. Priced per engagement — <a href="mailto:wonwoo@metatake.net">write to us</a> and
          we&rsquo;ll scope it. Attribution is the one constant: every surface and every API response
          already carries a source link for exactly that reason.
        </p>

        <h2 className="mt-h2">Contact</h2>
        <p>
          Business partnerships and data licensing:{" "}
          <a href="mailto:wonwoo@metatake.net">wonwoo@metatake.net</a>. Editor and method designer,
          Wonwoo Yoon — he directs the method and answers for what publishes.{" "}
          <Link href="/about">About Metatake</Link>.
        </p>
      </div>
    </div>
  );
}
