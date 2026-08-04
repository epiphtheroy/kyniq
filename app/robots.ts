import type { MetadataRoute } from "next";

/**
 * robots.txt — posture (2026-06, revised 2026-08-03): be discoverable, but opt
 * OUT of pure model-training scrapes.
 *  • Search index bots (Googlebot, Bingbot, …) — allowed via the default rule (we
 *    NEED search traffic; AdSense needs us crawlable).
 *  • AI answer / retrieval bots — allowed (they cite us and drive traffic).
 *  • AI TRAINING / bulk-scraping bots — disallowed (so our criticism isn't slurped
 *    into model training sets). robots.txt is advisory: reputable crawlers obey it;
 *    it does not stop bad actors or human copy-paste.
 *  Note: blocking training bots does NOT affect Google/Bing search rankings.
 *
 * 2026-08-03 — Google-Extended and Applebot-Extended REMOVED from the block list
 * (owner's call). They are the two tokens where "training" and "answering" are the
 * same switch, so blocking them bought nothing and cost the AI surface:
 *  • Google-Extended gates Gemini and Vertex AI grounding ONLY. Google documents
 *    that it does not affect Googlebot crawling or Search ranking, so it was never
 *    protecting rank — it was only keeping us out of Gemini's answers.
 *  • Applebot-Extended gates Apple Intelligence. Applebot is this site's LARGEST
 *    legitimate crawler by a wide margin (8,690 hits over the measured window,
 *    ~380/day), i.e. the widest AI answer surface currently reading us at all.
 * The rest of the list is unchanged: GPTBot, ClaudeBot, CCBot and friends are
 * training-only and blocking them costs no citation traffic.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://metatake.net";

  // AI/data crawlers that exist to harvest content for model training or resale.
  // NOT here on purpose (see the docblock): Google-Extended and Applebot-Extended,
  // which also gate Gemini and Apple Intelligence ANSWERS, not just training.
  const TRAINING_BOTS = [
    "GPTBot",              // OpenAI training
    "ClaudeBot",           // Anthropic training
    "anthropic-ai",        // Anthropic (legacy)
    "CCBot",               // Common Crawl (feeds many models)
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

  // Crawlers that cost us real database time and send back nothing. Measured
  // 2026-08-01 over mt_crawler_visits (07-11→07-31) against referred visitors in
  // mt_events: each of these walked the catalogue and referred ZERO visitors.
  // Enforced for real in middleware.ts BAD_UA (403) — robots.txt only asks.
  // NOT listed (they earn their crawl): Googlebot, bingbot, DuckDuckBot,
  // Baiduspider, NaverBot, Yandex, OAI-SearchBot, PerplexityBot, and
  // facebookexternalhit (Meta's link-PREVIEW fetcher — distinct from
  // meta-webindexer; blocking it would break shared-link cards).
  const LOAD_PARASITES = [
    "meta-webindexer",       // 9,844 hits — the largest crawler on the site, walking /credits/*
    "SleepBot",              // 1,097
    "SERankingBacklinksBot", // 142 — SEO backlink harvester
    "AwarioBot",             // 112 — social listening
    "AgenstryBot",           // 39
  ];

  // Paths no crawler should index: admin, APIs, the infinite internal-search
  // query space (/search itself — the landing — stays crawlable), and the
  // legacy AI chat shell. Repeated per group because robots.txt groups are
  // exclusive: a bot obeys ONLY its best-matching group, inheriting nothing.
  // "/api/" (with trailing slash) blocks the data endpoints (/api/v1, /api/mcp,
  // /api/pack, …) while leaving the exact "/api" developer landing page
  // crawlable/indexable — it's a public reference + backlink target.
  // /tv/list/* added 2026-08-04: those pages set robots noindex unconditionally
  // (a watch-list is a playlist wrapper, not indexable content), yet they were
  // the single largest source of 504s — 197 in a day. A noindex still has to be
  // fetched to be read; a disallow stops the fetch. Safe here because the cohort
  // has never been indexable, so there is nothing in the index to strand.
  const NOINDEX_PATHS = ["/admin", "/api/", "/search?*", "/ask-ai", "/tv/list/"];

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

      // High-cost, zero-return crawlers — blocked.
      { userAgent: LOAD_PARASITES, disallow: "/" },
    ],
    sitemap: [`${siteUrl}/sitemap.xml`, `${siteUrl}/news-sitemap.xml`],
  };
}
