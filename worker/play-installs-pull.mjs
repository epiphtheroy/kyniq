#!/usr/bin/env node
/**
 * play-installs-pull — Google Play daily installs → mt_app_downloads (android).
 *
 * The Play Console has no installs API. What it has is a Cloud Storage export:
 * every developer account owns a bucket (gs://pubsite_prod_…) where Google
 * drops monthly CSVs, refreshed daily, one row per day —
 *   stats/installs/installs_<package>_<YYYYMM>_overview.csv
 * This reads that file with the service account the repo already uses for
 * Play (worker/gsc-sa.json — the one eas submit signs with) and upserts the
 * "Daily User Installs" column as kind=download, so /admin/app can print
 * Android next to iOS.
 *
 *   node worker/play-installs-pull.mjs              # this month + last month
 *   node worker/play-installs-pull.mjs --months 3
 *   node worker/play-installs-pull.mjs --probe      # just list the bucket
 *
 * One-time setup (owner, browser, ~2 minutes):
 *   1. Play Console → Download reports → Statistics → "Copy Cloud Storage URI"
 *      → gs://pubsite_prod_rev_XXXXXXXXXXXXXXXXXXXX  → put the bucket name in
 *      .env.local as PLAY_REPORTS_BUCKET=pubsite_prod_rev_XXXXXXXXXXXXXXXXXXXX
 *   2. Play Console → Users and permissions → the service account
 *      (metatake@epiph-test-bot.iam.gserviceaccount.com) → account-level
 *      permission "View app information and download bulk reports (read-only)".
 *      Without it the bucket answers 403.
 *
 * Report semantics: Google's overview CSV is UTF-16LE with a BOM. "Daily User
 * Installs" = users who installed for the first time that day (≈ Apple's
 * first-time download units); "Daily Device Installs" counts every device.
 * Days are in the developer's Play Console time zone. The month file updates
 * daily, so re-pulling is safe (upsert on day/platform/kind).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSign } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const WT = ROOT.match(/^(.*)\/\.claude\/worktrees\/[^/]+$/);
const ENV_ROOTS = WT ? [ROOT, WT[1]] : [ROOT];
const PACKAGE = "net.metatake.app";

for (const root of ENV_ROOTS) {
  try {
    for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const [k, ...rest] = t.split("=");
      const v = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!(k.trim() in process.env)) process.env[k.trim()] = v;
    }
    break;
  } catch { /* try the next root */ }
}
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const BUCKET = (process.env.PLAY_REPORTS_BUCKET || "").replace(/^gs:\/\//, "").replace(/\/.*$/, "");
if (!BUCKET) {
  console.error(
    "Missing PLAY_REPORTS_BUCKET — one-time setup:\n" +
    "  Play Console → Download reports → Statistics → \"Copy Cloud Storage URI\"\n" +
    "  then add PLAY_REPORTS_BUCKET=pubsite_prod_rev_… to .env.local"
  );
  process.exit(1);
}
const SA_PATH = process.env.PLAY_SA_JSON
  || ENV_ROOTS.map((r) => join(r, "worker", "gsc-sa.json")).find((p) => { try { readFileSync(p); return true; } catch { return false; } });
if (!SA_PATH) { console.error("Service account JSON not found (worker/gsc-sa.json or PLAY_SA_JSON)."); process.exit(1); }
const SA = JSON.parse(readFileSync(SA_PATH, "utf8"));

// ── service-account JWT → access token (RS256) ──────────────────────────────
const b64u = (buf) => Buffer.from(buf).toString("base64url");
async function accessToken() {
  const iat = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({
    iss: SA.client_email,
    scope: "https://www.googleapis.com/auth/devstorage.read_only",
    aud: "https://oauth2.googleapis.com/token",
    iat, exp: iat + 600,
  }));
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(SA.private_key);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${head}.${body}.${b64u(sig)}`,
    }),
  });
  if (!r.ok) throw new Error(`token ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).access_token;
}

const GCS = "https://storage.googleapis.com/storage/v1/b";
async function listObjects(token, prefix) {
  const r = await fetch(`${GCS}/${encodeURIComponent(BUCKET)}/o?prefix=${encodeURIComponent(prefix)}&fields=items(name,updated,size)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`list ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return (await r.json()).items ?? [];
}
async function getObject(token, name) {
  const r = await fetch(`${GCS}/${encodeURIComponent(BUCKET)}/o/${encodeURIComponent(name)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`get ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const buf = Buffer.from(await r.arrayBuffer());
  // Google writes these as UTF-16LE with a BOM; fall back to UTF-8 just in case.
  return buf[0] === 0xff && buf[1] === 0xfe ? buf.slice(2).toString("utf16le") : buf.toString("utf8");
}

function parseOverview(csv) {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const cols = lines[0].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const iDate = cols.indexOf("Date");
  const iPkg = cols.indexOf("Package Name");
  const iUser = cols.indexOf("Daily User Installs");
  const iDevice = cols.indexOf("Daily Device Installs");
  const iUpgrade = cols.indexOf("Daily Device Upgrades");
  if (iDate < 0 || iUser < 0) throw new Error(`unexpected columns: ${cols.join(" | ")}`);
  const rows = [];
  for (const line of lines.slice(1)) {
    const f = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (iPkg >= 0 && f[iPkg] !== PACKAGE) continue;
    const day = f[iDate];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    rows.push({ day, platform: "android", kind: "download", units: Number(f[iUser]) || 0 });
    if (iUpgrade >= 0 && Number(f[iUpgrade]) > 0)
      rows.push({ day, platform: "android", kind: "update", units: Number(f[iUpgrade]) || 0 });
    // Device installs ride along as redownload-ish extra devices (device − user).
    if (iDevice >= 0 && Number(f[iDevice]) > Number(f[iUser]))
      rows.push({ day, platform: "android", kind: "redownload", units: Number(f[iDevice]) - (Number(f[iUser]) || 0) });
  }
  return rows;
}

async function upsert(rows) {
  if (!rows.length) return;
  const r = await fetch(`${SB_URL}/rest/v1/mt_app_downloads?on_conflict=day,platform,kind`, {
    method: "POST",
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`upsert failed ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

// ── main ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const months = args.includes("--months") ? Number(args[args.indexOf("--months") + 1]) : 2;
const token = await accessToken();

if (args.includes("--probe")) {
  const items = await listObjects(token, "stats/installs/");
  console.log(`gs://${BUCKET}/stats/installs/ — ${items.length} object(s)`);
  for (const it of items) console.log(`  ${it.name}  ${it.size}B  ${it.updated}`);
  process.exit(0);
}

let wrote = 0;
for (let i = 0; i < months; i++) {
  const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i);
  const ym = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const name = `stats/installs/installs_${PACKAGE}_${ym}_overview.csv`;
  const csv = await getObject(token, name);
  if (!csv) { console.log(`${ym}: no report yet (${name})`); continue; }
  const rows = parseOverview(csv);
  await upsert(rows);
  const dl = rows.filter((r) => r.kind === "download");
  wrote += dl.length;
  console.log(`${ym}: ${dl.length} day(s), ${dl.reduce((s, r) => s + r.units, 0)} user installs`);
}
console.log(`Done — ${wrote} day-row(s) upserted into mt_app_downloads (android).`);
