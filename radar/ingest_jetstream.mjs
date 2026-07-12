// Keyword Radar — Bluesky Jetstream consumer (정본 HANDOFF §6.1-A).
// Resident process: connects to the public Jetstream firehose (no auth),
// matches every post against all keywords locally, batch-upserts hits to
// Supabase. Reconnects with the last cursor − 5s (24h replay window). Node 22
// has global WebSocket; no npm install. Started by radar-watch.sh.
//
//   ~/.local/node/bin/node radar/ingest_jetstream.mjs

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnv, log, makeMatcherRefresher, recordRun, upsertItems, urlHash } from "./stream_common.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(HERE, "state");
try { mkdirSync(STATE_DIR, { recursive: true }); } catch { /* exists */ }
const CURSOR_FILE = join(STATE_DIR, ".jetstream_cursor");
const INSTANCES = [
  "wss://jetstream2.us-east.bsky.network", "wss://jetstream1.us-east.bsky.network",
  "wss://jetstream2.us-west.bsky.network", "wss://jetstream1.us-west.bsky.network",
];
const FLUSH_EVERY = 50;      // items
const FLUSH_INTERVAL = 5000; // ms

const env = loadEnv();
const matcher = await makeMatcherRefresher(env);

let pending = [];
let seenTotal = 0, hitTotal = 0;
let lastCursor = readCursor();
let instIdx = 0;

function readCursor() {
  try { return parseInt(readFileSync(CURSOR_FILE, "utf8").trim(), 10) || 0; } catch { return 0; }
}
function saveCursor(us) {
  try { writeFileSync(CURSOR_FILE, String(us)); } catch { /* best effort */ }
}

// DID → {handle, name} via the public AppView (no auth), cached in-process.
const profileCache = new Map();
async function resolveProfile(did) {
  const hit = profileCache.get(did);
  if (hit) return hit;
  let p = { handle: did, name: null };
  try {
    const r = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
      { headers: { "User-Agent": "metatake-radar/1.0" }, signal: AbortSignal.timeout(6000) });
    if (r.ok) { const j = await r.json(); p = { handle: j.handle || did, name: j.displayName || j.handle || null }; }
  } catch { /* fall back to did */ }
  if (profileCache.size > 5000) profileCache.clear();  // bound memory
  profileCache.set(did, p);
  return p;
}

async function flush() {
  if (!pending.length) return;
  const batch = pending; pending = [];
  try {
    const { seen, hits } = await upsertItems(env, batch);
    seenTotal += seen; hitTotal += hits;
    if (seen) log(`jetstream: +${seen} items / +${hits} hits (session ${seenTotal}/${hitTotal})`);
  } catch (e) { log(`jetstream flush error: ${e.message}`); }
}
setInterval(flush, FLUSH_INTERVAL).unref?.();
setInterval(() => recordRun(env, "jetstream", { seen: seenTotal, hits: hitTotal }).catch(() => {}), 3600000).unref?.();

function connect() {
  const base = INSTANCES[instIdx % INSTANCES.length];
  // rewind 5s to avoid gaps on reconnect (cursor is unix microseconds)
  const cursorParam = lastCursor ? `&cursor=${Math.max(0, lastCursor - 5_000_000)}` : "";
  const url = `${base}/subscribe?wantedCollections=app.bsky.feed.post${cursorParam}`;
  log(`jetstream: connecting ${base}${lastCursor ? " (replay -5s)" : ""}`);
  const ws = new WebSocket(url);

  ws.addEventListener("message", (ev) => {
    let e; try { e = JSON.parse(ev.data); } catch { return; }
    if (e.time_us) lastCursor = e.time_us;
    const c = e.commit;
    if (!c || c.operation !== "create" || c.collection !== "app.bsky.feed.post") return;
    const text = c.record?.text;
    if (!text) return;
    const kws = matcher.get().match(text);
    if (!kws.size) return;
    const url2 = `https://bsky.app/profile/${e.did}/post/${c.rkey}`;
    // resolve DID → readable handle/name so the feed shows WHO to engage, not a
    // did:plc: string (matches are rare, so one cached lookup each is cheap).
    resolveProfile(e.did).then((p) => {
      pending.push({
        url: url2, url_hash: urlHash(url2), platform: "bluesky",
        author: p.name || p.handle, author_url: `https://bsky.app/profile/${p.handle}`,
        title: text.slice(0, 140), snippet: text.slice(0, 300),
        content_text: text.slice(0, 3000),
        published_at: c.record?.createdAt || null,
        author_kind: "individual",  // Bluesky posts are always a person
        meta: { did: e.did, handle: p.handle, rkey: c.rkey }, _kw: kws,
      });
      if (pending.length >= FLUSH_EVERY) flush();
    });
  });

  ws.addEventListener("close", () => { saveCursor(lastCursor); scheduleReconnect("close"); });
  ws.addEventListener("error", (e) => { log(`jetstream ws error: ${e.message || "?"}`); try { ws.close(); } catch {} });
}

let reconnecting = false;
function scheduleReconnect(why) {
  if (reconnecting) return;
  reconnecting = true;
  instIdx++; // rotate instance on failure
  const delay = 3000;
  log(`jetstream: reconnecting in ${delay}ms (${why})`);
  setTimeout(() => { reconnecting = false; connect(); }, delay);
}

process.on("SIGTERM", () => { saveCursor(lastCursor); flush().finally(() => process.exit(0)); });
process.on("SIGINT", () => { saveCursor(lastCursor); flush().finally(() => process.exit(0)); });
setInterval(() => saveCursor(lastCursor), 30000).unref?.();

log(`jetstream: starting (keywords loaded, cursor ${lastCursor || "live"})`);
connect();
