/**
 * Crawler identification — parse a User-Agent into a stable identity plus the
 * homepage URL the crawler declares about itself (the "+http…" convention that
 * Googlebot, GPTBot, bingbot, CCBot, MetatakeBot, etc. all use).
 *
 * We only ever act on a crawler's OWN self-declared URL — never a reverse-DNS
 * guess and never an arbitrary IP. That keeps the visit-back honest: we go where
 * the bot told the world to go to learn about it.
 */

// The canonical User-Agent our own crawler + visit-back requests carry. Must
// match the scrapers under worker/, hourly/, etc. and resolve to /bot.
export const METATAKE_UA =
  "Mozilla/5.0 (compatible; MetatakeBot/1.0; +https://metatake.net/bot)";

export type CrawlerId = {
  botName: string | null;
  declaredUrl: string | null;
  declaredHost: string | null;
};

// Preferred: the robots.org "+URL" self-reference convention (Googlebot, GPTBot…).
const URL_PLUS_RE = /\+\s*(https?:\/\/[^\s;)"'<>]+)/i;
// Fallback: a bare URL in the UA (e.g. CCBot/2.0 (https://commoncrawl.org/faq/)).
const URL_BARE_RE = /(https?:\/\/[^\s;)"'<>]+)/i;
const NAME_RE = /([\w.-]*(?:bot|crawler|spider|slurp|scraper|crawl))\/?[\d.]*/i;

function normHost(u: string): string | null {
  try {
    return new URL(u).hostname.replace(/^www\./i, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

export function parseCrawler(ua: string): CrawlerId {
  const urlMatch = ua.match(URL_PLUS_RE) ?? ua.match(URL_BARE_RE);
  let declaredUrl = urlMatch ? urlMatch[1].replace(/[.,;]+$/, "") : null;
  let declaredHost = declaredUrl ? normHost(declaredUrl) : null;

  // Never treat ourselves as a foreign crawler to visit back.
  if (declaredHost === "metatake.net") {
    declaredUrl = null;
    declaredHost = null;
  }

  const nameMatch = ua.match(NAME_RE);
  const botName = nameMatch ? nameMatch[1] : null;

  return { botName, declaredUrl, declaredHost };
}

/**
 * Is this UA an identifiable crawler worth observing? True when it either
 * declares a "+http…" URL, matches a bot we already know by name, or simply
 * calls itself a bot in the UA string.
 *
 * That last clause was added 2026-08-09, and it is the whole point of this
 * edit. ShapBot/0.1.0 (Parallel.ai) spent four hours on 2026-08-08 fetching
 * 29,511 distinct pages — the largest crawler this site has ever seen in a day
 * — and left ZERO rows in mt_crawler_visits, because its UA declares no
 * "+http…" URL and its name was in no list we kept. It also runs no JavaScript,
 * so the beacon-fed detector (mt_detect_bots) could not see it either. A new
 * crawler is exactly the one we most need on the record, and "names itself a
 * bot" is the one signal that does not require having heard of it first.
 *
 * Observation only — nothing here blocks. False positives cost a row.
 * Ordinary human browser UAs still return false: no "bot"/"crawler"/"spider"
 * token appears in Chrome, Safari, Firefox, or Edge UA strings.
 */
const KNOWN_BOT =
  /googlebot|bingbot|duckduckbot|yandex|baiduspider|applebot|slurp|Claude-|ChatGPT-User|OAI-SearchBot|PerplexityBot|Amzn-SearchBot|GPTBot|ClaudeBot|CCBot|Bytespider|Diffbot|AhrefsBot|SemrushBot|Amazonbot|cohere-ai|YouBot|facebookexternalhit|metatakebot/i;
// Self-declared automation, whatever its name. Anchored on a word boundary so
// "robot"/"Cubot"-style substrings inside ordinary tokens do not match.
const SELF_DECLARED_BOT = /\b(?:bot|crawler|spider|scraper|fetcher)\b|\w+bot\/[\d.]/i;

export function isObservableCrawler(ua: string): boolean {
  if (!ua) return false;
  return (
    /\+\s*https?:\/\//i.test(ua) || KNOWN_BOT.test(ua) || SELF_DECLARED_BOT.test(ua)
  );
}

/**
 * Infrastructure / hosting hosts we never bother visiting back — a declared URL
 * pointing at raw cloud infra has no human operator whose log would matter.
 */
const INFRA_HOST =
  /(^|\.)(amazonaws\.com|cloudfront\.net|googleusercontent\.com|1e100\.net|akamai(hd|edge|tech)?\.net|fastly\.net|azurewebsites\.net|herokuapp\.com|vercel\.app|netlify\.app|digitaloceanspaces\.com|linodeobjects\.com)$/i;

export function isVisitableHost(host: string | null): boolean {
  if (!host) return false;
  if (host === "metatake.net") return false;
  if (INFRA_HOST.test(host)) return false;
  return true;
}
