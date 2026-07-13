import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { pageRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Metatake API — Free Film-Criticism Data for AI & Developers",
  description:
    "A free, read-only REST API over Metatake's film criticism: search films, the 13-dimension TakeScore, multi-framework readings, and filming-location geodata. OpenAPI schema for ChatGPT Custom GPTs, plus an MCP server for Claude. CC BY-NC 4.0.",
  alternates: { canonical: "/api" },
  robots: pageRobots(true),
};

const pre: React.CSSProperties = {
  whiteSpace: "pre-wrap", wordBreak: "break-word",
  background: "var(--mt-code-bg, rgba(0,0,0,0.05))",
  padding: "0.75rem 1rem", borderRadius: 6, fontSize: "0.82rem", overflowX: "auto",
};

export default function ApiPage() {
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/about">About</Link></div>
        <h1 className="mt-h1">Metatake API</h1>
        <p className="mt-laconic">Free, read-only film-criticism data for AI assistants and developers</p>

        <p>
          Metatake&rsquo;s criticism is open to build on. Everything below is <strong>free, needs no key</strong>,
          and is licensed{" "}
          <a href="https://creativecommons.org/licenses/by-nc/4.0/" rel="license noopener noreferrer" target="_blank">CC BY-NC 4.0</a>{" "}
          — reuse it with attribution to Metatake and a link back (every response carries one). There is no paid tier
          to get in the way; for bulk or commercial use, see <Link href="/data">Metatake Data</Link>.
        </p>

        <h2 className="mt-h2">Three ways to plug in</h2>
        <ul>
          <li><strong>ChatGPT / Custom GPTs</strong> — import the OpenAPI schema below as an Action (no code).</li>
          <li><strong>Claude &amp; MCP apps</strong> — connect the <Link href="/mcp">MCP server</Link> (<code>https://metatake.net/api/mcp</code>).</li>
          <li><strong>Anything else</strong> — call the REST endpoints directly.</li>
        </ul>

        <h2 className="mt-h2">REST endpoints</h2>
        <pre style={pre}>{`GET  /api/v1/films?q=mulholland            → search by title or director
GET  /api/v1/films/{slug}                  → full record: TakeScore + readings + kindred
GET  /api/v1/takescore/{slug}              → 13-dimension Value / Cost / Risk
GET  /api/v1/locations?film={slug}         → filming locations with coordinates
GET  /api/v1/locations?country=France      → locations by country
GET  /api/v1/openapi.json                  → OpenAPI 3.1 schema (for GPT Actions)`}</pre>
        <p style={{ fontSize: "0.9rem" }}>
          Try it now:{" "}
          <a href="/api/v1/films?q=mulholland" target="_blank" rel="noopener">/api/v1/films?q=mulholland</a>{" · "}
          <a href="/api/v1/takescore/mulholland-drive-2001" target="_blank" rel="noopener">/api/v1/takescore/mulholland-drive-2001</a>
        </p>

        <h2 className="mt-h2">Make a ChatGPT that knows Metatake</h2>
        <ol>
          <li>ChatGPT → <b>Create a GPT</b> → <b>Configure</b> → <b>Create new Action</b>.</li>
          <li>Under <em>Schema</em>, choose <em>Import from URL</em> and paste:</li>
        </ol>
        <pre style={pre}>https://metatake.net/api/v1/openapi.json</pre>
        <ol start={3}>
          <li>Authentication: <b>None</b>. Save — the four operations appear.</li>
          <li>Publish to the GPT Store so anyone can find &ldquo;Metatake film criticism&rdquo; and use it.</li>
        </ol>

        <h2 className="mt-h2">The filming-location dataset</h2>
        <p>
          Metatake maps where films were shot and set — a geodata layer that mostly doesn&rsquo;t exist elsewhere.
          It&rsquo;s open here (<code>/api/v1/locations</code>) and published as a citable dataset. Use it, cite it.
          Details and the full download: <Link href="/data">Metatake Data</Link>.
        </p>

        <p className="mt-laconic" style={{ marginTop: 24 }}>
          Questions: <a href="mailto:wonwoo@metatake.net">wonwoo@metatake.net</a> · Method: <Link href="/methodology">/methodology</Link>
        </p>
      </div>
    </div>
  );
}
