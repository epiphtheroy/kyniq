#!/usr/bin/env node
/**
 * IndexNow ping script for metatake.net
 *
 * Usage:
 *   node scripts/indexnow-ping.mjs <url> [url ...]
 *   node scripts/indexnow-ping.mjs --sitemap
 *   node scripts/indexnow-ping.mjs --dry-run --sitemap
 *   node scripts/indexnow-ping.mjs --dry-run https://metatake.net/some-page
 */

const KEY = "72623852f17d4eb341d4cd3755d3ba64";
const SITE = "https://metatake.net";
const HOST = new URL(SITE).host;
const KEY_LOCATION = `${SITE}/${KEY}.txt`;
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const BATCH_SIZE = 500; // IndexNow spec: max 10,000, but 500 is a safe batch size

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const useSitemap = args.includes("--sitemap");
const cliUrls = args.filter((a) => !a.startsWith("--"));

async function fetchXmlLocs(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch sitemap: HTTP ${res.status} (${url})`);
  }
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) =>
    m[1].trim()
  );
  return { xml, locs };
}

async function fetchSitemapUrls() {
  const sitemapUrl = `${SITE}/sitemap.xml`;
  console.log(`Fetching sitemap: ${sitemapUrl}`);
  const { xml, locs } = await fetchXmlLocs(sitemapUrl);
  // /sitemap.xml is a sitemapindex: its <loc>s are child sitemaps, not pages.
  if (!xml.includes("<sitemapindex")) return locs;
  const pages = [];
  for (const child of locs) {
    const { locs: childLocs } = await fetchXmlLocs(child);
    console.log(`  ${child}: ${childLocs.length} URLs`);
    pages.push(...childLocs);
  }
  return [...new Set(pages)];
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function main() {
  let urls = [];

  if (useSitemap) {
    urls = await fetchSitemapUrls();
  } else if (cliUrls.length > 0) {
    urls = cliUrls;
  } else {
    console.error(
      "No URLs given. Pass URLs as arguments or use --sitemap.\n" +
        "  node scripts/indexnow-ping.mjs https://metatake.net/page\n" +
        "  node scripts/indexnow-ping.mjs --sitemap"
    );
    process.exit(1);
  }

  // Keep only URLs belonging to our host (IndexNow requires same host)
  const validUrls = urls.filter((u) => {
    try {
      return new URL(u).host === HOST;
    } catch {
      return false;
    }
  });
  const skipped = urls.length - validUrls.length;
  if (skipped > 0) {
    console.warn(`Skipped ${skipped} URL(s) not on host ${HOST}`);
  }
  if (validUrls.length === 0) {
    console.error("No valid URLs to submit.");
    process.exit(1);
  }

  const batches = chunk(validUrls, BATCH_SIZE);
  console.log(
    `Submitting ${validUrls.length} URL(s) in ${batches.length} batch(es)` +
      (dryRun ? " [DRY RUN - nothing will be sent]" : "")
  );

  for (let i = 0; i < batches.length; i++) {
    const body = {
      host: HOST,
      key: KEY,
      keyLocation: KEY_LOCATION,
      urlList: batches[i],
    };

    if (dryRun) {
      console.log(`\n--- Batch ${i + 1}/${batches.length} (dry run) ---`);
      console.log(`POST ${INDEXNOW_ENDPOINT}`);
      console.log(JSON.stringify(body, null, 2));
      continue;
    }

    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    console.log(
      `Batch ${i + 1}/${batches.length}: HTTP ${res.status} ${res.statusText} (${batches[i].length} URLs)`
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (text) console.error(`  Response: ${text}`);
    }
  }

  console.log(dryRun ? "\nDry run complete. Nothing was sent." : "\nDone.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
