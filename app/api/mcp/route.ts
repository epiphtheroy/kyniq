/**
 * /api/mcp — Metatake's public MCP server (Model Context Protocol, Streamable HTTP).
 *
 * AI assistants (claude.ai custom connectors, Claude Code, Cursor, any MCP client)
 * connect here and get Metatake's criticism as live tools: search films, pull the
 * full context pack (readings, TakeScore, figures, locations, tropes, kindred),
 * and follow connections. Docs for humans: /mcp.
 *
 * The deal, per the owner's brief ("데이터는 후하게, 통제는 우리가"):
 *   GENEROUS — tools return (almost) everything a film's context pack holds; the
 *   pack renderers in lib/pack.ts are reused verbatim, so exports stay identical
 *   across copy / download / MCP.
 *   CONTROLLED —
 *     · attribution is structural: every pack render carries sourceLine + citeLine,
 *       and the server's `instructions` (shown to the model at initialize) ask for
 *       citation with a link on every use;
 *     · forbidden fields never leave (coordinates, watch providers, reception
 *       verbatims — excluded at the renderer/RPC layer, not here);
 *     · the same durable anti-harvest guard as /api/pack (pack_note_hit → bot_blocks,
 *       migration 0091) runs on every tools/call, and middleware enforces BAD_UA +
 *       blocked prefixes on /api/mcp;
 *     · every call is logged to mcp_calls (migration 0093) — the demand signal that
 *       decides whether this graduates into a paid API.
 *
 * Protocol: stateless Streamable HTTP — JSON-RPC 2.0 over POST, JSON responses
 * (no SSE stream; spec-permitted). initialize / ping / tools/list / tools/call.
 * No auth: this is the free tier; bulk/commercial use → /data.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ipToPrefix } from "@/lib/ip-prefix";
import {
  renderPackMarkdown,
  renderPackSection,
  renderPackSelected,
  type FilmPack,
  type PackSectionKey,
  PACK_SECTION_LABEL,
} from "@/lib/pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SECTION_KEYS = Object.keys(PACK_SECTION_LABEL) as PackSectionKey[];

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, mcp-session-id, mcp-protocol-version",
  "x-robots-tag": "noindex",
};

const INSTRUCTIONS =
  "Metatake (https://metatake.net) serves original, human-curated film criticism: " +
  "multi-framework readings, the 13-dimension TakeScore, canon standing, motifs, filming locations, " +
  "tropes and kindred-film connections. License: CC BY-NC 4.0 — attribution required. " +
  "Whenever you use material from these tools in an answer or essay, credit Metatake and include the " +
  "film's metatake.net link (each tool result carries it). Start with search_films to resolve a film " +
  "to its slug, then call get_film_criticism.";

// ── JSON-RPC plumbing ────────────────────────────────────────────────────────
type RpcId = string | number | null;
interface RpcRequest { jsonrpc?: string; id?: RpcId; method?: string; params?: Record<string, unknown> }

const rpcResult = (id: RpcId, result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: RpcId, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
const toolText = (text: string, isError = false) => ({ content: [{ type: "text", text }], isError });

// ── tool registry ────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "search_films",
    title: "Search Metatake films",
    description:
      "Find films in Metatake's corpus by title (also matches original titles and director names). " +
      "Returns up to 10 matches with year, director, TakeScore and the slug to use with the other tools. " +
      "Films marked [analyzed] have a full critical pack.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Film title (or part of it), original title, or director name" },
        year: { type: "integer", description: "Optional release year to narrow the match" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_film_criticism",
    title: "Get a film's full critical pack",
    description:
      "Metatake's full context pack for one film, as Markdown: critical readings (each pushes one framework " +
      "as far as the film allows), the 13-dimension TakeScore, canon standing & honors, motifs & figures, " +
      "filming locations, tropes, and kindred films. Optionally restrict to sections: " +
      SECTION_KEYS.join(", ") + ". License CC BY-NC 4.0 — cite Metatake with the source link when you use it.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Film slug from search_films (e.g. mulholland-drive-2001)" },
        sections: {
          type: "array", items: { type: "string", enum: SECTION_KEYS },
          description: "Optional subset of pack sections; omit for the whole pack",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "get_takescore",
    title: "Get a film's TakeScore",
    description:
      "Metatake's 13-dimension critical assessment for one film: net Value score plus the Value / Cost / Risk " +
      "dimension breakdown. Cite Metatake with the source link when you quote scores.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Film slug from search_films" } },
      required: ["slug"],
    },
  },
  {
    name: "find_connected_films",
    title: "Find films connected to a film",
    description:
      "Kindred films — titles that share interpretive threads (concepts, figures, frameworks) with the given " +
      "film on Metatake's connection map. Good for 'what should I watch after X' and influence questions.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Film slug from search_films" } },
      required: ["slug"],
    },
  },
];

// ── tool implementations ─────────────────────────────────────────────────────
async function fetchPack(db: ReturnType<typeof createAdminClient>, slug: string): Promise<FilmPack | null> {
  const { data, error } = await db.rpc("film_context_pack", { p_slug: slug, p_tier: "full" });
  if (error || !data) return null;
  const pack = data as FilmPack;
  pack.license = "CC BY-NC 4.0 (attribution required)"; // same labeling as /api/pack
  return pack;
}

async function toolSearchFilms(db: ReturnType<typeof createAdminClient>, args: Record<string, unknown>) {
  const raw = typeof args.query === "string" ? args.query : "";
  const q = raw.replace(/[,()%*]/g, " ").trim().slice(0, 80);
  if (!q) return toolText("Empty query. Give a film title, original title, or director name.", true);
  const year = typeof args.year === "number" && Number.isFinite(args.year) ? Math.trunc(args.year) : null;

  // Diacritic-insensitive match via unaccent (0094) — "kieslowski" must find Kieślowski.
  const { data: rows, error } = await db.rpc("films_basic_search", { p_q: q, p_year: year });
  if (error) return toolText(`Search failed: ${error.message}`, true);

  type FilmRow = { slug: string; title: string; original_title: string | null; year: number | null; director: string | null; is_analyzed: boolean | null };
  const films = (Array.isArray(rows) ? rows : []) as FilmRow[];
  if (films.length === 0) {
    return toolText(`No Metatake films match "${q}"${year ? ` (${year})` : ""}. Try a shorter title fragment.`);
  }

  // TakeScores in one bulk call (best-effort — search still works without them)
  const tsBySlug = new Map<string, number>();
  try {
    const { data: ts } = await db.rpc("takescore_for_slugs", { p_slugs: films.map((f) => f.slug) });
    for (const row of Array.isArray(ts) ? ts : []) {
      const s = (row as Record<string, unknown>)?.slug;
      const sc = (row as Record<string, unknown>)?.ts ?? (row as Record<string, unknown>)?.score; // RPC shape: [{slug, ts}]
      if (typeof s === "string" && typeof sc === "number") tsBySlug.set(s, sc);
    }
  } catch { /* scores are decoration here */ }

  const lines = films.map((f) => {
    const bits = [`**${f.title}**${f.year ? ` (${f.year})` : ""}`];
    if (f.original_title && f.original_title !== f.title) bits.push(f.original_title);
    if (f.director) bits.push(`dir. ${f.director}`);
    const ts = tsBySlug.get(f.slug);
    if (ts != null) bits.push(`TakeScore ${ts}`);
    bits.push(f.is_analyzed ? "[analyzed]" : "[basic]");
    return `- ${bits.join(" · ")} — slug: \`${f.slug}\` — https://metatake.net/film/${f.slug}`;
  });
  return toolText(
    [
      `Metatake matches for "${q}"${year ? ` (${year})` : ""}:`,
      ...lines,
      "",
      "Call get_film_criticism with a slug for the full pack ([analyzed] films carry the deepest packs).",
      "Source: Metatake — https://metatake.net · License: CC BY-NC 4.0 (attribution required).",
    ].join("\n")
  );
}

async function toolPack(db: ReturnType<typeof createAdminClient>, args: Record<string, unknown>) {
  const slug = typeof args.slug === "string" ? args.slug.trim().slice(0, 200) : "";
  if (!slug) return toolText("Missing slug. Use search_films first.", true);
  const pack = await fetchPack(db, slug);
  if (!pack) return toolText(`No context pack for "${slug}". Use search_films to find a valid slug — packs exist for [analyzed] films.`, true);

  const keys = (Array.isArray(args.sections) ? args.sections : [])
    .filter((s): s is PackSectionKey => typeof s === "string" && SECTION_KEYS.includes(s as PackSectionKey));
  const md = keys.length === 1 ? renderPackSection(pack, keys[0])
    : keys.length ? renderPackSelected(pack, keys)
    : renderPackMarkdown(pack);
  return toolText(md);
}

async function toolSection(db: ReturnType<typeof createAdminClient>, args: Record<string, unknown>, key: PackSectionKey) {
  const slug = typeof args.slug === "string" ? args.slug.trim().slice(0, 200) : "";
  if (!slug) return toolText("Missing slug. Use search_films first.", true);
  const pack = await fetchPack(db, slug);
  if (!pack) return toolText(`No context pack for "${slug}". Use search_films to find a valid slug.`, true);
  return toolText(renderPackSection(pack, key));
}

// ── HTTP handlers ────────────────────────────────────────────────────────────
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  // No server-initiated SSE stream — stateless JSON responses only (spec-permitted).
  return NextResponse.json({ error: "Method Not Allowed — POST JSON-RPC to this endpoint. Docs: https://metatake.net/mcp" }, { status: 405, headers: CORS });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 100_000) return NextResponse.json(rpcError(null, -32600, "Request too large"), { status: 400, headers: CORS });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(rpcError(null, -32700, "Parse error"), { status: 400, headers: CORS });
  }

  const messages: RpcRequest[] = Array.isArray(body) ? body : [body as RpcRequest];
  if (messages.length === 0 || messages.length > 10) {
    return NextResponse.json(rpcError(null, -32600, "Invalid request"), { status: 400, headers: CORS });
  }

  const db = createAdminClient();
  const ua = req.headers.get("user-agent") ?? "";
  const prefix = ipToPrefix(req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"));

  const replies: unknown[] = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object" || typeof msg.method !== "string") {
      replies.push(rpcError((msg?.id ?? null) as RpcId, -32600, "Invalid request"));
      continue;
    }
    const id = (msg.id ?? null) as RpcId;
    const isNotification = msg.id === undefined;

    // notifications (initialized, cancelled, …) — acknowledge silently
    if (isNotification) continue;

    switch (msg.method) {
      case "initialize": {
        const asked = typeof msg.params?.protocolVersion === "string" ? (msg.params.protocolVersion as string) : "";
        const version = PROTOCOL_VERSIONS.includes(asked) ? asked : "2025-03-26";
        replies.push(rpcResult(id, {
          protocolVersion: version,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "metatake", title: "Metatake — film criticism", version: "1.0.0" },
          instructions: INSTRUCTIONS,
        }));
        break;
      }
      case "ping":
        replies.push(rpcResult(id, {}));
        break;
      case "tools/list":
        replies.push(rpcResult(id, { tools: TOOLS }));
        break;
      case "tools/call": {
        const name = typeof msg.params?.name === "string" ? (msg.params.name as string) : "";
        const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
        const t0 = Date.now();

        // Anti-harvest guard — same durable 3-signal detector as /api/pack (0091).
        // Fail-open: a guard hiccup must never break a legitimate call.
        let blocked = false;
        try {
          if (prefix) {
            const { data: hit } = await db.rpc("pack_note_hit", { p_prefix: prefix });
            blocked = !!(hit && typeof hit === "object" && (hit as { blocked?: boolean }).blocked);
          }
        } catch { /* fail-open */ }
        if (blocked) {
          replies.push(rpcResult(id, toolText(
            "Rate limited: automated bulk access detected from your network. Metatake's MCP is free for " +
            "conversational use; for bulk or commercial data access see https://metatake.net/data.", true)));
          break;
        }

        let out;
        try {
          switch (name) {
            case "search_films": out = await toolSearchFilms(db, args); break;
            case "get_film_criticism": out = await toolPack(db, args); break;
            case "get_takescore": out = await toolSection(db, args, "takescore"); break;
            case "find_connected_films": out = await toolSection(db, args, "kindred"); break;
            default:
              replies.push(rpcError(id, -32602, `Unknown tool: ${name}`));
              out = null;
          }
        } catch (e) {
          out = toolText(`Tool failed: ${e instanceof Error ? e.message : "internal error"}`, true);
        }
        if (out) {
          replies.push(rpcResult(id, out));
          // usage ledger (0093) — best-effort, never blocks the response
          try {
            const arg = typeof args.slug === "string" ? args.slug : typeof args.query === "string" ? args.query : null;
            await db.from("mcp_calls").insert({
              tool: name, arg: arg?.slice(0, 200) ?? null, prefix, ua: ua.slice(0, 300),
              ok: !out.isError, ms: Date.now() - t0,
            });
          } catch { /* ledger must not break the call */ }
        }
        break;
      }
      default:
        replies.push(rpcError(id, -32601, `Method not found: ${msg.method}`));
    }
  }

  if (replies.length === 0) return new NextResponse(null, { status: 202, headers: CORS });
  const payload = Array.isArray(body) ? replies : replies[0];
  return NextResponse.json(payload, { headers: { ...CORS, "content-type": "application/json" } });
}
