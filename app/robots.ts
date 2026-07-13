import type { MetadataRoute } from "next";

/**
 * robots.txt — posture (2026-06): be discoverable, but opt OUT of AI training.
 *  • Search index bots (Googlebot, Bingbot, …) — allowed via the default rule (we
 *    NEED search traffic; AdSense needs us crawlable).
 *  • AI answer / retrieval bots — allowed (they cite us and drive traffic).
 *  • AI TRAINING / bulk-scraping bots — disallowed (so our criticism isn't slurped
 *    into model training sets). robots.txt is advisory: reputable crawlers obey it;
 *    it does not stop bad actors or human copy-paste.
 *  Note: blocking training bots does NOT affect Google/Bing search rankings.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://metatake.net";

  // AI/data crawlers that exist to harvest content for model training or resale.
  const TRAINING_BOTS = [
    "GPTBot",              // OpenAI training
    "ClaudeBot",           // Anthropic training
    "anthropic-ai",        // Anthropic (legacy)
    "Google-Extended",     // Google AI training / Gemini grounding (NOT Googlebot search)
    "CCBot",               // Common Crawl (feeds many models)
    "Applebot-Extended",   // Apple AI training
    "Bytespider",          // ByteDance / TikTok (aggressive scraper)
    "Meta-ExternalAgent",  // Meta AI training
    "FacebookBot",         // Meta
    "Amazonbot",           // Amazon AI
    "Diffbot",             // data resale
    "Omgilibot",           // Webis data resale
    "ImagesiftBot",        // image dataset scraper
    "PetalBot",            // Huawei
    "cohere-ai",           // Cohere training
    "Timpibot",            // dataset scraper
    "YouBot",              // You.com
  ];

  // Paths no crawler should index: admin, APIs, the infinite internal-search
  // query space (/search itself — the landing — stays crawlable), and the
  // legacy AI chat shell. Repeated per group because robots.txt groups are
  // exclusive: a bot obeys ONLY its best-matching group, inheriting nothing.
  // "/api/" (with trailing slash) blocks the data endpoints (/api/v1, /api/mcp,
  // /api/pack, …) while leaving the exact "/api" developer landing page
  // crawlable/indexable — it's a public reference + backlink target.
  const NOINDEX_PATHS = ["/admin", "/api/", "/search?*", "/ask-ai"];

  return {
    rules: [
      // Everyone else (incl. Googlebot, Bingbot, DuckDuckBot) — allowed.
      { userAgent: "*", allow: "/", disallow: NOINDEX_PATHS },

      // AI answer / retrieval bots — explicitly allowed (they cite + send traffic).
      { userAgent: "OAI-SearchBot", allow: "/", disallow: NOINDEX_PATHS },
      { userAgent: "ChatGPT-User", allow: "/", disallow: NOINDEX_PATHS },
      { userAgent: "PerplexityBot", allow: "/", disallow: NOINDEX_PATHS },
      { userAgent: "Claude-SearchBot", allow: "/", disallow: NOINDEX_PATHS },
      { userAgent: "Claude-User", allow: "/", disallow: NOINDEX_PATHS },

      // AI training / bulk-scraping bots — blocked.
      { userAgent: TRAINING_BOTS, disallow: "/" },
    ],
    sitemap: [`${siteUrl}/sitemap.xml`, `${siteUrl}/news-sitemap.xml`],
  };
}
