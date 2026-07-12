// Keyword Radar — Mastodon fedi.buzz SSE consumer (정본 HANDOFF §6.1-G).
// Resident process: reads the public fediverse-wide SSE firehose (no auth),
// strips HTML, matches every status against all keywords locally, batch-upserts
// hits. brid.gy-bridged Bluesky posts are deduped by url_hash automatically.
// Node 22 global fetch streams the SSE body. Started by radar-watch.sh.
//
//   ~/.local/node/bin/node radar/ingest_fedibuzz.mjs

import { loadEnv, log, makeMatcherRefresher, recordRun, upsertItems, urlHash } from "./stream_common.mjs";

const SSE_URL = "https://fedi.buzz/api/v1/streaming/public";
const FLUSH_EVERY = 30;
const FLUSH_INTERVAL = 5000;
const TAG = /<[^>]+>/g;

const env = loadEnv();
const matcher = await makeMatcherRefresher(env);

let pending = [];
let seenTotal = 0, hitTotal = 0;

function stripHtml(s) {
  return (s || "").replace(TAG, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();
}

async function flush() {
  if (!pending.length) return;
  const batch = pending; pending = [];
  try {
    const { seen, hits } = await upsertItems(env, batch);
    seenTotal += seen; hitTotal += hits;
    if (seen) log(`fedibuzz: +${seen} items / +${hits} hits (session ${seenTotal}/${hitTotal})`);
  } catch (e) { log(`fedibuzz flush error: ${e.message}`); }
}
setInterval(flush, FLUSH_INTERVAL).unref?.();
setInterval(() => recordRun(env, "fedibuzz", { seen: seenTotal, hits: hitTotal }).catch(() => {}), 3600000).unref?.();

function handleStatus(s) {
  const url = s.url || s.uri;
  const text = stripHtml(s.content);
  if (!url || !text) return;
  const kws = matcher.get().match(text);
  if (!kws.size) return;
  const acct = s.account || {};
  pending.push({
    url, url_hash: urlHash(url), platform: "mastodon",
    author: acct.acct || acct.username || null, author_url: acct.url || null,
    title: text.slice(0, 140), snippet: text.slice(0, 300),
    content_text: text.slice(0, 3000), published_at: s.created_at || null,
    meta: { status_id: s.id }, _kw: kws,
  });
  if (pending.length >= FLUSH_EVERY) flush();
}

async function stream() {
  for (;;) {
    try {
      log("fedibuzz: connecting SSE");
      const res = await fetch(SSE_URL, { headers: { Accept: "text/event-stream" } });
      if (!res.ok || !res.body) { log(`fedibuzz: HTTP ${res.status}, retry in 5s`); await sleep(5000); continue; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx); buf = buf.slice(idx + 2);
          if (!frame.includes("event: update")) continue;
          const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          try { handleStatus(JSON.parse(dataLine.slice(5).trim())); } catch { /* skip */ }
        }
      }
      log("fedibuzz: stream ended, reconnecting in 5s");
    } catch (e) {
      log(`fedibuzz: ${e.message}, retry in 5s`);
    }
    await sleep(5000);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
process.on("SIGTERM", () => flush().finally(() => process.exit(0)));
process.on("SIGINT", () => flush().finally(() => process.exit(0)));

log("fedibuzz: starting");
stream();
