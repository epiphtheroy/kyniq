import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { pageRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Metatake MCP — Film Criticism for Your AI" },
  description:
    "Connect your AI assistant to Metatake over the Model Context Protocol: live tools for film search, multi-framework critical readings, the 13-dimension TakeScore, and kindred-film connections. Free for conversational use, CC BY-NC 4.0 with attribution.",
  alternates: { canonical: "/mcp" },
  robots: pageRobots(true),
};

const ENDPOINT = "https://metatake.net/api/mcp";

const pre: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  background: "var(--mt-code-bg, rgba(0,0,0,0.05))",
  padding: "0.75rem 1rem",
  borderRadius: 6,
  fontSize: "0.85rem",
  overflowX: "auto",
};

export default function McpPage() {
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/about">About</Link></div>
        <h1 className="mt-h1">Metatake MCP</h1>
        <p className="mt-laconic">Live film criticism inside your AI assistant · Model Context Protocol</p>

        <p>
          Metatake speaks the <strong>Model Context Protocol</strong>. Connect the endpoint below and
          your AI assistant — Claude, Cursor, or any MCP-capable client — can search our corpus and
          pull a film&rsquo;s full critical pack mid-conversation: the multi-framework readings, the
          13-dimension TakeScore, canon standing, motifs, filming locations, tropes, and kindred-film
          connections. Always current, always attributed, no copy-paste.
        </p>

        <h2 className="mt-h2">Endpoint</h2>
        <pre style={pre}>{ENDPOINT}</pre>
        <p style={{ fontSize: "0.9rem" }}>
          Streamable HTTP transport · no API key for conversational use · responses are Markdown.
        </p>

        <h2 className="mt-h2">Connect it</h2>
        <p><strong>claude.ai</strong> — Settings → Connectors → <em>Add custom connector</em> → paste the endpoint URL.</p>
        <p><strong>Claude Code</strong>:</p>
        <pre style={pre}>{`claude mcp add --transport http metatake ${ENDPOINT}`}</pre>
        <p><strong>Claude Desktop / other stdio-only clients</strong> — bridge with mcp-remote:</p>
        <pre style={pre}>{`{
  "mcpServers": {
    "metatake": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${ENDPOINT}"]
    }
  }
}`}</pre>

        <h2 className="mt-h2">Tools</h2>
        <ul>
          <li><strong>search_films</strong> — find films by title, original title, or director; returns slugs, years, TakeScores.</li>
          <li><strong>get_film_criticism</strong> — a film&rsquo;s full context pack (or chosen sections): readings, TakeScore, standing &amp; honors, figures, locations, tropes, kindred films.</li>
          <li><strong>get_takescore</strong> — just the 13-dimension Value / Cost / Risk assessment.</li>
          <li><strong>find_connected_films</strong> — kindred films that share interpretive threads, for &ldquo;what next after X&rdquo; questions.</li>
        </ul>
        <p>Try these prompts once connected:</p>
        <ul>
          <li><em>&ldquo;Search Metatake for Mulholland Drive, then give me its strongest reading and three kindred films.&rdquo;</em></li>
          <li><em>&ldquo;Compare the TakeScores of the Three Colors trilogy on Metatake — which has the highest Value, and what does the Cost axis say about each?&rdquo;</em></li>
          <li><em>&ldquo;I loved In the Mood for Love. Use Metatake to find connected films and explain the interpretive threads they share.&rdquo;</em></li>
        </ul>

        <h2 className="mt-h2">License &amp; fair use</h2>
        <p>
          Everything the tools return is Metatake&rsquo;s original criticism — AI-drafted, human-reviewed — licensed{" "}
          <a href="https://creativecommons.org/licenses/by-nc/4.0/" rel="license noopener noreferrer" target="_blank">
            CC BY-NC 4.0
          </a>
          : reuse it freely <strong>with attribution</strong> (credit Metatake and keep the film&rsquo;s
          metatake.net link) and not commercially. The server is free for conversational use and
          rate-limited against bulk harvesting; for bulk or commercial data access, see{" "}
          <Link href="/data">Metatake Data</Link>. Our crawler policy lives at <Link href="/bot">/bot</Link>,
          our method at <Link href="/methodology">/methodology</Link>.
        </p>
      </div>
    </div>
  );
}
