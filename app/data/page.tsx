import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { pageRobots } from "@/lib/seo";
import { filmingLocationsDataset, filmCriticismDataset } from "@/lib/datasets";

export const metadata: Metadata = {
  title: { absolute: "Metatake Data — Open Dataset, API, MCP" },
  description:
    "Metatake's film-criticism data, open to build on: a free filming-locations dataset (Hugging Face + Zenodo DOI), a no-key REST API, an MCP server for AI assistants, and embeddable TakeScore badges. CC BY for the geodata, CC BY-NC for the writing.",
  alternates: { canonical: "/data" },
  robots: pageRobots(true),
};

const HF = "https://huggingface.co/datasets/wonwooyoon/metatake-filming-locations";
const ZENODO = "https://doi.org/10.5281/zenodo.21336967";

// Dataset JSON-LD for the distribution hub — both open datasets declared with
// license + DataDownload[] + DOI so Google Dataset Search indexes them and a
// vendor-research agent can confirm "real, licensed, downloadable" (§2.2).
const datasetGraph = {
  "@context": "https://schema.org",
  "@graph": [filmingLocationsDataset(), filmCriticismDataset()],
};

export default function DataPage() {
  return (
    <div className="mt">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetGraph) }} />
      <SiteNav />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/about">About</Link></div>
        <h1 className="mt-h1">Metatake Data</h1>
        <p className="mt-laconic">Our film-criticism data, open to build on</p>

        <p>
          Most of what Metatake compiles is meant to be used, not fenced off. Everything below is
          free and needs no key. The short version of the licence: <strong>the facts and geodata are
          CC BY 4.0</strong> (reuse freely, including commercially, with attribution), and{" "}
          <strong>our writing is CC BY-NC 4.0</strong> (reuse with attribution, non-commercially).
          How we compile it all is in the <Link href="/methodology">methodology</Link>.
        </p>

        <h2 className="mt-h2">The filming-locations dataset</h2>
        <p>
          A geocoded map of where films were shot and set — 17,341 locations across 1,917 films and
          130 countries, each labelled as <em>filmed</em> or <em>set</em>. A layer that mostly does
          not exist as open data elsewhere. <strong>CC BY 4.0.</strong>
        </p>
        <ul>
          <li><a href={HF} target="_blank" rel="noopener">Hugging Face</a> — load it into a notebook or model.</li>
          <li><a href={ZENODO} target="_blank" rel="noopener">Zenodo (DOI 10.5281/zenodo.21336967)</a> — archived and citable. <em>Cite as: Metatake Film Filming-Locations Dataset.</em></li>
          <li>Live, by film or country: <Link href="/api">the API</Link> (<code>/api/v1/locations</code>).</li>
        </ul>

        <h2 className="mt-h2">The API</h2>
        <p>
          A free, read-only, no-key REST API: search films, a film&rsquo;s full record, its TakeScore,
          and locations. It ships an OpenAPI schema, so you can drop it into a ChatGPT Custom GPT in
          one paste. Details and live examples: <Link href="/api">metatake.net/api</Link>.
        </p>

        <h2 className="mt-h2">Metatake in your AI</h2>
        <p>
          An <Link href="/mcp">MCP server</Link> lets Claude and other MCP apps read Metatake live,
          mid-conversation, and answer with a link back — <code>https://metatake.net/api/mcp</code>.
          Plain-language setup and a try-it prompt are on the <Link href="/mcp">MCP page</Link>.
        </p>

        <h2 className="mt-h2">Embed a TakeScore</h2>
        <p>
          Writing about a film? Put a live TakeScore badge on your page in one line — it updates
          itself and links back. <Link href="/embed">Build a badge</Link>.
        </p>

        <h2 className="mt-h2">Bulk or commercial use</h2>
        <p>
          The open dataset and API cover most needs. For a bespoke cut, a feed, or help building on
          the data, write to <a href="mailto:wonwoo@metatake.net">wonwoo@metatake.net</a>. Attribution
          is the one thing we always ask — every surface and every response carries a source link for
          exactly that reason.
        </p>
      </div>
    </div>
  );
}
