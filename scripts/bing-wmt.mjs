#!/usr/bin/env node
/**
 * Bing Webmaster Tools daily report for metatake.net.
 *
 * The Search Performance and Crawl Information panels that used to need an
 * owner login (Microsoft OAuth — no agent can get in) are both reachable with
 * the Webmaster API key. Key lives in .env.local (gitignored), issued from
 * WMT > Settings > API access.
 *
 * Usage:
 *   node scripts/bing-wmt.mjs            # last 14 days
 *   node scripts/bing-wmt.mjs --days 30
 *   node scripts/bing-wmt.mjs --json     # raw rows, for piping
 *
 * Read the two series together. Impressions falling while InIndex keeps
 * climbing means Bing still holds the documents and has stopped serving them
 * (suppression); impressions and InIndex falling together means the pages are
 * leaving the index. The remedies are opposite, so never read one alone.
 */

import { readFileSync } from "node:fs";

const SITE = "https://metatake.net/"; // must match GetUserSites exactly, trailing slash included
const API = "https://ssl.bing.com/webmaster/api.svc/json";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const days = Number(args[args.indexOf("--days") + 1]) || 14;

function apiKey() {
  if (process.env.BING_WEBMASTER_API_KEY) return process.env.BING_WEBMASTER_API_KEY;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const m = env.match(/^BING_WEBMASTER_API_KEY=(.+)$/m);
  if (!m) throw new Error("BING_WEBMASTER_API_KEY not found in env or .env.local");
  return m[1].trim();
}

// Bing serializes dates as /Date(1788418800000-0700)/ — epoch ms plus a PT
// offset that is already baked into the value, so ignore the offset.
function bingDate(s) {
  const m = /\/Date\((-?\d+)/.exec(s ?? "");
  return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : String(s);
}

async function get(method) {
  const url = `${API}/${method}?apikey=${encodeURIComponent(apiKey())}&siteUrl=${encodeURIComponent(SITE)}`;
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok || body.ErrorCode) {
    throw new Error(`${method}: HTTP ${res.status} ${body.Message ?? ""}`);
  }
  return body.d;
}

function byDate(rows) {
  const out = new Map();
  for (const r of rows) out.set(bingDate(r.Date), r);
  return out;
}

const [traffic, crawl] = await Promise.all([
  get("GetRankAndTrafficStats"),
  get("GetCrawlStats"),
]);

const t = byDate(traffic);
const c = byDate(crawl);
const dates = [...new Set([...t.keys(), ...c.keys()])].sort().slice(-days);

if (asJson) {
  console.log(
    JSON.stringify(
      dates.map((d) => ({ date: d, traffic: t.get(d) ?? null, crawl: c.get(d) ?? null })),
      null,
      2
    )
  );
} else {
  const pad = (v, w) => String(v ?? "-").padStart(w);
  console.log(`Bing Webmaster — ${SITE} (dates are Bing's, Pacific Time)\n`);
  console.log(
    "date         impr  clicks   ctr%  crawled  errors    4xx    5xx  robots  inIndex"
  );
  for (const d of dates) {
    const x = t.get(d);
    const y = c.get(d) ?? {};
    // A missing traffic row is Bing's 2-3 day reporting lag, not a zero day.
    // Printing it as 0 would invent a collapse, so keep the two apart.
    const imp = x?.Impressions;
    const clk = x?.Clicks;
    console.log(
      [
        d.padEnd(11),
        pad(imp, 6),
        pad(clk, 7),
        pad(imp ? ((100 * clk) / imp).toFixed(1) : x ? "0.0" : "-", 6),
        pad(y.CrawledPages, 8),
        pad(y.CrawlErrors, 7),
        pad(y.Code4xx, 6),
        pad(y.Code5xx, 6),
        pad(y.BlockedByRobotsTxt, 7),
        pad(y.InIndex, 8),
      ].join("")
    );
  }
  const blocked = await get("GetBlockedUrls");
  const issues = await get("GetCrawlIssues");
  const links = await get("GetLinkCounts");
  console.log(
    `\nblocked URLs: ${blocked.length}   crawl issues: ${issues.length}   ` +
      `inbound link sources known to Bing: ${links.Links?.length ?? 0}`
  );
}
