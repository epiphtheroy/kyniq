/**
 * AI client / crawler UA classification — the SHARED classifier for the usage
 * meter (/admin/usage). HANDOFF-AI사용현황-어드민.md §0-1.
 *
 * Why in TS, not SQL: the usage_overview_json RPC returns RAW by-ua rows; both
 * the dashboard and any future rollup classify with THIS one function so the
 * families never drift. mt_crawler_visits.bot_name parsing is unreliable
 * (ChatGPT-User→"bot", Claude-User→null) — always classify from the raw UA.
 *
 * The core insight the panels are built around: the vast majority of MCP UAs are
 * automated registry crawlers and health-checkers, NOT real assistant usage. The
 * classifier separates the three tiers so the dashboard never shows vanity totals.
 */

// ── MCP / REST clients (the demand side of /api/mcp + /api/v1) ───────────────
export type ClientFamily = "assistant" | "registry" | "health" | "sdk" | "browser" | "other";

export const CLIENT_FAMILY_LABEL: Record<ClientFamily, string> = {
  assistant: "AI assistant (real use)",
  registry: "Registry / directory crawler",
  health: "Health-checker (noise)",
  sdk: "HTTP client / SDK",
  browser: "Browser",
  other: "Other",
};

/** A pure liveness/health probe that never invokes tools = pure noise. */
export function isNoiseClient(family: ClientFamily): boolean {
  return family === "health";
}

export function classifyMcpClient(ua: string): { family: ClientFamily; label: string } {
  const s = (ua || "").toLowerCase();
  const fam = (f: ClientFamily): { family: ClientFamily; label: string } => ({ family: f, label: CLIENT_FAMILY_LABEL[f] });
  if (!s) return fam("other");
  // Assistants first — a real end-user's AI acting on their behalf.
  if (/claude-user|chatgpt-user|perplexity-user|gemini-user|copilot|\bgpt-user/.test(s)) return fam("assistant");
  // Health-checkers BEFORE registry (some contain "mcp" but are liveness-only).
  if (/sentineloracle|drift-monitor|liveness|livenesscheck|health.?prob|uptime|heartbeat/.test(s)) return fam("health");
  // Registry / directory / security crawlers doing discovery (initialize + tools/list).
  if (/\bmcp[-_/.]|-mcp\b|mcpgw|smithery|verifymcp|mcplookup|mcpqueen|mcp-ledger|mcp-scraper|prsm|aisec|chiark|agent-tools|doppelops|agentplane|spanly|catalog|indexer|probe|registry|graph|research|rugpull|handshake/.test(s)) return fam("registry");
  // Raw HTTP clients / SDKs — ambiguous (a dev testing, or an unlabelled bot).
  if (/^node$|^undici$|httpx|urllib|^python-|^curl|^ruby$|^deno|axios|okhttp|go-http|reqwest|libwww|^java\b|apache-httpclient/.test(s)) return fam("sdk");
  if (/mozilla|applewebkit|gecko|safari|chrome|firefox|edg\//.test(s)) return fam("browser");
  return fam("other");
}

// ── Inbound web crawlers (mt_crawler_visits) — AI vs traditional ─────────────
export type CrawlerFamily = "ai-assistant" | "ai-search" | "search" | "social" | "other";

export const CRAWLER_FAMILY_LABEL: Record<CrawlerFamily, string> = {
  "ai-assistant": "AI assistant fetch",
  "ai-search": "AI search index",
  search: "Search engine",
  social: "Social / preview",
  other: "Other bot",
};

export function classifyWebCrawler(ua: string): { family: CrawlerFamily; label: string; isAi: boolean } {
  const s = (ua || "").toLowerCase();
  const out = (f: CrawlerFamily) => ({ family: f, label: CRAWLER_FAMILY_LABEL[f], isAi: f === "ai-assistant" || f === "ai-search" });
  // AI assistants fetching a page for a user (on-demand, per query).
  if (/chatgpt-user|claude-user|duckassistbot|perplexity-user|gemini-user/.test(s)) return out("ai-assistant");
  // AI search / answer-engine indexers.
  if (/oai-searchbot|perplexitybot|claude-searchbot|claudebot|gptbot|amazonbot|amzn-searchbot|aranet-searchbot|youbot|meta-externalagent|bytespider|applebot-extended|google-extended/.test(s)) return out("ai-search");
  // Traditional search engines.
  if (/googlebot|bingbot|yandex|duckduckbot|applebot|baiduspider|petalbot|seznambot|yeti|daumoa|coccocbot/.test(s)) return out("search");
  // Social / link-preview crawlers.
  if (/facebookexternalhit|meta-webindexer|twitterbot|linkedinbot|slackbot|flipboardproxy|linkring|pinterest|telegrambot|discordbot/.test(s)) return out("social");
  return out("other");
}
