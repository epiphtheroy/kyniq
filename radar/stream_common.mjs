// Keyword Radar — shared plumbing for the Node stream consumers (정본 HANDOFF §7).
// .env.local loader, service-role Supabase REST, URL normalize/hash, the
// items+hits writer, and a keyword→Matcher loader that refreshes every 10 min.
// Stdlib/Node-only (no npm install): Node 22 has global fetch + WebSocket.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Matcher } from "./matcher.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);

export function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(join(REPO, ".env.local"), "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* .env.local optional */ }
  return env;
}

const TRACKING = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "igsh", "gclid", "mc_cid", "mc_eid",
]);

export function normalizeUrl(u) {
  try {
    const url = new URL(u.trim());
    url.hash = "";
    url.host = url.host.toLowerCase();
    for (const k of [...url.searchParams.keys()]) {
      if (TRACKING.has(k.toLowerCase())) url.searchParams.delete(k);
    }
    url.searchParams.sort();
    let s = url.toString();
    if (s.endsWith("/") && url.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch { return (u || "").trim(); }
}

export function urlHash(u) {
  return createHash("sha256").update(normalizeUrl(u)).digest("hex");
}

export function log(msg) {
  console.log(`[${new Date().toISOString().replace(/\.\d+Z$/, "Z")}] ${msg}`);
}

// ── Supabase REST (service role — radar_* has no RLS) ──
// A non-browser User-Agent is REQUIRED: sb_secret_* keys 401 with a browser-like
// UA ("Forbidden use of secret API key in browser"). Node fetch defaults are
// fine, but set it explicitly so this never regresses.
function sbHeaders(env, extra) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json",
    "User-Agent": "metatake-radar/1.0", ...(extra || {}),
  };
}

export async function sbGet(env, path) {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders(env) });
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}

async function sbPost(env, table, rows, { onConflict, ignore, representation } = {}) {
  const q = onConflict ? `?on_conflict=${onConflict}` : "";
  const prefer = [];
  if (ignore) prefer.push("resolution=ignore-duplicates");
  prefer.push(representation ? "return=representation" : "return=minimal");
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}${q}`, {
    method: "POST", headers: sbHeaders(env, { Prefer: prefer.join(",") }),
    body: JSON.stringify(rows),
  });
  if (!r.ok) { log(`sbPost ${table} -> HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`); return null; }
  if (representation) { try { return await r.json(); } catch { return null; } }
  return true;
}

// ── keyword loading + refresh ──
export async function loadKeywords(env) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const batch = await sbGet(env,
      `radar_keywords?select=id,keyword,match_text,norm,aliases,require_context,tier` +
      `&active=is.true&order=id&limit=1000&offset=${offset}`);
    if (!Array.isArray(batch) || !batch.length) break;
    rows.push(...batch);
    if (batch.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

export async function makeMatcherRefresher(env, everyMs = 600000) {
  let matcher = new Matcher(await loadKeywords(env));
  const timer = setInterval(async () => {
    try {
      const kws = await loadKeywords(env);
      if (kws.length) { matcher = new Matcher(kws); log(`keywords reloaded: ${kws.length}`); }
    } catch (e) { log(`keyword reload failed: ${e.message}`); }
  }, everyMs);
  timer.unref?.();
  return { get: () => matcher };
}

// ── items + hits writer (mirror of common.upsert_items) ──
export async function upsertItems(env, items) {
  if (!items.length) return { seen: 0, hits: 0 };
  const byHash = new Map();
  for (const it of items) {
    const h = it.url_hash;
    if (byHash.has(h)) {
      for (const k of it._kw) byHash.get(h)._kw.add(k);
    } else {
      it._kw = it._kw || new Set();
      byHash.set(h, it);
    }
  }
  const batch = [...byHash.values()];
  const rows = batch.map((it) => {
    const o = {}; for (const k of Object.keys(it)) if (!k.startsWith("_")) o[k] = it[k]; return o;
  });
  const rep = await sbPost(env, "radar_items", rows,
    { onConflict: "url_hash", ignore: true, representation: true });
  if (rep === null) return { seen: 0, hits: 0 };

  const idByHash = new Map();
  const hashes = batch.map((it) => it.url_hash);
  for (let i = 0; i < hashes.length; i += 60) {
    const chunk = hashes.slice(i, i + 60);
    const got = await sbGet(env, `radar_items?select=id,url_hash&url_hash=in.(${chunk.join(",")})`);
    for (const r of got || []) idByHash.set(r.url_hash, r.id);
  }
  const hits = [];
  for (const it of batch) {
    const iid = idByHash.get(it.url_hash);
    if (!iid) continue;
    for (const kid of it._kw) hits.push({ item_id: iid, keyword_id: kid, matched_on: "text" });
  }
  if (hits.length) await sbPost(env, "radar_hits", hits, { onConflict: "item_id,keyword_id", ignore: true });
  return { seen: batch.length, hits: hits.length };
}

export async function recordRun(env, engine, { seen = 0, hits = 0, errors = [] } = {}) {
  await sbPost(env, "radar_runs", {
    engine, finished_at: new Date().toISOString(), items_seen: seen, hits, errors,
  });
}
